import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";

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

// GÜVENLİK: siteId token'dan alınır, body'den değil — cross-tenant kayıt engellenmiş.
// Yalnızca admin ve security paket kaydı girebilir.
router.post(
  "/packages",
  requireAuth,
  blockRoles("merchant", "resident"),
  async (req: Request, res: Response) => {
    const { siteId } = (req as AuthRequest).authUser;
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
    const { siteId } = (req as AuthRequest).authUser;
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
    res.json(toDto(updated));
  },
);

export default router;
