-- ═══════════════════════════════════════════════════════════════════
-- Migration: refresh_tokens + missing performance indexes
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. RefreshToken table ─────────────────────────────────────────
CREATE TABLE "refresh_tokens" (
    "id"         TEXT        NOT NULL,
    "token"      TEXT        NOT NULL,
    "user_id"    TEXT        NOT NULL,
    "family"     TEXT        NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_token_key"   ON "refresh_tokens"("token");
CREATE INDEX       "refresh_tokens_user_id_idx"  ON "refresh_tokens"("user_id");
CREATE INDEX       "refresh_tokens_token_idx"    ON "refresh_tokens"("token");
CREATE INDEX       "refresh_tokens_family_idx"   ON "refresh_tokens"("family");

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. messages(from_id) ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "messages_from_id_idx"
  ON "messages"("from_id");

-- ── 3. vendor_requests(requested_by) ────────────────────────────
CREATE INDEX IF NOT EXISTS "vendor_requests_requested_by_idx"
  ON "vendor_requests"("requested_by");

-- ── 4. user_payments(user_id, site_id, status) composite ─────────
CREATE INDEX IF NOT EXISTS "user_payments_user_id_site_id_status_idx"
  ON "user_payments"("user_id", "site_id", "status");

-- ── 5. notifications(from_user_id, created_at DESC) ──────────────
CREATE INDEX IF NOT EXISTS "notifications_from_user_id_created_at_idx"
  ON "notifications"("from_user_id", "created_at" DESC);
