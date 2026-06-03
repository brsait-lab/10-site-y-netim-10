/**
 * AsyncLocalStorage-based request context.
 *
 * Allows Prisma slow-query logger (and other deep utilities) to access
 * requestId / userId / siteId without threading them through every call.
 *
 * Usage:
 *   1. app.ts: runs `runWithContext({}, next)` on every request (seeds requestId later)
 *   2. requireAuth.ts: calls `setContextValues({ userId, siteId })` after successful auth
 *   3. prisma.ts: calls `getRequestContext()` in $extends slow-query hook
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId?: string;
  userId?: string;
  siteId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext(ctx: RequestContext, fn: () => void): void {
  storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext {
  return storage.getStore() ?? {};
}

/** Mutates the current store in-place — safe to call from within requireAuth. */
export function setContextValues(values: Partial<RequestContext>): void {
  const store = storage.getStore();
  if (store) Object.assign(store, values);
}
