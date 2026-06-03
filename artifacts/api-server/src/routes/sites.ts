import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";
import { encryptIban, decryptIban } from "../lib/ibanCrypto.js";
import { cacheGet, cacheSet, cacheDelPattern } from "../lib/cache.js";

const router = Router();

// ─── Public: lookup a site by join code ───────────────────────────────────────
router.get("/sites/lookup", async (req: Request, res: Response) => {
  const code = (req.query["joinCode"] as string | undefined)?.toUpperCase().trim();
  if (!code) {
    res.status(400).json({ message: "joinCode parametresi gereklidir." });
    return;
  }
  const site = await prisma.site.findFirst({ where: { joinCode: code, deletedAt: null } });
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

// ─── List all sites (excludes deleted) ────────────────────────────────────────
router.get("/sites", async (_req: Request, res: Response) => {
  const sites = await prisma.site.findMany({ where: { deletedAt: null } });
  res.json(sites.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    adminId: s.adminId,
    settlementType: s.settlementType,
    createdAt: s.createdAt.toISOString(),
  })));
});

// ─── Get single site (admin sees joinCode + decrypted bank info) ──────────────
router.get("/sites/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { siteId, role } = (req as AuthRequest).authUser;

  if (role !== "admin" && siteId !== id) {
    res.status(403).json({ message: "Erişim reddedildi." });
    return;
  }

  const cacheVariant = role === "admin" && siteId === id ? "admin"
    : role === "resident" && siteId === id ? "resident"
    : "basic";
  const cacheKey = `cache:site:${id}:${cacheVariant}`;

  const cached = await cacheGet(cacheKey);
  if (cached) { res.json(cached); return; }

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site || site.deletedAt) {
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

  // Admin sees joinCode + full bank details
  if (role === "admin" && siteId === id) {
    dto.joinCode = site.joinCode;
    dto.bankName = site.bankName ?? undefined;
    dto.accountHolder = site.accountHolder ?? undefined;
    dto.iban = decryptIban(site.iban);
  } else if (role === "resident" && siteId === id && site.iban) {
    // Residents see bank info for payment (IBAN display), no joinCode
    dto.bankName = site.bankName ?? undefined;
    dto.accountHolder = site.accountHolder ?? undefined;
    dto.iban = decryptIban(site.iban);
  }

  await cacheSet(cacheKey, dto, 300);
  res.json(dto);
});

// ─── Update site settings (admin only) — encrypts IBAN on write ──────────────
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

    const rawUpdates = req.body as {
      name?: string;
      address?: string;
      settlementType?: string;
      bankName?: string;
      accountHolder?: string;
      iban?: string;
    };

    // Encrypt IBAN before storing
    const updates = {
      ...rawUpdates,
      ...(rawUpdates.iban !== undefined ? { iban: encryptIban(rawUpdates.iban) } : {}),
    };

    try {
      const updated = await prisma.site.update({ where: { id }, data: updates });
      // Invalidate all cached variants for this site
      await cacheDelPattern(`cache:site:${id}:*`);
      res.json({
        id: updated.id,
        name: updated.name,
        address: updated.address,
        adminId: updated.adminId,
        settlementType: updated.settlementType,
        joinCode: updated.joinCode,
        bankName: updated.bankName ?? undefined,
        accountHolder: updated.accountHolder ?? undefined,
        // Return decrypted IBAN to the admin who just set it
        iban: decryptIban(updated.iban),
        createdAt: updated.createdAt.toISOString(),
      });
    } catch {
      res.status(404).json({ message: "Site bulunamadı." });
    }
  },
);

export default router;
