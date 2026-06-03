---
name: Scale Prep Phases 1-10
description: Production stability & 1000+ site scale preparation — what was changed and key decisions
---

## Key Decisions

**Phase 1 — Critical Security Fixes:**
- `body.siteId` entirely removed from POST /payments; siteId always from JWT token
- Local `addAuditLog` in payments.ts deleted; all modules use `lib/audit.ts`
- POST /payments is now fully atomic: Payment + UserPayment + AuditLog in single `prisma.$transaction`
- Pre-fetch actor name + residents before transaction; pass `performedByName` + `client: tx` to avoid extra DB calls inside transaction
- POST /notifications: `fromUserId` and `fromName` no longer accepted from body; always from token (userId) and DB lookup

**Phase 2 — Subscription Architecture:**
- `Plan` and `Subscription` models added to schema
- `requireActiveSubscription()` middleware in `src/middlewares/requireActiveSubscription.ts`
- Middleware allows through if no subscription exists (free tier pass-through) — real payment integration pending

**Phase 3 — FK Relations:**
- Added Prisma relations with named back-relations (needed because User has multiple relations from same model)
- Named relations: UserPaymentOwner, UserPaymentPaidBy, PackageRecipient, VendorRequestor, VendorProfile, ChatParticipantUser, NotificationReadUser

**Phase 4 — Decimal:**
- `amount Float` → `amount Decimal @db.Decimal(12,2)` on Payment and Expense
- DTOs updated to use `Number(p.amount)` to handle `Prisma.Decimal` type

**Phase 5 — Services:**
- `src/services/NotificationService.ts` — DB write + queues push
- `src/services/QueueService.ts` — in-memory, interface ready for Redis/BullMQ swap
- `src/services/PushService.ts` — Expo Push API, chunks of 100, updates lastPushAt

**Phase 6 — Chat:**
- `src/services/ChatService.ts` — PollingProvider active; WebSocketChatProvider scaffold ready (socket.io dep already in package.json)

**Phase 7 — Observability:**
- `lib/logger.ts`: added `base` fields (service, env), better redact list
- `app.ts`: `genReqId: () => randomUUID()` — every request gets a UUID requestId; serializer logs userId/siteId/role per request

**Phase 9 — Archiving:**
- `lib/dataRetention.ts`: real archiving job functions added (archiveOldMessages, archiveOldNotifications, archiveOldNotificationReads, archiveOldAuditLogs, runAllArchivingJobs, getRetentionStats)

**Phase 10 — Report:**
- `PRODUCTION_READINESS_REPORT.md` at root of api-server — comprehensive readiness assessment

## Migration Notes
- Migration `20260603140617_scale_prep_phases_1_9` applied successfully
- After schema change, must run `npx prisma generate` before build (or build fails with PrismaClient export error)
- Vendor.userId does NOT have @unique; relation is one-to-many (User → Vendor[])
