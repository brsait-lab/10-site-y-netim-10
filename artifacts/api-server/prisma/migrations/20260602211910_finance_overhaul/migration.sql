-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "month" INTEGER,
ADD COLUMN     "period" TEXT,
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "user_payments" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "paid_by_user_id" TEXT,
ADD COLUMN     "payment_method" TEXT,
ADD COLUMN     "unit_key" TEXT,
ALTER COLUMN "user_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "payment_audit_logs" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "user_payment_id" TEXT,
    "action" TEXT NOT NULL,
    "performed_by" TEXT NOT NULL,
    "performed_by_name" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "document_url" TEXT,
    "year" INTEGER,
    "month" INTEGER,
    "period" TEXT,
    "created_by" TEXT NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_audit_logs_site_id_created_at_idx" ON "payment_audit_logs"("site_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payment_audit_logs_payment_id_idx" ON "payment_audit_logs"("payment_id");

-- CreateIndex
CREATE INDEX "payment_audit_logs_user_payment_id_idx" ON "payment_audit_logs"("user_payment_id");

-- CreateIndex
CREATE INDEX "expenses_site_id_created_at_idx" ON "expenses"("site_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "expenses_site_id_year_month_idx" ON "expenses"("site_id", "year", "month");

-- CreateIndex
CREATE INDEX "payments_site_id_year_month_idx" ON "payments"("site_id", "year", "month");

-- CreateIndex
CREATE INDEX "user_payments_unit_key_site_id_idx" ON "user_payments"("unit_key", "site_id");
