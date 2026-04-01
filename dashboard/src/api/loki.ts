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
