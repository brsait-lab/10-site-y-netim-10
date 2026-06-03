import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";
import { addAuditLog } from "../lib/audit.js";
import { requireActiveSubscription } from "../middlewares/requireActiveSubscription.js";
import { cacheGet, cacheSet, cacheDel } from "../lib/cache.js";

const router = Router();

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

function toDto(p: Awaited<ReturnType<typeof prisma.package.findFirst>>) {
  if (!p) return null;
  return {
    id: p.id, siteId: p.siteId, recipientUserId: p.recipientUserId,
    recipientName: p.recipientName, senderInfo: p.senderInfo,
    description: p.description, status: p.status,
    receivedAt: p.receivedAt.toISOString(),
    deliveredAt: p.deliveredAt?.toISOString(),
  };
}

// C1 — GET /packages/stats (60s cache)
router.get("/packages/stats", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const key = `cache:packages:stats:${siteId}`;

  const cached = await cacheGet(key);
  if (cached) { res.json(cached); return; }

  const [total, pending, delivered, rejected] = await Promise.all([
    prisma.package.count({ where: { siteId } }),
    prisma.package.count({ where: { siteId, status: "pending" } }),
    prisma.package.count({ where: { siteId, status: "delivered" } }),
    prisma.package.count({ where: { siteId, status: "rejected" } }),
  ]);

  const result = { total, pending, delivered, rejected };
  await cacheSet(key, result, 60);
  res.json(result);
});

router.get("/packages", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;

  const rawLimit = parseInt((req.query["limit"] as string) ?? "", 10);
  const rawOffset = parseInt((req.query["offset"] as string) ?? "0", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  const rows = await prisma.package.findMany({
    where: { siteId },
    orderBy: { receivedAt: "desc" },
    take: limit,
    skip: offset,
  });
  res.json(rows.map(toDto));
});

// GÜVENLİK: siteId token'dan alınır, body'den değil.
// Yalnızca admin ve security paket kaydı girebilir.
router.post(
  "/packages",
  requireAuth,
  blockRoles("merchant", "resident"),
  requireActiveSubscription(),
  async (req: Request, res: Response) => {
    const { siteId, userId } = (req as AuthRequest).authUser;
    const body = req.body as {
      recipientUserId: string; recipientName: string;
      senderInfo: string; description: string;
    };
    const row = await prisma.package.create({
      data: {
        siteId,
        recipientUserId: body.recipientUserId,
        recipientName: body.recipientName,
        senderInfo: body.senderInfo,
        description: body.description,
      },
    });

    await addAuditLog({
      siteId,
      action: "package_received",
      performedBy: userId,
      note: `Kargo alındı: ${body.recipientName} — gönderen: ${body.senderInfo}`,
    });

    await cacheDel(`cache:packages:stats:${siteId}`);
    res.status(201).json(toDto(row));
  },
);

// GÜVENLİK: Site izolasyonu + yalnızca admin/security durum güncelleyebilir.
router.patch(
  "/packages/:id/status",
  requireAuth,
  blockRoles("merchant", "resident"),
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const { siteId, userId } = (req as AuthRequest).authUser;
    const { status } = req.body as { status: string };

    const pkg = await prisma.package.findUnique({ where: { id } });
    if (!pkg || pkg.siteId !== siteId) {
      res.status(404).json({ message: "Paket bulunamadı." });
      return;
    }

    const updated = await prisma.package.update({
      where: { id },
      data: { status, deliveredAt: status === "delivered" ? new Date() : undefined },
    });

    if (status === "delivered") {
      await addAuditLog({
        siteId,
        action: "package_delivered",
        performedBy: userId,
        note: `Kargo teslim edildi: ${pkg.recipientName} (ID: ${id})`,
      });
    }

    await cacheDel(`cache:packages:stats:${siteId}`);
    res.json(toDto(updated));
  },
);

export default router;
