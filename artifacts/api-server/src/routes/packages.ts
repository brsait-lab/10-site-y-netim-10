import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";

const router = Router();

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

// Vendors cannot access package tracking
router.get("/packages", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const rows = await prisma.package.findMany({ where: { siteId } });
  res.json(rows.map(toDto));
});

router.post("/packages", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const body = req.body as {
    siteId: string; recipientUserId: string; recipientName: string;
    senderInfo: string; description: string;
  };
  const row = await prisma.package.create({ data: body });
  res.status(201).json(toDto(row));
});

router.patch("/packages/:id/status", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { status } = req.body as { status: string };
  try {
    const updated = await prisma.package.update({
      where: { id },
      data: { status, deliveredAt: status === "delivered" ? new Date() : undefined },
    });
    res.json(toDto(updated));
  } catch {
    res.status(404).json({ message: "Paket bulunamadı." });
  }
});

export default router;
