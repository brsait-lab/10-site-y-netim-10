import { Router, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import {
  signToken,
  hashPassword,
  comparePassword,
} from "../lib/auth.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import type { User } from "@prisma/client";

const router = Router();

const REFRESH_TOKEN_BYTES = 64;
const REFRESH_TOKEN_TTL_DAYS = 30;

function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
}

function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return d;
}

async function issueTokenPair(user: User): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signToken({
    userId: user.id,
    role: user.role,
    siteId: user.siteId,
    email: user.email,
    sessionVersion: user.sessionVersion,
  });

  const rawToken = generateRefreshToken();
  const family = randomBytes(16).toString("hex");

  await prisma.refreshToken.create({
    data: {
      token: rawToken,
      userId: user.id,
      family,
      expiresAt: refreshTokenExpiresAt(),
    },
  });

  return { accessToken, refreshToken: rawToken };
}

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createUniqueJoinCode(): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const code = generateJoinCode();
    const exists = await prisma.site.findFirst({ where: { joinCode: code } });
    if (!exists) return code;
  }
  return generateJoinCode() + Date.now().toString(36).slice(-2).toUpperCase();
}

export function toUserDto(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    siteId: u.siteId,
    status: u.status,
    phone: u.phone,
    unitNo: u.unitNo ?? undefined,
    block: u.block ?? undefined,
    tower: u.tower ?? undefined,
    villaNo: u.villaNo ?? undefined,
    floor: u.floor ?? undefined,
    officeNo: u.officeNo ?? undefined,
    plates: u.plates ?? undefined,
    businessName: u.businessName ?? undefined,
    businessCategory: u.businessCategory ?? undefined,
    businessDescription: u.businessDescription ?? undefined,
    businessAddress: u.businessAddress ?? undefined,
    businessHours: u.businessHours ?? undefined,
    latitude: u.latitude ?? undefined,
    longitude: u.longitude ?? undefined,
    consentGiven: u.consentGiven,
    consentAt: u.consentAt?.toISOString() ?? undefined,
    consentVersion: u.consentVersion ?? undefined,
    createdAt: u.createdAt.toISOString(),
  };
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password, role } = req.body as {
    email: string;
    password: string;
    role: string;
  };
  if (!email || !password || !role) {
    res.status(400).json({ message: "E-posta, şifre ve rol zorunludur." });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user || user.role !== role) {
    res.status(401).json({ message: "E-posta, şifre veya rol hatalı." });
    return;
  }

  const match = await comparePassword(password, user.passwordHash);
  if (!match) {
    res.status(401).json({ message: "E-posta, şifre veya rol hatalı." });
    return;
  }

  if (user.deletedAt) {
    res.status(401).json({ message: "Bu hesap silinmiştir. Yöneticinizle iletişime geçin." });
    return;
  }
  if (user.status === "pending") {
    res.status(401).json({ message: "Hesabınız henüz onaylanmadı." });
    return;
  }
  if (user.status === "rejected") {
    res.status(401).json({ message: "Hesabınız reddedildi. Lütfen yöneticinizle iletişime geçin." });
    return;
  }

  const { accessToken, refreshToken } = await issueTokenPair(user);
  res.json({ user: toUserDto(user), token: accessToken, accessToken, refreshToken });
});

// ─── REFRESH ──────────────────────────────────────────────────────────────────
// POST /auth/refresh — exchange a valid refresh token for a new access+refresh pair
router.post("/auth/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ message: "refreshToken zorunludur." });
    return;
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!stored) {
    res.status(401).json({ message: "Geçersiz refresh token." });
    return;
  }

  // Detect revoked token — possible reuse attack: revoke entire family
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { family: stored.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.status(401).json({ message: "Refresh token iptal edilmiş. Lütfen tekrar giriş yapın." });
    return;
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    res.status(401).json({ message: "Refresh token süresi dolmuş. Lütfen tekrar giriş yapın." });
    return;
  }

  const user = stored.user;
  if (user.deletedAt || user.status === "rejected") {
    res.status(401).json({ message: "Hesap erişimi kaldırılmış." });
    return;
  }

  // Revoke the old token (rotation)
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  // Issue new pair, preserve family for rotation chain tracking
  const newAccessToken = signToken({
    userId: user.id,
    role: user.role,
    siteId: user.siteId,
    email: user.email,
    sessionVersion: user.sessionVersion,
  });

  const newRawToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      token: newRawToken,
      userId: user.id,
      family: stored.family,
      expiresAt: refreshTokenExpiresAt(),
    },
  });

  res.json({
    accessToken: newAccessToken,
    token: newAccessToken,
    refreshToken: newRawToken,
    user: toUserDto(user),
  });
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
// POST /auth/logout — revoke a specific refresh token
router.post("/auth/logout", async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.json({ message: "Çıkış yapıldı." });
});

// ─── LOGOUT ALL ───────────────────────────────────────────────────────────────
// POST /auth/logout-all — invalidate all sessions (bump sessionVersion + revoke all refresh tokens)
router.post("/auth/logout-all", requireAuth, async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).authUser;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  res.json({ message: "Tüm oturumlar sonlandırıldı." });
});

// ─── REGISTER ─────────────────────────────────────────────────────────────────
router.post("/auth/register", async (req: Request, res: Response) => {
  const data = req.body as {
    name: string;
    email: string;
    password: string;
    role: string;
    phone: string;
    siteName?: string;
    siteAddress?: string;
    settlementType?: string;
    joinCode?: string;
    unitNo?: string;
    block?: string;
    tower?: string;
    villaNo?: string;
    floor?: string;
    officeNo?: string;
    plates?: string[];
    businessName?: string;
    businessCategory?: string;
    businessDescription?: string;
    businessAddress?: string;
    latitude?: number;
    longitude?: number;
  };

  const { name, email, password, role, phone } = data;
  if (!name || !email || !password || !role) {
    res.status(400).json({ success: false, message: "Zorunlu alanlar eksik." });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    res.json({ success: false, message: "Bu e-posta adresi zaten kayıtlı." });
    return;
  }

  const passwordHash = await hashPassword(password);

  if (role === "admin") {
    if (!data.siteName) {
      res.json({ success: false, message: "Site adı gereklidir." });
      return;
    }
    const siteExists = await prisma.site.findFirst({ where: { name: data.siteName } });
    if (siteExists) {
      res.json({ success: false, message: "Bu site adı zaten mevcut." });
      return;
    }

    const joinCode = await createUniqueJoinCode();
    const site = await prisma.site.create({
      data: {
        name: data.siteName,
        address: data.siteAddress ?? "",
        adminId: "",
        joinCode,
        settlementType: data.settlementType ?? "site",
      },
    });
    const user = await prisma.user.create({
      data: {
        name, email: email.toLowerCase(), passwordHash,
        role: "admin", siteId: site.id, status: "active", phone,
      },
    });
    await prisma.site.update({ where: { id: site.id }, data: { adminId: user.id } });

    const { accessToken, refreshToken } = await issueTokenPair(user);
    res.json({ success: true, message: "Hesap oluşturuldu.", user: toUserDto(user), token: accessToken, accessToken, refreshToken });
    return;
  }

  if (role === "merchant") {
    const user = await prisma.user.create({
      data: {
        name, email: email.toLowerCase(), passwordHash,
        role: "merchant", siteId: "global", status: "active", phone,
        businessName: data.businessName,
        businessCategory: data.businessCategory,
        businessDescription: data.businessDescription,
        businessAddress: data.businessAddress,
        latitude: data.latitude,
        longitude: data.longitude,
        plates: data.plates ?? [],
      },
    });
    const { accessToken, refreshToken } = await issueTokenPair(user);
    res.json({ success: true, message: "Kayıt başarılı.", user: toUserDto(user), token: accessToken, accessToken, refreshToken });
    return;
  }

  if (!data.joinCode) {
    res.json({ success: false, message: "Katılım kodu (Join Code) gereklidir." });
    return;
  }

  const site = await prisma.site.findFirst({
    where: { joinCode: data.joinCode.toUpperCase().trim() },
  });
  if (!site) {
    res.json({ success: false, message: "Geçersiz katılım kodu. Yöneticinizden kodu alın." });
    return;
  }

  if (role === "resident") {
    const st = site.settlementType;
    if ((st === "villa") && !data.villaNo) {
      res.json({ success: false, message: "Villa numarası zorunludur." });
      return;
    }
    if ((st === "plaza" || st === "is_merkezi") && !data.officeNo) {
      res.json({ success: false, message: "Ofis numarası zorunludur." });
      return;
    }
    if (st !== "villa" && st !== "plaza" && st !== "is_merkezi" && !data.unitNo) {
      res.json({ success: false, message: "Daire numarası zorunludur." });
      return;
    }
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      siteId: site.id,
      status: "active",
      phone,
      unitNo: data.unitNo,
      block: data.block,
      tower: data.tower,
      villaNo: data.villaNo,
      floor: data.floor,
      officeNo: data.officeNo,
      plates: data.plates ?? [],
    },
  });

  const { accessToken, refreshToken } = await issueTokenPair(user);
  res.json({
    success: true,
    message: "Kayıt başarılı. Anında giriş yapabilirsiniz.",
    user: toUserDto(user),
    token: accessToken,
    accessToken,
    refreshToken,
  });
});

// ─── ME ───────────────────────────────────────────────────────────────────────
router.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).authUser;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) {
    res.status(404).json({ message: "Kullanıcı bulunamadı." });
    return;
  }
  res.json(toUserDto(user));
});

export default router;
