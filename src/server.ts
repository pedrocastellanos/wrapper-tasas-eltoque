import { app } from "./app";
import { config } from "./config";
import { startScheduler } from "./scheduler";
import { fetchTodayAtNine } from "./service";

const server = app.listen(config.PORT, () => {
  console.log(`API escuchando en http://localhost:${config.PORT}`);
});

startScheduler();

if (config.RUN_FETCH_ON_START) {
  fetchTodayAtNine()
    .then((result) => console.log(`[startup] ${result.data.rateDate}: ${result.data.rates.length} tasas`))
    .catch((error) => console.error("[startup] API oficial:", error instanceof Error ? error.message : error));
}

function shutdown(signal: string) {
  console.log(`${signal}: cerrando servidor...`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
