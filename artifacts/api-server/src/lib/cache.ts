import { getRedis } from "./redis.js";
import { logger } from "./logger.js";

const DEFAULT_TTL = 300;

/** In-memory hit/miss counters — exposed to /system/metrics. */
export const cacheStats = { hits: 0, misses: 0 };

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis();
    const val = await redis.get(key);
    if (!val) {
      cacheStats.misses++;
      return null;
    }
    cacheStats.hits++;
    return JSON.parse(val) as T;
  } catch {
    cacheStats.misses++;
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = DEFAULT_TTL): Promise<void> {
  try {
    const redis = getRedis();
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.debug({ err, key }, "[CACHE] set başarısız (non-fatal)");
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(key);
  } catch {}
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const redis = getRedis();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {}
}
