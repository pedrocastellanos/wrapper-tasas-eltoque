import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildDateRange, fetchRatesForDate } from "../src/eltoque-api";

describe("elTOQUE official API client", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("construye un rango del día menor a 24h para el día actual", () => {
    const now = new Date("2026-10-02T13:00:00.000Z");
    const range = buildDateRange("2026-10-02", now);
    expect(range.dateFrom).toBe("2026-10-02 00:00:00");
    expect(range.dateTo).toMatch(/^2026-10-02 /);
  });

  it("parsea el objeto tasas y envía Bearer", async () => {
    const mock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tasas: { USD: 760, MLC: 492.45, ECU: 860 } }), { status: 200 })
    );
    const rates = await fetchRatesForDate("2026-10-01", new Date("2026-10-02T13:00:00Z"));
    expect(rates).toEqual([
      { currency: "ECU", cup: 860 },
      { currency: "MLC", cup: 492.45 },
      { currency: "USD", cup: 760 }
    ]);
    const [, init] = mock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: expect.stringMatching(/^Bearer /),
      Accept: "application/json"
    });
  });

  it("maneja 429 sin ocultar Retry-After", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "limit", limit: "60 per 1 minute" }), { status: 429, headers: { "Retry-After": "17" } })
    );
    await expect(fetchRatesForDate("2026-10-01")).rejects.toMatchObject({ status: 429, retryAfter: 17 });
  });
});
