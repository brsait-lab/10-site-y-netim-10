/**
 * WebSocket Capacity Test — Socket.IO
 * Tests 1000 and 5000 concurrent connections
 *
 * Usage:
 *   node ws-test.js 1000
 *   node ws-test.js 5000
 */

import { io } from "socket.io-client";

const TARGET_VU = parseInt(process.argv[2] || "1000", 10);
const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const HOLD_DURATION_MS = 30_000;
const RAMP_INTERVAL_MS = 50;

const stats = {
  connected: 0,
  failed: 0,
  disconnected: 0,
  messages: 0,
  connectTimes: [],
  errors: [],
};

console.log(`\n[WS TEST] Target: ${TARGET_VU} connections`);
console.log(`[WS TEST] URL: ${BASE_URL}`);
console.log(`[WS TEST] Hold duration: ${HOLD_DURATION_MS / 1000}s\n`);

const sockets = [];
const startTs = Date.now();

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function rampUp() {
  for (let i = 0; i < TARGET_VU; i++) {
    const connStart = Date.now();
    const socket = io(BASE_URL, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 10000,
      auth: { token: "load-test-no-auth" },
    });

    socket.on("connect", () => {
      stats.connected++;
      stats.connectTimes.push(Date.now() - connStart);
    });

    socket.on("connect_error", (err) => {
      stats.failed++;
      if (stats.errors.length < 10) stats.errors.push(err.message);
    });

    socket.on("disconnect", () => {
      stats.disconnected++;
    });

    socket.on("new_message", () => {
      stats.messages++;
    });

    sockets.push(socket);
    await new Promise((r) => setTimeout(r, RAMP_INTERVAL_MS));

    if ((i + 1) % 100 === 0) {
      console.log(`  Ramp: ${i + 1}/${TARGET_VU} — connected=${stats.connected} failed=${stats.failed}`);
    }
  }
}

async function main() {
  await rampUp();

  console.log(`\n[WS TEST] Ramp complete — holding for ${HOLD_DURATION_MS / 1000}s...`);
  await new Promise((r) => setTimeout(r, HOLD_DURATION_MS));

  const peakConnected = stats.connected;

  for (const s of sockets) s.disconnect();
  await new Promise((r) => setTimeout(r, 2000));

  const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);
  console.log("\n════════════════════════════════════════");
  console.log(`  WebSocket Test Results (${TARGET_VU} VU target)`);
  console.log("════════════════════════════════════════");
  console.log(`  Duration:          ${elapsed}s`);
  console.log(`  Target VUs:        ${TARGET_VU}`);
  console.log(`  Peak Connected:    ${peakConnected}`);
  console.log(`  Failed:            ${stats.failed}`);
  console.log(`  Disconnected:      ${stats.disconnected}`);
  console.log(`  Connect p50:       ${percentile(stats.connectTimes, 50)}ms`);
  console.log(`  Connect p95:       ${percentile(stats.connectTimes, 95)}ms`);
  console.log(`  Connect p99:       ${percentile(stats.connectTimes, 99)}ms`);
  console.log(`  Max Connect Time:  ${Math.max(...stats.connectTimes, 0)}ms`);
  console.log(`  Messages rcvd:     ${stats.messages}`);
  console.log(`  Error rate:        ${((stats.failed / TARGET_VU) * 100).toFixed(2)}%`);
  if (stats.errors.length) {
    console.log(`  Sample Errors:     ${stats.errors.slice(0, 3).join(", ")}`);
  }
  console.log("════════════════════════════════════════\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("[WS TEST] Fatal:", err);
  process.exit(1);
});
