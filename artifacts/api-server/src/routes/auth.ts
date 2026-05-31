import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import {
  signToken,
  hashPassword,
  comparePassword,
} from "../lib/auth.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import type { User } from "@prisma/client";

const router = Router();

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
    plates: u.plates ?? undefined,
    businessName: u.businessName ?? undefined,
    businessCategory: u.businessCategory ?? undefined,
    businessDescription: u.businessDescription ?? undefined,
    businessAddress: u.businessAddress ?? undefined,
    latitude: u.latitude ?? undefined,
    longitude: u.longitude ?? undefined,
    createdAt: u.createdAt.toISOString(),
  };
}

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

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user || user.role !== role) {
    res.status(401).json({ message: "E-posta, şifre veya rol hatalı." });
    return;
  }

  const match = await comparePassword(password, user.passwordHash);
  if (!match) {
    res.status(401).json({ message: "E-posta, şifre veya rol hatalı." });
    return;
  }

  if (user.status === "pending") {
    res.status(401).json({ message: "Hesabınız henüz onaylanmadı. Yönetici onayı bekleniyor." });
    return;
  }
  if (user.status === "rejected") {
    res.status(401).json({ message: "Hesabınız reddedildi. Lütfen yöneticinizle iletişime geçin." });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role, siteId: user.siteId, email: user.email });
  res.json({ user: toUserDto(user), token });
});

router.post("/auth/register", async (req: Request, res: Response) => {
  const data = req.body as {
    name: string; email: string; password: string; role: string; phone: string;
    siteId?: string; siteName?: string; siteAddress?: string;
    unitNo?: string; plates?: string[];
    businessName?: string; businessCategory?: string;
    businessDescription?: string; businessAddress?: string;
    latitude?: number; longitude?: number;
  };

  const { name, email, password, role, phone } = data;
  if (!name || !email || !password || !role || !phone) {
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

    const site = await prisma.site.create({
      data: { name: data.siteName, address: data.siteAddress ?? "", adminId: "" },
    });
    const user = await prisma.user.create({
      data: { name, email: email.toLowerCase(), passwordHash, role: "admin", siteId: site.id, status: "active", phone },
    });
    await prisma.site.update({ where: { id: site.id }, data: { adminId: user.id } });

    const token = signToken({ userId: user.id, role: "admin", siteId: site.id, email: user.email });
    res.json({ success: true, message: "Hesap oluşturuldu.", user: toUserDto(user), token });
    return;
  }

  if (role !== "merchant" && !data.siteId) {
    res.json({ success: false, message: "Lütfen bir site seçin." });
    return;
  }

  const status = role === "security" || role === "merchant" ? "active" : "pending";
  const user = await prisma.user.create({
    data: {
      name, email: email.toLowerCase(), passwordHash, role,
      siteId: data.siteId || "global", status, phone,
      unitNo: data.unitNo, plates: data.plates ?? [],
      businessName: data.businessName, businessCategory: data.businessCategory,
      businessDescription: data.businessDescription, businessAddress: data.businessAddress,
      latitude: data.latitude, longitude: data.longitude,
    },
  });

  if (status === "active") {
    const token = signToken({ userId: user.id, role, siteId: user.siteId, email: user.email });
    res.json({ success: true, message: "Kayıt başarılı.", user: toUserDto(user), token });
    return;
  }

  res.json({ success: true, message: "Kayıt talebiniz alındı. Yönetici onayı bekleniyor." });
});

router.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).authUser;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ message: "Kullanıcı bulunamadı." }); return; }
  res.json(toUserDto(user));
});

export default router;
