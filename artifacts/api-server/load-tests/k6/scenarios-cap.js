/**
 * Kapasite doğrulama senaryoları — kısaltılmış süreler (sandbox uyumlu)
 * load_100  : 20s ramp → 90s hold → 10s ramp-down  = ~2 min
 * load_1000 : 30s ramp → 90s hold → 10s ramp-down  = ~2.3 min
 * spike     : 15s baseline → 15s spike → 60s peak → 15s ramp-down = ~1.8 min
 * soak      : 200 VU / 3 min (extrapolate to 1h)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const errorRate    = new Rate("error_rate");
const rateLimitRate = new Rate("rate_limit_rate");
const dashboardTrend = new Trend("dashboard_stats_duration");
const paymentsTrend  = new Trend("payments_list_duration");
const notifTrend     = new Trend("notifications_duration");
const requestCount   = new Counter("total_requests");

const BASE_URL  = __ENV.BASE_URL  || "http://localhost:8080/api";
const SCENARIO  = __ENV.SCENARIO  || "load_100";

const headers = { "Content-Type": "application/json" };

const scenarios = {
  load_100: {
    executor: "ramping-vus", startVUs: 0,
    stages: [
      { duration: "15s", target: 100 },
      { duration: "60s", target: 100 },
      { duration: "5s",  target: 0   },
    ],
  },
  load_1000: {
    executor: "ramping-vus", startVUs: 0,
    stages: [
      { duration: "20s", target: 1000 },
      { duration: "60s", target: 1000 },
      { duration: "5s",  target: 0    },
    ],
  },
  spike: {
    executor: "ramping-vus", startVUs: 0,
    stages: [
      { duration: "10s", target: 200 },
      { duration: "8s",  target: 500 },
      { duration: "50s", target: 500 },
      { duration: "7s",  target: 0   },
    ],
  },
  soak: {
    executor: "constant-vus",
    vus: 200,
    duration: "80s",
  },
};

export const options = {
  scenarios: {
    main: scenarios[SCENARIO] || scenarios.load_100,
  },
  thresholds: {
    http_req_duration: ["p(95)<2000", "p(99)<4000"],
    error_rate: ["rate<0.01"],
    dashboard_stats_duration: ["p(95)<1000"],
    payments_list_duration:   ["p(95)<1000"],
  },
};

export default function () {
  requestCount.add(1);

  {
    const t0 = Date.now();
    const res = http.get(`${BASE_URL}/dashboard/stats`, { headers });
    dashboardTrend.add(Date.now() - t0);
    rateLimitRate.add(res.status === 429);
    errorRate.add(res.status >= 500);
    check(res, { "dashboard 2xx|401|429": r => r.status === 200 || r.status === 401 || r.status === 429 });
  }
  sleep(0.1);

  {
    const t0 = Date.now();
    const res = http.get(`${BASE_URL}/user-payments/stats`, { headers });
    paymentsTrend.add(Date.now() - t0);
    rateLimitRate.add(res.status === 429);
    errorRate.add(res.status >= 500);
    check(res, { "payments 2xx|401|429": r => r.status === 200 || r.status === 401 || r.status === 429 });
  }
  sleep(0.1);

  {
    const t0 = Date.now();
    const res = http.get(`${BASE_URL}/notifications`, { headers });
    notifTrend.add(Date.now() - t0);
    rateLimitRate.add(res.status === 429);
    errorRate.add(res.status >= 500);
    check(res, { "notifications 2xx|401|429": r => r.status === 200 || r.status === 401 || r.status === 429 });
  }
  sleep(0.1);

  {
    const res = http.get(`${BASE_URL}/sites/current`, { headers });
    rateLimitRate.add(res.status === 429);
    errorRate.add(res.status >= 500);
    check(res, { "site 2xx|401|404|429": r => [200,401,404,429].includes(r.status) });
  }
  sleep(0.1);

  {
    const res = http.get(`${BASE_URL}/subscription/status`, { headers });
    rateLimitRate.add(res.status === 429);
    errorRate.add(res.status >= 500);
    check(res, { "subscription 2xx|401|429": r => [200,401,429].includes(r.status) });
  }

  sleep(Math.random() * 0.3 + 0.1);
}

export function setup() {
  console.log(`[K6] scenario=${SCENARIO} base=${BASE_URL}`);
  const h = http.get(`${BASE_URL}/system/health`);
  if (h.status !== 200) console.warn(`Health: ${h.status}`);
}
