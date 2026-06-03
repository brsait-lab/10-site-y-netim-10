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
import type { AuthRequest } from "./middlewares/requireAuth.js";

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

// ── PHASE 11 PRIORITY 4: Observability — requestId + userId + siteId + role ──
// pinoHttp response zamanında loglar (res.on('finish')).
// Bu noktada requireAuth çoktan çalışmış olduğu için req.authUser doludur.
// customProps: auth alanlarını log kaydının üst seviyesine taşır.
// serializers.req: method, url, requestId'i loglar.
app.use(
  pinoHttp({
    logger,
    genReqId: () => randomUUID(),

    // Auth context — response zamanında değerlendirilir (requireAuth çalıştıktan sonra)
    customProps(req: Request) {
      const authUser = (req as AuthRequest).authUser;
      return {
        requestId: (req as Request & { id?: string }).id,
        userId: authUser?.userId ?? undefined,
        siteId: authUser?.siteId ?? undefined,
        role: authUser?.role ?? undefined,
      };
    },

    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },

    customLogLevel(_req, res, err) {
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
  const authUser = (req as AuthRequest).authUser;

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
      userId: authUser?.userId,
      siteId: authUser?.siteId,
      role: authUser?.role,
    },
    "Unhandled server error",
  );
  res.status(500).json({ message: "Sunucu hatası. Lütfen tekrar deneyin." });
});

export default app;
