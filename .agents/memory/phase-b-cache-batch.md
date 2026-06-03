---
name: Phase B Cache & Batch
description: Redis cache on hot endpoints, explicit invalidation, push batch splitting, slow query monitoring
---

## Cache Strategy

| Endpoint | Cache Key Pattern | TTL | Invalidated On |
|---|---|---|---|
| GET /user-payments/stats | `cache:stats:payments:{siteId}` | 30s | approve, reject, manual-pay |
| GET /expenses/stats | `cache:stats:expenses:{siteId}` | 60s | POST /expenses, DELETE /expenses/:id |
| GET /sites/:id | `cache:site:{id}:{admin\|resident\|basic}` | 300s | PATCH /sites/:id (cacheDelPattern) |
| GET /subscription/status | `cache:subscription:{siteId}` | 300s | (TTL only) |

- paymentId-filtered stats calls bypass cache (specific queries, used less often)
- Site cache is role-variant (admin sees joinCode/IBAN, resident sees IBAN, others see basic)
- cacheDelPattern used for site to invalidate all role variants at once

## Push Notification Batching

- `push_notification` BullMQ job: queries target users, updates lastPushAt once, then:
  - ≤100 tokens: sendTokenBatch() directly in same job
  - >100 tokens: enqueues N `push_notification_chunk` jobs (one per 100 users)
- `push_notification_chunk` job: calls pushService.sendTokenBatch(tokens, ...) — no DB queries
- PushService.sendTokenBatch() added for pre-resolved token lists (no DB)
- Both QueueService (InMemory fallback) and BullMQQueueProvider handle push_notification_chunk

## Slow Query Monitoring

- prisma.ts uses `$extends` with `$allModels.$allOperations`
- >200ms → logger.warn; >1000ms → logger.error
- Fields logged: duration, model, operation

**Why:**
- `$extends` returns a new type — this is fine since esbuild ignores type errors at build
- `$use` was deprecated/removed in Prisma 7

## New Endpoints

- `GET /subscription/status` — route at artifacts/api-server/src/routes/subscription.ts
- `GET /expenses/stats` — added before GET /expenses in expenses.ts; accepts ?year= ?month= filters

**Why:**
- Subscription status was only checked in middleware, never exposed to mobile client
- Expenses stats was missing entirely (required by Phase B dashboard)
