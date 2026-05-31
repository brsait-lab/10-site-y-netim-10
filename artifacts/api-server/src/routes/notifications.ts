import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

function toDto(n: Awaited<ReturnType<typeof prisma.notification.findFirst>>) {
  if (!n) return null;
  return {
    id: n.id, type: n.type, title: n.title, message: n.message,
    fromUserId: n.fromUserId, fromName: n.fromName,
    toRoles: n.toRoles ?? undefined, toUserIds: n.toUserIds ?? undefined,
    siteId: n.siteId, readBy: n.readBy ?? [],
    createdAt: n.createdAt.toISOString(),
  };
}

router.get("/notifications", requireAuth, async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const rows = await prisma.notification.findMany({ where: { siteId } });
  res.json(rows.map((n) => toDto(n)));
});

router.post("/notifications", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as {
    type: string; title: string; message: string;
    fromUserId: string; fromName: string;
    toRoles?: string[]; toUserIds?: string[]; siteId: string;
  };
  const row = await prisma.notification.create({
    data: {
      type: body.type, title: body.title, message: body.message,
      fromUserId: body.fromUserId, fromName: body.fromName,
      toRoles: body.toRoles ?? [], toUserIds: body.toUserIds ?? [],
      siteId: body.siteId, readBy: [],
    },
  });
  res.status(201).json(toDto(row));
});

router.patch("/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId } = (req as AuthRequest).authUser;

  const current = await prisma.notification.findUnique({ where: { id } });
  if (!current) { res.status(404).json({ message: "Bildirim bulunamadı." }); return; }

  const readBy = current.readBy ?? [];
  if (!readBy.includes(userId)) {
    await prisma.notification.update({ where: { id }, data: { readBy: [...readBy, userId] } });
  }
  res.status(204).end();
});

export default router;
