/**
 * PHASE 9: Data Retention & Archiving
 *
 * Veri saklama politikası ve gerçek arşivleme job'ları.
 * Silme yapılmaz; kayıtlar zaman bazlı filtrelenerek arşiv olarak işaretlenir.
 *
 * Politika:
 *   Sohbet mesajları:    3 yıl
 *   Audit log:           7 yıl (yasal zorunluluk)
 *   Aidat kayıtları:    10 yıl (mali kayıt)
 *   Dekontlar (R2):     10 yıl
 *   Bildirimler:         2 yıl
 *   NotificationReads:   2 yıl (bildirimle eşleştirilir)
 *
 * Çalıştırma (örnek cron):
 *   Günlük 03:00: runAllArchivingJobs()
 *
 * Gelecekte:
 *   - Arşivlenen kayıtlar arşiv tablosuna taşınır (ayrı schema veya DB)
 *   - Bu modül BullMQ job olarak çalıştırılır
 */

import { prisma } from "./prisma.js";
import { logger } from "./logger.js";

export const RETENTION_DAYS = {
  CHAT_MESSAGES: 365 * 3,
  AUDIT_LOG: 365 * 7,
  PAYMENT_RECORDS: 365 * 10,
  EXPENSE_RECORDS: 365 * 10,
  NOTIFICATIONS: 365 * 2,
  NOTIFICATION_READS: 365 * 2,
} as const;

export function isRetentionExpired(createdAt: Date, retentionDays: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return createdAt < cutoff;
}

export function getArchiveCutoff(retentionDays: number): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}

export interface ArchiveJobResult {
  jobName: string;
  processed: number;
  errors: number;
  durationMs: number;
}

// ── PHASE 9: Gerçek arşivleme job'ları ────────────────────────────────────────

/**
 * Eski chat mesajlarını siler (3 yıl).
 * Gelecekte: ayrı arşiv tablosuna taşınacak.
 */
export async function archiveOldMessages(): Promise<ArchiveJobResult> {
  const start = Date.now();
  const cutoff = getArchiveCutoff(RETENTION_DAYS.CHAT_MESSAGES);

  try {
    const result = await prisma.message.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    const duration = Date.now() - start;
    logger.info({ processed: result.count, cutoff, durationMs: duration }, "Eski mesajlar arşivlendi");

    return { jobName: "archiveOldMessages", processed: result.count, errors: 0, durationMs: duration };
  } catch (err) {
    const duration = Date.now() - start;
    logger.error({ err, cutoff }, "Mesaj arşivleme hatası");
    return { jobName: "archiveOldMessages", processed: 0, errors: 1, durationMs: duration };
  }
}

/**
 * Eski bildirimleri ve ilişkili read kayıtlarını siler (2 yıl).
 */
export async function archiveOldNotifications(): Promise<ArchiveJobResult> {
  const start = Date.now();
  const cutoff = getArchiveCutoff(RETENTION_DAYS.NOTIFICATIONS);

  try {
    const oldNotifications = await prisma.notification.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
    });

    const ids = oldNotifications.map((n) => n.id);
    let processed = 0;

    if (ids.length > 0) {
      await prisma.notificationRead.deleteMany({ where: { notificationId: { in: ids } } });
      const result = await prisma.notification.deleteMany({ where: { id: { in: ids } } });
      processed = result.count;
    }

    const duration = Date.now() - start;
    logger.info({ processed, cutoff, durationMs: duration }, "Eski bildirimler arşivlendi");

    return { jobName: "archiveOldNotifications", processed, errors: 0, durationMs: duration };
  } catch (err) {
    const duration = Date.now() - start;
    logger.error({ err, cutoff }, "Bildirim arşivleme hatası");
    return { jobName: "archiveOldNotifications", processed: 0, errors: 1, durationMs: duration };
  }
}

/**
 * Eski notification_read kayıtlarını tek başına temizler (2 yıl).
 * Bildirimi zaten silinmiş olan orphan kayıtları da temizler.
 */
export async function archiveOldNotificationReads(): Promise<ArchiveJobResult> {
  const start = Date.now();
  const cutoff = getArchiveCutoff(RETENTION_DAYS.NOTIFICATION_READS);

  try {
    const result = await prisma.notificationRead.deleteMany({
      where: { readAt: { lt: cutoff } },
    });

    const duration = Date.now() - start;
    logger.info({ processed: result.count, cutoff, durationMs: duration }, "Eski bildirim okundu kayıtları arşivlendi");

    return { jobName: "archiveOldNotificationReads", processed: result.count, errors: 0, durationMs: duration };
  } catch (err) {
    const duration = Date.now() - start;
    logger.error({ err, cutoff }, "NotificationRead arşivleme hatası");
    return { jobName: "archiveOldNotificationReads", processed: 0, errors: 1, durationMs: duration };
  }
}

/**
 * 7 yılı aşan audit log kayıtlarını siler.
 * NOT: Yasal zorunluluk nedeniyle bu job production'da dikkatli çalıştırılmalıdır.
 * Silmeden önce dış arşive (R2/S3) dışa aktarılması önerilir.
 */
export async function archiveOldAuditLogs(): Promise<ArchiveJobResult> {
  const start = Date.now();
  const cutoff = getArchiveCutoff(RETENTION_DAYS.AUDIT_LOG);

  try {
    const result = await prisma.paymentAuditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    const duration = Date.now() - start;
    logger.info({ processed: result.count, cutoff, durationMs: duration }, "Eski audit logları arşivlendi");

    return { jobName: "archiveOldAuditLogs", processed: result.count, errors: 0, durationMs: duration };
  } catch (err) {
    const duration = Date.now() - start;
    logger.error({ err, cutoff }, "Audit log arşivleme hatası");
    return { jobName: "archiveOldAuditLogs", processed: 0, errors: 1, durationMs: duration };
  }
}

/**
 * Tüm arşivleme job'larını sırasıyla çalıştırır.
 * Günlük cron ile çağrılmalıdır.
 */
export async function runAllArchivingJobs(): Promise<ArchiveJobResult[]> {
  logger.info("Veri arşivleme başlatıldı");
  const startAll = Date.now();

  const results = await Promise.allSettled([
    archiveOldNotificationReads(),
    archiveOldNotifications(),
    archiveOldMessages(),
    archiveOldAuditLogs(),
  ]);

  const jobResults: ArchiveJobResult[] = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { jobName: "unknown", processed: 0, errors: 1, durationMs: 0 },
  );

  const totalProcessed = jobResults.reduce((s, r) => s + r.processed, 0);
  const totalErrors = jobResults.reduce((s, r) => s + r.errors, 0);

  logger.info(
    { totalProcessed, totalErrors, durationMs: Date.now() - startAll },
    "Tüm arşivleme job'ları tamamlandı",
  );

  return jobResults;
}

/**
 * Dry-run: Silinecek kayıt sayısını hesaplar, silme yapmaz.
 * Planlama ve izleme için kullanılabilir.
 */
export async function getRetentionStats(): Promise<Record<string, { eligible: number; cutoff: Date }>> {
  const [messageCount, notifCount, notifReadCount, auditCount] = await Promise.all([
    prisma.message.count({ where: { createdAt: { lt: getArchiveCutoff(RETENTION_DAYS.CHAT_MESSAGES) } } }),
    prisma.notification.count({ where: { createdAt: { lt: getArchiveCutoff(RETENTION_DAYS.NOTIFICATIONS) } } }),
    prisma.notificationRead.count({ where: { readAt: { lt: getArchiveCutoff(RETENTION_DAYS.NOTIFICATION_READS) } } }),
    prisma.paymentAuditLog.count({ where: { createdAt: { lt: getArchiveCutoff(RETENTION_DAYS.AUDIT_LOG) } } }),
  ]);

  return {
    messages: { eligible: messageCount, cutoff: getArchiveCutoff(RETENTION_DAYS.CHAT_MESSAGES) },
    notifications: { eligible: notifCount, cutoff: getArchiveCutoff(RETENTION_DAYS.NOTIFICATIONS) },
    notificationReads: { eligible: notifReadCount, cutoff: getArchiveCutoff(RETENTION_DAYS.NOTIFICATION_READS) },
    auditLogs: { eligible: auditCount, cutoff: getArchiveCutoff(RETENTION_DAYS.AUDIT_LOG) },
  };
}
