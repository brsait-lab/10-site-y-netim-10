import express, { type Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
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

// ── Endpoint bazlı rate limit'ler (global sınırdan önce uygulanır) ───────────
// Auth: brute-force koruması
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Site arama: join-code keşif koruması
app.use("/api/sites/lookup", siteLookupLimiter);

// Mesajlar: spam koruması
app.use("/api/messages", messageLimiter);

// Bildirimler: spam koruması
app.use("/api/notifications", notificationLimiter);

// Aidat işlemleri: finansal işlem güvenliği
app.use("/api/user-payments", paymentLimiter);
app.use("/api/payments", paymentLimiter);

// Dosya yükleme: R2 maliyet koruması
app.use("/api/upload", uploadLimiter);

// Vendor talepleri: spam koruması
app.use("/api/vendor-requests", vendorRequestLimiter);

// ── Request logging ───────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
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
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── Global error handling middleware ──────────────────────────────────────────
// Yakalanmamış hatalar yapılandırılmış log ile kayıt altına alınır.
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
    },
    "Unhandled server error",
  );
  res.status(500).json({ message: "Sunucu hatası. Lütfen tekrar deneyin." });
});

export default app;
