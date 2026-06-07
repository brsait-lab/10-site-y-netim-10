import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";
import { toUserDto } from "./auth.js";

const router = Router();

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

// ── Ortak audit log yardımcısı ────────────────────────────────────────────────
async function addUserAuditLog(params: {
  siteId: string; action: string; performedBy: string; note?: string;
}) {
  const actor = await prisma.user.findUnique({ where: { id: params.performedBy }, select: { name: true } });
  await prisma.paymentAuditLog.create({
    data: {
      siteId: params.siteId,
      paymentId: null,
      userPaymentId: null,
      action: params.action,
      performedBy: params.performedBy,
      performedByName: actor?.name ?? "Bilinmiyor",
      note: params.note ?? null,
    },
  });
}

// ── GET /users ────────────────────────────────────────────────────────────────
// GÜVENLİK: querySiteId her zaman token'dan alınır — kullanıcı override edemez.
router.get("/users", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { siteId, role } = (req as AuthRequest).authUser;

  const rawLimit = parseInt((req.query["limit"] as string) ?? "", 10);
  const rawOffset = parseInt((req.query["offset"] as string) ?? "0", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  const roleFilter = (req.query["role"] as string) ?? null;

  // Admins can query global merchants (siteId="global") via ?role=merchant
  const whereClause =
    roleFilter === "merchant" && role === "admin"
      ? { role: "merchant" as const, deletedAt: null }
      : { siteId, deletedAt: null };

  const users = await prisma.user.findMany({
    where: whereClause,
    take: limit,
    skip: offset,
  });
  res.json(users.map(toUserDto));
});

// ── GET /users/:id ────────────────────────────────────────────────────────────
router.get("/users/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId, siteId, role } = (req as AuthRequest).authUser;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.deletedAt) {
    res.status(404).json({ message: "Kullanıcı bulunamadı." });
    return;
  }

  if (role === "merchant" && id !== userId) {
    res.status(403).json({ message: "Erişim reddedildi." });
    return;
  }
  // GÜVENLİK: Admin dahil tüm roller yalnızca kendi sitesindeki kullanıcıları görebilir.
  if (user.siteId !== siteId) {
    res.status(403).json({ message: "Erişim reddedildi." });
    return;
  }

  res.json(toUserDto(user));
});

// ── PATCH /users/:id ──────────────────────────────────────────────────────────
// GÜVENLİK:
//   - merchant → yalnızca kendi profili
//   - resident / security → yalnızca kendi profili (sınırlı alanlar)
//   - admin → aynı sitedeki herhangi bir kullanıcı
router.patch("/users/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId, siteId, role } = (req as AuthRequest).authUser;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.deletedAt) {
    res.status(404).json({ message: "Kullanıcı bulunamadı." });
    return;
  }

  // Tenant izolasyonu: her rol yalnızca kendi sitesindeki kullanıcıyı güncelleyebilir
  if (target.siteId !== siteId) {
    res.status(403).json({ message: "Erişim reddedildi." });
    return;
  }

  // Merchant, resident ve security yalnızca kendini güncelleyebilir
  if ((role === "merchant" || role === "resident" || role === "security") && id !== userId) {
    res.status(403).json({ message: "Yalnızca kendi profilinizi güncelleyebilirsiniz." });
    return;
  }

  const body = req.body as {
    name?: string;
    phone?: string;
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
    businessHours?: string;
    latitude?: number;
    longitude?: number;
  };

  try {
    const updated = await prisma.user.update({ where: { id }, data: body });
    res.json(toUserDto(updated));
  } catch {
    res.status(404).json({ message: "Kullanıcı bulunamadı." });
  }
});

// ── DELETE /users/:id ─────────────────────────────────────────────────────────
router.delete(
  "/users/:id",
  requireAuth,
  blockRoles("resident", "security", "merchant"),
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const { userId: adminId, siteId } = (req as AuthRequest).authUser;

    if (id === adminId) {
      res.status(400).json({ message: "Kendi hesabınızı silemezsiniz." });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.siteId !== siteId) {
      res.status(404).json({ message: "Kullanıcı bulunamadı veya bu siteye ait değil." });
      return;
    }
    if (target.deletedAt) {
      res.status(400).json({ message: "Kullanıcı zaten silinmiş." });
      return;
    }
    if (target.role === "admin") {
      res.status(400).json({ message: "Admin hesabı silinemez. Önce yönetimi devredin." });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await addUserAuditLog({
      siteId,
      action: "user_deleted",
      performedBy: adminId,
      note: `Silinen kullanıcı: ${target.name} (${target.email}) — rol: ${target.role}`,
    });

    res.json({ success: true, user: toUserDto(updated) });
  },
);

// ── POST /users/:id/transfer-admin ───────────────────────────────────────────
router.post(
  "/users/:id/transfer-admin",
  requireAuth,
  blockRoles("resident", "security", "merchant"),
  async (req: Request, res: Response) => {
    const { id: newAdminId } = req.params as { id: string };
    const { userId: oldAdminId, siteId } = (req as AuthRequest).authUser;
    const { reason } = req.body as { reason?: string };

    if (newAdminId === oldAdminId) {
      res.status(400).json({ message: "Kendinize devir yapamazsınız." });
      return;
    }

    const newAdmin = await prisma.user.findUnique({ where: { id: newAdminId } });
    if (!newAdmin || newAdmin.siteId !== siteId || newAdmin.deletedAt) {
      res.status(404).json({ message: "Kullanıcı bulunamadı veya bu siteye ait değil." });
      return;
    }
    if (newAdmin.role === "admin") {
      res.status(400).json({ message: "Bu kullanıcı zaten yönetici." });
      return;
    }

    const oldAdminCurrent = await prisma.user.findUnique({
      where: { id: oldAdminId },
      select: { sessionVersion: true },
    });

    const [newAdminUser, oldAdminUser] = await prisma.$transaction([
      prisma.user.update({ where: { id: newAdminId }, data: { role: "admin" } }),
      prisma.user.update({
        where: { id: oldAdminId },
        data: {
          role: "resident",
          sessionVersion: (oldAdminCurrent?.sessionVersion ?? 0) + 1,
        },
      }),
    ]);

    await prisma.site.update({ where: { id: siteId }, data: { adminId: newAdminId } });

    await prisma.adminTransfer.create({
      data: { siteId, oldAdminId, newAdminId, reason: reason ?? null },
    });

    // Audit log
    await addUserAuditLog({
      siteId,
      action: "admin_transfer",
      performedBy: oldAdminId,
      note: `Yönetim devredildi: ${newAdmin.name} (${newAdmin.email}) — neden: ${reason ?? "belirtilmedi"}`,
    });

    res.json({
      success: true,
      message: `Yönetim ${newAdmin.name} adlı kullanıcıya devredildi. Eski yönetici oturumu sonlandırıldı.`,
      newAdmin: toUserDto(newAdminUser),
      oldAdmin: toUserDto(oldAdminUser),
    });
  },
);

// ── POST /users/:id/kvkk-consent ─────────────────────────────────────────────
router.post(
  "/users/:id/kvkk-consent",
  requireAuth,
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const { userId } = (req as AuthRequest).authUser;
    const { version } = req.body as { version?: string };

    if (id !== userId) {
      res.status(403).json({ message: "Yalnızca kendi rıza kaydınızı oluşturabilirsiniz." });
      return;
    }

    const consentVersion = version ?? "v1.0";

    const updated = await prisma.user.update({
      where: { id },
      data: { consentGiven: true, consentAt: new Date(), consentVersion },
    });

    res.json({
      success: true,
      consentGiven: updated.consentGiven,
      consentAt: updated.consentAt?.toISOString(),
      consentVersion: updated.consentVersion,
    });
  },
);

// ── PATCH /users/:id/approve ──────────────────────────────────────────────────
// GÜVENLİK: Site kontrolü — admin yalnızca kendi sitesindeki kullanıcıyı onaylayabilir.
router.patch(
  "/users/:id/approve",
  requireAuth,
  blockRoles("merchant", "resident", "security"),
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const { siteId } = (req as AuthRequest).authUser;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.siteId !== siteId) {
      res.status(404).json({ message: "Kullanıcı bulunamadı veya bu siteye ait değil." });
      return;
    }

    const updated = await prisma.user.update({ where: { id }, data: { status: "active" } });
    res.json(toUserDto(updated));
  },
);

// ── PATCH /users/:id/reject ───────────────────────────────────────────────────
// GÜVENLİK: Site kontrolü — admin yalnızca kendi sitesindeki kullanıcıyı reddedebilir.
router.patch(
  "/users/:id/reject",
  requireAuth,
  blockRoles("merchant", "resident", "security"),
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const { siteId } = (req as AuthRequest).authUser;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.siteId !== siteId) {
      res.status(404).json({ message: "Kullanıcı bulunamadı veya bu siteye ait değil." });
      return;
    }

    const updated = await prisma.user.update({ where: { id }, data: { status: "rejected" } });
    res.json(toUserDto(updated));
  },
);

export default router;
