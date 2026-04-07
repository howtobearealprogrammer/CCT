import type { TimeSeries, TimeSeriesPoint } from "../types";

interface LokiMetricResult {
  metric: Record<string, string>;
  values: [number, string][];
}

interface LokiResponse {
  status: string;
  data: {
    resultType: string;
    result: LokiMetricResult[];
  };
}

interface LokiLogEntry {
  stream: Record<string, string>;
  values: [string, string][]; // [nanosecond timestamp, log line]
}

interface LokiLogResponse {
  status: string;
  data: {
    resultType: string;
    result: LokiLogEntry[];
  };
}

/** Fetch raw log timestamps for a log query (not a metric query). Returns Unix ms timestamps. */
export async function lokiLogTimestamps(
  expr: string,
  start: number,
  end: number,
  limit: number = 1000
): Promise<number[]> {
  const params = new URLSearchParams({
    query: expr,
    start: (start * 1e9).toString(),
    end: (end * 1e9).toString(),
    limit: limit.toString(),
    direction: "forward",
  });
  const res = await fetch(`/api/loki/loki/api/v1/query_range?${params}`);
  if (!res.ok) throw new Error(`Loki error: ${res.status}`);
  const json: LokiLogResponse = await res.json();

  const timestamps: number[] = [];
  for (const stream of json.data.result) {
    for (const [nsTimestamp] of stream.values) {
      timestamps.push(Math.floor(Number(nsTimestamp) / 1e6)); // ns → ms
    }
  }
  return timestamps.sort((a, b) => a - b);
}

export async function lokiQueryRange(
  expr: string,
  start: number,
  end: number,
  step: number
): Promise<TimeSeries[]> {
  const params = new URLSearchParams({
    query: expr,
    start: (start * 1e9).toString(),
    end: (end * 1e9).toString(),
    step: step.toString(),
  });
  const res = await fetch(`/api/loki/loki/api/v1/query_range?${params}`);
  if (!res.ok) throw new Error(`Loki error: ${res.status}`);
  const json: LokiResponse = await res.json();

  return json.data.result.map((r) => ({
    label: Object.values(r.metric).filter(Boolean).join(" ") || "value",
    data: r.values.map(([ts, val]): TimeSeriesPoint => ({
      timestamp: ts,
      value: parseFloat(val),
    })),
  }));
}

/** Returns the unix-seconds timestamp of the earliest matching event in the last `lookbackSeconds`, or null if none. */
export async function lokiEarliestEventTime(
  expr: string,
  lookbackSeconds: number = 30 * 24 * 3600
): Promise<number | null> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - lookbackSeconds;
  const params = new URLSearchParams({
    query: expr,
    start: (start * 1e9).toString(),
    end: (end * 1e9).toString(),
    limit: "1",
    direction: "forward",
  });
  const res = await fetch(`/api/loki/loki/api/v1/query_range?${params}`);
  if (!res.ok) throw new Error(`Loki error: ${res.status}`);
  const json: LokiLogResponse = await res.json();
  for (const stream of json.data.result) {
    for (const [nsTimestamp] of stream.values) {
      return Math.floor(Number(nsTimestamp) / 1e9);
    }
  }
  return null;
}

/** Returns bucketed counts across [start, end] using `bins` buckets. */
export async function lokiActivityHistogram(
  expr: string,
  start: number,
  end: number,
  bins: number = 120
): Promise<{ t: number; count: number }[]> {
  const span = Math.max(end - start, 1);
  const step = Math.max(Math.floor(span / bins), 15);
  const params = new URLSearchParams({
    query: expr,
    start: (start * 1e9).toString(),
    end: (end * 1e9).toString(),
    step: step.toString(),
  });
  const res = await fetch(`/api/loki/loki/api/v1/query_range?${params}`);
  if (!res.ok) throw new Error(`Loki error: ${res.status}`);
  const json: LokiResponse = await res.json();
  const buckets = new Map<number, number>();
  for (const r of json.data.result) {
    for (const [ts, val] of r.values) {
      const t = Math.floor(Number(ts));
      buckets.set(t, (buckets.get(t) ?? 0) + parseFloat(val));
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, count]) => ({ t, count }));
}
