import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { prisma } from "../lib/prisma.js";
import { checkRedisAvailable } from "../lib/redis.js";

const router: IRouter = Router();

router.get("/healthz", async (_req: Request, res: Response) => {
  const [dbOk, redisOk] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    checkRedisAvailable(2000),
  ]);

  const db: "ok" | "error" = dbOk.status === "fulfilled" && dbOk.value === true ? "ok" : "error";
  const redis: "ok" | "error" = redisOk.status === "fulfilled" && redisOk.value === true ? "ok" : "error";
  const overallStatus = db === "ok" && redis === "ok" ? "ok" : "degraded";

  const data = HealthCheckResponse.parse({
    status: overallStatus,
    db,
    redis,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });

  res.status(overallStatus === "ok" ? 200 : 503).json(data);
});

export default router;
