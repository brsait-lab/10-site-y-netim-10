import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, packagesTable } from "@workspace/db";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { generateId } from "../lib/auth.js";

const router = Router();

function toDto(p: typeof packagesTable.$inferSelect) {
  return {
    id: p.id,
    siteId: p.siteId,
    recipientUserId: p.recipientUserId,
    recipientName: p.recipientName,
    senderInfo: p.senderInfo,
    description: p.description,
    status: p.status,
    receivedAt: p.receivedAt.toISOString(),
    deliveredAt: p.deliveredAt?.toISOString(),
  };
}

router.get("/packages", requireAuth, async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const rows = await db
    .select()
    .from(packagesTable)
    .where(eq(packagesTable.siteId, siteId));
  res.json(rows.map(toDto));
});

router.post("/packages", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as {
    siteId: string;
    recipientUserId: string;
    recipientName: string;
    senderInfo: string;
    description: string;
  };

  const [row] = await db
    .insert(packagesTable)
    .values({ id: generateId(), ...body })
    .returning();

  res.status(201).json(toDto(row!));
});

router.patch(
  "/packages/:id/status",
  requireAuth,
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };

    const [updated] = await db
      .update(packagesTable)
      .set({
        status,
        deliveredAt: status === "delivered" ? new Date() : undefined,
      })
      .where(eq(packagesTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ message: "Paket bulunamadı." });
      return;
    }
    res.json(toDto(updated));
  },
);

export default router;
