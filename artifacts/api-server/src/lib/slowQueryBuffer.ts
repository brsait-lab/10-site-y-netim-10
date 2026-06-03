/**
 * C4 — Slow Query Remediation
 *
 * In-memory circular buffer (son 500 yavaş sorgu).
 * Prisma $extends slow-query hook'u tarafından doldurulur.
 * GET /system/slow-queries endpoint'i tarafından okunur.
 */

const MAX_ENTRIES = 500;

export interface SlowQueryEntry {
  duration: number;
  model: string;
  operation: string;
  requestId?: string;
  userId?: string;
  siteId?: string;
  ts: string; // ISO timestamp
}

// Circular buffer
const buffer: SlowQueryEntry[] = [];

export function recordSlowQuery(entry: SlowQueryEntry): void {
  if (buffer.length >= MAX_ENTRIES) buffer.shift();
  buffer.push(entry);
}

export interface SlowQueryReport {
  totalRecorded: number;
  last7DaysCount: number;
  recentEntries: SlowQueryEntry[];
  topModels: { model: string; count: number; avgMs: number }[];
  topOperations: { key: string; count: number; avgMs: number }[];
  recommendations: string[];
}

const KNOWN_INDEXES: Record<string, string> = {
  Notification: "CREATE INDEX CONCURRENTLY ON notifications (site_id, created_at DESC);",
  NotificationRead: "CREATE INDEX CONCURRENTLY ON notification_reads (notification_id, user_id);",
  UserPayment: "CREATE INDEX CONCURRENTLY ON user_payments (site_id, status, due_date);",
  Expense: "CREATE INDEX CONCURRENTLY ON expenses (site_id, cancelled_at, created_at DESC);",
  User: "CREATE INDEX CONCURRENTLY ON users (site_id, status, deleted_at);",
  Package: "CREATE INDEX CONCURRENTLY ON packages (site_id, status, received_at DESC);",
  VendorRequest: "CREATE INDEX CONCURRENTLY ON vendor_requests (site_id, status, created_at DESC);",
  AuditLog: "CREATE INDEX CONCURRENTLY ON audit_logs (site_id, created_at DESC);",
  ChatMessage: "CREATE INDEX CONCURRENTLY ON chat_messages (site_id, created_at DESC);",
};

export function getSlowQueryReport(): SlowQueryReport {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = buffer.filter((e) => new Date(e.ts).getTime() > sevenDaysAgo);

  // Group by model
  const modelMap = new Map<string, { count: number; totalMs: number }>();
  const opMap = new Map<string, { count: number; totalMs: number }>();

  for (const e of recent) {
    const m = modelMap.get(e.model) ?? { count: 0, totalMs: 0 };
    m.count++;
    m.totalMs += e.duration;
    modelMap.set(e.model, m);

    const key = `${e.model}.${e.operation}`;
    const o = opMap.get(key) ?? { count: 0, totalMs: 0 };
    o.count++;
    o.totalMs += e.duration;
    opMap.set(key, o);
  }

  const topModels = [...modelMap.entries()]
    .map(([model, { count, totalMs }]) => ({ model, count, avgMs: Math.round(totalMs / count) }))
    .sort((a, b) => b.count - a.count || b.avgMs - a.avgMs)
    .slice(0, 10);

  const topOperations = [...opMap.entries()]
    .map(([key, { count, totalMs }]) => ({ key, count, avgMs: Math.round(totalMs / count) }))
    .sort((a, b) => b.count - a.count || b.avgMs - a.avgMs)
    .slice(0, 10);

  // Auto-generate index recommendations
  const recommendations: string[] = [];
  const seen = new Set<string>();

  for (const { model, avgMs } of topModels) {
    if (avgMs > 200 && KNOWN_INDEXES[model] && !seen.has(model)) {
      seen.add(model);
      recommendations.push(`-- ${model} (avg ${avgMs}ms)\n${KNOWN_INDEXES[model]}`);
    }
  }

  // Also check by operation type
  for (const { key, avgMs } of topOperations) {
    const [model, op] = key.split(".");
    if (avgMs > 500 && (op === "findMany" || op === "count")) {
      if (!seen.has(key)) {
        seen.add(key);
        recommendations.push(
          `-- Yavaş ${op} tespit edildi: ${key} (avg ${avgMs}ms)\n` +
          `-- EXPLAIN ANALYZE ile sorgu planını inceleyin.`,
        );
      }
    }
  }

  return {
    totalRecorded: buffer.length,
    last7DaysCount: recent.length,
    recentEntries: recent.slice(-50).reverse(),
    topModels,
    topOperations,
    recommendations,
  };
}
