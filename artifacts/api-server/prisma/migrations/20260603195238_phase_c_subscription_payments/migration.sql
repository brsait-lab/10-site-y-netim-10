-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "payment_interval" TEXT NOT NULL DEFAULT 'monthly';

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "interval" TEXT NOT NULL DEFAULT 'monthly',
    "provider_token" TEXT,
    "provider_ref" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_payments_site_id_created_at_idx" ON "subscription_payments"("site_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "subscription_payments_subscription_id_idx" ON "subscription_payments"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_payments_provider_token_idx" ON "subscription_payments"("provider_token");

-- CreateIndex
CREATE INDEX "subscription_payments_provider_ref_idx" ON "subscription_payments"("provider_ref");

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
