import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { config } from "./config";
import { getDailyRates, getLatestRates, getRate } from "./db";
import { ensureDateRates, localDate, refreshDateRates } from "./service";
import { swaggerDocument } from "./swagger";

export const app = express();
const allowedOrigins = config.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origen no permitido por CORS."));
  }
}));
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/api-docs.json", (_req, res) => res.json(swaggerDocument));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "eltoque-rates-api" });
});

// Sin fecha: responde exclusivamente desde la BD. La actualización diaria
// ocurre a las 09:00 mediante el scheduler.
app.get("/api/rates", (_req, res) => {
  const latest = getLatestRates();
  if (!latest) return res.status(404).json({ error: "No hay tasas almacenadas todavía." });
  return res.json(latest);
});

// Fecha específica: BD primero; API oficial solo si no existe la fecha.
app.get("/api/rates/date/:date", async (req, res) => {
  try {
    const result = await ensureDateRates(req.params.date);
    return res.json({ ...result.data, cached: !result.fetched });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Error consultando elTOQUE." });
  }
});

app.get("/api/rates/:currency", async (req, res) => {
  // Mantiene un endpoint sencillo para la tasa más reciente almacenada.
  const latest = getLatestRates();
  if (!latest) return res.status(404).json({ error: "No hay tasas almacenadas todavía." });
  const rate = getRate(latest.rateDate, req.params.currency);
  if (!rate) return res.status(404).json({ error: `No existe una tasa almacenada para ${req.params.currency.toUpperCase()}.` });
  return res.json(rate);
});

app.get("/api/rates/:currency/:date", async (req, res) => {
  try {
    const result = await ensureDateRates(req.params.date);
    const rate = getRate(result.data.rateDate, req.params.currency);
    if (!rate) return res.status(404).json({ error: `No existe una tasa para ${req.params.currency.toUpperCase()} en ${result.data.rateDate}.` });
    return res.json({ ...rate, cached: !result.fetched });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Error consultando elTOQUE." });
  }
});

// Consulta la API oficial y reemplaza la captura almacenada de hoy.
app.post("/api/rates/refresh", async (_req, res) => {
  try {
    const result = await refreshDateRates(localDate());
    return res.status(200).json({ ...result.data, cached: false });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Error consultando elTOQUE." });
  }
});
