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
