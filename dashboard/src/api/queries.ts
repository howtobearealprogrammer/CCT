import { prometheusQueryRange } from "./prometheus";
import { lokiQueryRange, lokiLogTimestamps } from "./loki";
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
  const sparseStep = Math.max(step * 5, 300);

  const [
    tokensByType,
    tokensByModel,
    linesOfCode,
    activeTime,
    toolCalls,
    actToolTotal,
    actToolSuccess,
    agentCalls,
    mcpToolCalls,
    agentTypes,
    totalAgentCalls,
    commits,
    userPromptTimestamps,
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
      `sum by (tool_name)(count_over_time(${SERVICE} | event_name="tool_result" | tool_name=~"Edit|Write|Bash" [${range}]))`,
      start, end, step
    ),
    lokiQueryRange(
      `sum by (tool_name)(count_over_time(${SERVICE} | event_name="tool_result" | tool_name=~"Edit|Write|Bash" | success="true" [${range}]))`,
      start, end, step
    ),
    lokiQueryRange(
      `sum(count_over_time(${SERVICE} | event_name="tool_result" | tool_name="Agent" [${sparseStep}s]))`,
      start, end, step
    ),
    lokiQueryRange(
      `sum by (mcp_tool_name)(count_over_time(${SERVICE} | event_name="tool_result" | tool_name="mcp_tool" | line_format \`{{.tool_parameters}}\` | json mcp_tool_name="mcp_tool_name" [${step}s]))`,
      start, end, step
    ),
    lokiQueryRange(
      `sum by (subagent_type)(count_over_time(${SERVICE} | event_name="tool_result" | tool_name="Agent" | line_format \`{{.tool_input}}\` | json subagent_type="subagent_type" | subagent_type != "" [${range}]))`,
      start, end, step
    ),
    lokiQueryRange(
      `sum(count_over_time(${SERVICE} | event_name="tool_result" | tool_name="Agent" [${range}]))`,
      start, end, step
    ),
    lokiQueryRange(
      `sum(count_over_time(${SERVICE} | event_name="tool_result" | tool_name="Bash" | line_format \`{{.tool_parameters}}\` | json git_commit_id="git_commit_id" | git_commit_id != "" [${step}s]))`,
      start, end, step
    ),
    lokiLogTimestamps(
      `${SERVICE} | event_name="user_prompt"`,
      start, end
    ),
  ]);

  const typedAgentPie = seriesToPie(agentTypes);
  const typedTotal = typedAgentPie.reduce((s, p) => s + p.value, 0);
  const totalAgentCount = collapseToSingleSeries(totalAgentCalls).data.reduce((s, p) => s + p.value, 0);
  const untypedCount = Math.max(0, totalAgentCount - typedTotal);
  const agentTypePie: PieSlice[] = [
    ...(untypedCount > 0 ? [{ name: "general-purpose", value: untypedCount }] : []),
    ...typedAgentPie,
  ];

  const totalTokenSeries = collapseToSingleSeries(tokensByType);
  const linesSeries = collapseToSingleSeries(linesOfCode);
  const activeSeries = collapseToSingleSeries(activeTime);
  const commitsSeries = collapseToSingleSeries(commits);

  // Compute Act Success Rate
  const actTotalPie = seriesToPie(actToolTotal);
  const actSuccessPie = seriesToPie(actToolSuccess);
  const actTools = actTotalPie.map((t) => {
    const s = actSuccessPie.find((p) => p.name === t.name);
    const successful = s?.value ?? 0;
    return {
      name: t.name,
      total: t.value,
      successful,
      rate: t.value > 0 ? Math.round((successful / t.value) * 100) : 0,
    };
  });
  const totalAct = actTools.reduce((s, t) => s + t.total, 0);
  const totalSuccess = actTools.reduce((s, t) => s + t.successful, 0);
  const actSuccessData = {
    tools: actTools,
    aggregateRate: totalAct > 0 ? Math.round((totalSuccess / totalAct) * 100) : 0,
    ringSlices: actTotalPie,
  };

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
    actSuccess: actSuccessData,
    agentCallsOverTime: agentCalls,
    mcpToolCallsOverTime: topN(mcpToolCalls, 5),
    agentTypes: agentTypePie,
    userPromptTimestamps,
  };
}
