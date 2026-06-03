-- Migration: push_notification_preparation
-- Push bildirim altyapısı için User tablosuna 3 alan eklendi.
-- Gerçek push gönderimi bu migrationda yapılmaz.
-- FCM/APNs entegrasyonu ayrı bir sprint'te uygulanacak.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "push_token"    TEXT,
  ADD COLUMN IF NOT EXISTS "push_platform" TEXT,
  ADD COLUMN IF NOT EXISTS "last_push_at"  TIMESTAMPTZ;
