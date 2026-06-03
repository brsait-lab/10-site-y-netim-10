/**
 * PHASE 5: Queue Service
 *
 * Soyut kuyruk katmanı. Mevcut implementasyon in-memory (synchronous).
 * Gelecekte Redis + BullMQ veya RabbitMQ'ya geçiş için arayüz sabittir.
 *
 * Geçiş yolu:
 *   1. QueueProvider interface'ini implemente eden RedisQueueProvider yaz
 *   2. queueService = new QueueService(new RedisQueueProvider()) yap
 *   3. Uygulama kodu değişmez
 */

import { logger } from "../lib/logger.js";
import { pushService } from "./PushService.js";

export interface QueueJob {
  type: "push_notification" | "email" | "sms" | "data_retention" | "backup";
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
        logger.info({ jobType: job.type }, "Veri arşivleme görevi alındı (implementation pending)");
        break;
      case "backup":
        logger.info({ jobType: job.type }, "Yedekleme görevi alındı (implementation pending)");
        break;
      default:
        logger.warn({ jobType: job.type }, "Bilinmeyen kuyruk iş türü");
    }
  }
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
