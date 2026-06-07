/**
 * PHASE 11:   Sentry, scheduler, archiving
 * PHASE A:    Socket.IO WebSocket, BullMQ/Redis queue, Redis cache
 */

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

process.on("uncaughtException", (err) => {
  if (SENTRY_DSN) Sentry.captureException(err);
  console.error("[FATAL] Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  if (SENTRY_DSN) Sentry.captureException(reason);
  console.error("[FATAL] Unhandled Rejection:", reason);
});

import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { validateAllSecrets } from "./lib/secrets.js";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startScheduler } from "./lib/scheduler.js";
import { verifyToken, type AuthUser } from "./lib/auth.js";
import { chatService, WebSocketChatProvider } from "./services/ChatService.js";
import { queueService } from "./services/QueueService.js";
import { setIO } from "./lib/wsState.js";
import { setBullMQProvider } from "./lib/queueState.js";

validateAllSecrets();

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

startScheduler();

// ── HTTP server + Socket.IO ────────────────────────────────────────────────
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  path: "/api/socket.io",
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

// Socket.IO JWT auth middleware
io.use((socket, next): void => {
  const token = socket.handshake.auth["token"] as string | undefined;
  if (!token) {
    next(new Error("Kimlik doğrulama başarısız: token eksik"));
    return;
  }
  try {
    const authUser = verifyToken(token);
    (socket as typeof socket & { authUser: AuthUser }).authUser = authUser;
    next();
  } catch {
    next(new Error("Kimlik doğrulama başarısız: geçersiz token"));
  }
});

io.on("connection", (socket) => {
  const authUser = (socket as typeof socket & { authUser: AuthUser }).authUser;
  if (!authUser) { socket.disconnect(); return; }

  // Auto-join site room for notifications
  socket.join(`site:${authUser.siteId}`);

  socket.on("join_chat", (chatId: string) => {
    socket.join(`chat:${chatId}`);
  });

  socket.on("leave_chat", (chatId: string) => {
    socket.leave(`chat:${chatId}`);
  });

  socket.on("disconnect", () => {
    logger.debug({ userId: authUser.userId }, "[WS] Bağlantı kesildi");
  });

  logger.debug({ userId: authUser.userId, siteId: authUser.siteId }, "[WS] Bağlantı kuruldu");
});

// Wire WebSocketChatProvider
chatService.useProvider(new WebSocketChatProvider(io));
setIO(io);
logger.info("[WS] Socket.IO + WebSocketChatProvider aktif ✓");

// ── Socket.IO Redis Adapter (multi-instance scaling) ──────────────────────────
// Enable with: REDIS_ADAPTER_ENABLED=true
// Required when running 2+ API server instances behind a load balancer.
// Broadcasts (io.to(room).emit) fan out across all instances via Redis pub/sub.
if (process.env["REDIS_ADAPTER_ENABLED"] === "true") {
  (async () => {
    try {
      const { createAdapter } = await import("@socket.io/redis-adapter");
      const { getRedis } = await import("./lib/redis.js");
      const pubClient = getRedis();
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      logger.info("[WS] Socket.IO Redis adapter aktif ✓ (çok instance modu)");
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "[WS] Redis adapter başlatılamadı — tek instance modunda devam ediliyor");
    }
  })();
} else {
  logger.info("[WS] Socket.IO tek instance modunda çalışıyor (REDIS_ADAPTER_ENABLED=false)");
}

// ── BullMQ/Redis queue (graceful degradation) ─────────────────────────────
let bullmqProvider: import("./services/BullMQQueueProvider.js").BullMQQueueProvider | null = null;

(async () => {
  try {
    const { checkRedisAvailable } = await import("./lib/redis.js");
    const redisReady = await checkRedisAvailable(3000);
    if (!redisReady) {
      logger.warn("[QUEUE] Redis erişilemiyor — InMemory queue kullanılıyor (BullMQ devre dışı)");
      return;
    }
    const { BullMQQueueProvider } = await import("./services/BullMQQueueProvider.js");
    bullmqProvider = new BullMQQueueProvider();
    queueService.useProvider(bullmqProvider);
    setBullMQProvider(bullmqProvider);
    logger.info("[QUEUE] BullMQ/Redis provider aktif ✓");
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "[QUEUE] BullMQ başlatılamadı, InMemory kullanılıyor");
  }
})();

// ── Graceful shutdown ─────────────────────────────────────────────────────
async function shutdown(signal: string) {
  logger.info({ signal }, "Graceful shutdown başlatıldı");
  io.close();
  if (bullmqProvider) await bullmqProvider.close().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ── Start server ──────────────────────────────────────────────────────────
httpServer.on("error", (err) => {
  if (SENTRY_DSN) Sentry.captureException(err);
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

httpServer.listen(port, () => {
  logger.info({ port, sentry: !!SENTRY_DSN }, "Server listening");
});
