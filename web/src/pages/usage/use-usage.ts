/** FE-4: Usage 데이터 페칭 훅. */

import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { DailySummary, ProviderSummary, ModelDailySummary, TokenPricing } from "./types";

export function useDailySummary(days: number) {
  return useQuery<DailySummary[]>({
    queryKey: ["usage", "daily", days],
    queryFn: () => api.get(`/api/usage/summary/daily?days=${days}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useProviderSummary(days: number) {
  return useQuery<ProviderSummary[]>({
    queryKey: ["usage", "provider", days],
    queryFn: () => api.get(`/api/usage/summary/provider?days=${days}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useTodayByModel() {
  return useQuery<ModelDailySummary[]>({
    queryKey: ["usage", "today-model"],
    queryFn: () => api.get("/api/usage/today/model"),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function usePricing() {
  return useQuery<Record<string, TokenPricing>>({
    queryKey: ["usage", "pricing"],
    queryFn: () => api.get("/api/usage/pricing"),
    staleTime: 300_000,
  });
}
