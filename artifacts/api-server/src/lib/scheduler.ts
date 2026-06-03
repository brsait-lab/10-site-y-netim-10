/**
 * PHASE 11 — PRIORITY 1: Archiving Scheduler
 * C8 — Subscription Renewal Check Scheduler
 *
 * Jobs:
 *   03:00 — runAllArchivingJobs() (veri arşivleme)
 *   09:00 — subscription_renewal_check (abonelik yenileme kontrol)
 */

import cron from "node-cron";
import { runAllArchivingJobs } from "./dataRetention.js";
import { logger } from "./logger.js";
import { queueService } from "../services/QueueService.js";

const TIMEZONE = "Europe/Istanbul";

export function startScheduler(): void {
  // ── Archiving: Her gün 03:00 ─────────────────────────────────────────────
  const ARCHIVING_CRON = "0 3 * * *";

  if (!cron.validate(ARCHIVING_CRON)) {
    logger.error({ cron: ARCHIVING_CRON }, "[SCHEDULER] Geçersiz cron — arşivleme schedule edilemedi");
  } else {
    cron.schedule(
      ARCHIVING_CRON,
      async () => {
        logger.info({ cron: ARCHIVING_CRON }, "[SCHEDULER] Arşivleme job'u başlatıldı");
        const startMs = Date.now();

        try {
          const results = await runAllArchivingJobs();
          const totalProcessed = results.reduce((s, r) => s + r.processed, 0);
          const totalErrors = results.reduce((s, r) => s + r.errors, 0);

          if (totalErrors > 0) {
            logger.warn(
              { results, totalProcessed, totalErrors, durationMs: Date.now() - startMs },
              "[SCHEDULER] Arşivleme tamamlandı — bazı job'lar hata verdi",
            );
          } else {
            logger.info(
              { results, totalProcessed, durationMs: Date.now() - startMs },
              "[SCHEDULER] Arşivleme başarıyla tamamlandı",
            );
          }
        } catch (err) {
          logger.error({ err, durationMs: Date.now() - startMs }, "[SCHEDULER] Arşivleme kritik hata");
        }
      },
      { timezone: TIMEZONE },
    );

    logger.info({ cron: ARCHIVING_CRON, timezone: TIMEZONE, nextRun: "Her gün 03:00 (Europe/Istanbul)" },
      "[SCHEDULER] Arşivleme job'u schedule edildi ✓",
    );
  }

  // ── Subscription renewal check: Her gün 09:00 ────────────────────────────
  const RENEWAL_CRON = "0 9 * * *";

  if (cron.validate(RENEWAL_CRON)) {
    cron.schedule(
      RENEWAL_CRON,
      async () => {
        logger.info("[SCHEDULER] Abonelik yenileme kontrol job'u başlatıldı");
        try {
          await queueService.enqueue({
            type: "subscription_renewal_check",
            payload: {},
            priority: 3,
          });
        } catch (err) {
          logger.error({ err }, "[SCHEDULER] Abonelik yenileme job enqueue edilemedi");
        }
      },
      { timezone: TIMEZONE },
    );

    logger.info({ cron: RENEWAL_CRON, timezone: TIMEZONE, nextRun: "Her gün 09:00 (Europe/Istanbul)" },
      "[SCHEDULER] Abonelik yenileme job'u schedule edildi ✓",
    );
  }
}
