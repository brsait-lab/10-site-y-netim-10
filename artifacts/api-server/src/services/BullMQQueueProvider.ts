import { Queue, Worker, type Job } from "bullmq";
import { getBullMQConnectionOptions } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { pushService } from "./PushService.js";
import type { QueueJob, QueueProvider } from "./QueueService.js";

const QUEUE_NAME = "site-yonetim-jobs";

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

  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }

  private async process(job: QueueJob): Promise<void> {
    switch (job.type) {
      case "push_notification": {
        const { notificationId, siteId, title, body, toRoles, toUserIds } = job.payload as {
          notificationId: string;
          siteId: string;
          title: string;
          body: string;
          toRoles?: string[];
          toUserIds?: string[];
        };
        await pushService.sendToTargets({
          siteId,
          title,
          body,
          data: { notificationId },
          toRoles,
          toUserIds,
        });
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
