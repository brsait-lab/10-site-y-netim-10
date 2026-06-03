/**
 * PHASE 2: Subscription middleware
 *
 * requireActiveSubscription() — Express middleware.
 * Bir sitenin aktif aboneliği olup olmadığını kontrol eder.
 *
 * Kontroller (sırasıyla):
 *   1. Aktif abonelik var mı?
 *   2. Trial süresi dolmuş mu?
 *   3. Ödeme gecikmiş mi? (past_due)
 *   4. Hesap askıya alınmış mı? (suspended)
 *
 * Kullanım:
 *   router.get("/premium-endpoint", requireAuth, requireActiveSubscription(), handler)
 *
 * Not: Abonelik sistemi şu anda scaffolding aşamasındadır.
 * Gerçek ödeme provider entegrasyonu (Stripe/iyzico) Phase 2'de eklenecektir.
 * Bu middleware, entegrasyon hazır olana kadar "free tier" geçişine izin verir.
 */

import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "./requireAuth.js";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "suspended";

export interface SubscriptionCheckResult {
  allowed: boolean;
  status: SubscriptionStatus | "none";
  reason?: string;
  planName?: string;
  trialEndsAt?: Date;
  currentPeriodEnd?: Date;
}

export async function checkSubscription(siteId: string): Promise<SubscriptionCheckResult> {
  const subscription = await prisma.subscription.findFirst({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });

  if (!subscription) {
    return { allowed: true, status: "none" };
  }

  const now = new Date();

  if (subscription.status === "suspended" || subscription.suspendedAt) {
    return {
      allowed: false,
      status: "suspended",
      reason: "Hesabınız askıya alınmıştır. Lütfen destek ekibiyle iletişime geçin.",
      planName: subscription.plan.name,
    };
  }

  if (subscription.status === "cancelled" && subscription.cancelledAt && subscription.cancelledAt < now) {
    return {
      allowed: false,
      status: "cancelled",
      reason: "Aboneliğiniz iptal edilmiştir.",
      planName: subscription.plan.name,
    };
  }

  if (subscription.status === "trialing") {
    if (subscription.trialEndsAt && subscription.trialEndsAt < now) {
      return {
        allowed: false,
        status: "trialing",
        reason: "Deneme süreniz dolmuştur. Lütfen bir plan seçin.",
        trialEndsAt: subscription.trialEndsAt,
        planName: subscription.plan.name,
      };
    }
    return {
      allowed: true,
      status: "trialing",
      trialEndsAt: subscription.trialEndsAt ?? undefined,
      planName: subscription.plan.name,
    };
  }

  if (subscription.status === "past_due") {
    return {
      allowed: false,
      status: "past_due",
      reason: "Bekleyen ödemeniz bulunmaktadır. Lütfen ödemenizi tamamlayın.",
      currentPeriodEnd: subscription.currentPeriodEnd,
      planName: subscription.plan.name,
    };
  }

  if (subscription.currentPeriodEnd < now) {
    return {
      allowed: false,
      status: "past_due",
      reason: "Abonelik döneminiz sona ermiştir. Lütfen ödemenizi gerçekleştirin.",
      currentPeriodEnd: subscription.currentPeriodEnd,
      planName: subscription.plan.name,
    };
  }

  return {
    allowed: true,
    status: "active",
    planName: subscription.plan.name,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}

export function requireActiveSubscription() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { siteId } = (req as AuthRequest).authUser;
    const result = await checkSubscription(siteId);

    if (!result.allowed) {
      res.status(402).json({
        message: result.reason ?? "Aktif abonelik gereklidir.",
        subscriptionStatus: result.status,
        planName: result.planName,
      });
      return;
    }

    next();
  };
}
