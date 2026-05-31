import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";

const router = Router();

// Vendors cannot see payment/dues data
router.get("/payments", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const rows = await prisma.payment.findMany({ where: { siteId } });
  res.json(rows.map((p) => ({
    id: p.id, siteId: p.siteId, title: p.title, amount: p.amount,
    dueDate: p.dueDate, type: p.type, description: p.description ?? undefined,
    createdAt: p.createdAt.toISOString(),
  })));
});

router.post("/payments", requireAuth, blockRoles("merchant", "resident", "security"), async (req: Request, res: Response) => {
  const body = req.body as {
    siteId: string; title: string; amount: number;
    dueDate: string; type: string; description?: string;
  };

  const payment = await prisma.payment.create({ data: body });

  const residents = await prisma.user.findMany({
    where: { siteId: body.siteId, role: "resident", status: "active" },
  });

  if (residents.length > 0) {
    await prisma.userPayment.createMany({
      data: residents.map((u) => ({
        paymentId: payment.id, userId: u.id, siteId: body.siteId, status: "pending",
      })),
    });
  }

  res.status(201).json({
    id: payment.id, siteId: payment.siteId, title: payment.title,
    amount: payment.amount, dueDate: payment.dueDate, type: payment.type,
    description: payment.description ?? undefined,
    createdAt: payment.createdAt.toISOString(),
  });
});

// Vendors cannot see user payment/dues records
router.get("/user-payments", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { userId, siteId, role } = (req as AuthRequest).authUser;
  const rows = role === "resident"
    ? await prisma.userPayment.findMany({ where: { userId } })
    : await prisma.userPayment.findMany({ where: { siteId } });

  res.json(rows.map((up) => ({
    id: up.id, paymentId: up.paymentId, userId: up.userId,
    siteId: up.siteId, status: up.status,
    paidAt: up.paidAt?.toISOString(),
  })));
});

router.patch("/user-payments/:id/pay", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    const updated = await prisma.userPayment.update({
      where: { id }, data: { status: "paid", paidAt: new Date() },
    });
    res.json({
      id: updated.id, paymentId: updated.paymentId, userId: updated.userId,
      siteId: updated.siteId, status: updated.status,
      paidAt: updated.paidAt?.toISOString(),
    });
  } catch {
    res.status(404).json({ message: "Kayıt bulunamadı." });
  }
});

export default router;
