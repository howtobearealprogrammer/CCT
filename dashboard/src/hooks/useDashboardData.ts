import { useState, useEffect, useCallback } from "react";
import { fetchDashboardData } from "../api/queries";
import { useInterval } from "./useInterval";
import type { DashboardData } from "../types";

interface UseDashboardDataResult {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

export function useDashboardData(
  refreshQueryParams: () => { start: number; end: number; step: number },
  refreshSeconds: number | null
): UseDashboardDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { start, end, step } = refreshQueryParams();
      const result = await fetchDashboardData(start, end, step);
      setData(result);
      setError(null);
      setLastUpdated(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [refreshQueryParams]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling
  useInterval(fetchData, refreshSeconds ? refreshSeconds * 1000 : null);

  return { data, loading, error, lastUpdated };
}
