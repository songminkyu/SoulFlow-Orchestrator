/** FE-4: Usage 대시보드 타입. 백엔드 usage-store.ts 계약 미러링. */

export type DailySummary = {
  date: string;
  provider_id: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  avg_latency_ms: number;
};

export type ProviderSummary = {
  provider_id: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  avg_latency_ms: number;
  error_calls: number;
};

export type ModelDailySummary = {
  date: string;
  provider_id: string;
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
};

export type TokenPricing = {
  input_per_1m: number;
  output_per_1m: number;
  cache_read_per_1m?: number;
  cache_write_per_1m?: number;
};

/** 기간 선택 프리셋. */
export type PeriodPreset = "7d" | "14d" | "30d" | "90d";

/** 일별 데이터를 날짜별로 합산한 결과. */
export type DailyAggregate = {
  date: string;
  calls: number;
  total_tokens: number;
  cost_usd: number;
};
