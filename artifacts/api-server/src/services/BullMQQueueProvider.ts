import { Queue, Worker, type Job } from "bullmq";
import { getBullMQConnectionOptions } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { pushService } from "./PushService.js";
import { dashboardService } from "./DashboardService.js";
import type { QueueJob, QueueProvider } from "./QueueService.js";

const QUEUE_NAME = "site-yonetim-jobs";

/**
 * PHASE B:
 * - push_notification: büyük sitelerde 100'lük chunk job'lara böler
 * - push_notification_chunk: pre-resolved token'lara gönderim
 * - dashboard_stats_update: dashboard aggregation tablosunu günceller
 * - getJobCounts(): /system/queues endpoint için kuyruk metrikleri
 */

const BATCH_SIZE = 100;

export class BullMQQueueProvider implements QueueProvider {
  private queue: Queue;
  private worker: Worker;

  constructor() {
    const conn = getBullMQConnectionOptions();

    this.queue = new Queue(QUEUE_NAME, { connection: conn });

    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job) => {
        await this.process(job.data as QueueJob);
      },
      { connection: getBullMQConnectionOptions(), concurrency: 5 },
    );

    this.worker.on("completed", (job) => {
      logger.debug({ jobId: job.id, jobType: (job.data as QueueJob)?.type }, "[QUEUE] İş tamamlandı");
    });

    this.worker.on("failed", (job, err) => {
      logger.error(
        { jobId: job?.id, jobType: (job?.data as QueueJob)?.type, err: (err as Error).message },
        "[QUEUE] İş başarısız",
      );
    });

    logger.info("[QUEUE] BullMQ/Redis provider aktif ✓");
  }

  async enqueue(job: QueueJob): Promise<void> {
    await this.queue.add(job.type, job, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      priority: job.priority ?? 5,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    });
  }

  async dequeue(): Promise<QueueJob | null> {
    return null;
  }

  async size(): Promise<number> {
    return this.queue.count();
  }

  /** TASK 4: Returns BullMQ job counts for /system/queues endpoint. */
  async getJobCounts(): Promise<Record<string, number>> {
    return this.queue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused",
    );
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }

  private async process(job: QueueJob): Promise<void> {
    switch (job.type) {
      case "push_notification": {
        const { notificationId, siteId, title, body, toRoles, toUserIds } = job.payload as {
          notificationId: string; siteId: string; title: string; body: string;
          toRoles?: string[]; toUserIds?: string[];
        };

        const where: Record<string, unknown> = {
          siteId,
          pushToken: { not: null },
          deletedAt: null,
          status: "active",
        };
        if (toUserIds && toUserIds.length > 0) where["id"] = { in: toUserIds };
        else if (toRoles && toRoles.length > 0) where["role"] = { in: toRoles };

        const users = await prisma.user.findMany({
          where,
          select: { id: true, pushToken: true },
        });

        const tokens = users.map((u) => u.pushToken).filter((t): t is string => !!t);

        if (tokens.length === 0) {
          logger.info({ siteId, notificationId }, "[PUSH] Gönderilecek token yok");
          break;
        }

        await prisma.user.updateMany({
          where: { id: { in: users.map((u) => u.id) } },
          data: { lastPushAt: new Date() },
        });

        if (tokens.length <= BATCH_SIZE) {
          const { sent, failed } = await pushService.sendTokenBatch(tokens, title, body, { notificationId });
          logger.info({ siteId, sent, failed, total: tokens.length }, "[PUSH] Direkt gönderim tamamlandı");
        } else {
          const chunks: string[][] = [];
          for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
            chunks.push(tokens.slice(i, i + BATCH_SIZE));
          }
          for (const chunk of chunks) {
            await this.enqueue({
              type: "push_notification_chunk",
              payload: { tokens: chunk, title, body, data: { notificationId } },
              priority: 6,
            });
          }
          logger.info({ siteId, total: tokens.length, chunks: chunks.length }, `[PUSH] ${chunks.length} chunk job enqueue edildi`);
        }
        break;
      }

      case "push_notification_chunk": {
        const { tokens, title, body, data } = job.payload as {
          tokens: string[]; title: string; body: string; data?: Record<string, unknown>;
        };
        const { sent, failed } = await pushService.sendTokenBatch(tokens, title, body, data);
        logger.info({ sent, failed, total: tokens.length }, "[PUSH] Chunk gönderildi");
        break;
      }

      case "dashboard_stats_update": {
        const { siteId } = job.payload as { siteId: string };
        await dashboardService.refresh(siteId);
        break;
      }

      case "data_retention":
        logger.info("[QUEUE] Veri arşivleme görevi alındı");
        break;
      case "backup":
        logger.info("[QUEUE] Yedekleme görevi alındı");
        break;
      default:
        logger.warn({ jobType: job.type }, "[QUEUE] Bilinmeyen iş türü");
    }
  }
}
