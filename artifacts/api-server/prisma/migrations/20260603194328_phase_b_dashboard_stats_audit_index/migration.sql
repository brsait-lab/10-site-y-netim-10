-- CreateTable
CREATE TABLE "dashboard_stats" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "total_users" INTEGER NOT NULL DEFAULT 0,
    "total_payments" INTEGER NOT NULL DEFAULT 0,
    "paid_payments" INTEGER NOT NULL DEFAULT 0,
    "pending_payments" INTEGER NOT NULL DEFAULT 0,
    "overdue_payments" INTEGER NOT NULL DEFAULT 0,
    "total_expenses" INTEGER NOT NULL DEFAULT 0,
    "total_expense_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_stats_site_id_key" ON "dashboard_stats"("site_id");

-- CreateIndex
CREATE INDEX "payment_audit_logs_action_created_at_idx" ON "payment_audit_logs"("action", "created_at" DESC);
