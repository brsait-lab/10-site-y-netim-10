/**
 * PHASE 11 — PRIORITY 1: Archiving Scheduler
 *
 * node-cron ile runAllArchivingJobs() her gün 03:00'te otomatik çalışır.
 * Startup sırasında cron durumu loglanır.
 * Başarı/hata sonuçları structured log olarak üretilir.
 */

import cron from "node-cron";
import { runAllArchivingJobs } from "./dataRetention.js";
import { logger } from "./logger.js";

const ARCHIVING_CRON = "0 3 * * *";
const TIMEZONE = "Europe/Istanbul";

export function startScheduler(): void {
  if (!cron.validate(ARCHIVING_CRON)) {
    logger.error({ cron: ARCHIVING_CRON }, "[SCHEDULER] Geçersiz cron ifadesi — arşivleme schedule edilemedi");
    return;
  }

  cron.schedule(
    ARCHIVING_CRON,
    async () => {
      logger.info({ cron: ARCHIVING_CRON, timezone: TIMEZONE }, "[SCHEDULER] Arşivleme job'u başlatıldı");
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
            { results, totalProcessed, totalErrors, durationMs: Date.now() - startMs },
            "[SCHEDULER] Arşivleme başarıyla tamamlandı",
          );
        }
      } catch (err) {
        logger.error(
          { err, durationMs: Date.now() - startMs },
          "[SCHEDULER] Arşivleme cron kritik hata — job çalışamadı",
        );
      }
    },
    { timezone: TIMEZONE },
  );

  logger.info(
    { cron: ARCHIVING_CRON, timezone: TIMEZONE, nextRun: "Her gün 03:00 (Europe/Istanbul)" },
    "[SCHEDULER] Arşivleme job'u schedule edildi ✓",
  );
}
