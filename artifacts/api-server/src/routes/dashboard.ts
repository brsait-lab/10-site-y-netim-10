/**
 * PHASE B TASK 1 — Dashboard Aggregation Endpoint
 *
 * GET /dashboard/stats
 *   Reads from pre-computed dashboard_stats table (zero live COUNT queries).
 *   Falls back to inline refresh on first request for a site.
 *   Redis cache: 60s TTL.
 */

import { Router, Request, Response } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";
import { dashboardService } from "../services/DashboardService.js";
import { cacheGet, cacheSet } from "../lib/cache.js";

const router = Router();
const CACHE_TTL = 60;

router.get("/dashboard/stats", requireAuth, async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const cacheKey = `cache:dashboard:${siteId}`;

  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const stats = await dashboardService.getOrRefresh(siteId);
  if (!stats) {
    res.status(404).json({ message: "Dashboard stats bulunamadı." });
    return;
  }

  await cacheSet(cacheKey, stats, CACHE_TTL);
  res.json(stats);
});

export default router;
