import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";
import { getRequestContext } from "./requestContext.js";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"]! });
const adapter = new PrismaPg(pool);

/** Export pool for /system/metrics DB connection count. */
export { pool as dbPool };

const _base = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

/**
 * PHASE B TASK 3 — Slow Query Monitoring
 *
 * Thresholds:
 *   100ms  → info   (noticeable but not alarming)
 *   250ms  → warn   (investigate soon)
 *   1000ms → error  (critical bottleneck)
 *
 * Context: requestId / userId / siteId from AsyncLocalStorage (populated by
 * app.ts requestContext middleware + requireAuth.ts setContextValues call).
 */
export const prisma = _base.$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        const start = Date.now();
        const result = await query(args);
        const duration = Date.now() - start;

        if (duration > 1000) {
          const ctx = getRequestContext();
          logger.error(
            { duration, model, operation, ...ctx },
            "[DB] Çok yavaş sorgu — 1000ms aşıldı ⚠",
          );
        } else if (duration > 250) {
          const ctx = getRequestContext();
          logger.warn(
            { duration, model, operation, ...ctx },
            "[DB] Yavaş sorgu — 250ms aşıldı",
          );
        } else if (duration > 100) {
          const ctx = getRequestContext();
          logger.info(
            { duration, model, operation, ...ctx },
            "[DB] Dikkat: sorgu 100ms aştı",
          );
        }

        return result;
      },
    },
  },
});
