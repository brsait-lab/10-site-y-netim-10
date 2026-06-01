import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";

const router = Router();

// ─── Public: lookup a site by join code ───────────────────────────────────────
// Returns minimal info (name, settlementType) without exposing the joinCode
router.get("/sites/lookup", async (req: Request, res: Response) => {
  const code = (req.query["joinCode"] as string | undefined)?.toUpperCase().trim();
  if (!code) {
    res.status(400).json({ message: "joinCode parametresi gereklidir." });
    return;
  }
  const site = await prisma.site.findFirst({ where: { joinCode: code } });
  if (!site) {
    res.status(404).json({ message: "Geçersiz katılım kodu." });
    return;
  }
  res.json({
    id: site.id,
    name: site.name,
    address: site.address,
    settlementType: site.settlementType,
  });
});

// ─── List all sites (public for registration dropdown / admin use) ─────────────
router.get("/sites", async (_req: Request, res: Response) => {
  const sites = await prisma.site.findMany();
  res.json(sites.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    adminId: s.adminId,
    settlementType: s.settlementType,
    createdAt: s.createdAt.toISOString(),
  })));
});

// ─── Get single site by id (admin sees joinCode + bank info) ──────────────────
router.get("/sites/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { siteId, role } = (req as AuthRequest).authUser;

  // Non-admins can only see their own site (without joinCode/bank)
  if (role !== "admin" && siteId !== id) {
    res.status(403).json({ message: "Erişim reddedildi." });
    return;
  }

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) {
    res.status(404).json({ message: "Site bulunamadı." });
    return;
  }

  const dto: Record<string, unknown> = {
    id: site.id,
    name: site.name,
    address: site.address,
    adminId: site.adminId,
    settlementType: site.settlementType,
    createdAt: site.createdAt.toISOString(),
  };

  // Only the admin of this site sees joinCode and bank details
  if (role === "admin" && siteId === id) {
    dto.joinCode = site.joinCode;
    dto.bankName = site.bankName ?? undefined;
    dto.accountHolder = site.accountHolder ?? undefined;
    dto.iban = site.iban ?? undefined;
  }

  res.json(dto);
});

// ─── Update site settings (admin only) ───────────────────────────────────────
router.patch(
  "/sites/:id",
  requireAuth,
  blockRoles("resident", "security", "merchant"),
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const { siteId } = (req as AuthRequest).authUser;

    if (siteId !== id) {
      res.status(403).json({ message: "Yalnızca kendi sitenizi güncelleyebilirsiniz." });
      return;
    }

    const updates = req.body as {
      name?: string;
      address?: string;
      settlementType?: string;
      bankName?: string;
      accountHolder?: string;
      iban?: string;
    };

    try {
      const updated = await prisma.site.update({ where: { id }, data: updates });
      res.json({
        id: updated.id,
        name: updated.name,
        address: updated.address,
        adminId: updated.adminId,
        settlementType: updated.settlementType,
        joinCode: updated.joinCode,
        bankName: updated.bankName ?? undefined,
        accountHolder: updated.accountHolder ?? undefined,
        iban: updated.iban ?? undefined,
        createdAt: updated.createdAt.toISOString(),
      });
    } catch {
      res.status(404).json({ message: "Site bulunamadı." });
    }
  },
);

export default router;
