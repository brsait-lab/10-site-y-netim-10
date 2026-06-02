-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: finance_security_hardening
-- Tarih: 2026-06-02
-- Kapsam:
--   1. UserPayment duplicate koruma (partial unique index)
--   2. Payment (siteId, type) performans index
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Duplicate temizleme (güvenli — mevcut verileri korur) ─────────────────

-- Aynı (paymentId, unitKey) çifti için sadece en yeni kaydı tut
DELETE FROM "user_payments"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("payment_id", "unit_key") "id"
  FROM "user_payments"
  WHERE "unit_key" IS NOT NULL
  ORDER BY "payment_id", "unit_key", "id" DESC
)
AND "unit_key" IS NOT NULL;

-- Aynı (paymentId, userId) çifti için sadece en yeni kaydı tut
DELETE FROM "user_payments"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("payment_id", "user_id") "id"
  FROM "user_payments"
  WHERE "user_id" IS NOT NULL
  ORDER BY "payment_id", "user_id", "id" DESC
)
AND "user_id" IS NOT NULL;

-- ── 2. Partial unique index: (paymentId, unitKey) — unit-based ödemeler ──────
-- NULL unitKey satırları bu kısıtlamayı etkilemez (personal_charge)
CREATE UNIQUE INDEX IF NOT EXISTS "user_payments_payment_id_unit_key_unique"
  ON "user_payments"("payment_id", "unit_key")
  WHERE "unit_key" IS NOT NULL;

-- ── 3. Partial unique index: (paymentId, userId) — personal_charge ödemeler ─
-- NULL userId satırları bu kısıtlamayı etkilemez (unit-based)
CREATE UNIQUE INDEX IF NOT EXISTS "user_payments_payment_id_user_id_unique"
  ON "user_payments"("payment_id", "user_id")
  WHERE "user_id" IS NOT NULL;

-- ── 4. Payment (siteId, type) performans index ───────────────────────────────
CREATE INDEX IF NOT EXISTS "payments_site_id_type_idx"
  ON "payments"("site_id", "type");
