import { useCallback, useMemo, useState } from "react";
import { useTimeRange } from "./hooks/useTimeRange";
import { useDashboardData } from "./hooks/useDashboardData";
import { useActivityHistogram } from "./hooks/useActivityHistogram";
import TopBar from "./components/TopBar";
import TimelineScrubber from "./components/TimelineScrubber";
import StatCard from "./components/StatCard";
import ChartCard from "./components/ChartCard";
import AreaChart from "./components/AreaChart";
import RingGauge from "./components/RingGauge";
import HorizontalBar from "./components/HorizontalBar";
import { COLORS, TOKEN_TYPE_COLORS, ACT_TOOL_COLORS, AGENT_TYPE_COLORS, colorForModel } from "./utils/colors";
import { formatNumber, formatDuration } from "./utils/formatters";

export default function App() {
  const {
    rangeSeconds,
    setRangeSeconds,
    refreshSeconds,
    setRefreshSeconds,
    endSeconds,
    setEndSeconds,
    isLive,
    refreshQueryParams,
  } = useTimeRange();

  const stableRefresh = useCallback(refreshQueryParams, [rangeSeconds, endSeconds]);
  const { data, error, lastUpdated } = useDashboardData(stableRefresh, refreshSeconds);
  const { earliestSeconds, histogram } = useActivityHistogram(30000);
  const [timelineVisible, setTimelineVisible] = useState(false);

  // Compute time range bounds for x-axis pinning
  const timeRangeMs = useMemo(() => {
    const end = (endSeconds ?? Math.floor(Date.now() / 1000)) * 1000;
    const start = end - rangeSeconds * 1000;
    return { start, end };
  }, [rangeSeconds, endSeconds, lastUpdated]);

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

  // Act Success Rate center color
  const actRate = data?.actSuccess?.aggregateRate ?? 0;
  const actCenterColor = actRate >= 95 ? "#73BF69" : actRate >= 80 ? "#FF9830" : "#F2495C";
  const actLegendLabels: Record<string, string> = {};
  if (data?.actSuccess) {
    for (const t of data.actSuccess.tools) {
      actLegendLabels[t.name] = `${t.name}  ${t.rate}%`;
    }
  }

  return (
    <div
      className="h-screen w-screen p-3 grid gap-3"
      style={{
        gridTemplateRows: timelineVisible
          ? "48px 28px 80px 1fr 1fr 0.7fr"
          : "48px 80px 1fr 1fr 0.7fr",
        background: COLORS.bg,
      }}
    >
      {/* Row 0: Top Bar */}
      <TopBar
        rangeSeconds={rangeSeconds}
        onRangeChange={setRangeSeconds}
        refreshSeconds={refreshSeconds}
        onRefreshChange={setRefreshSeconds}
        isLive={!error && lastUpdated !== null && isLive}
        timelineVisible={timelineVisible}
        onToggleTimeline={() => setTimelineVisible((v) => !v)}
      />

      {/* Row 1: Timeline Scrubber (toggleable) */}
      {timelineVisible && (
        <TimelineScrubber
          earliestSeconds={earliestSeconds}
          rangeSeconds={rangeSeconds}
          endSeconds={endSeconds}
          onEndChange={setEndSeconds}
          histogram={histogram}
        />
      )}

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Tokens" value={tokens.value} suffix={tokens.suffix} color={COLORS.blue} sparklineData={data?.totalTokens.series ?? []} />
        <StatCard label="Lines of Code" value={lines.value} suffix={lines.suffix} color={COLORS.green} sparklineData={data?.linesOfCode.series ?? []} />
        <StatCard label="Active Time" value={active.value} suffix={active.suffix} color={COLORS.purple} sparklineData={data?.activeTime.series ?? []} />
        <StatCard label="Commits" value={commitCount.value} suffix={commitCount.suffix} color={COLORS.amber} sparklineData={data?.commits.series ?? []} sparklineType="bar" />
      </div>

      {/* Row 2: Token Story */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <ChartCard title="Token Usage Over Time">
          <AreaChart
            series={data?.tokenUsageOverTime ?? []}
            colorMap={TOKEN_TYPE_COLORS}
            markLineTimestamps={data?.userPromptTimestamps}
            markLineLabel="prompt"
            timeRangeMs={timeRangeMs}
          />
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
          <AreaChart series={data?.toolCallsOverTime ?? []} showLegend={false} timeRangeMs={timeRangeMs} integerAxis />
        </ChartCard>
        <div className="grid gap-3 grid-rows-2">
          <ChartCard title="Tool Distribution">
            <HorizontalBar data={data?.toolDistribution ?? []} />
          </ChartCard>
          <ChartCard title="Act Success Rate">
            <RingGauge
              data={data?.actSuccess?.ringSlices ?? []}
              colorMap={ACT_TOOL_COLORS}
              centerValue={data?.actSuccess?.aggregateRate}
              centerLabel="success"
              centerColor={data ? actCenterColor : undefined}
              legendLabels={actLegendLabels}
            />
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
            timeRangeMs={timeRangeMs}
            integerAxis
          />
        </ChartCard>
        <ChartCard title="MCP Tool Calls Over Time">
          <AreaChart series={data?.mcpToolCallsOverTime ?? []} showLegend={false} timeRangeMs={timeRangeMs} integerAxis />
        </ChartCard>
        <ChartCard title="Agent Types">
          <RingGauge data={data?.agentTypes ?? []} colorMap={AGENT_TYPE_COLORS} />
        </ChartCard>
      </div>
    </div>
  );
}
