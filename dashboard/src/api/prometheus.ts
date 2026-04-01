import type { TimeSeries, TimeSeriesPoint } from "../types";

interface PrometheusResult {
  metric: Record<string, string>;
  values: [number, string][];
}

interface PrometheusResponse {
  status: string;
  data: {
    resultType: string;
    result: PrometheusResult[];
  };
}

export async function prometheusQueryRange(
  expr: string,
  start: number,
  end: number,
  step: number
): Promise<TimeSeries[]> {
  const params = new URLSearchParams({
    query: expr,
    start: start.toString(),
    end: end.toString(),
    step: step.toString(),
  });
  const res = await fetch(`/api/prometheus/api/v1/query_range?${params}`);
  if (!res.ok) throw new Error(`Prometheus error: ${res.status}`);
  const json: PrometheusResponse = await res.json();

  return json.data.result.map((r) => ({
    label: Object.values(r.metric).join(" ") || "value",
    data: r.values.map(([ts, val]): TimeSeriesPoint => ({
      timestamp: ts,
      value: parseFloat(val),
    })),
  }));
}

export async function prometheusInstantQuery(
  expr: string
): Promise<number> {
  const params = new URLSearchParams({ query: expr });
  const res = await fetch(`/api/prometheus/api/v1/query?${params}`);
  if (!res.ok) throw new Error(`Prometheus error: ${res.status}`);
  const json = await res.json();
  const result = json.data?.result?.[0];
  if (!result) return 0;
  return parseFloat(result.value[1]);
}
