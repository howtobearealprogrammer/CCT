import { prometheusQueryRange } from "./prometheus";
import { lokiQueryRange } from "./loki";
import type { DashboardData, TimeSeries, PieSlice } from "../types";

const SERVICE = `{service_name="claude-code"}`;

function seriesToPie(series: TimeSeries[]): PieSlice[] {
  return series
    .map((s) => ({
      name: s.label,
      value: s.data.reduce((sum, p) => sum + p.value, 0),
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

function topN(series: TimeSeries[], n: number): TimeSeries[] {
  const totals = series.map((s) => ({
    series: s,
    total: s.data.reduce((sum, p) => sum + p.value, 0),
  }));
  totals.sort((a, b) => b.total - a.total);
  return totals.slice(0, n).map((t) => t.series);
}

function collapseToSingleSeries(series: TimeSeries[]): TimeSeries {
  if (series.length === 0) return { label: "value", data: [] };
  if (series.length === 1) return series[0]!;

  const timestamps = new Set<number>();
  for (const s of series) for (const p of s.data) timestamps.add(p.timestamp);
  const sorted = [...timestamps].sort((a, b) => a - b);

  return {
    label: "value",
    data: sorted.map((ts) => ({
      timestamp: ts,
      value: series.reduce((sum, s) => {
        const point = s.data.find((p) => p.timestamp === ts);
        return sum + (point?.value ?? 0);
      }, 0),
    })),
  };
}

export async function fetchDashboardData(
  start: number,
  end: number,
  step: number
): Promise<DashboardData> {
  const range = `${end - start}s`;

  const [
    tokensByType,
    tokensByModel,
    linesOfCode,
    activeTime,
    toolCalls,
    toolDecisions,
    agentCalls,
    mcpToolCalls,
    agentTypes,
    commits,
  ] = await Promise.all([
    prometheusQueryRange(
      `sum by (type)(increase(claude_code_token_usage_tokens_total[${step}s]))`,
      start, end, step
    ),
    prometheusQueryRange(
      `sum by (model)(increase(claude_code_token_usage_tokens_total[${range}]))`,
      start, end, step
    ),
    prometheusQueryRange(
      `sum(increase(claude_code_lines_of_code_count_total[${step}s]))`,
      start, end, step
    ),
    prometheusQueryRange(
      `sum(increase(claude_code_active_time_seconds_total[${step}s]))`,
      start, end, step
    ),
    lokiQueryRange(
      `sum by (tool_name)(count_over_time(${SERVICE} | event_name="tool_result" [${step}s]))`,
      start, end, step
    ),
    lokiQueryRange(
      `sum by (source)(count_over_time(${SERVICE} | event_name="tool_decision" [${step}s]))`,
      start, end, step
    ),
    lokiQueryRange(
      `sum(count_over_time(${SERVICE} | event_name="tool_result" | tool_name="Agent" [${step}s]))`,
      start, end, step
    ),
    lokiQueryRange(
      `sum by (mcp_tool_name)(count_over_time(${SERVICE} | event_name="tool_result" | tool_name="mcp_tool" | line_format \`{{.tool_parameters}}\` | json mcp_tool_name="mcp_tool_name" [${step}s]))`,
      start, end, step
    ),
    lokiQueryRange(
      `sum by (subagent_type)(count_over_time(${SERVICE} | event_name="tool_result" | tool_name="Agent" | line_format \`{{.tool_input}}\` | regexp \`subagent_type.{3}(?P<subagent_type>[a-zA-Z][a-zA-Z0-9_-]+)\` [${range}]))`,
      start, end, step
    ),
    lokiQueryRange(
      `sum(count_over_time(${SERVICE} | event_name="tool_result" | tool_name="Bash" | line_format \`{{.tool_parameters}}\` | json git_commit_id="git_commit_id" | git_commit_id != "" [${step}s]))`,
      start, end, step
    ),
  ]);

  const totalTokenSeries = collapseToSingleSeries(tokensByType);
  const linesSeries = collapseToSingleSeries(linesOfCode);
  const activeSeries = collapseToSingleSeries(activeTime);
  const commitsSeries = collapseToSingleSeries(commits);

  return {
    totalTokens: {
      value: totalTokenSeries.data.reduce((s, p) => s + p.value, 0),
      series: totalTokenSeries.data,
    },
    linesOfCode: {
      value: linesSeries.data.reduce((s, p) => s + p.value, 0),
      series: linesSeries.data,
    },
    activeTime: {
      value: activeSeries.data.reduce((s, p) => s + p.value, 0),
      series: activeSeries.data,
    },
    commits: {
      value: commitsSeries.data.reduce((s, p) => s + p.value, 0),
      series: commitsSeries.data,
    },
    tokenUsageOverTime: tokensByType,
    tokensByType: seriesToPie(tokensByType),
    tokensByModel: seriesToPie(tokensByModel),
    toolCallsOverTime: topN(toolCalls, 8),
    toolDistribution: seriesToPie(toolCalls).slice(0, 6),
    toolDecisions: seriesToPie(toolDecisions),
    agentCallsOverTime: agentCalls,
    mcpToolCallsOverTime: topN(mcpToolCalls, 5),
    agentTypes: seriesToPie(agentTypes),
  };
}
