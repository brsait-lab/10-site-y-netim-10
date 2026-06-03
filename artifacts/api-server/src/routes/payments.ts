import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";
import { addAuditLog } from "../lib/audit.js";

const router = Router();
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

// ── Unit key derivation ───────────────────────────────────────────────────────

function buildUnitKey(user: {
  block?: string | null; tower?: string | null;
  unitNo?: string | null; villaNo?: string | null;
}): string | null {
  if (user.unitNo) {
    const prefix = user.block ?? user.tower ?? null;
    return prefix ? `${prefix}-${user.unitNo}` : user.unitNo;
  }
  if (user.villaNo) return `villa-${user.villaNo}`;
  return null;
}

function isUnitBased(type: string): boolean {
  return type === "aidat" || type === "extra_expense" || type === "gider";
}

function extractPeriod(dueDate: string): { year: number | null; month: number | null; period: string | null } {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(dueDate);
  if (m) {
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    return { year, month, period: `${year}-${String(month).padStart(2, "0")}` };
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (iso) {
    const year = parseInt(iso[1], 10); const month = parseInt(iso[2], 10);
    return { year, month, period: `${year}-${String(month).padStart(2, "0")}` };
  }
  return { year: null, month: null, period: null };
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

function toPaymentDto(p: {
  id: string; siteId: string; title: string; amount: number | { toNumber(): number };
  dueDate: string; type: string; description: string | null; targetBlocks: string[];
  targetUserIds: string[]; createdBy: string; cancelledAt: Date | null;
  createdAt: Date; year: number | null; month: number | null; period: string | null;
}) {
  return {
    id: p.id, siteId: p.siteId, title: p.title,
    amount: Number(p.amount),
    dueDate: p.dueDate, type: p.type,
    description: p.description ?? undefined,
    targetBlocks: p.targetBlocks, targetUserIds: p.targetUserIds,
    createdBy: p.createdBy,
    cancelledAt: p.cancelledAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    year: p.year ?? undefined, month: p.month ?? undefined, period: p.period ?? undefined,
  };
}

function toUserPaymentDto(up: {
  id: string; paymentId: string; userId: string | null; unitKey: string | null;
  siteId: string; status: string; paidAt: Date | null; paidByUserId: string | null;
  paymentMethod: string | null; approvedBy: string | null; approvedAt: Date | null;
  note: string | null; receiptUrl: string | null;
}) {
  return {
    id: up.id, paymentId: up.paymentId,
    userId: up.userId ?? undefined,
    unitKey: up.unitKey ?? undefined,
    siteId: up.siteId, status: up.status,
    paidAt: up.paidAt?.toISOString() ?? null,
    paidByUserId: up.paidByUserId ?? undefined,
    paymentMethod: up.paymentMethod ?? undefined,
    approvedBy: up.approvedBy ?? undefined,
    approvedAt: up.approvedAt?.toISOString() ?? null,
    note: up.note ?? undefined,
    receiptUrl: up.receiptUrl ?? undefined,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const blockSecurity = blockRoles("merchant", "security");
const blockNonAdmin = blockRoles("merchant", "resident", "security");

async function getResidents(
  siteId: string,
  targetBlocks: string[],
  targetUserIds: string[],
): Promise<{ id: string; block: string | null; tower: string | null; unitNo: string | null; villaNo: string | null }[]> {
  const select = { id: true, block: true, tower: true, unitNo: true, villaNo: true };
  const base = { siteId, role: "resident", status: "active", deletedAt: null };
  if (targetUserIds.length > 0)
    return prisma.user.findMany({ where: { ...base, id: { in: targetUserIds } }, select });
  if (targetBlocks.length > 0)
    return prisma.user.findMany({ where: { ...base, block: { in: targetBlocks } }, select });
  return prisma.user.findMany({ where: base, select });
}

// Ensures the userPayment belongs to the authenticated user's site.
function assertSameSite(existingSiteId: string, authSiteId: string, res: Response): boolean {
  if (existingSiteId !== authSiteId) {
    res.status(403).json({ message: "Bu işleme erişim yetkiniz yok." });
    return false;
  }
  return true;
}

// ── GET /payments ─────────────────────────────────────────────────────────────

router.get("/payments", requireAuth, blockSecurity, async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const includeCancelled = req.query["includeCancelled"] === "true";
  const rawLimit = parseInt((req.query["limit"] as string) ?? "", 10);
  const rawOffset = parseInt((req.query["offset"] as string) ?? "0", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  const rows = await prisma.payment.findMany({
    where: { siteId, ...(!includeCancelled ? { cancelledAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit, skip: offset,
  });
  res.json(rows.map(toPaymentDto));
});

// ── GET /payments/:id ─────────────────────────────────────────────────────────

router.get("/payments/:id", requireAuth, blockSecurity, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { siteId } = (req as AuthRequest).authUser;
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment || payment.siteId !== siteId) {
    res.status(404).json({ message: "Ödeme bulunamadı." });
    return;
  }
  res.json(toPaymentDto(payment));
});

// ── POST /payments — admin only, fully atomic ─────────────────────────────────
// PHASE 1: body.siteId kullanımı kaldırıldı — siteId her zaman token'dan alınır.
// PHASE 1: Payment + UserPayment + AuditLog tek $transaction içinde atomik.

router.post("/payments", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  const { userId: createdBy, siteId } = (req as AuthRequest).authUser;
  const body = req.body as {
    title: string; amount: number; dueDate: string;
    type: string; description?: string;
    targetBlocks?: string[]; targetUserIds?: string[];
  };

  if (!body.title || !body.amount || !body.dueDate || !body.type) {
    res.status(400).json({ message: "title, amount, dueDate ve type gereklidir." });
    return;
  }

  const { year, month, period } = extractPeriod(body.dueDate);
  const targetBlocks = body.targetBlocks ?? [];
  const targetUserIds = body.targetUserIds ?? [];

  // Duplicate check (read-only, before transaction)
  if (period && isUnitBased(body.type)) {
    const duplicate = await prisma.payment.findFirst({
      where: { siteId, type: body.type, period, cancelledAt: null },
      select: { id: true, title: true },
    });
    if (duplicate) {
      res.status(409).json({
        message: `"${body.type}" türünde ${period} dönemi için zaten bir ödeme mevcut: "${duplicate.title}". Aynı döneme ikinci ödeme oluşturulamaz.`,
      });
      return;
    }
  }

  // Pre-fetch residents and actor name (read-only, before transaction)
  const [residents, actor] = await Promise.all([
    getResidents(siteId, targetBlocks, targetUserIds),
    prisma.user.findUnique({ where: { id: createdBy }, select: { name: true } }),
  ]);
  const actorName = actor?.name ?? "Bilinmiyor";

  // Build user payment data in memory
  const unitBased = isUnitBased(body.type);
  const upData: { unitKey: string | null; userId: string | null; siteId: string; status: string }[] = [];

  if (unitBased) {
    const seen = new Map<string, true>();
    for (const r of residents) {
      const uk = buildUnitKey(r);
      if (uk && !seen.has(uk)) {
        seen.set(uk, true);
        upData.push({ unitKey: uk, userId: null, siteId, status: "pending" });
      }
    }
  } else {
    for (const u of residents) {
      upData.push({ userId: u.id, unitKey: null, siteId, status: "pending" });
    }
  }

  // ── ATOMIC TRANSACTION: Payment + UserPayments + AuditLog ────────────────
  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        siteId, title: body.title, amount: body.amount, dueDate: body.dueDate,
        type: body.type, description: body.description,
        targetBlocks, targetUserIds, createdBy, year, month, period,
      },
    });

    if (upData.length > 0) {
      await tx.userPayment.createMany({
        data: upData.map((d) => ({ ...d, paymentId: created.id })),
        skipDuplicates: true,
      });
    }

    await addAuditLog({
      siteId, paymentId: created.id,
      action: "payment_created",
      performedBy: createdBy,
      performedByName: actorName,
      note: `${body.type}: ${body.title} | ₺${body.amount}`,
      client: tx,
    });

    return created;
  });

  res.status(201).json(toPaymentDto(payment));
});

// ── DELETE /payments/:id — soft cancel, admin only ───────────────────────────

router.delete("/payments/:id", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { siteId, userId } = (req as AuthRequest).authUser;

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment || payment.siteId !== siteId) {
    res.status(404).json({ message: "Ödeme bulunamadı." });
    return;
  }
  if (payment.cancelledAt) {
    res.status(400).json({ message: "Bu ödeme zaten iptal edilmiş." });
    return;
  }

  const [updatedPayment, { count }] = await prisma.$transaction([
    prisma.payment.update({ where: { id }, data: { cancelledAt: new Date() } }),
    prisma.userPayment.updateMany({ where: { paymentId: id, status: "pending" }, data: { status: "cancelled" } }),
  ]);

  await addAuditLog({ siteId, paymentId: id, action: "payment_cancelled", performedBy: userId });
  res.json({ success: true, payment: toPaymentDto(updatedPayment), cancelledUserPayments: count });
});

// ── GET /user-payments ────────────────────────────────────────────────────────

router.get("/user-payments", requireAuth, blockSecurity, async (req: Request, res: Response) => {
  const { userId, siteId, role } = (req as AuthRequest).authUser;
  const rawLimit = parseInt((req.query["limit"] as string) ?? "", 10);
  const rawOffset = parseInt((req.query["offset"] as string) ?? "0", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  if (role === "resident") {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { block: true, tower: true, unitNo: true, villaNo: true },
    });
    const unitKey = currentUser ? buildUnitKey(currentUser) : null;

    const orConditions: object[] = [{ userId }];
    if (unitKey) orConditions.push({ unitKey });

    const rows = await prisma.userPayment.findMany({
      where: {
        siteId,
        status: { not: "cancelled" },
        OR: orConditions,
      },
      orderBy: { paymentId: "asc" },
      take: limit,
      skip: offset,
    });

    return res.json(rows.map(toUserPaymentDto));
  }

  const rows = await prisma.userPayment.findMany({
    where: { siteId },
    orderBy: { paymentId: "asc" },
    take: limit, skip: offset,
  });
  res.json(rows.map(toUserPaymentDto));
});

// ── GET /user-payments/stats — admin only ────────────────────────────────────

router.get("/user-payments/stats", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const paymentId = req.query["paymentId"] as string | undefined;
  const where = paymentId ? { siteId, paymentId } : { siteId };

  const [total, paid, pending, pendingApproval, rejected, cancelled] = await Promise.all([
    prisma.userPayment.count({ where }),
    prisma.userPayment.count({ where: { ...where, status: "paid" } }),
    prisma.userPayment.count({ where: { ...where, status: "pending" } }),
    prisma.userPayment.count({ where: { ...where, status: "pending_approval" } }),
    prisma.userPayment.count({ where: { ...where, status: "rejected" } }),
    prisma.userPayment.count({ where: { ...where, status: "cancelled" } }),
  ]);

  res.json({
    total, paid, pending, pending_approval: pendingApproval, rejected, cancelled,
    paidRate: total > 0 ? Math.round((paid / total) * 100) : 0,
  });
});

// ── PATCH /user-payments/:id/pay ──────────────────────────────────────────────

router.patch("/user-payments/:id/pay", requireAuth, blockSecurity, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { role, userId, siteId } = (req as AuthRequest).authUser;
  const body = req.body as { note?: string; receiptUrl?: string; paymentMethod?: string };

  const existing = await prisma.userPayment.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: "Kayıt bulunamadı." }); return; }

  if (!assertSameSite(existing.siteId, siteId, res)) return;

  if (role === "resident") {
    if (existing.unitKey) {
      const cu = await prisma.user.findUnique({ where: { id: userId }, select: { block: true, tower: true, unitNo: true, villaNo: true } });
      if (buildUnitKey(cu ?? {}) !== existing.unitKey) {
        res.status(403).json({ message: "Bu ödemeye erişim yetkiniz yok." }); return;
      }
    } else if (existing.userId && existing.userId !== userId) {
      res.status(403).json({ message: "Yalnızca kendi ödemenizi yapabilirsiniz." }); return;
    }

    if (existing.status === "paid") { res.status(400).json({ message: "Bu aidat zaten ödenmiş." }); return; }
    if (existing.status === "cancelled") { res.status(400).json({ message: "İptal edilmiş aidat ödenemez." }); return; }

    if (!body.receiptUrl) {
      res.status(400).json({
        message: "Ödeme onayı için dekont yüklenmesi zorunludur. Lütfen 'Dekont Yükle' butonunu kullanın.",
      });
      return;
    }

    const updated = await prisma.userPayment.update({
      where: { id },
      data: {
        receiptUrl: body.receiptUrl,
        note: body.note ?? existing.note,
        paidByUserId: userId,
        status: "pending_approval",
      },
    });

    await addAuditLog({
      siteId: existing.siteId, paymentId: existing.paymentId, userPaymentId: id,
      action: "receipt_uploaded", performedBy: userId, note: body.receiptUrl,
    });
    res.json(toUserPaymentDto(updated));
    return;
  }

  if (existing.status === "paid") { res.status(400).json({ message: "Bu aidat zaten ödenmiş." }); return; }
  if (existing.status === "cancelled") { res.status(400).json({ message: "İptal edilmiş aidat ödenemez." }); return; }

  const updated = await prisma.userPayment.update({
    where: { id },
    data: {
      status: "paid", paidAt: new Date(), paidByUserId: userId,
      paymentMethod: body.paymentMethod ?? "manual",
      note: body.note ?? existing.note,
      receiptUrl: body.receiptUrl ?? existing.receiptUrl,
      approvedBy: userId, approvedAt: new Date(),
    },
  });

  await addAuditLog({ siteId: existing.siteId, paymentId: existing.paymentId, userPaymentId: id, action: "paid", performedBy: userId });
  res.json(toUserPaymentDto(updated));
});

// ── PATCH /user-payments/:id/upload-receipt ───────────────────────────────────

router.patch("/user-payments/:id/upload-receipt", requireAuth, blockSecurity, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId, role, siteId } = (req as AuthRequest).authUser;
  const body = req.body as { receiptUrl: string; note?: string };

  if (!body.receiptUrl) { res.status(400).json({ message: "receiptUrl gereklidir." }); return; }

  const existing = await prisma.userPayment.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: "Kayıt bulunamadı." }); return; }

  if (!assertSameSite(existing.siteId, siteId, res)) return;

  if (role === "resident") {
    if (existing.unitKey) {
      const cu = await prisma.user.findUnique({ where: { id: userId }, select: { block: true, tower: true, unitNo: true, villaNo: true } });
      if (buildUnitKey(cu ?? {}) !== existing.unitKey) {
        res.status(403).json({ message: "Bu ödemeye erişim yetkiniz yok." }); return;
      }
    } else if (existing.userId && existing.userId !== userId) {
      res.status(403).json({ message: "Bu ödemeye erişim yetkiniz yok." }); return;
    }
  }

  if (existing.status === "paid") { res.status(400).json({ message: "Bu aidat zaten ödenmiş." }); return; }
  if (existing.status === "cancelled") { res.status(400).json({ message: "İptal edilmiş aidat için dekont yüklenemez." }); return; }

  const updated = await prisma.userPayment.update({
    where: { id },
    data: { receiptUrl: body.receiptUrl, note: body.note ?? existing.note, paidByUserId: userId, status: "pending_approval" },
  });

  await addAuditLog({ siteId: existing.siteId, paymentId: existing.paymentId, userPaymentId: id, action: "receipt_uploaded", performedBy: userId, note: body.receiptUrl });
  res.json(toUserPaymentDto(updated));
});

// ── PATCH /user-payments/:id/approve — admin only ────────────────────────────

router.patch("/user-payments/:id/approve", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId, siteId } = (req as AuthRequest).authUser;
  const body = req.body as { note?: string };

  const existing = await prisma.userPayment.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: "Kayıt bulunamadı." }); return; }

  if (!assertSameSite(existing.siteId, siteId, res)) return;

  if (existing.status !== "pending_approval") {
    res.status(400).json({ message: "Yalnızca onay bekleyen dekontlar onaylanabilir." }); return;
  }

  const updated = await prisma.userPayment.update({
    where: { id },
    data: {
      status: "paid", paidAt: new Date(),
      approvedBy: userId, approvedAt: new Date(),
      paymentMethod: existing.paymentMethod ?? "bank_transfer",
      note: body.note ?? existing.note,
    },
  });

  await addAuditLog({ siteId: existing.siteId, paymentId: existing.paymentId, userPaymentId: id, action: "payment_approved", performedBy: userId, note: body.note });
  res.json(toUserPaymentDto(updated));
});

// ── PATCH /user-payments/:id/reject — admin only ─────────────────────────────

router.patch("/user-payments/:id/reject", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId, siteId } = (req as AuthRequest).authUser;
  const body = req.body as { note?: string };

  const existing = await prisma.userPayment.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: "Kayıt bulunamadı." }); return; }

  if (!assertSameSite(existing.siteId, siteId, res)) return;

  if (existing.status !== "pending_approval") {
    res.status(400).json({ message: "Yalnızca onay bekleyen dekontlar reddedilebilir." }); return;
  }

  const updated = await prisma.userPayment.update({
    where: { id },
    data: { status: "rejected", note: body.note ?? existing.note },
  });

  await addAuditLog({ siteId: existing.siteId, paymentId: existing.paymentId, userPaymentId: id, action: "payment_rejected", performedBy: userId, note: body.note });
  res.json(toUserPaymentDto(updated));
});

// ── PATCH /user-payments/:id/manual-pay — admin only ─────────────────────────

router.patch("/user-payments/:id/manual-pay", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId, siteId } = (req as AuthRequest).authUser;
  const body = req.body as { paymentMethod: string; note?: string };

  if (!body.paymentMethod) { res.status(400).json({ message: "paymentMethod gereklidir." }); return; }

  const existing = await prisma.userPayment.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: "Kayıt bulunamadı." }); return; }

  if (!assertSameSite(existing.siteId, siteId, res)) return;

  if (existing.status === "paid") { res.status(400).json({ message: "Bu aidat zaten ödenmiş." }); return; }
  if (existing.status === "cancelled") { res.status(400).json({ message: "İptal edilmiş aidat işlenemiyor." }); return; }

  const updated = await prisma.userPayment.update({
    where: { id },
    data: {
      status: "paid", paidAt: new Date(),
      paymentMethod: body.paymentMethod,
      approvedBy: userId, approvedAt: new Date(),
      note: body.note ?? existing.note,
    },
  });

  const action = body.paymentMethod === "cash" ? "cash_collected" : "manual_collected";
  await addAuditLog({ siteId: existing.siteId, paymentId: existing.paymentId, userPaymentId: id, action, performedBy: userId, note: body.note ?? body.paymentMethod });
  res.json(toUserPaymentDto(updated));
});

// ── GET /payment-audit-logs — admin only ─────────────────────────────────────

router.get("/payment-audit-logs", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const paymentId = req.query["paymentId"] as string | undefined;
  const userPaymentId = req.query["userPaymentId"] as string | undefined;
  const rawLimit = parseInt((req.query["limit"] as string) ?? "50", 10);
  const limit = Math.min(rawLimit, 200);

  const logs = await prisma.paymentAuditLog.findMany({
    where: { siteId, ...(paymentId ? { paymentId } : {}), ...(userPaymentId ? { userPaymentId } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  res.json(logs.map((l) => ({
    id: l.id, siteId: l.siteId,
    paymentId: l.paymentId ?? undefined,
    userPaymentId: l.userPaymentId ?? undefined,
    action: l.action, performedBy: l.performedBy,
    performedByName: l.performedByName,
    note: l.note ?? undefined,
    createdAt: l.createdAt.toISOString(),
  })));
});

export default router;
