/**
 * Queue Service — soyut kuyruk katmanı
 *
 * InMemory: geliştirme + Redis olmadan çalışma
 * BullMQ:   production Redis ile yüksek throughput
 *
 * Job types: C8 subscription_renewal_check eklendi
 */

import { logger } from "../lib/logger.js";
import { pushService } from "./PushService.js";
import { dashboardService } from "./DashboardService.js";

export interface QueueJob {
  type:
    | "push_notification"
    | "push_notification_chunk"
    | "dashboard_stats_update"
    | "subscription_renewal_check"
    | "email"
    | "sms"
    | "data_retention"
    | "backup";
  payload: Record<string, unknown>;
  priority?: number;
  retryCount?: number;
}

export interface QueueProvider {
  enqueue(job: QueueJob): Promise<void>;
  dequeue(): Promise<QueueJob | null>;
  size(): Promise<number>;
}

class InMemoryQueueProvider implements QueueProvider {
  private queue: QueueJob[] = [];

  async enqueue(job: QueueJob): Promise<void> {
    this.queue.push(job);
    setImmediate(() => this.processNext());
  }

  async dequeue(): Promise<QueueJob | null> {
    return this.queue.shift() ?? null;
  }

  async size(): Promise<number> {
    return this.queue.length;
  }

  private async processNext(): Promise<void> {
    const job = await this.dequeue();
    if (!job) return;
    try {
      await this.process(job);
    } catch (err) {
      logger.error({ err, jobType: job.type }, "Kuyruk işi başarısız");
    }
  }

  private async process(job: QueueJob): Promise<void> {
    switch (job.type) {
      case "push_notification": {
        const { notificationId, siteId, title, body, toRoles, toUserIds } = job.payload as {
          notificationId: string; siteId: string; title: string; body: string;
          toRoles?: string[]; toUserIds?: string[];
        };
        await pushService.sendToTargets({ siteId, title, body, data: { notificationId }, toRoles, toUserIds });
        break;
      }
      case "push_notification_chunk": {
        const { tokens, title, body, data } = job.payload as {
          tokens: string[]; title: string; body: string; data?: Record<string, unknown>;
        };
        await pushService.sendTokenBatch(tokens, title, body, data);
        break;
      }
      case "dashboard_stats_update": {
        const { siteId } = job.payload as { siteId: string };
        await dashboardService.refresh(siteId);
        break;
      }
      case "subscription_renewal_check":
        await runSubscriptionRenewalCheck();
        break;
      case "data_retention":
        logger.info("[QUEUE] Veri arşivleme görevi alındı");
        break;
      case "backup":
        logger.info("[QUEUE] Yedekleme görevi alındı");
        break;
      default:
        logger.warn({ jobType: job.type }, "Bilinmeyen kuyruk iş türü");
    }
  }
}

/** Subscription renewal check — inline for InMemory provider */
async function runSubscriptionRenewalCheck(): Promise<void> {
  const { prisma } = await import("../lib/prisma.js");
  const { invalidateSubscriptionCache } = await import("../routes/subscription.js");

  const now = new Date();
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Mark active subscriptions past their period end → past_due
  const expired = await prisma.subscription.updateMany({
    where: {
      status: "active",
      currentPeriodEnd: { lt: now },
    },
    data: { status: "past_due" },
  });

  if (expired.count > 0) {
    logger.info({ count: expired.count }, "[RENEWAL] Süresi dolan abonelikler past_due olarak işaretlendi");
  }

  // Find subscriptions expiring in 3 days — fetch for cache invalidation + notification
  const expiring = await prisma.subscription.findMany({
    where: {
      status: "active",
      currentPeriodEnd: { gte: now, lte: threeDaysLater },
    },
    select: { siteId: true, currentPeriodEnd: true },
  });

  for (const sub of expiring) {
    await invalidateSubscriptionCache(sub.siteId);
    logger.info({ siteId: sub.siteId, expiresAt: sub.currentPeriodEnd }, "[RENEWAL] Yaklaşan abonelik sonu");
  }

  // Invalidate caches for all past_due sites
  const pastDue = await prisma.subscription.findMany({
    where: { status: "past_due", updatedAt: { gte: new Date(now.getTime() - 60 * 1000) } },
    select: { siteId: true },
  });

  for (const { siteId } of pastDue) {
    await invalidateSubscriptionCache(siteId);
  }

  logger.info({ expired: expired.count, expiring: expiring.length }, "[RENEWAL] Abonelik kontrol tamamlandı ✓");
}

class QueueService {
  constructor(private provider: QueueProvider = new InMemoryQueueProvider()) {}

  async enqueue(job: QueueJob): Promise<void> {
    await this.provider.enqueue(job);
    logger.debug({ jobType: job.type }, "Kuyruk görevi eklendi");
  }

  async size(): Promise<number> {
    return this.provider.size();
  }

  useProvider(provider: QueueProvider): void {
    this.provider = provider;
  }
}

export const queueService = new QueueService();
