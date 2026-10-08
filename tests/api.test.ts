import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { db, saveDailyRates } from "../src/db";
import { localDate } from "../src/service";

describe("API", () => {
  beforeEach(() => {
    db.exec("DELETE FROM rates; DELETE FROM daily_rates;");
  });

  it("publica la documentación OpenAPI sin autenticación", async () => {
    const response = await request(app).get("/api-docs.json");
    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.0.3");
    expect(response.body.paths["/api/rates"]).toBeDefined();
  });

  it("responde la última captura desde BD", async () => {
    saveDailyRates("2026-10-02", "2026-10-02T13:00:00.000Z", "https://tasas.eltoque.com/v1/trmi", [{ currency: "USD", cup: 760 }], { tasas: { USD: 760 } });
    const response = await request(app).get("/api/rates");
    expect(response.status).toBe(200);
    expect(response.body.rateDate).toBe("2026-10-02");
    expect(response.body.rates).toEqual([{ currency: "USD", cup: 760 }]);
  });

  it("permite solicitudes CORS desde el frontend configurado", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:5173");
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("si la fecha no existe, consulta la API y guarda el resultado", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ tasas: { USD: 760, EUR: 860 } }), { status: 200, headers: { "content-type": "application/json" } }));

    const response = await request(app).get("/api/rates/date/2026-10-01");
    expect(response.status).toBe(200);
    expect(response.body.cached).toBe(false);
    expect(response.body.rates).toHaveLength(2);

    fetchMock.mockRestore();
    const cachedResponse = await request(app).get("/api/rates/date/2026-10-01");
    expect(cachedResponse.status).toBe(200);
    expect(cachedResponse.body.cached).toBe(true);
  });

  it("la consulta de una moneda por fecha también usa la caché", async () => {
    saveDailyRates("2026-09-30", "2026-09-30T13:00:00.000Z", "https://tasas.eltoque.com/v1/trmi", [{ currency: "USD", cup: 750 }], { tasas: { USD: 750 } });
    const response = await request(app).get("/api/rates/USD/2026-09-30");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ currency: "USD", cup: 750, cached: true });
  });

  it("POST /api/rates/refresh consulta la fuente y reemplaza la captura existente", async () => {
    const today = localDate();
    saveDailyRates(today, "2026-10-08T13:00:01.440Z", "https://tasas.eltoque.com/v1/trmi", [{ currency: "USD", cup: 765 }], { tasas: { USD: 765 } });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tasas: { USD: 770, MLC: 503.04 } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const response = await request(app).post("/api/rates/refresh");

    expect(response.status).toBe(200);
    expect(response.body.cached).toBe(false);
    expect(response.body.rates).toEqual([
      { currency: "MLC", cup: 503.04 },
      { currency: "USD", cup: 770 }
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await request(app).get("/api/rates")).body.rates).toEqual(response.body.rates);
    fetchMock.mockRestore();
  });
});
