/**
 * PHASE 11:
 *   PRIORITY 1 — Archiving scheduler (node-cron, her gün 03:00)
 *   PRIORITY 5 — Sentry error monitoring (uncaught + unhandled + express 500)
 */

// ── PRIORITY 5: Sentry — en erken initialize edilmeli ────────────────────────
import * as Sentry from "@sentry/node";

const SENTRY_DSN = process.env["SENTRY_DSN"];

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env["NODE_ENV"] ?? "development",
    tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.2 : 1.0,
  });
  console.log("[SENTRY] Sentry başlatıldı ✓");
} else {
  console.warn("[SENTRY] WARNING: SENTRY_DSN ayarlanmamış. Hata izleme devre dışı.");
}

// ── Uncaught exception & unhandled rejection ─────────────────────────────────
process.on("uncaughtException", (err) => {
  if (SENTRY_DSN) Sentry.captureException(err);
  console.error("[FATAL] Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  if (SENTRY_DSN) Sentry.captureException(reason);
  console.error("[FATAL] Unhandled Rejection:", reason);
});

import { validateAllSecrets } from "./lib/secrets.js";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startScheduler } from "./lib/scheduler.js";

// ─── Fail-fast secret validation ─────────────────────────────────────────────
validateAllSecrets();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── PRIORITY 1: Arşivleme cron schedule ──────────────────────────────────────
startScheduler();

app.listen(port, (err) => {
  if (err) {
    if (SENTRY_DSN) Sentry.captureException(err);
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, sentry: !!SENTRY_DSN }, "Server listening");
});
