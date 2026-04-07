import { useEffect, useState, useCallback } from "react";
import { lokiEarliestEventTime, lokiActivityHistogram } from "../api/loki";
import { useInterval } from "./useInterval";

const SERVICE_FILTER = `{service_name="claude-code"}`;

// Loki doesn't expand $__interval — we substitute step manually inside the helper.
// The helper computes step from (end-start)/bins, so use a literal interval here.
function exprWithStep(stepSeconds: number) {
  return `sum(count_over_time(${SERVICE_FILTER} [${stepSeconds}s]))`;
}

interface UseActivityHistogramResult {
  earliestSeconds: number | null;
  histogram: { t: number; count: number }[];
  refresh: () => void;
}

export function useActivityHistogram(refreshMs: number = 30000): UseActivityHistogramResult {
  const [earliestSeconds, setEarliestSeconds] = useState<number | null>(null);
  const [histogram, setHistogram] = useState<{ t: number; count: number }[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      // Find earliest, refreshing periodically so the bar stretches as logs accumulate.
      const earliest = await lokiEarliestEventTime(`${SERVICE_FILTER}`);
      setEarliestSeconds(earliest);
      const end = Math.floor(Date.now() / 1000);
      const start = earliest ?? end - 3600;
      const span = Math.max(end - start, 1);
      const bins = 120;
      const step = Math.max(Math.floor(span / bins), 15);
      const data = await lokiActivityHistogram(exprWithStep(step), start, end, bins);
      setHistogram(data);
    } catch {
      // swallow — keep previous state
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useInterval(fetchAll, refreshMs);

  return { earliestSeconds, histogram, refresh: fetchAll };
}
