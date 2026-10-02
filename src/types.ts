export interface RateValue {
  currency: string;
  cup: number;
}

export interface OfficialApiResponse {
  tasas: Record<string, number>;
  [key: string]: unknown;
}

export interface StoredRate extends RateValue {
  rateDate: string;
  fetchedAt: string;
  source: "elTOQUE";
}

export interface DailyRates {
  rateDate: string;
  fetchedAt: string;
  source: "elTOQUE";
  sourceUrl: string;
  rates: RateValue[];
}
