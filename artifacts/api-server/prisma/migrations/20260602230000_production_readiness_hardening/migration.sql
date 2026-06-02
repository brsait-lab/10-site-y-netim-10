-- Production Readiness Hardening: Eksik indexler ekleniyor
-- Amaç: Full table scan risklerini ortadan kaldır, sorgu performansını güvence altına al

-- AdminTransfer: site bazlı devir sorgularını hızlandır
CREATE INDEX IF NOT EXISTS "admin_transfers_site_id_transferred_at_idx"
  ON "admin_transfers"("site_id", "transferred_at" DESC);

-- UserPayment: stats sorguları (payment bazlı status sayımı) için
CREATE INDEX IF NOT EXISTS "user_payments_payment_id_status_idx"
  ON "user_payments"("payment_id", "status");

-- Expense: cancelledAt: null filtresi (varsayılan liste) için
CREATE INDEX IF NOT EXISTS "expenses_site_id_cancelled_at_idx"
  ON "expenses"("site_id", "cancelled_at");

-- Package: status bazlı filtreleme (bekleyen/teslim edilen kargolar) için
CREATE INDEX IF NOT EXISTS "packages_site_id_status_idx"
  ON "packages"("site_id", "status");

-- VendorRequest: status bazlı filtreleme (pending/completed talepler) için
CREATE INDEX IF NOT EXISTS "vendor_requests_site_id_status_idx"
  ON "vendor_requests"("site_id", "status");
