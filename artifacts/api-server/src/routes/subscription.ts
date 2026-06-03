import { Router, Request, Response } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";
import { checkSubscription } from "../middlewares/requireActiveSubscription.js";
import { cacheGet, cacheSet, cacheDel } from "../lib/cache.js";

const router = Router();

const SUB_TTL = 300;

// ── GET /subscription/status ──────────────────────────────────────────────────
router.get("/subscription/status", requireAuth, async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;
  const key = `cache:subscription:${siteId}`;

  const cached = await cacheGet(key);
  if (cached) {
    res.json(cached);
    return;
  }

  const result = await checkSubscription(siteId);
  await cacheSet(key, result, SUB_TTL);
  res.json(result);
});

export async function invalidateSubscriptionCache(siteId: string): Promise<void> {
  await cacheDel(`cache:subscription:${siteId}`);
}

export default router;
