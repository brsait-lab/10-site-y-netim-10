---
name: Refresh token & mobile interceptor
description: Server-side refresh token system + mobile auto-retry interceptor with SecureStore storage
---

## Server side (artifacts/api-server/src/routes/auth.ts)
- Login returns `{ token, accessToken, refreshToken }` — `token` kept for backward compat, equals `accessToken`
- Access token: 24h JWT; refresh token: 128-char opaque hex, 30 days, stored in `refresh_tokens` table
- Token rotation on every `/auth/refresh` call — old RT immediately revoked
- `family` field: reuse attack detection. If revoked RT is replayed → entire family revoked atomically
- `POST /auth/logout` — revoke single RT (body: `{ refreshToken }`)
- `POST /auth/logout-all` (requires auth) — bumps `sessionVersion` on user + revokes all RTs in DB transaction
- `sessionVersion` check in `requireAuth` middleware invalidates all previously issued JWTs

## Mobile client (lib/api-client-react/src/custom-fetch.ts)
- `setRefreshTokenHandler(fn)` — registers the refresh callback
- `setForceLogoutHandler(fn)` — registers the force-logout callback
- `_refreshLock`: `Promise<string|null> | null` — single lock; parallel 401s await same promise, only ONE refresh call fires
- On 401: skip if `isAuthEndpoint(url)` (prevents loop on /auth/refresh, /auth/login, /auth/logout)
- On 401 (eligible): acquire lock → await refresh → retry original request once (`isRetry=true`)
- If refresh returns null → call forceLogoutHandler (fire-and-forget)

## Token storage (artifacts/mobile/lib/tokenStore.ts)
- Uses `expo-secure-store` (Keychain on iOS, Keystore on Android)
- Keys: `siteapp_access_token`, `siteapp_refresh_token`
- `clearTokens()` → deleteItemAsync both (ignores errors)
- `_layout.tsx` uses `setAuthTokenGetter(getAccessToken)` — interceptor auto-updates SecureStore so getter always returns fresh token

## AuthContext wiring (artifacts/mobile/context/AuthContext.tsx)
- `useEffect` on mount: registers both handlers, clears them on unmount
- `login()` + `register()`: store both tokens; uses `result as unknown as { accessToken?, refreshToken? }` cast (generated AuthResponse type only has `token`)
- `logout()`: calls POST /api/auth/logout with RT (best-effort), then clearTokens + setUser(null)
- Force-logout handler: `tokenStore.clearTokens()` + `setUserRef.current(null)` + `router.replace('/(auth)/login')`
- Uses `setUserRef` (ref pattern) so handler registered once always accesses current setter

**Why:**
- Parallel 401 lock prevents token refresh stampede when multiple in-flight requests expire simultaneously
- `family` reuse detection provides server-side security even if client lock fails
- SecureStore instead of AsyncStorage: encrypted at rest, not accessible to other apps
