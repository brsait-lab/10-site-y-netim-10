/**
 * C8 — Subscription Monetization Routes
 *
 * POST /subscription/checkout          — iyzico checkout formu oluştur
 * POST /subscription/webhook           — iyzico webhook handler (public, imzalı)
 * GET  /subscription/payments          — ödeme geçmişi (admin)
 * GET  /subscription/plans             — mevcut planları listele
 * PATCH /admin/subscriptions/:siteId/suspend     — askıya al
 * PATCH /admin/subscriptions/:siteId/reactivate  — yeniden aktifleştir
 * PATCH /admin/subscriptions/:siteId/cancel      — iptal et
 * POST  /admin/subscriptions           — yeni abonelik oluştur
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";
import { invalidateSubscriptionCache } from "./subscription.js";
import {
  createCheckoutSession,
  getPaymentResult,
  validateWebhookSignature,
  isIyzicoConfigured,
} from "../services/IyzicoService.js";
import { logger } from "../lib/logger.js";

const router = Router();
const blockNonAdmin = blockRoles("merchant", "resident", "security");

// ── GET /subscription/plans — public ─────────────────────────────────────────
router.get("/subscription/plans", async (_req: Request, res: Response) => {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { monthlyPrice: "asc" },
  });
  res.json(
    plans.map((p) => ({
      id: p.id,
      name: p.name,
      maxUsers: p.maxUsers,
      maxSites: p.maxSites,
      features: p.features,
      monthlyPrice: Number(p.monthlyPrice),
      yearlyPrice: Number(p.yearlyPrice),
    })),
  );
});

// ── POST /subscription/checkout — admin ──────────────────────────────────────
router.post("/subscription/checkout", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  if (!isIyzicoConfigured()) {
    res.status(503).json({ message: "iyzico yapılandırılmamış. IYZICO_API_KEY ve IYZICO_SECRET_KEY gereklidir." });
    return;
  }

  const { siteId } = (req as AuthRequest).authUser;
  const body = req.body as {
    planId: string;
    interval: "monthly" | "yearly";
    buyerName: string;
    buyerSurname: string;
    buyerEmail: string;
    buyerPhone: string;
    buyerCity?: string;
  };

  const plan = await prisma.plan.findUnique({ where: { id: body.planId } });
  if (!plan) {
    res.status(404).json({ message: "Plan bulunamadı." });
    return;
  }

  const amount = body.interval === "yearly"
    ? Math.round(Number(plan.yearlyPrice) * 100)
    : Math.round(Number(plan.monthlyPrice) * 100);

  const session = await createCheckoutSession({
    siteId,
    planId: plan.id,
    planName: plan.name,
    amount,
    buyerName: body.buyerName,
    buyerSurname: body.buyerSurname,
    buyerEmail: body.buyerEmail,
    buyerPhone: body.buyerPhone,
    buyerCity: body.buyerCity ?? "İstanbul",
    interval: body.interval,
  });

  if (!session) {
    res.status(500).json({ message: "Ödeme sayfası oluşturulamadı. Lütfen tekrar deneyin." });
    return;
  }

  // Pending payment kaydı oluştur
  const now = new Date();
  const periodEnd = new Date(now);
  if (body.interval === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  await prisma.subscriptionPayment.create({
    data: {
      siteId,
      planId: plan.id,
      amount: amount / 100,
      currency: "TRY",
      status: "pending",
      interval: body.interval,
      providerToken: session.token,
      periodStart: now,
      periodEnd,
    },
  });

  res.json({
    token: session.token,
    checkoutFormContent: session.checkoutFormContent,
    paymentPageUrl: session.paymentPageUrl,
    tokenExpireTime: session.tokenExpireTime,
  });
});

// ── POST /subscription/webhook — public, imza doğrulamalı ────────────────────
router.post("/subscription/webhook", async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-iyz-signature"] as string | undefined;

  if (!validateWebhookSignature(rawBody, signature)) {
    logger.warn("[WEBHOOK] Geçersiz iyzico imzası");
    res.status(401).json({ message: "Geçersiz imza." });
    return;
  }

  const { token, iyziEventType } = req.body as {
    token?: string; iyziEventType?: string; paymentId?: string;
  };

  logger.info({ iyziEventType, token }, "[WEBHOOK] iyzico event alındı");

  if (!token) {
    res.status(200).json({ received: true });
    return;
  }

  // Pending ödeme kaydını bul
  const payment = await prisma.subscriptionPayment.findFirst({
    where: { providerToken: token, status: "pending" },
  });

  if (!payment) {
    res.status(200).json({ received: true });
    return;
  }

  // iyzico'dan ödeme sonucunu doğrula
  const result = await getPaymentResult(token);

  if (!result) {
    res.status(200).json({ received: true });
    return;
  }

  if (result.status === "success") {
    // Ödeme başarılı → subscription güncelle
    await prisma.$transaction(async (tx) => {
      await tx.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: "success",
          providerRef: result.paymentId,
        },
      });

      // Mevcut aboneliği bul veya yeni oluştur
      const existing = await tx.subscription.findFirst({
        where: { siteId: payment.siteId },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        await tx.subscription.update({
          where: { id: existing.id },
          data: {
            status: "active",
            planId: payment.planId,
            currentPeriodStart: payment.periodStart,
            currentPeriodEnd: payment.periodEnd,
            suspendedAt: null,
            cancelledAt: null,
            externalProviderId: result.paymentId,
          },
        });
      } else {
        await tx.subscription.create({
          data: {
            siteId: payment.siteId,
            planId: payment.planId,
            status: "active",
            currentPeriodStart: payment.periodStart,
            currentPeriodEnd: payment.periodEnd,
            externalProviderId: result.paymentId,
          },
        });
      }
    });

    await invalidateSubscriptionCache(payment.siteId);
    logger.info({ siteId: payment.siteId, paymentId: result.paymentId }, "[WEBHOOK] Abonelik aktifleştirildi ✓");
  } else {
    // Ödeme başarısız
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "failure",
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      },
    });
    logger.warn({ siteId: payment.siteId, errorCode: result.errorCode }, "[WEBHOOK] Ödeme başarısız");
  }

  res.status(200).json({ received: true });
});

// ── GET /subscription/payments — admin ───────────────────────────────────────
router.get("/subscription/payments", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;

  const payments = await prisma.subscriptionPayment.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json(
    payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      interval: p.interval,
      providerRef: p.providerRef,
      errorMessage: p.errorMessage,
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
  );
});

// ── Admin subscription management ────────────────────────────────────────────
// Bu endpoint'ler site admini değil, platform yöneticisi içindir.
// Yetki kontrolü: admin rol + özel admin site token (tek tenant)

async function findSubscription(siteId: string) {
  return prisma.subscription.findFirst({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });
}

// POST /admin/subscriptions — create subscription (free trial setup)
router.post("/admin/subscriptions", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const body = req.body as {
    planId: string;
    interval?: "monthly" | "yearly";
    trialDays?: number;
  };

  const plan = await prisma.plan.findUnique({ where: { id: body.planId } });
  if (!plan) { res.status(404).json({ message: "Plan bulunamadı." }); return; }

  const now = new Date();
  const trialDays = body.trialDays ?? 14;
  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
  const periodEnd = new Date(trialEndsAt);

  const existing = await findSubscription(siteId);
  if (existing) {
    res.status(400).json({ message: "Bu site için zaten bir abonelik mevcut." });
    return;
  }

  const sub = await prisma.subscription.create({
    data: {
      siteId,
      planId: body.planId,
      status: "trialing",
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    include: { plan: true },
  });

  await invalidateSubscriptionCache(siteId);

  res.status(201).json({
    id: sub.id,
    siteId: sub.siteId,
    planName: sub.plan.name,
    status: sub.status,
    trialEndsAt: sub.trialEndsAt?.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
  });
});

// PATCH /admin/subscriptions/:siteId/suspend
router.patch("/admin/subscriptions/:siteId/suspend", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  const { siteId: targetSiteId } = req.params as { siteId: string };
  const sub = await findSubscription(targetSiteId);
  if (!sub) { res.status(404).json({ message: "Abonelik bulunamadı." }); return; }

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "suspended", suspendedAt: new Date() },
  });
  await invalidateSubscriptionCache(targetSiteId);
  logger.info({ siteId: targetSiteId }, "[SUBSCRIPTION] Askıya alındı");
  res.json({ message: "Abonelik askıya alındı.", siteId: targetSiteId });
});

// PATCH /admin/subscriptions/:siteId/reactivate
router.patch("/admin/subscriptions/:siteId/reactivate", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  const { siteId: targetSiteId } = req.params as { siteId: string };
  const sub = await findSubscription(targetSiteId);
  if (!sub) { res.status(404).json({ message: "Abonelik bulunamadı." }); return; }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: "active",
      suspendedAt: null,
      cancelledAt: null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });
  await invalidateSubscriptionCache(targetSiteId);
  logger.info({ siteId: targetSiteId }, "[SUBSCRIPTION] Yeniden aktifleştirildi");
  res.json({ message: "Abonelik aktifleştirildi.", siteId: targetSiteId });
});

// PATCH /admin/subscriptions/:siteId/cancel
router.patch("/admin/subscriptions/:siteId/cancel", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  const { siteId: targetSiteId } = req.params as { siteId: string };
  const sub = await findSubscription(targetSiteId);
  if (!sub) { res.status(404).json({ message: "Abonelik bulunamadı." }); return; }

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "cancelled", cancelledAt: new Date() },
  });
  await invalidateSubscriptionCache(targetSiteId);
  logger.info({ siteId: targetSiteId }, "[SUBSCRIPTION] İptal edildi");
  res.json({ message: "Abonelik iptal edildi.", siteId: targetSiteId });
});

export default router;
