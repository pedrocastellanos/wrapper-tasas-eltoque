import { config } from "./config";
import { OfficialApiResponse, RateValue } from "./types";

export class ElToqueApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = "ElToqueApiError";
  }
}

function parseRates(payload: unknown): RateValue[] {
  if (!payload || typeof payload !== "object") {
    throw new ElToqueApiError("La API de elTOQUE devolvió un JSON inválido.");
  }

  const body = payload as Partial<OfficialApiResponse>;
  if (!body.tasas || typeof body.tasas !== "object" || Array.isArray(body.tasas)) {
    throw new ElToqueApiError("La respuesta de elTOQUE no contiene el objeto 'tasas'.");
  }

  const rates: RateValue[] = [];
  for (const [currency, value] of Object.entries(body.tasas)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    rates.push({ currency: currency.toUpperCase(), cup: value });
  }

  if (rates.length === 0) {
    throw new ElToqueApiError("La API de elTOQUE devolvió 'tasas' sin valores válidos.");
  }

  return rates.sort((a, b) => a.currency.localeCompare(b.currency));
}

function formatApiDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export function buildDateRange(rateDate: string, now = new Date()): { dateFrom: string; dateTo: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rateDate)) {
    throw new Error("La fecha debe tener formato YYYY-MM-DD.");
  }

  const today = formatApiDate(now).slice(0, 10);
  const dateFrom = `${rateDate} 00:00:00`;
  const dateTo = rateDate === today ? formatApiDate(now) : `${rateDate} 23:59:59`;

  return { dateFrom, dateTo };
}

export async function fetchRatesForDate(rateDate: string, now = new Date()): Promise<RateValue[]> {
  if (!config.ELTOQUE_API_KEY) {
    throw new ElToqueApiError("ELTOQUE_API_KEY no está configurada.");
  }

  const { dateFrom, dateTo } = buildDateRange(rateDate, now);
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  const url = `${config.ELTOQUE_API_URL.replace(/\/$/, "")}/v1/trmi?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.ELTOQUE_API_KEY}`,
        Accept: "application/json"
      }
    });

    if (response.status === 401) {
      throw new ElToqueApiError("La clave API de elTOQUE es incorrecta o expiró.", 401);
    }

    if (response.status === 422) {
      throw new ElToqueApiError("elTOQUE rechazó la clave API o la solicitud no es procesable.", 422);
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;
      throw new ElToqueApiError(
        "Se alcanzó el límite de peticiones de la API de elTOQUE.",
        429,
        Number.isFinite(retryAfter) ? retryAfter : undefined
      );
    }

    if (!response.ok) {
      throw new ElToqueApiError(`La API de elTOQUE respondió HTTP ${response.status}.`, response.status);
    }

    const payload = (await response.json()) as unknown;
    return parseRates(payload);
  } catch (error) {
    if (error instanceof ElToqueApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ElToqueApiError("Timeout consultando la API de elTOQUE.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
