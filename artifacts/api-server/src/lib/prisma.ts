import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"]! });
const adapter = new PrismaPg(pool);

const _base = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

export const prisma = _base.$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        const start = Date.now();
        const result = await query(args);
        const duration = Date.now() - start;

        if (duration > 1000) {
          logger.error(
            { duration, model, operation },
            "[DB] Çok yavaş sorgu — 1000ms aşıldı ⚠",
          );
        } else if (duration > 200) {
          logger.warn(
            { duration, model, operation },
            "[DB] Yavaş sorgu — 200ms aşıldı",
          );
        }

        return result;
      },
    },
  },
});
