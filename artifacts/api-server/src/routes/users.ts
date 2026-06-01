import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";
import { toUserDto } from "./auth.js";

const router = Router();

// ─── List users in a site (excludes soft-deleted) ────────────────────────────
router.get("/users", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { siteId: tokenSiteId } = (req as AuthRequest).authUser;
  const querySiteId = (req.query["siteId"] as string | undefined) ?? tokenSiteId;

  const users = await prisma.user.findMany({
    where: { siteId: querySiteId, deletedAt: null },
  });
  res.json(users.map(toUserDto));
});

// ─── Update user profile ──────────────────────────────────────────────────────
router.patch("/users/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId, role } = (req as AuthRequest).authUser;

  if (role === "merchant" && id !== userId) {
    res.status(403).json({ message: "Yalnızca kendi profilinizi güncelleyebilirsiniz." });
    return;
  }

  const updates = req.body as {
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
    latitude?: number;
    longitude?: number;
  };

  try {
    const updated = await prisma.user.update({ where: { id }, data: updates });
    res.json(toUserDto(updated));
  } catch {
    res.status(404).json({ message: "Kullanıcı bulunamadı." });
  }
});

// ─── Soft-delete a user (admin only, same site) ───────────────────────────────
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
    res.json({ success: true, user: toUserDto(updated) });
  },
);

// ─── Transfer admin rights to another user ────────────────────────────────────
router.post(
  "/users/:id/transfer-admin",
  requireAuth,
  blockRoles("resident", "security", "merchant"),
  async (req: Request, res: Response) => {
    const { id: newAdminId } = req.params as { id: string };
    const { userId: oldAdminId, siteId } = (req as AuthRequest).authUser;

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

    // Execute transfer in a transaction
    const [newAdminUser, oldAdminUser] = await prisma.$transaction([
      prisma.user.update({ where: { id: newAdminId }, data: { role: "admin" } }),
      prisma.user.update({ where: { id: oldAdminId }, data: { role: "resident" } }),
    ]);

    // Update site's adminId
    await prisma.site.update({ where: { id: siteId }, data: { adminId: newAdminId } });

    // Record the transfer
    await prisma.adminTransfer.create({
      data: { siteId, oldAdminId, newAdminId },
    });

    res.json({
      success: true,
      message: `Yönetim ${newAdmin.name} adlı kullanıcıya devredildi.`,
      newAdmin: toUserDto(newAdminUser),
      oldAdmin: toUserDto(oldAdminUser),
    });
  },
);

// ─── Approve / Reject (kept for backward compat, no longer primary flow) ──────
router.patch(
  "/users/:id/approve",
  requireAuth,
  blockRoles("merchant", "resident", "security"),
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    try {
      const updated = await prisma.user.update({ where: { id }, data: { status: "active" } });
      res.json(toUserDto(updated));
    } catch {
      res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }
  },
);

router.patch(
  "/users/:id/reject",
  requireAuth,
  blockRoles("merchant", "resident", "security"),
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    try {
      const updated = await prisma.user.update({ where: { id }, data: { status: "rejected" } });
      res.json(toUserDto(updated));
    } catch {
      res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }
  },
);

export default router;
