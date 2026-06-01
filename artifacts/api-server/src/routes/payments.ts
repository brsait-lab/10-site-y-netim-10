import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";

const router = Router();

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

function toPaymentDto(p: {
  id: string; siteId: string; title: string; amount: number;
  dueDate: string; type: string; description: string | null;
  targetBlocks: string[]; targetUserIds: string[];
  createdBy: string; cancelledAt: Date | null; createdAt: Date;
}) {
  return {
    id: p.id, siteId: p.siteId, title: p.title, amount: p.amount,
    dueDate: p.dueDate, type: p.type,
    description: p.description ?? undefined,
    targetBlocks: p.targetBlocks,
    targetUserIds: p.targetUserIds,
    createdBy: p.createdBy,
    cancelledAt: p.cancelledAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

function toUserPaymentDto(up: {
  id: string; paymentId: string; userId: string; siteId: string;
  status: string; paidAt: Date | null; note: string | null; receiptUrl: string | null;
}) {
  return {
    id: up.id, paymentId: up.paymentId, userId: up.userId,
    siteId: up.siteId, status: up.status,
    paidAt: up.paidAt?.toISOString() ?? null,
    note: up.note ?? undefined,
    receiptUrl: up.receiptUrl ?? undefined,
  };
}

router.get("/payments", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const includeCancelled = req.query["includeCancelled"] === "true";

  const rawLimit = parseInt((req.query["limit"] as string) ?? "", 10);
  const rawOffset = parseInt((req.query["offset"] as string) ?? "0", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  const rows = await prisma.payment.findMany({
    where: { siteId, ...(!includeCancelled ? { cancelledAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
  res.json(rows.map(toPaymentDto));
});

router.get("/payments/:id", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { siteId } = (req as AuthRequest).authUser;
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment || payment.siteId !== siteId) {
    res.status(404).json({ message: "Ödeme bulunamadı." });
    return;
  }
  res.json(toPaymentDto(payment));
});

router.post("/payments", requireAuth, blockRoles("merchant", "resident", "security"), async (req: Request, res: Response) => {
  const { userId: createdBy, siteId: tokenSiteId } = (req as AuthRequest).authUser;
  const body = req.body as {
    siteId?: string; title: string; amount: number;
    dueDate: string; type: string; description?: string;
    targetBlocks?: string[];
    targetUserIds?: string[];
  };

  const siteId = body.siteId ?? tokenSiteId;

  const payment = await prisma.payment.create({
    data: {
      siteId,
      title: body.title,
      amount: body.amount,
      dueDate: body.dueDate,
      type: body.type,
      description: body.description,
      targetBlocks: body.targetBlocks ?? [],
      targetUserIds: body.targetUserIds ?? [],
      createdBy,
    },
  });

  const hasBlockFilter = (body.targetBlocks ?? []).length > 0;
  const hasUserFilter = (body.targetUserIds ?? []).length > 0;

  let residents;
  if (hasUserFilter) {
    residents = await prisma.user.findMany({
      where: { id: { in: body.targetUserIds }, siteId, role: "resident", status: "active", deletedAt: null },
      select: { id: true },
    });
  } else if (hasBlockFilter) {
    residents = await prisma.user.findMany({
      where: { siteId, role: "resident", status: "active", deletedAt: null, block: { in: body.targetBlocks } },
      select: { id: true },
    });
  } else {
    residents = await prisma.user.findMany({
      where: { siteId, role: "resident", status: "active", deletedAt: null },
      select: { id: true },
    });
  }

  if (residents.length > 0) {
    await prisma.userPayment.createMany({
      data: residents.map((u) => ({
        paymentId: payment.id, userId: u.id, siteId, status: "pending",
      })),
    });
  }

  res.status(201).json(toPaymentDto(payment));
});

router.delete("/payments/:id", requireAuth, blockRoles("merchant", "resident", "security"), async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { siteId } = (req as AuthRequest).authUser;

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment || payment.siteId !== siteId) {
    res.status(404).json({ message: "Ödeme bulunamadı." });
    return;
  }
  if (payment.cancelledAt) {
    res.status(400).json({ message: "Bu ödeme zaten iptal edilmiş." });
    return;
  }

  const [updatedPayment, { count: cancelledCount }] = await prisma.$transaction([
    prisma.payment.update({ where: { id }, data: { cancelledAt: new Date() } }),
    prisma.userPayment.updateMany({ where: { paymentId: id, status: "pending" }, data: { status: "cancelled" } }),
  ]);

  res.json({ success: true, payment: toPaymentDto(updatedPayment), cancelledUserPayments: cancelledCount });
});

router.get("/user-payments", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { userId, siteId, role } = (req as AuthRequest).authUser;

  const rawLimit = parseInt((req.query["limit"] as string) ?? "", 10);
  const rawOffset = parseInt((req.query["offset"] as string) ?? "0", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  const rows = role === "resident"
    ? await prisma.userPayment.findMany({ where: { userId }, take: limit, skip: offset })
    : await prisma.userPayment.findMany({ where: { siteId }, take: limit, skip: offset });

  res.json(rows.map(toUserPaymentDto));
});

router.get("/user-payments/stats", requireAuth, blockRoles("merchant", "resident"), async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const paymentId = req.query["paymentId"] as string | undefined;

  const where = paymentId ? { siteId, paymentId } : { siteId };
  const [total, paid, pending, cancelled] = await Promise.all([
    prisma.userPayment.count({ where }),
    prisma.userPayment.count({ where: { ...where, status: "paid" } }),
    prisma.userPayment.count({ where: { ...where, status: "pending" } }),
    prisma.userPayment.count({ where: { ...where, status: "cancelled" } }),
  ]);

  res.json({
    total, paid, pending, cancelled,
    paidRate: total > 0 ? Math.round((paid / total) * 100) : 0,
  });
});

router.patch("/user-payments/:id/pay", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { role, userId } = (req as AuthRequest).authUser;
  const body = req.body as { note?: string; receiptUrl?: string };

  const existing = await prisma.userPayment.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: "Kayıt bulunamadı." }); return; }

  if (role === "resident" && existing.userId !== userId) {
    res.status(403).json({ message: "Yalnızca kendi aidatınızı ödeyebilirsiniz." });
    return;
  }

  if (existing.status === "paid") { res.status(400).json({ message: "Bu aidat zaten ödenmiş." }); return; }
  if (existing.status === "cancelled") { res.status(400).json({ message: "İptal edilmiş aidat ödenemez." }); return; }

  try {
    const updated = await prisma.userPayment.update({
      where: { id },
      data: {
        status: "paid", paidAt: new Date(),
        note: body.note ?? existing.note,
        receiptUrl: body.receiptUrl ?? existing.receiptUrl,
      },
    });
    res.json(toUserPaymentDto(updated));
  } catch {
    res.status(404).json({ message: "Kayıt bulunamadı." });
  }
});

export default router;
