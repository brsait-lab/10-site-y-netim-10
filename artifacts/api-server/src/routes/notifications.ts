import { Router, Request, Response } from "express";
import { eq, arrayContains } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { generateId } from "../lib/auth.js";

const router = Router();

function toDto(n: typeof notificationsTable.$inferSelect) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    fromUserId: n.fromUserId,
    fromName: n.fromName,
    toRoles: n.toRoles ?? undefined,
    toUserIds: n.toUserIds ?? undefined,
    siteId: n.siteId,
    readBy: n.readBy ?? [],
    createdAt: n.createdAt.toISOString(),
  };
}

router.get(
  "/notifications",
  requireAuth,
  async (req: Request, res: Response) => {
    const { siteId } = (req as AuthRequest).authUser;

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.siteId, siteId));

    res.json(rows.map(toDto));
  },
);

router.post(
  "/notifications",
  requireAuth,
  async (req: Request, res: Response) => {
    const body = req.body as {
      type: string;
      title: string;
      message: string;
      fromUserId: string;
      fromName: string;
      toRoles?: string[];
      toUserIds?: string[];
      siteId: string;
    };

    const [row] = await db
      .insert(notificationsTable)
      .values({
        id: generateId(),
        type: body.type,
        title: body.title,
        message: body.message,
        fromUserId: body.fromUserId,
        fromName: body.fromName,
        toRoles: body.toRoles,
        toUserIds: body.toUserIds,
        siteId: body.siteId,
      })
      .returning();

    res.status(201).json(toDto(row!));
  },
);

router.patch(
  "/notifications/:id/read",
  requireAuth,
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const { userId } = (req as AuthRequest).authUser;

    const [current] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, id));

    if (!current) {
      res.status(404).json({ message: "Bildirim bulunamadı." });
      return;
    }

    const readBy = current.readBy ?? [];
    if (!readBy.includes(userId)) {
      await db
        .update(notificationsTable)
        .set({ readBy: [...readBy, userId] })
        .where(eq(notificationsTable.id, id));
    }

    res.status(204).end();
  },
);

export default router;
