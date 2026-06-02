import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";

const router = Router();
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

function extractPeriod(date: string): { year: number | null; month: number | null; period: string | null } {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(date);
  if (m) {
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    return { year, month, period: `${year}-${String(month).padStart(2, "0")}` };
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const month = parseInt(iso[2], 10);
    return { year, month, period: `${year}-${String(month).padStart(2, "0")}` };
  }
  return { year: null, month: null, period: null };
}

function toExpenseDto(e: {
  id: string; siteId: string; title: string; description: string;
  amount: number; date: string; category: string; documentUrl: string | null;
  year: number | null; month: number | null; period: string | null;
  createdBy: string; cancelledAt: Date | null; createdAt: Date;
}) {
  return {
    id: e.id, siteId: e.siteId, title: e.title, description: e.description,
    amount: e.amount, date: e.date, category: e.category,
    documentUrl: e.documentUrl ?? undefined,
    year: e.year ?? undefined, month: e.month ?? undefined,
    period: e.period ?? undefined,
    createdBy: e.createdBy,
    cancelledAt: e.cancelledAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

async function addExpenseAuditLog(params: {
  siteId: string; action: string; performedBy: string; note?: string;
}) {
  const actor = await prisma.user.findUnique({ where: { id: params.performedBy }, select: { name: true } });
  await prisma.paymentAuditLog.create({
    data: {
      siteId: params.siteId,
      paymentId: null,
      userPaymentId: null,
      action: params.action,
      performedBy: params.performedBy,
      performedByName: actor?.name ?? "Bilinmiyor",
      note: params.note ?? null,
    },
  });
}

router.get("/expenses", requireAuth, blockRoles("merchant", "security"), async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const includeCancelled = req.query["includeCancelled"] === "true";
  const year = req.query["year"] ? parseInt(req.query["year"] as string, 10) : undefined;
  const month = req.query["month"] ? parseInt(req.query["month"] as string, 10) : undefined;
  const category = req.query["category"] as string | undefined;
  const rawLimit = parseInt((req.query["limit"] as string) ?? "", 10);
  const rawOffset = parseInt((req.query["offset"] as string) ?? "0", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  const rows = await prisma.expense.findMany({
    where: {
      siteId,
      ...(!includeCancelled ? { cancelledAt: null } : {}),
      ...(year !== undefined ? { year } : {}),
      ...(month !== undefined ? { month } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
  res.json(rows.map(toExpenseDto));
});

router.post("/expenses", requireAuth, blockRoles("merchant", "resident", "security"), async (req: Request, res: Response) => {
  const { userId: createdBy, siteId } = (req as AuthRequest).authUser;
  const body = req.body as {
    title: string; description?: string; amount: number;
    date: string; category: string; documentUrl?: string;
  };
  if (!body.title || !body.amount || !body.date || !body.category) {
    res.status(400).json({ message: "title, amount, date ve category gereklidir." });
    return;
  }
  const { year, month, period } = extractPeriod(body.date);
  const expense = await prisma.expense.create({
    data: {
      siteId, title: body.title, description: body.description ?? "",
      amount: body.amount, date: body.date, category: body.category,
      documentUrl: body.documentUrl ?? null,
      year, month, period, createdBy,
    },
  });

  // Audit log
  await addExpenseAuditLog({
    siteId,
    action: "expense_created",
    performedBy: createdBy,
    note: `Gider: ${body.title} — ${body.amount} TL — kategori: ${body.category}`,
  });

  res.status(201).json(toExpenseDto(expense));
});

router.delete("/expenses/:id", requireAuth, blockRoles("merchant", "resident", "security"), async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { siteId, userId } = (req as AuthRequest).authUser;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.siteId !== siteId) {
    res.status(404).json({ message: "Kayıt bulunamadı." });
    return;
  }
  if (expense.cancelledAt) {
    res.status(400).json({ message: "Bu kayıt zaten silinmiş." });
    return;
  }
  const updated = await prisma.expense.update({ where: { id }, data: { cancelledAt: new Date() } });

  // Audit log
  await addExpenseAuditLog({
    siteId,
    action: "expense_cancelled",
    performedBy: userId,
    note: `Gider iptal: ${expense.title} — ${expense.amount} TL`,
  });

  res.json(toExpenseDto(updated));
});

export default router;
