import IORedis from "ioredis";
import { logger } from "./logger.js";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://127.0.0.1:6379";

function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: parsed.port ? Number(parsed.port) : 6379,
      ...(parsed.password ? { password: parsed.password } : {}),
    };
  } catch {
    return { host: "127.0.0.1", port: 6379 };
  }
}

let _cache: IORedis | null = null;

export function getRedis(): IORedis {
  if (!_cache) {
    _cache = new IORedis(REDIS_URL, {
      enableReadyCheck: false,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    });
    _cache.on("connect", () => logger.info("[REDIS] Cache bağlantısı kuruldu ✓"));
    _cache.on("error", (err: Error) => logger.warn({ err: err.message }, "[REDIS] Cache bağlantı hatası"));
  }
  return _cache;
}

/** BullMQ için connection options — 10 denemeden sonra bağlantı kesilir */
export function getBullMQConnectionOptions() {
  const { host, port, password } = parseRedisUrl(REDIS_URL);
  return {
    host,
    port,
    ...(password ? { password } : {}),
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      if (times > 10) return null;
      return Math.min(times * 500, 5000);
    },
  };
}

/**
 * Redis'in hazır olup olmadığını kontrol eder.
 * Sunucu başlamadan önce BullMQ'yu güvenli şekilde başlatmak için kullanılır.
 */
export async function checkRedisAvailable(timeoutMs = 3000): Promise<boolean> {
  const probe = new IORedis({
    host: "127.0.0.1",
    port: 6379,
    connectTimeout: timeoutMs,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: true,
  });
  try {
    await probe.connect();
    await probe.ping();
    return true;
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

export const redisUrl = REDIS_URL;
