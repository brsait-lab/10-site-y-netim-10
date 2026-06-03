/**
 * Veri saklama politikası.
 * Arşivleme (silme değil) prensibi uygulanır.
 *
 * Politika:
 *   Sohbet mesajları:    3 yıl
 *   Audit log:           7 yıl
 *   Aidat kayıtları:    10 yıl
 *   Dekontlar (R2):     10 yıl
 *   Bildirimler:         2 yıl
 *
 * Uygulama:
 *   Silme yapılmaz. Kayıtlar `archivedAt` timestamp ile işaretlenir.
 *   Arşivleme, günlük çalışacak bir background job ile yönetilmelidir.
 *   Arşivlenen kayıtlar normal sorgularda hariç tutulur.
 *
 * TODO: Arşivleme job'ı uygulanmamıştır. İlk 90 gün içinde eklenmesi önerilir.
 */

export const RETENTION_DAYS = {
  /** Sohbet mesajları — 3 yıl */
  CHAT_MESSAGES: 365 * 3,

  /** PaymentAuditLog — 7 yıl (yasal zorunluluk) */
  AUDIT_LOG: 365 * 7,

  /** Payment / UserPayment — 10 yıl (mali kayıt) */
  PAYMENT_RECORDS: 365 * 10,

  /** Expense — 10 yıl */
  EXPENSE_RECORDS: 365 * 10,

  /** Notifications — 2 yıl */
  NOTIFICATIONS: 365 * 2,
} as const;

/** Verilen tarihin saklama süresi dolmuş mu kontrol eder. */
export function isRetentionExpired(
  createdAt: Date,
  retentionDays: number,
): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return createdAt < cutoff;
}

/** Arşivleme cutoff tarihini hesaplar. */
export function getArchiveCutoff(retentionDays: number): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}
