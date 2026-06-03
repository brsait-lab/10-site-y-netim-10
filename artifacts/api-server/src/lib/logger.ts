/**
 * PHASE 7: Enhanced structured logger
 *
 * Pino logger ile yapılandırılmış loglama.
 * Her log kaydına otomatik olarak requestId, userId, siteId, role eklenir.
 *
 * Kullanım:
 *   import { logger, createRequestLogger } from "./logger.js";
 *   logger.info({ userId, siteId }, "İşlem tamamlandı");
 *
 * requestLogger middleware: pino-http ile her isteğe requestId atar.
 * Child logger: createChildLogger({ userId, siteId, role }) kullanın.
 */

import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
    "*.passwordHash",
    "*.password",
    "*.token",
  ],
  base: {
    env: process.env.NODE_ENV ?? "development",
    service: "site-yonetim-api",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }),
});

export interface RequestContext {
  requestId: string;
  userId?: string;
  siteId?: string;
  role?: string;
}

export function createChildLogger(ctx: RequestContext) {
  return logger.child(ctx);
}
