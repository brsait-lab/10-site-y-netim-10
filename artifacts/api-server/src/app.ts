import express, { type Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import {
  authLimiter,
  siteLookupLimiter,
  messageLimiter,
  notificationLimiter,
  paymentLimiter,
  uploadLimiter,
  vendorRequestLimiter,
} from "./lib/rateLimiters.js";

const app: Express = express();

app.set("trust proxy", 1);
app.use(helmet());

// ── Global rate limit: 200 istek / 15 dakika ─────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Çok fazla istek. Lütfen bekleyin." },
  }),
);

// ── Endpoint bazlı rate limit'ler ────────────────────────────────────────────
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/sites/lookup", siteLookupLimiter);
app.use("/api/messages", messageLimiter);
app.use("/api/notifications", notificationLimiter);
app.use("/api/user-payments", paymentLimiter);
app.use("/api/payments", paymentLimiter);
app.use("/api/upload", uploadLimiter);
app.use("/api/vendor-requests", vendorRequestLimiter);

// ── PHASE 7: Request ID + Structured logging ──────────────────────────────────
// Her isteğe benzersiz requestId atanır. userId, siteId, role log'a eklenir.
app.use(
  pinoHttp({
    logger,
    genReqId: () => randomUUID(),
    serializers: {
      req(req) {
        const authUser = (req as Request & { authUser?: { userId?: string; siteId?: string; role?: string } }).authUser;
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
          userId: authUser?.userId,
          siteId: authUser?.siteId,
          role: authUser?.role,
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    customLogLevel(req, res, err) {
      if (err) return "error";
      if (res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage(req, res) {
      return `${req.method} ${req.url?.split("?")[0]} ${res.statusCode}`;
    },
    customErrorMessage(req, res, err) {
      return `${req.method} ${req.url?.split("?")[0]} ${res.statusCode} — ${err.message}`;
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── Global error handling middleware ──────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error(
    {
      err: {
        name: err.name,
        message: err.message,
        stack: process.env["NODE_ENV"] !== "production" ? err.stack : undefined,
      },
      url: req.url?.split("?")[0],
      method: req.method,
      requestId: (req as Request & { id?: string }).id,
    },
    "Unhandled server error",
  );
  res.status(500).json({ message: "Sunucu hatası. Lütfen tekrar deneyin." });
});

export default app;
