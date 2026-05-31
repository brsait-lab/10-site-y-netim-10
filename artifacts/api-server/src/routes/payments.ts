import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, paymentsTable, userPaymentsTable, usersTable } from "@workspace/db";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { generateId } from "../lib/auth.js";

const router = Router();

function toPaymentDto(p: typeof paymentsTable.$inferSelect) {
  return {
    id: p.id,
    siteId: p.siteId,
    title: p.title,
    amount: p.amount,
    dueDate: p.dueDate,
    type: p.type,
    description: p.description ?? undefined,
    createdAt: p.createdAt.toISOString(),
  };
}

function toUserPaymentDto(up: typeof userPaymentsTable.$inferSelect) {
  return {
    id: up.id,
    paymentId: up.paymentId,
    userId: up.userId,
    siteId: up.siteId,
    status: up.status,
    paidAt: up.paidAt?.toISOString(),
  };
}

router.get("/payments", requireAuth, async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const rows = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.siteId, siteId));
  res.json(rows.map(toPaymentDto));
});

router.post("/payments", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as {
    siteId: string;
    title: string;
    amount: number;
    dueDate: string;
    type: string;
    description?: string;
  };

  const [payment] = await db
    .insert(paymentsTable)
    .values({ id: generateId(), ...body })
    .returning();

  const siteResidents = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.siteId, body.siteId));

  const residentList = siteResidents.filter(
    (u) => u.role === "resident" && u.status === "active",
  );

  if (residentList.length > 0) {
    await db.insert(userPaymentsTable).values(
      residentList.map((u) => ({
        id: generateId(),
        paymentId: payment!.id,
        userId: u.id,
        siteId: body.siteId,
        status: "pending" as const,
      })),
    );
  }

  res.status(201).json(toPaymentDto(payment!));
});

router.get(
  "/user-payments",
  requireAuth,
  async (req: Request, res: Response) => {
    const { userId, siteId, role } = (req as AuthRequest).authUser;

    const rows =
      role === "resident"
        ? await db
            .select()
            .from(userPaymentsTable)
            .where(eq(userPaymentsTable.userId, userId))
        : await db
            .select()
            .from(userPaymentsTable)
            .where(eq(userPaymentsTable.siteId, siteId));

    res.json(rows.map(toUserPaymentDto));
  },
);

router.patch(
  "/user-payments/:id/pay",
  requireAuth,
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const [updated] = await db
      .update(userPaymentsTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(userPaymentsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ message: "Kayıt bulunamadı." });
      return;
    }
    res.json(toUserPaymentDto(updated));
  },
);

export default router;
