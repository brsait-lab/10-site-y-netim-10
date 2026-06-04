/**
 * PHASE B TASK 7 — K6 Load Test Scenarios
 *
 * Kullanım:
 *   k6 run --env BASE_URL=https://your-api.replit.app/api \
 *          --env JWT_TOKEN=your_admin_token \
 *          scenarios.js
 *
 * Senaryolar:
 *   SCENARIO=smoke     → 5 kullanıcı, 1 dakika (temel doğrulama)
 *   SCENARIO=load_100  → 100 kullanıcı, 5 dakika
 *   SCENARIO=load_1000 → 1000 kullanıcı, 10 dakika
 *   SCENARIO=load_5000 → 5000 kullanıcı, 15 dakika (peak)
 *   SCENARIO=spike     → aniden 500 → 2000 kullanıcı
 *   SCENARIO=soak      → 200 kullanıcı, 1 saat (bellek/kaynak sızıntısı)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ── Custom metrics ─────────────────────────────────────────────────────────
const errorRate = new Rate("error_rate");       // only counts 5xx as errors
const rateLimitRate = new Rate("rate_limit_rate"); // tracks 429 hits (expected)
const dashboardTrend = new Trend("dashboard_stats_duration");
const paymentsTrend = new Trend("payments_list_duration");
const notificationsTrend = new Trend("notifications_duration");
const requestCount = new Counter("total_requests");

// ── Config ─────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:8080/api";
const JWT_TOKEN = __ENV.JWT_TOKEN || "";
const SCENARIO = __ENV.SCENARIO || "smoke";

const headers = {
  Authorization: `Bearer ${JWT_TOKEN}`,
  "Content-Type": "application/json",
};

// ── Scenario definitions ────────────────────────────────────────────────────
const scenarios = {
  smoke: {
    executor: "constant-vus",
    vus: 5,
    duration: "1m",
  },
  load_100: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "30s", target: 100 },
      { duration: "4m", target: 100 },
      { duration: "30s", target: 0 },
    ],
  },
  load_1000: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "1m", target: 1000 },
      { duration: "8m", target: 1000 },
      { duration: "1m", target: 0 },
    ],
  },
  load_5000: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "2m", target: 1000 },
      { duration: "2m", target: 5000 },
      { duration: "9m", target: 5000 },
      { duration: "2m", target: 0 },
    ],
  },
  spike: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "30s", target: 500 },
      { duration: "1m", target: 500 },
      { duration: "10s", target: 2000 },
      { duration: "3m", target: 2000 },
      { duration: "1m", target: 500 },
      { duration: "30s", target: 0 },
    ],
  },
  soak: {
    executor: "constant-vus",
    vus: 200,
    duration: "1h",
  },
};

// ── Export options ──────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    main: scenarios[SCENARIO] || scenarios.smoke,
  },
  thresholds: {
    http_req_duration: ["p(95)<1000", "p(99)<2000"],
    // 5xx errors must stay < 1%; 429 rate-limit responses are excluded (expected under load)
    error_rate: ["rate<0.01"],
    dashboard_stats_duration: ["p(95)<500"],
    payments_list_duration: ["p(95)<800"],
    // rate_limit_rate is informational only — no threshold, just measured
  },
};

// ── Main test function ──────────────────────────────────────────────────────
export default function () {
  requestCount.add(1);

  // Dashboard stats (most critical — cached)
  {
    const t0 = Date.now();
    const res = http.get(`${BASE_URL}/dashboard/stats`, { headers });
    dashboardTrend.add(Date.now() - t0);
    rateLimitRate.add(res.status === 429);
    // 5xx = real error; 429 = rate-limited (feature); 401 = auth issue
    const is5xx = res.status >= 500;
    errorRate.add(is5xx);
    check(res, {
      "dashboard stats 2xx|429": (r) => r.status === 200 || r.status === 429,
    });
  }

  sleep(0.1);

  // Payment stats
  {
    const t0 = Date.now();
    const res = http.get(`${BASE_URL}/user-payments/stats`, { headers });
    paymentsTrend.add(Date.now() - t0);
    rateLimitRate.add(res.status === 429);
    errorRate.add(res.status >= 500);
    check(res, { "payment stats 2xx|403|429": (r) => r.status === 200 || r.status === 403 || r.status === 429 });
  }

  sleep(0.1);

  // Notifications list
  {
    const t0 = Date.now();
    const res = http.get(`${BASE_URL}/notifications`, { headers });
    notificationsTrend.add(Date.now() - t0);
    rateLimitRate.add(res.status === 429);
    errorRate.add(res.status >= 500);
    check(res, { "notifications 2xx|429": (r) => r.status === 200 || r.status === 429 });
  }

  sleep(0.1);

  // Site info (cached 5min)
  {
    const res = http.get(`${BASE_URL}/sites/current`, { headers });
    rateLimitRate.add(res.status === 429);
    errorRate.add(res.status >= 500);
    check(res, { "site 2xx|404|429": (r) => r.status === 200 || r.status === 404 || r.status === 429 });
  }

  sleep(0.1);

  // Subscription status (cached 5min)
  {
    const res = http.get(`${BASE_URL}/subscription/status`, { headers });
    rateLimitRate.add(res.status === 429);
    errorRate.add(res.status >= 500);
    check(res, { "subscription 2xx|429": (r) => r.status === 200 || r.status === 429 });
  }

  sleep(Math.random() * 0.5 + 0.2);
}

// ── Lifecycle hooks ─────────────────────────────────────────────────────────
export function setup() {
  console.log(`K6 Load Test başlıyor: scenario=${SCENARIO}, base=${BASE_URL}`);
  const res = http.get(`${BASE_URL}/system/health`);
  if (res.status !== 200) {
    console.warn(`Health check başarısız: ${res.status} — test yine de devam ediyor`);
  }
}

export function teardown(data) {
  console.log("K6 Load Test tamamlandı.");
}
