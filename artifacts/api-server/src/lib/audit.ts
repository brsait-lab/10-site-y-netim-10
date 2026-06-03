/**
 * Merkezi audit log yardımcısı.
 * Tüm route dosyaları bu fonksiyonu kullanmalıdır.
 *
 * Desteklenen action değerleri:
 *   Finans:   payment_created, payment_cancelled, receipt_uploaded,
 *             payment_approved, payment_rejected, payment_manual
 *   Gider:    expense_created, expense_cancelled
 *   Kullanıcı: user_deleted, admin_transfer
 *   Vendor:   vendor_request_created, vendor_request_updated
 *   Bildirim: notification_sent
 *   Kargo:    package_received, package_delivered
 */

import { prisma } from "./prisma.js";

export async function addAuditLog(params: {
  siteId: string;
  paymentId?: string;
  userPaymentId?: string;
  action: string;
  performedBy: string;
  note?: string;
}): Promise<void> {
  const actor = await prisma.user.findUnique({
    where: { id: params.performedBy },
    select: { name: true },
  });

  await prisma.paymentAuditLog.create({
    data: {
      siteId: params.siteId,
      paymentId: params.paymentId ?? null,
      userPaymentId: params.userPaymentId ?? null,
      action: params.action,
      performedBy: params.performedBy,
      performedByName: actor?.name ?? "Bilinmiyor",
      note: params.note ?? null,
    },
  });
}
