---
name: Phase B Large Scale Readiness — complete
description: 8-task implementation summary; key decisions and constraints for future sessions
---

## Tamamlanan: Phase B Tasks 1-8

### Task 1 — Dashboard Aggregation Layer
- `DashboardStats` Prisma model (`dashboard_stats` table, `@@unique([siteId])`)
- `DashboardService.ts` → `refresh(siteId)` + `getOrRefresh(siteId)`
- `GET /dashboard/stats` (any auth, 60s Redis cache, first-request inline refresh)
- payments.ts + expenses.ts → `queueService.enqueue({ type: "dashboard_stats_update", ... })` on mutations

### Task 2 — NotificationRead Partition Strategy
- Design doc only: `docs/notification-partition-plan.md`
- Not implemented in DB yet; triggers at 10M rows or 500ms query latency

### Task 3 — Slow Query Monitoring (requestContext + thresholds)
- `src/lib/requestContext.ts` → AsyncLocalStorage with mutable `setContextValues()`
- `app.ts` wraps every request in ALS with requestId (UUID) BEFORE pinoHttp
- `requireAuth.ts` calls `setContextValues({ userId, siteId })` after auth
- `prisma.ts` → `$extends` reads context in slow-query hook
- Thresholds: 100ms info, 250ms warn, 1000ms error

### Task 4 — Queue Monitoring
- `GET /system/queues` (admin only) → `BullMQQueueProvider.getJobCounts()`
- `src/lib/queueState.ts` singleton; `setBullMQProvider()` called from `index.ts` after BullMQ init

### Task 5 — System Health Endpoint
- `GET /system/health` (public) → DB/Redis/BullMQ/WebSocket latency + status
- `src/lib/wsState.ts` singleton; `setIO(io)` called from `index.ts`

### Task 6 — Audit Log Optimization
- `@@index([action, createdAt(sort: Desc)])` added to `PaymentAuditLog`
- Migration: `20260603194328_phase_b_dashboard_stats_audit_index`

### Task 7 — Load Test Infrastructure
- `load-tests/k6/scenarios.js` → smoke/load_100/load_1000/load_5000/spike/soak
- SCENARIO env var controls which scenario runs

### Task 8 — Production Metrics Dashboard
- `GET /system/metrics` (admin only) → uptime, WS count, queue counts, cache hit/miss ratio
- `cacheStats` exported from `cache.ts` (in-memory hit/miss counters)

## Critical constraints

**blockNonAdmin is NOT exported from requireRole.ts** — must define locally:
`const blockNonAdmin = blockRoles("merchant", "resident", "security");`

**requestContext ALS ordering**:
1. app.ts runs `runWithContext({requestId}, next)` — creates store
2. requireAuth runs `setContextValues({userId, siteId})` — mutates same store
3. prisma.ts `$extends` reads `getRequestContext()` — sees all values

**BullMQ connection**: always use `getBullMQConnectionOptions()` (plain object), never `new IORedis()` — version conflict.

**QueueJob type**: `dashboard_stats_update` now in both QueueService.ts and BullMQQueueProvider.ts.

**DashboardStats overdue query**: uses `Prisma.sql` with PostgreSQL CASE + character-class regex `[.][0-9]` (not `\.`) to avoid escape issues in template literals.
