-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: extend_architecture
-- Tarih: 2026-06-01
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. KVKK: Kullanıcı rıza alanları
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_given" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_at" TIMESTAMP(3);

-- 2. Soft-delete for Sites
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- 3. Mevcut sütunlar (init migration'da eksik kalanlar)
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "join_code" TEXT;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "settlement_type" TEXT NOT NULL DEFAULT 'site';
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "bank_name" TEXT;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "account_holder" TEXT;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "iban" TEXT;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "block" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tower" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "villa_no" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "floor" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "office_no" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

-- 4. Aidat: Payment iptal + hedefleme
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "created_by" TEXT NOT NULL DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "target_blocks" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "target_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 5. UserPayment: ödeme notu + makbuz
ALTER TABLE "user_payments" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "user_payments" ADD COLUMN IF NOT EXISTS "receipt_url" TEXT;

-- 6. AdminTransfer: devir sebebi + tablo oluşturma (eğer yoksa)
CREATE TABLE IF NOT EXISTS "admin_transfers" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "old_admin_id" TEXT NOT NULL,
    "new_admin_id" TEXT NOT NULL,
    "transferred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    CONSTRAINT "admin_transfers_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "admin_transfers" ADD COLUMN IF NOT EXISTS "reason" TEXT;
