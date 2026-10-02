import cron from "node-cron";
import { config } from "./config";
import { fetchTodayAtNine } from "./service";

export function startScheduler() {
  const task = cron.schedule(
    config.RATE_UPDATE_CRON,
    async () => {
      try {
        const result = await fetchTodayAtNine();
        console.log(`[scheduler] fecha ${result.data.rateDate}: ${result.data.rates.length} tasas; ${result.skipped ? "ya estaba en BD" : "actualizada desde API oficial"}`);
      } catch (error) {
        console.error("[scheduler] error consultando API oficial:", error instanceof Error ? error.message : error);
      }
    },
    { timezone: config.TIMEZONE }
  );

  console.log(`[scheduler] activo: "${config.RATE_UPDATE_CRON}" (${config.TIMEZONE})`);
  return task;
}
