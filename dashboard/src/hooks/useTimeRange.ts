import { useState, useMemo, useCallback } from "react";
import type { TimeRangeOption, RefreshOption } from "../types";

export const TIME_RANGES: TimeRangeOption[] = [
  { label: "Last 1h", seconds: 3600 },
  { label: "Last 3h", seconds: 10800 },
  { label: "Last 6h", seconds: 21600 },
  { label: "Last 12h", seconds: 43200 },
  { label: "Last 24h", seconds: 86400 },
  { label: "Last 7d", seconds: 604800 },
];

export const REFRESH_OPTIONS: RefreshOption[] = [
  { label: "10s", seconds: 10 },
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "Off", seconds: null },
];

export function useTimeRange() {
  const [rangeSeconds, setRangeSeconds] = useState(3600);
  const [refreshSeconds, setRefreshSeconds] = useState<number | null>(30);
  // null = live (end follows now); number = frozen unix seconds
  const [endSeconds, setEndSeconds] = useState<number | null>(null);

  const isLive = endSeconds === null;

  const jumpToNow = useCallback(() => setEndSeconds(null), []);

  const queryParams = useMemo(() => {
    const end = endSeconds ?? Math.floor(Date.now() / 1000);
    const start = end - rangeSeconds;
    const step = Math.max(Math.floor(rangeSeconds / 100), 15);
    return { start, end, step };
  }, [rangeSeconds, endSeconds]);

  const refreshQueryParams = useCallback(() => {
    const end = endSeconds ?? Math.floor(Date.now() / 1000);
    const start = end - rangeSeconds;
    const step = Math.max(Math.floor(rangeSeconds / 100), 15);
    return { start, end, step };
  }, [rangeSeconds, endSeconds]);

  return {
    rangeSeconds,
    setRangeSeconds,
    refreshSeconds,
    setRefreshSeconds,
    endSeconds,
    setEndSeconds,
    jumpToNow,
    isLive,
    queryParams,
    refreshQueryParams,
  };
}
