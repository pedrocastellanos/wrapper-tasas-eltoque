import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { DailyRates, RateValue, StoredRate } from "./types";

const dbDir = path.dirname(path.resolve(config.DATABASE_PATH));
fs.mkdirSync(dbDir, { recursive: true });

export const db = new Database(config.DATABASE_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS daily_rates (
    rate_date TEXT PRIMARY KEY,
    fetched_at TEXT NOT NULL,
    source_url TEXT NOT NULL,
    raw_response TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rate_date TEXT NOT NULL,
    currency TEXT NOT NULL,
    cup REAL NOT NULL,
    FOREIGN KEY(rate_date) REFERENCES daily_rates(rate_date) ON DELETE CASCADE,
    UNIQUE(rate_date, currency)
  );

  CREATE INDEX IF NOT EXISTS idx_rates_currency_date ON rates(currency, rate_date);
`);

export function hasRatesForDate(rateDate: string): boolean {
  const row = db.prepare("SELECT 1 FROM daily_rates WHERE rate_date = ? LIMIT 1").get(rateDate);
  return Boolean(row);
}

export function saveDailyRates(
  rateDate: string,
  fetchedAt: string,
  sourceUrl: string,
  rates: RateValue[],
  rawResponse: unknown
): void {
  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO daily_rates (rate_date, fetched_at, source_url, raw_response)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(rate_date) DO UPDATE SET
        fetched_at = excluded.fetched_at,
        source_url = excluded.source_url,
        raw_response = excluded.raw_response
    `).run(rateDate, fetchedAt, sourceUrl, JSON.stringify(rawResponse));

    db.prepare("DELETE FROM rates WHERE rate_date = ?").run(rateDate);
    const insert = db.prepare(`INSERT INTO rates (rate_date, currency, cup) VALUES (?, ?, ?)`);
    for (const rate of rates) insert.run(rateDate, rate.currency, rate.cup);
  });

  transaction();
}

export function getDailyRates(rateDate: string): DailyRates | null {
  const row = db.prepare(`
    SELECT rate_date, fetched_at, source_url
    FROM daily_rates
    WHERE rate_date = ?
  `).get(rateDate) as { rate_date: string; fetched_at: string; source_url: string } | undefined;

  if (!row) return null;

  const rates = db.prepare(`
    SELECT currency, cup
    FROM rates
    WHERE rate_date = ?
    ORDER BY currency
  `).all(rateDate) as RateValue[];

  return {
    rateDate: row.rate_date,
    fetchedAt: row.fetched_at,
    source: "elTOQUE",
    sourceUrl: row.source_url,
    rates
  };
}

export function getRate(rateDate: string, currency: string): StoredRate | null {
  const row = db.prepare(`
    SELECT r.rate_date, r.currency, r.cup, d.fetched_at
    FROM rates r
    JOIN daily_rates d ON d.rate_date = r.rate_date
    WHERE r.rate_date = ? AND r.currency = ?
  `).get(rateDate, currency.toUpperCase()) as {
    rate_date: string;
    currency: string;
    cup: number;
    fetched_at: string;
  } | undefined;

  if (!row) return null;

  return {
    rateDate: row.rate_date,
    fetchedAt: row.fetched_at,
    source: "elTOQUE",
    currency: row.currency,
    cup: row.cup
  };
}

export function getLatestRates(): DailyRates | null {
  const row = db.prepare(`
    SELECT rate_date
    FROM daily_rates
    ORDER BY rate_date DESC
    LIMIT 1
  `).get() as { rate_date: string } | undefined;

  return row ? getDailyRates(row.rate_date) : null;
}
