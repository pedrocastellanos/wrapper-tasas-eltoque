import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().default("./data/eltoque.sqlite"),
  ELTOQUE_API_URL: z.string().url().default("https://tasas.eltoque.com"),
  ELTOQUE_API_KEY: z.string().default(""),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  RATE_UPDATE_CRON: z.string().default("0 9 * * *"),
  TIMEZONE: z.string().default("America/Havana"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  RUN_FETCH_ON_START: z.string().default("false").transform((v) => v.toLowerCase() === "true")
});

export const config = envSchema.parse(process.env);
