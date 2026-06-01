-- AlterTable
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active';

-- CreateIndex
CREATE INDEX "chat_participants_user_id_idx" ON "chat_participants"("user_id");

-- CreateIndex
CREATE INDEX "chats_site_id_created_at_idx" ON "chats"("site_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "messages_chat_id_created_at_idx" ON "messages"("chat_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "notification_reads_notification_id_idx" ON "notification_reads"("notification_id");

-- CreateIndex
CREATE INDEX "notification_reads_user_id_idx" ON "notification_reads"("user_id");

-- CreateIndex
CREATE INDEX "notifications_site_id_created_at_idx" ON "notifications"("site_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "packages_site_id_received_at_idx" ON "packages"("site_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "packages_recipient_user_id_idx" ON "packages"("recipient_user_id");

-- CreateIndex
CREATE INDEX "payments_site_id_created_at_idx" ON "payments"("site_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payments_site_id_cancelled_at_idx" ON "payments"("site_id", "cancelled_at");

-- CreateIndex
CREATE INDEX "user_payments_payment_id_idx" ON "user_payments"("payment_id");

-- CreateIndex
CREATE INDEX "user_payments_user_id_idx" ON "user_payments"("user_id");

-- CreateIndex
CREATE INDEX "user_payments_site_id_status_idx" ON "user_payments"("site_id", "status");

-- CreateIndex
CREATE INDEX "users_site_id_idx" ON "users"("site_id");

-- CreateIndex
CREATE INDEX "users_site_id_deleted_at_idx" ON "users"("site_id", "deleted_at");

-- CreateIndex
CREATE INDEX "users_site_id_status_idx" ON "users"("site_id", "status");

-- CreateIndex
CREATE INDEX "vendor_requests_site_id_created_at_idx" ON "vendor_requests"("site_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "vendor_requests_vendor_id_idx" ON "vendor_requests"("vendor_id");

-- CreateIndex
CREATE INDEX "vendors_user_id_idx" ON "vendors"("user_id");

-- CreateIndex
CREATE INDEX "vendors_status_idx" ON "vendors"("status");
