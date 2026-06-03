/**
 * PHASE 5: Notification Service
 *
 * API → NotificationService → QueueService → PushService
 *
 * Mevcut implementasyon doğrudan DB yazımı yapar.
 * Gelecekte Redis/BullMQ queue katmanına geçiş için soyutlanmıştır.
 *
 * Kullanım:
 *   import { notificationService } from "../services/NotificationService.js";
 *   await notificationService.send({ siteId, type, title, message, ... });
 */

import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { queueService } from "./QueueService.js";

export interface NotificationPayload {
  siteId: string;
  type: string;
  title: string;
  message: string;
  fromUserId: string;
  fromName: string;
  toRoles?: string[];
  toUserIds?: string[];
}

export interface NotificationResult {
  id: string;
  queued: boolean;
  pushSent: boolean;
}

class NotificationService {
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const row = await prisma.notification.create({
      data: {
        type: payload.type,
        title: payload.title,
        message: payload.message,
        fromUserId: payload.fromUserId,
        fromName: payload.fromName,
        toRoles: payload.toRoles ?? [],
        toUserIds: payload.toUserIds ?? [],
        siteId: payload.siteId,
        readBy: [],
      },
    });

    let pushSent = false;
    try {
      await queueService.enqueue({
        type: "push_notification",
        payload: {
          notificationId: row.id,
          siteId: payload.siteId,
          title: payload.title,
          body: payload.message,
          toRoles: payload.toRoles,
          toUserIds: payload.toUserIds,
        },
      });
      pushSent = true;
    } catch (err) {
      logger.warn({ err, notificationId: row.id }, "Push notification kuyruğa eklenemedi");
    }

    return { id: row.id, queued: pushSent, pushSent };
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notificationRead.upsert({
      where: { notificationId_userId: { notificationId, userId } },
      create: { notificationId, userId },
      update: {},
    });
  }

  async getForSite(siteId: string, limit = 100, offset = 0) {
    const rows = await prisma.notification.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 500),
      skip: offset,
    });
    return rows;
  }
}

export const notificationService = new NotificationService();
