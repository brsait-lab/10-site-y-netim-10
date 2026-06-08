---
name: Beta fix session
description: Root causes and fixes for 8 beta-blocking issues; critical patterns to preserve
---

## Merchant panel crash (DataContext)
Merchants have `siteId: "global"`. DataContext.load() called 6 APIs that all return 403 for merchants (`blockRoles("merchant")` on payments, userPayments, packages, expenses, notifications). Promise.all fails → loadError → blank crash screen.

**Fix:** `const isMerchant = user.role === "merchant"` guard in DataContext.load() — skip blocked calls with `Promise.resolve([])`.

**Why:** Merchants only need `getMessages({})` and `getChats()` which are not blocked.

**How to apply:** Any future API call added to DataContext.load() must include a merchant guard if the route uses `blockRoles("merchant")`.

## Notification backend — security role check was broken
Original code: `if (!isOperational || toRoles.includes("merchant")) { if (toRoles.includes("merchant")) { ... } }` — the outer condition was effectively a no-op. Security could send ANY type to ANY roles.

**Fix:** Replaced with explicit allow-list `SECURITY_ALLOWED_TYPES = [...SECURITY_OPERATIONAL_TYPES, "general", "security"]` + broadcast prevention (empty toRoles AND empty toUserIds → 403) + merchant targeting block.

## Notification backend — resident general type broadcast prevention
Resident "general" type had no recipient validation. Anyone could send to empty targets (broadcast).

**Fix:** After the package-type check in the resident block, validate that `general` type must have at least one toRole (admin|security only) or one toUserId.

## blockRoles("merchant") on GET notification routes
GET /notifications, GET /notifications/unread-count, PATCH /notifications/:id/read all had `blockRoles("merchant")`. This prevented merchants from receiving notifications even though they have a notifications tab.

**Fix:** Removed blockRoles from these 3 GET/PATCH routes. The `getForSite(siteId, ...)` filtering uses merchant's `siteId: "global"` which naturally returns 0 results — safe, no data leakage.

**Keep:** blockRoles("merchant") on POST /notifications (merchants cannot send site notifications).

## Security send UI
(security)/notifications.tsx was receive-only. Added "Gelen/Gönder" tab bar. Send tab supports:
- Target: "Yönetici" (toRoles: ["admin"]) or "Belirli Kişi" (toUserIds: [id])
- Type: "general" or "security"  
- User picker with search (calls getSiteUsers from AuthContext)
- Broadcast prevented both at UI (must select) and backend (empty targets → 403)
