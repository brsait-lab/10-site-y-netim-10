import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, sitesTable } from "@workspace/db";
import {
  signToken,
  hashPassword,
  comparePassword,
  generateId,
} from "../lib/auth.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { Request, Response } from "express";

const router = Router();

function toUserDto(u: typeof usersTable.$inferSelect) {
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

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));

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
    res
      .status(401)
      .json({ message: "Hesabınız henüz onaylanmadı. Yönetici onayı bekleniyor." });
    return;
  }
  if (user.status === "rejected") {
    res
      .status(401)
      .json({ message: "Hesabınız reddedildi. Lütfen yöneticinizle iletişime geçin." });
    return;
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    siteId: user.siteId,
    email: user.email,
  });

  res.json({ user: toUserDto(user), token });
});

router.post("/auth/register", async (req: Request, res: Response) => {
  const data = req.body as {
    name: string;
    email: string;
    password: string;
    role: string;
    phone: string;
    siteId?: string;
    siteName?: string;
    siteAddress?: string;
    unitNo?: string;
    plates?: string[];
    businessName?: string;
    businessCategory?: string;
    businessDescription?: string;
    businessAddress?: string;
    latitude?: number;
    longitude?: number;
  };

  const { name, email, password, role, phone } = data;
  if (!name || !email || !password || !role || !phone) {
    res.status(400).json({ success: false, message: "Zorunlu alanlar eksik." });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));

  if (existing) {
    res.json({ success: false, message: "Bu e-posta adresi zaten kayıtlı." });
    return;
  }

  const passwordHash = await hashPassword(password);
  let siteId = data.siteId ?? "";
  let autoLogin = false;

  if (role === "admin") {
    if (!data.siteName) {
      res.json({ success: false, message: "Site adı gereklidir." });
      return;
    }
    const [siteExists] = await db
      .select({ id: sitesTable.id })
      .from(sitesTable)
      .where(eq(sitesTable.name, data.siteName));

    if (siteExists) {
      res.json({ success: false, message: "Bu site adı zaten mevcut." });
      return;
    }

    const newSiteId = generateId();
    const userId = generateId();

    await db.insert(sitesTable).values({
      id: newSiteId,
      name: data.siteName,
      address: data.siteAddress ?? "",
      adminId: userId,
    });

    await db.insert(usersTable).values({
      id: userId,
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: "admin",
      siteId: newSiteId,
      status: "active",
      phone,
    });

    const [newUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const token = signToken({
      userId,
      role: "admin",
      siteId: newSiteId,
      email: email.toLowerCase(),
    });

    res.json({
      success: true,
      message: "Hesap oluşturuldu.",
      user: toUserDto(newUser!),
      token,
    });
    return;
  }

  if (role !== "merchant" && !siteId) {
    res.json({ success: false, message: "Lütfen bir site seçin." });
    return;
  }

  const status =
    role === "security" || role === "merchant" ? "active" : "pending";
  autoLogin = status === "active";

  const userId = generateId();
  await db.insert(usersTable).values({
    id: userId,
    name,
    email: email.toLowerCase(),
    passwordHash,
    role,
    siteId: siteId || "global",
    status,
    phone,
    unitNo: data.unitNo,
    plates: data.plates,
    businessName: data.businessName,
    businessCategory: data.businessCategory,
    businessDescription: data.businessDescription,
    businessAddress: data.businessAddress,
    latitude: data.latitude,
    longitude: data.longitude,
  });

  if (autoLogin) {
    const [newUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const token = signToken({
      userId,
      role,
      siteId: siteId || "global",
      email: email.toLowerCase(),
    });

    res.json({
      success: true,
      message: "Kayıt başarılı.",
      user: toUserDto(newUser!),
      token,
    });
    return;
  }

  res.json({
    success: true,
    message: "Kayıt talebiniz alındı. Yönetici onayı bekleniyor.",
  });
});

router.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).authUser;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ message: "Kullanıcı bulunamadı." });
    return;
  }
  res.json(toUserDto(user));
});

export { toUserDto };
export default router;
