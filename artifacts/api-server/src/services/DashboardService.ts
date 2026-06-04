/**
 * PHASE B TASK 1 — Dashboard Aggregation Layer
 *
 * Pre-computes site-level stats into the `dashboard_stats` table.
 * BullMQ jobs trigger refresh after payment/expense mutations.
 *
 * Dashboard endpoint reads from this table → zero live COUNT queries.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { cacheDel } from "../lib/cache.js";
import { getIO } from "../lib/wsState.js";

export interface DashboardStatsDto {
  siteId: string;
  totalUsers: number;
  totalPayments: number;
  paidPayments: number;
  pendingPayments: number;
  overduePayments: number;
  totalExpenses: number;
  totalExpenseAmount: number;
  updatedAt: string;
}

class DashboardService {
  /**
   * Recomputes all stats for a site and upserts into dashboard_stats.
   * Called by BullMQ dashboard_stats_update job.
   */
  async refresh(siteId: string): Promise<void> {
    try {
      const [totalUsers, totalPayments, paidPayments, pendingPayments, expenseAgg, overdueResult] =
        await Promise.all([
          prisma.user.count({ where: { siteId, deletedAt: null, status: "active" } }),
          prisma.userPayment.count({ where: { siteId } }),
          prisma.userPayment.count({ where: { siteId, status: "paid" } }),
          prisma.userPayment.count({ where: { siteId, status: "pending" } }),
          prisma.expense.aggregate({
            where: { siteId, cancelledAt: null },
            _count: { id: true },
            _sum: { amount: true },
          }),
          // Overdue: pending payments whose due_date has passed
          // Handles both "DD.MM.YYYY" and "YYYY-MM-DD" string formats
          prisma.$queryRaw<[{ count: bigint }]>(
            Prisma.sql`
              SELECT COUNT(*)::int AS count
              FROM user_payments up
              JOIN payments p ON p.id = up.payment_id
              WHERE up.site_id = ${siteId}
                AND up.status = 'pending'
                AND p.cancelled_at IS NULL
                AND CASE
                  WHEN p.due_date ~ '^[0-9]{2}[.][0-9]{2}[.][0-9]{4}$'
                    THEN to_date(p.due_date, 'DD.MM.YYYY')
                  WHEN p.due_date ~ '^[0-9]{4}[-][0-9]{2}[-][0-9]{2}$'
                    THEN to_date(p.due_date, 'YYYY-MM-DD')
                  ELSE NULL
                END < CURRENT_DATE
            `,
          ),
        ]);

      const overduePayments = Number(overdueResult[0]?.count ?? 0);

      await prisma.dashboardStats.upsert({
        where: { siteId },
        create: {
          siteId,
          totalUsers,
          totalPayments,
          paidPayments,
          pendingPayments,
          overduePayments,
          totalExpenses: expenseAgg._count.id,
          totalExpenseAmount: expenseAgg._sum.amount ?? 0,
        },
        update: {
          totalUsers,
          totalPayments,
          paidPayments,
          pendingPayments,
          overduePayments,
          totalExpenses: expenseAgg._count.id,
          totalExpenseAmount: expenseAgg._sum.amount ?? 0,
        },
      });

      await cacheDel(`cache:dashboard:${siteId}`);
      logger.debug({ siteId }, "[DASHBOARD] Stats güncellendi ✓");

      // Real-time push — reuse already-computed values to avoid extra DB query
      const io = getIO();
      if (io) {
        const now = new Date().toISOString();
        io.to(`site:${siteId}`).emit("dashboard_stats_updated", {
          siteId,
          totalUsers,
          totalPayments,
          paidPayments,
          pendingPayments,
          overduePayments,
          totalExpenses: expenseAgg._count.id,
          totalExpenseAmount: Number(expenseAgg._sum.amount ?? 0),
          updatedAt: now,
        } satisfies DashboardStatsDto);
      }
    } catch (err) {
      logger.error({ err, siteId }, "[DASHBOARD] Stats güncellenemedi");
      throw err;
    }
  }

  /** Reads from dashboard_stats, triggers refresh if row doesn't exist yet. */
  async getOrRefresh(siteId: string): Promise<DashboardStatsDto | null> {
    let row = await prisma.dashboardStats.findUnique({ where: { siteId } });

    if (!row) {
      // First request for this site: build stats inline
      await this.refresh(siteId);
      row = await prisma.dashboardStats.findUnique({ where: { siteId } });
    }

    if (!row) return null;

    return {
      siteId: row.siteId,
      totalUsers: row.totalUsers,
      totalPayments: row.totalPayments,
      paidPayments: row.paidPayments,
      pendingPayments: row.pendingPayments,
      overduePayments: row.overduePayments,
      totalExpenses: row.totalExpenses,
      totalExpenseAmount: Number(row.totalExpenseAmount),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

export const dashboardService = new DashboardService();
