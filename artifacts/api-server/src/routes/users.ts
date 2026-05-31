import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { toUserDto } from "./auth.js";

const router = Router();

router.get("/users", requireAuth, async (req: Request, res: Response) => {
  const { siteId: tokenSiteId } = (req as AuthRequest).authUser;
  const querySiteId = (req.query["siteId"] as string | undefined) ?? tokenSiteId;

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.siteId, querySiteId));

  res.json(users.map(toUserDto));
});

router.patch("/users/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const updates = req.body as {
    name?: string;
    phone?: string;
    unitNo?: string;
    plates?: string[];
    businessName?: string;
    businessCategory?: string;
    businessDescription?: string;
    businessAddress?: string;
    latitude?: number;
    longitude?: number;
  };

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ message: "Kullanıcı bulunamadı." });
    return;
  }
  res.json(toUserDto(updated));
});

router.patch(
  "/users/:id/approve",
  requireAuth,
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const [updated] = await db
      .update(usersTable)
      .set({ status: "active" })
      .where(eq(usersTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ message: "Kullanıcı bulunamadı." });
      return;
    }
    res.json(toUserDto(updated));
  },
);

router.patch(
  "/users/:id/reject",
  requireAuth,
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const [updated] = await db
      .update(usersTable)
      .set({ status: "rejected" })
      .where(eq(usersTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ message: "Kullanıcı bulunamadı." });
      return;
    }
    res.json(toUserDto(updated));
  },
);

export default router;
