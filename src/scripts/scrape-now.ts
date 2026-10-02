import { ensureDateRates, localDate } from "../service";

enSure();

async function enSure() {
  try {
    const result = await ensureDateRates(localDate());
    console.log(JSON.stringify({ ...result.data, cached: !result.fetched }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
