import { config } from "./config";
import { fetchRatesForDate } from "./eltoque-api";
import { getDailyRates, hasRatesForDate, saveDailyRates } from "./db";

let running = false;

export function localDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function validateDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("La fecha debe tener formato YYYY-MM-DD.");
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("La fecha no es válida.");
  }
  if (value > localDate()) {
    throw new Error("No se pueden solicitar tasas de una fecha futura.");
  }
  return value;
}

async function fetchAndSaveDateRates(rateDate: string, now: Date) {
  if (running) throw new Error("Ya existe una consulta a la API oficial en ejecución.");
  running = true;
  try {
    const rates = await fetchRatesForDate(rateDate, now);
    const fetchedAt = new Date().toISOString();
    const sourceUrl = `${config.ELTOQUE_API_URL.replace(/\/$/, "")}/v1/trmi`;

    // Guardamos el payload normalizado que nuestra capa recibió. La API local
    // siempre responde desde esta captura posteriormente.
    saveDailyRates(rateDate, fetchedAt, sourceUrl, rates, { tasas: Object.fromEntries(rates.map((r) => [r.currency, r.cup])) });
    return { data: getDailyRates(rateDate)!, fetched: true };
  } finally {
    running = false;
  }
}

export async function ensureDateRates(rateDate: string, now = new Date()) {
  validateDate(rateDate);

  const cached = getDailyRates(rateDate);
  if (cached) return { data: cached, fetched: false };

  return fetchAndSaveDateRates(rateDate, now);
}

export async function refreshDateRates(rateDate: string, now = new Date()) {
  validateDate(rateDate);
  return fetchAndSaveDateRates(rateDate, now);
}

export async function fetchTodayAtNine(now = new Date()) {
  const rateDate = localDate(now);
  if (hasRatesForDate(rateDate)) {
    return { skipped: true, data: getDailyRates(rateDate)! };
  }
  const result = await ensureDateRates(rateDate, now);
  return { skipped: false, data: result.data };
}
