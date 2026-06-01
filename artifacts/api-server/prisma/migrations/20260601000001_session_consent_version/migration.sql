-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: session_consent_version
-- Tarih: 2026-06-01
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Admin transfer güvenliği: token versiyonu
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;

-- 2. KVKK versiyonlama
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_version" TEXT;
