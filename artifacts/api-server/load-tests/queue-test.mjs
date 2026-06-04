/**
 * Queue Capacity Test — BullMQ throughput
 * Enqueues N notification jobs via direct BullMQ and measures throughput
 *
 * Usage:
 *   node load-tests/queue-test.mjs 10000
 *   node load-tests/queue-test.mjs 50000
 */

import { Queue, Worker } from "bullmq";
import Redis from "ioredis";

const JOB_COUNT = parseInt(process.argv[2] || "10000", 10);
const CONCURRENCY = 50;
const BATCH_SIZE = 500;

const connection = new Redis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const queueName = `cap-test-${Date.now()}`;

const stats = {
  enqueued: 0,
  completed: 0,
  failed: 0,
  processingTimes: [],
};

console.log(`\n[QUEUE TEST] Target jobs: ${JOB_COUNT}`);
console.log(`[QUEUE TEST] Concurrency: ${CONCURRENCY}`);
console.log(`[QUEUE TEST] Batch size: ${BATCH_SIZE}\n`);

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function main() {
  const queue = new Queue(queueName, { connection });

  const worker = new Worker(
    queueName,
    async (job) => {
      const start = Date.now();
      await new Promise((r) => setTimeout(r, Math.random() * 2));
      stats.processingTimes.push(Date.now() - start);
      stats.completed++;
    },
    { connection, concurrency: CONCURRENCY }
  );

  worker.on("failed", () => stats.failed++);

  const enqueueStart = Date.now();

  for (let i = 0; i < JOB_COUNT; i += BATCH_SIZE) {
    const batch = [];
    const end = Math.min(i + BATCH_SIZE, JOB_COUNT);
    for (let j = i; j < end; j++) {
      batch.push({
        name: "push_notification",
        data: {
          siteId: `site-${(j % 100).toString().padStart(3, "0")}`,
          userId: `user-${j}`,
          title: `Test Notification ${j}`,
          body: `Capacity test job ${j}`,
        },
        opts: { removeOnComplete: 100, removeOnFail: 50 },
      });
    }
    await queue.addBulk(batch);
    stats.enqueued += batch.length;

    if (stats.enqueued % 5000 === 0) {
      const rate = Math.round(stats.enqueued / ((Date.now() - enqueueStart) / 1000));
      console.log(`  Enqueued: ${stats.enqueued}/${JOB_COUNT} (${rate} jobs/s) — completed: ${stats.completed}`);
    }
  }

  const enqueueDuration = Date.now() - enqueueStart;
  const enqueueRate = Math.round(JOB_COUNT / (enqueueDuration / 1000));
  console.log(`\n  Enqueue complete: ${JOB_COUNT} jobs in ${enqueueDuration}ms (${enqueueRate} jobs/s)`);
  console.log("  Waiting for workers to drain...");

  const drainStart = Date.now();
  while (stats.completed + stats.failed < JOB_COUNT) {
    await new Promise((r) => setTimeout(r, 500));
    const elapsed = Date.now() - drainStart;
    if (elapsed > 120_000) {
      console.warn("  WARNING: drain timeout after 120s");
      break;
    }
  }

  const totalDuration = Date.now() - enqueueStart;
  const throughput = Math.round(stats.completed / (totalDuration / 1000));

  await worker.close();
  await queue.obliterate({ force: true });
  await connection.quit();

  console.log("\n════════════════════════════════════════");
  console.log(`  Queue Test Results (${JOB_COUNT} jobs)`);
  console.log("════════════════════════════════════════");
  console.log(`  Total Duration:     ${totalDuration}ms`);
  console.log(`  Jobs Enqueued:      ${stats.enqueued}`);
  console.log(`  Jobs Completed:     ${stats.completed}`);
  console.log(`  Jobs Failed:        ${stats.failed}`);
  console.log(`  Enqueue Rate:       ${enqueueRate} jobs/s`);
  console.log(`  Throughput:         ${throughput} jobs/s`);
  console.log(`  Processing p50:     ${percentile(stats.processingTimes, 50)}ms`);
  console.log(`  Processing p95:     ${percentile(stats.processingTimes, 95)}ms`);
  console.log(`  Processing p99:     ${percentile(stats.processingTimes, 99)}ms`);
  console.log(`  Error Rate:         ${((stats.failed / JOB_COUNT) * 100).toFixed(2)}%`);
  console.log("════════════════════════════════════════\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("[QUEUE TEST] Fatal:", err);
  process.exit(1);
});
