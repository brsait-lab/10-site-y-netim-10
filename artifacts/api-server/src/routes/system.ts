/**
 * PHASE B + C — System Monitoring Endpoints
 *
 * TASK B4:  GET /system/queues       — BullMQ queue health (admin only)
 * TASK B5:  GET /system/health       — Component health + latency (public)
 * TASK B8:  GET /system/metrics      — Operational metrics (admin only)
 * TASK C4:  GET /system/slow-queries — Slow query report + index recs (admin only)
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { getRedis } from "../lib/redis.js";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";
import { getBullMQProvider } from "../lib/queueState.js";
import { getSocketCount } from "../lib/wsState.js";
import { cacheStats } from "../lib/cache.js";
import { getSlowQueryReport } from "../lib/slowQueryBuffer.js";

const router = Router();
const blockNonAdmin = blockRoles("merchant", "resident", "security");
const startTime = Date.now();

// ── GET /system/health — public ───────────────────────────────────────────────
router.get("/system/health", async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latencyMs?: number; detail?: string }> = {};

  // PostgreSQL
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks["postgresql"] = { status: "ok", latencyMs: Date.now() - t0 };
  } catch (err) {
    checks["postgresql"] = { status: "error", detail: (err as Error).message };
  }

  // Redis
  try {
    const t0 = Date.now();
    const redis = getRedis();
    await redis.ping();
    checks["redis"] = { status: "ok", latencyMs: Date.now() - t0 };
  } catch (err) {
    checks["redis"] = { status: "error", detail: (err as Error).message };
  }

  // BullMQ
  const queueProvider = getBullMQProvider();
  if (queueProvider) {
    try {
      const t0 = Date.now();
      await queueProvider.size();
      checks["bullmq"] = { status: "ok", latencyMs: Date.now() - t0 };
    } catch (err) {
      checks["bullmq"] = { status: "error", detail: (err as Error).message };
    }
  } else {
    checks["bullmq"] = { status: "degraded", detail: "InMemory fallback aktif" };
  }

  // WebSocket
  checks["websocket"] = { status: "ok", detail: `${getSocketCount()} bağlantı aktif` };

  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const anyError = Object.values(checks).some((c) => c.status === "error");

  res.status(anyError ? 503 : 200).json({
    status: anyError ? "error" : allOk ? "ok" : "degraded",
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    checks,
  });
});

// ── GET /system/queues — admin only ──────────────────────────────────────────
router.get("/system/queues", requireAuth, blockNonAdmin, async (_req: Request, res: Response) => {
  const queueProvider = getBullMQProvider();

  if (!queueProvider) {
    res.json({ provider: "in_memory", detail: "BullMQ/Redis aktif değil — InMemory kuyruk kullanılıyor" });
    return;
  }

  try {
    const counts = await queueProvider.getJobCounts();
    res.json({ provider: "bullmq", ...counts });
  } catch (err) {
    res.status(500).json({ message: "Kuyruk istatistikleri alınamadı", error: (err as Error).message });
  }
});

// ── GET /system/metrics — admin only ─────────────────────────────────────────
router.get("/system/metrics", requireAuth, blockNonAdmin, async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;

  const queueProvider = getBullMQProvider();
  let queueCounts: Record<string, number> = {};

  try {
    if (queueProvider) queueCounts = await queueProvider.getJobCounts();
  } catch { /* no-op */ }

  const total = cacheStats.hits + cacheStats.misses;
  const hitRatio = total > 0 ? Math.round((cacheStats.hits / total) * 100) : 0;

  res.json({
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    websocket: { activeConnections: getSocketCount() },
    queue: { provider: queueProvider ? "bullmq" : "in_memory", ...queueCounts },
    cache: { hits: cacheStats.hits, misses: cacheStats.misses, hitRatioPct: hitRatio },
    context: { siteId },
  });
});

// ── GET /system/slow-queries — admin only (C4) ────────────────────────────────
router.get("/system/slow-queries", requireAuth, blockNonAdmin, (_req: Request, res: Response) => {
  const report = getSlowQueryReport();
  res.json({
    ...report,
    thresholds: { infoMs: 100, warnMs: 250, errorMs: 1000 },
    note: "Son 500 yavaş sorgu bellekte tutulur. Yeniden başlatmada sıfırlanır.",
  });
});

export default router;
