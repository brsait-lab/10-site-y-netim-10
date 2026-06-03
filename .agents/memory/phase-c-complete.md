---
name: Phase C Operational Scale — complete
description: C1-C8 implementation; cache expansion, slow query, backup docs, iyzico monetization
---

## Phase C — 500+ Site Operational Scale

### C1 — Cache Coverage Expansion (4 yeni endpoint)
- `GET /notifications/unread-count` → `cache:notif:unread:{siteId}:{userId}` 30s TTL
  - Invalidation: PATCH /notifications/:id/read
- `GET /packages/stats` → `cache:packages:stats:{siteId}` 60s TTL  
  - Invalidation: POST /packages, PATCH /packages/:id/status
- `GET /vendor-requests/stats` → `cache:vendor-requests:stats:{siteId}` 60s TTL
  - Invalidation: POST /vendor-requests, PATCH /vendor-requests/:id/status
- `GET /dashboard/stats` → already done in Phase B

### C2 — Queue Monitoring (Phase B'de tamamlandı)
- `GET /system/queues` → BullMQQueueProvider.getJobCounts()

### C3 — Health Monitoring (Phase B'de tamamlandı)
- `GET /system/health` → PostgreSQL/Redis/BullMQ/WebSocket latency

### C4 — Slow Query Remediation
- `src/lib/slowQueryBuffer.ts` → in-memory circular buffer (500 entries max)
- `recordSlowQuery()` called from prisma.ts $extends for all queries ≥100ms
- `getSlowQueryReport()` → topModels, topOperations, auto index recommendations
- `GET /system/slow-queries` (admin only) → full report

### C5 — NotificationRead Growth Strategy (Phase B'de tamamlandı)
- `docs/notification-partition-plan.md` → SQL design, archive strategy

### C6 — Load Testing (Phase B'de tamamlandı)
- `load-tests/k6/scenarios.js` → 6 senaryo, SCENARIO env var

### C7 — Backup Verification
- `docs/backup-restore-plan.md` → Full restore procedure, DR scenarios
- RPO: ≤15 dakika, RTO: ≤2 saat
- Restore steps for PostgreSQL + Redis, PITR, monthly verify script

### C8 — Subscription Monetization
- `src/services/IyzicoService.ts` → HMAC-SHA256 auth, createCheckoutSession, getPaymentResult, validateWebhookSignature
  - Env: IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL, APP_BASE_URL
  - Graceful: isIyzicoConfigured() → returns null/503 if not set
- `src/routes/subscription-payments.ts`:
  - `GET /subscription/plans` (public)
  - `POST /subscription/checkout` (admin → iyzico form)
  - `POST /subscription/webhook` (public, HMAC validated)
  - `GET /subscription/payments` (admin)
  - `POST /admin/subscriptions` (create with trial)
  - `PATCH /admin/subscriptions/:siteId/suspend|reactivate|cancel`
- `SubscriptionPayment` Prisma model (migration: phase_c_subscription_payments)
- `Subscription.paymentInterval` field added
- BullMQ + QueueService: `subscription_renewal_check` job type added
- Scheduler: 09:00 daily renewal check (Europe/Istanbul)

## iyzico webhook flow
1. Admin calls POST /subscription/checkout → SubscriptionPayment(pending) created + iyzico token
2. User pays on iyzico form → iyzico calls POST /subscription/webhook
3. Webhook validates X-IYZ-SIGNATURE (HMAC-SHA256 of rawBody with secretKey)
4. getPaymentResult(token) → verify with iyzico API
5. On success: subscription upserted to active, cache invalidated

## Renewal flow
1. Scheduler 09:00 → queueService.enqueue(subscription_renewal_check)
2. BullMQ worker: expired active → past_due; expiring soon → cache invalidated
