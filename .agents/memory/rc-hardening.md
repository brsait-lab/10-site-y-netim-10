---
name: RC Hardening Additions
description: Production hardening phase — new shared libs, rate limiters, audit expansion, schema fields added in RC phase
---

# RC Hardening Phase — Key Decisions

## New shared libraries
- `src/lib/rateLimiters.ts` — central rate limit config; authLimiter(5/min), messageLimiter(30/min), notificationLimiter(20/min), paymentLimiter(10/min), uploadLimiter(10/min), vendorRequestLimiter(10/min), siteLookupLimiter(10/min)
- `src/lib/audit.ts` — shared `addAuditLog()` helper; vendors/notifications/packages import from here; expenses and users still have local copies (tech debt)
- `src/lib/dataRetention.ts` — RETENTION_DAYS constants + isRetentionExpired/getArchiveCutoff helpers; actual archive job NOT implemented (first 90 days)

## Rate limiters applied in app.ts
Applied before router via `app.use(path, limiter)` pattern — works because Express applies them in order before the global router.

## File upload security
- Removed `image/webp` from ALLOWED_MIME_TYPES (spec: only jpg/jpeg/png/pdf)
- Added filename extension check via `getExtension(fileName)` against ALLOWED_EXTENSIONS set
- ALLOWED_MIME_TYPES is now a Map<string, string> mapping MIME → extension (cleaner than Set)

## secrets.ts extensions
- DATABASE_URL check: always fatal (no fallback possible without DB)
- R2 vars: warn only (R2 is optional; app degrades to URL paste mode without it)

## Push notification schema
- Added to User: pushToken String?, pushPlatform String?, lastPushAt DateTime?
- Migration: 20260602240000_push_notification_preparation
- NOT exposed in toUserDto yet (internal only for now)
- FCM/APNs integration is a separate future sprint

## Audit log coverage added
- vendor_request_created (POST /vendor-requests)
- vendor_request_updated (PATCH /vendor-requests/:id/status)
- notification_sent (POST /notifications)
- package_received (POST /packages)
- package_delivered (PATCH /packages/:id/status when status=delivered)

## Error middleware
Added catch-all `(err, req, res, next)` middleware in app.ts — logs structured error with pino, returns generic 500.

**Why:** Unhandled throws in async route handlers were silently swallowed without this.

## Backup script
`artifacts/api-server/scripts/backup.sh` — pg_dump → gzip → optional GPG encrypt → R2 upload. Cron examples included in script comments.
