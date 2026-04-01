import { useCallback } from "react";
import { useTimeRange } from "./hooks/useTimeRange";
import { useDashboardData } from "./hooks/useDashboardData";
import TopBar from "./components/TopBar";
import StatCard from "./components/StatCard";
import ChartCard from "./components/ChartCard";
import AreaChart from "./components/AreaChart";
import RingGauge from "./components/RingGauge";
import HorizontalBar from "./components/HorizontalBar";
import { COLORS, TOKEN_TYPE_COLORS, DECISION_COLORS, AGENT_TYPE_COLORS, colorForModel } from "./utils/colors";
import { formatNumber, formatDuration } from "./utils/formatters";

export default function App() {
  const {
    rangeSeconds,
    setRangeSeconds,
    refreshSeconds,
    setRefreshSeconds,
    refreshQueryParams,
  } = useTimeRange();

  const stableRefresh = useCallback(refreshQueryParams, [rangeSeconds]);
  const { data, error, lastUpdated } = useDashboardData(stableRefresh, refreshSeconds);

  const tokens = data ? formatNumber(data.totalTokens.value) : { value: "—", suffix: "" };
  const lines = data ? formatNumber(data.linesOfCode.value) : { value: "—", suffix: "" };
  const active = data ? formatDuration(data.activeTime.value) : { value: "—", suffix: "" };
  const commitCount = data ? formatNumber(data.commits.value) : { value: "—", suffix: "" };

  // Build model color map from data
  const modelColorMap: Record<string, string> = {};
  if (data) {
    for (const slice of data.tokensByModel) {
      modelColorMap[slice.name] = colorForModel(slice.name);
    }
  }

  return (
    <div
      className="h-screen w-screen p-3 grid gap-3"
      style={{
        gridTemplateRows: "48px 90px 1fr 1fr auto",
        background: COLORS.bg,
      }}
    >
      {/* Row 0: Top Bar */}
      <TopBar
        rangeSeconds={rangeSeconds}
        onRangeChange={setRangeSeconds}
        refreshSeconds={refreshSeconds}
        onRefreshChange={setRefreshSeconds}
        isLive={!error && lastUpdated !== null}
      />

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Tokens" value={tokens.value} suffix={tokens.suffix} color={COLORS.blue} sparklineData={data?.totalTokens.series ?? []} />
        <StatCard label="Lines of Code" value={lines.value} suffix={lines.suffix} color={COLORS.green} sparklineData={data?.linesOfCode.series ?? []} />
        <StatCard label="Active Time" value={active.value} suffix={active.suffix} color={COLORS.purple} sparklineData={data?.activeTime.series ?? []} />
        <StatCard label="Commits" value={commitCount.value} suffix={commitCount.suffix} color={COLORS.amber} sparklineData={data?.commits.series ?? []} />
      </div>

      {/* Row 2: Token Story */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <ChartCard title="Token Usage Over Time">
          <AreaChart series={data?.tokenUsageOverTime ?? []} colorMap={TOKEN_TYPE_COLORS} />
        </ChartCard>
        <div className="grid gap-3 grid-rows-2">
          <ChartCard title="Token Usage by Type">
            <RingGauge data={data?.tokensByType ?? []} colorMap={TOKEN_TYPE_COLORS} />
          </ChartCard>
          <ChartCard title="Tokens by Model">
            <RingGauge data={data?.tokensByModel ?? []} colorMap={modelColorMap} />
          </ChartCard>
        </div>
      </div>

      {/* Row 3: Tool Story */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <ChartCard title="Tool Calls Over Time">
          <AreaChart series={data?.toolCallsOverTime ?? []} showLegend={false} />
        </ChartCard>
        <div className="grid gap-3 grid-rows-2">
          <ChartCard title="Tool Distribution">
            <HorizontalBar data={data?.toolDistribution ?? []} />
          </ChartCard>
          <ChartCard title="Tool Decisions">
            <RingGauge data={data?.toolDecisions ?? []} colorMap={DECISION_COLORS} />
          </ChartCard>
        </div>
      </div>

      {/* Row 4: Agent & MCP */}
      <div className="grid grid-cols-3 gap-3">
        <ChartCard title="Agent Calls Over Time">
          <AreaChart
            series={data?.agentCallsOverTime ?? []}
            colorMap={{ value: COLORS.amber }}
            stacked={false}
            showLegend={false}
          />
        </ChartCard>
        <ChartCard title="MCP Tool Calls Over Time">
          <AreaChart series={data?.mcpToolCallsOverTime ?? []} showLegend={false} />
        </ChartCard>
        <ChartCard title="Agent Types">
          <RingGauge data={data?.agentTypes ?? []} colorMap={AGENT_TYPE_COLORS} />
        </ChartCard>
      </div>
    </div>
  );
}
