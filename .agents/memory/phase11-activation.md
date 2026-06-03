---
name: Phase 11 Real Activation
description: Wiring of previously scaffolded components into real production flow
---

## What was wired

**Archiving scheduler:**
- `src/lib/scheduler.ts` — node-cron, `runAllArchivingJobs()` daily at 03:00 Europe/Istanbul
- `src/index.ts` — `startScheduler()` called at server startup

**Notification pipeline:**
- `POST /notifications` now calls `notificationService.send()` instead of direct prisma
- Full chain: Route → NotificationService → DB + QueueService → PushService (Expo Push API)

**Subscription enforcement:**
- `requireActiveSubscription()` added to: POST /payments, /expenses, /notifications, /packages, /vendor-requests
- Status rules: trialing/active/none → allow; past_due/suspended/cancelled → 402

**Observability:**
- `customProps` in pinoHttp captures userId, siteId, role, requestId at response time (after requireAuth runs)
- Error handler also logs these fields

**Sentry:**
- `@sentry/node` v10 installed, initialized in index.ts
- Graceful fallback if SENTRY_DSN missing (warning log, system continues)
- Captures: uncaughtException, unhandledRejection, express 500

## Build config notes
- `@sentry/node` and `@sentry/core` must be in esbuild external list (they import @opentelemetry/* which is also external)
- Required OTel packages installed as direct deps: @opentelemetry/api, @opentelemetry/core, @opentelemetry/instrumentation, @opentelemetry/sdk-trace-base, @opentelemetry/semantic-conventions

**Why:** @sentry/node v10 uses OpenTelemetry internally. If bundled by esbuild while @opentelemetry/* is external, runtime fails with ERR_MODULE_NOT_FOUND.

## Still passive / incomplete
- WebSocketChatProvider — skeleton, needs socket.io io instance
- SENTRY_DSN env var — must be set in production
- Redis/BullMQ — InMemoryQueueProvider still active
- Real payment provider (Stripe/iyzico) — subscription table exists but no payment processing
