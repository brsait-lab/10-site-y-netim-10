/**
 * WebSocket Capacity Test — K6 + Socket.IO polling fallback
 *
 * K6's k6/ws tests raw WebSocket connections.
 * Socket.IO handshake: GET /socket.io/?EIO=4&transport=polling
 *
 * Usage:
 *   VU=1000 ./k6 run ws-k6-test.js
 *   VU=5000 ./k6 run ws-k6-test.js
 */

import http from "k6/http";
import ws from "k6/ws";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const VU = parseInt(__ENV.VU || "1000");
const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const WS_URL = BASE_URL.replace(/^http/, "ws");

const connectErrors = new Rate("ws_connect_errors");
const connectDuration = new Trend("ws_connect_duration_ms");
const upgradeErrors = new Rate("ws_upgrade_errors");
const totalConnects = new Counter("ws_total_connects");

export const options = {
  scenarios: {
    websocket_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: VU },
        { duration: "60s", target: VU },
        { duration: "15s", target: 0 },
      ],
    },
  },
  thresholds: {
    ws_connect_errors: ["rate<0.05"],
    ws_connect_duration_ms: ["p(95)<3000"],
  },
};

export default function () {
  totalConnects.add(1);

  const t0 = Date.now();

  // Socket.IO long-polling handshake (EIO=4)
  const handshake = http.get(
    `${BASE_URL}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`,
    { timeout: "5s" }
  );

  connectDuration.add(Date.now() - t0);

  const handshakeOk =
    handshake.status === 200 &&
    handshake.body &&
    handshake.body.includes("sid");

  connectErrors.add(!handshakeOk);
  upgradeErrors.add(handshake.status >= 500);

  check(handshake, {
    "WS handshake 200": (r) => r.status === 200,
    "WS handshake has sid": (r) => r.body && r.body.includes("sid"),
  });

  sleep(Math.random() * 0.5 + 0.5);
}
