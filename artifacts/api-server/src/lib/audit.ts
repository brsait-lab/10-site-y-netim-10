/**
 * Merkezi audit log yardımcısı.
 * Tüm route dosyaları bu fonksiyonu kullanmalıdır.
 *
 * Desteklenen action değerleri:
 *   Finans:   payment_created, payment_cancelled, receipt_uploaded,
 *             payment_approved, payment_rejected, payment_manual,
 *             cash_collected, manual_collected
 *   Gider:    expense_created, expense_cancelled
 *   Kullanıcı: user_deleted, admin_transfer
 *   Vendor:   vendor_request_created, vendor_request_updated
 *   Bildirim: notification_sent
 *   Kargo:    package_received, package_delivered
 *
 * Transaction desteği:
 *   client parametresi ile Prisma transaction client kabul eder.
 *   performedByName verilirse ek DB sorgusu yapmaz (transaction içi kullanım için).
 */

import { prisma } from "./prisma.js";
import { Prisma } from "@prisma/client";

export async function addAuditLog(params: {
  siteId: string;
  paymentId?: string;
  userPaymentId?: string;
  action: string;
  performedBy: string;
  performedByName?: string;
  note?: string;
  client?: Prisma.TransactionClient;
}): Promise<void> {
  const db = params.client ?? prisma;

  let actorName = params.performedByName;
  if (!actorName) {
    const actor = await db.user.findUnique({
      where: { id: params.performedBy },
      select: { name: true },
    });
    actorName = actor?.name ?? "Bilinmiyor";
  }

  await db.paymentAuditLog.create({
    data: {
      siteId: params.siteId,
      paymentId: params.paymentId ?? null,
      userPaymentId: params.userPaymentId ?? null,
      action: params.action,
      performedBy: params.performedBy,
      performedByName: actorName,
      note: params.note ?? null,
    },
  });
}
