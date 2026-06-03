---
name: Phase A Scale Infrastructure
description: Socket.IO WebSocket, BullMQ/Redis queue, Redis cache — Phase A 500+ site readiness
---

## What was built

**Socket.IO WebSocket (Chat)**
- `src/index.ts` now creates `http.Server` + `SocketIOServer` (replaces `app.listen`)
- JWT auth middleware on every socket connection (verifyToken)
- Rooms: `site:{siteId}` (auto-join), `chat:{chatId}` (join_chat / leave_chat events)
- `WebSocketChatProvider` wired at startup — `POST /messages` now uses `chatService.sendMessage()` which triggers `io.to(chat:id).emit("new_message", msg)`
- Mobile: `context/SocketContext.tsx` — connects to `https://${domain}` with path `/api/socket.io`
- Mobile chat screen: joins room on mount, listens for `new_message`, deduplicates, falls back to polling every 5s when WS disconnected

**BullMQ + Redis Queue**
- `src/services/BullMQQueueProvider.ts` — replaces `InMemoryQueueProvider`
- `src/lib/redis.ts` — `getRedis()` for cache, `getBullMQConnectionOptions()` for BullMQ
- **Key constraint**: BullMQ and ioredis have different internal ioredis versions. Must pass `getBullMQConnectionOptions()` (plain options object) NOT an IORedis instance to Queue/Worker. Passing IORedis instance causes TS type conflict.
- Redis started in api-server dev script: `redis-server --daemonize yes --bind 127.0.0.1 --loglevel warning`
- BullMQ initialized async in index.ts with graceful degradation to InMemory if Redis unavailable

**Redis Cache**
- `src/lib/cache.ts` — `cacheGet`, `cacheSet`, `cacheDel`, `cacheDelPattern`
- Infrastructure ready; apply selectively to hot endpoints (site lookup, dashboard stats)

**Metro fix**
- `artifacts/mobile/metro.config.js` — added blockList patterns for `bullmq_tmp_*` and ioredis cluster dirs to prevent ENOENT watch errors

**Why:**
- InMemoryQueue lost jobs on restart, blocked API thread
- Polling chat caused N×site DB queries per second at 500+ sites
- BullMQ+Redis enables retry, persistence, batch push notifications
