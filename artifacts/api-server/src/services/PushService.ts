/**
 * PHASE 5: Push Notification Service
 *
 * Expo Push, FCM, APNs gibi servislere soyutlanmış push gönderim katmanı.
 *
 * Mevcut implementasyon Expo Push Notifications API'yi kullanır.
 * Token'lar User.pushToken ve User.pushPlatform alanlarında saklanır.
 *
 * Genişleme yolu:
 *   - FCMProvider: Firebase Cloud Messaging (Android native)
 *   - APNsProvider: Apple Push Notification Service (iOS native)
 *   - ExpoProvider: Expo Push (mevcut)
 */

import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

export interface PushPayload {
  siteId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  toRoles?: string[];
  toUserIds?: string[];
}

export interface PushResult {
  sent: number;
  failed: number;
  skipped: number;
}

export interface PushProvider {
  send(tokens: string[], title: string, body: string, data?: Record<string, unknown>): Promise<{ sent: number; failed: number }>;
}

class ExpoPushProvider implements PushProvider {
  private readonly EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

  async send(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<{ sent: number; failed: number }> {
    if (tokens.length === 0) return { sent: 0, failed: 0 };

    const CHUNK_SIZE = 100;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
      const chunk = tokens.slice(i, i + CHUNK_SIZE);
      const messages = chunk.map((token) => ({
        to: token,
        title,
        body,
        data: data ?? {},
        sound: "default",
      }));

      try {
        const response = await fetch(this.EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(messages),
        });

        if (!response.ok) {
          logger.error({ status: response.status }, "Expo Push API hatası");
          failed += chunk.length;
          continue;
        }

        const result = (await response.json()) as { data: Array<{ status: string }> };
        for (const item of result.data) {
          if (item.status === "ok") sent++;
          else failed++;
        }
      } catch (err) {
        logger.error({ err }, "Expo Push gönderilemedi");
        failed += chunk.length;
      }
    }

    return { sent, failed };
  }
}

class PushService {
  constructor(private provider: PushProvider = new ExpoPushProvider()) {}

  async sendToTargets(payload: PushPayload): Promise<PushResult> {
    const { siteId, title, body, data, toRoles, toUserIds } = payload;

    const where: Record<string, unknown> = {
      siteId,
      pushToken: { not: null },
      deletedAt: null,
      status: "active",
    };

    if (toUserIds && toUserIds.length > 0) {
      where["id"] = { in: toUserIds };
    } else if (toRoles && toRoles.length > 0) {
      where["role"] = { in: toRoles };
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, pushToken: true, pushPlatform: true },
    });

    const tokens = users
      .map((u) => u.pushToken)
      .filter((t): t is string => !!t);

    if (tokens.length === 0) {
      return { sent: 0, failed: 0, skipped: 0 };
    }

    const { sent, failed } = await this.provider.send(tokens, title, body, data);

    await prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { lastPushAt: new Date() },
    });

    logger.info({ siteId, sent, failed, total: tokens.length }, "Push bildirim gönderildi");

    return { sent, failed, skipped: users.length - tokens.length };
  }

  useProvider(provider: PushProvider): void {
    this.provider = provider;
  }
}

export const pushService = new PushService();
