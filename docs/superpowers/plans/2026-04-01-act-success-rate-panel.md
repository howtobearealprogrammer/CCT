# Act Success Rate Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Tool Decisions" ring gauge with an "Act Success Rate" panel showing first-attempt success rate for Edit/Write/Bash tools.

**Architecture:** Two new Loki queries fetch total and successful Act tool calls grouped by tool_name. Frontend computes per-tool and aggregate success rates. The existing RingGauge component gets optional props to override center text and legend formatting. The ring shows volume distribution; center shows aggregate success %; legend shows per-tool success %.

**Tech Stack:** React, ECharts (via echarts-for-react), Loki LogQL queries

---

### Task 1: Add ActSuccessData type and remove toolDecisions

**Files:**
- Modify: `dashboard/src/types/index.ts:36`

- [ ] **Step 1: Update DashboardData interface**

Replace `toolDecisions` with `actSuccess` in the DashboardData interface. In `dashboard/src/types/index.ts`, replace line 36:

```typescript
  toolDecisions: PieSlice[];
```

with:

```typescript
  actSuccess: {
    tools: Array<{ name: string; total: number; successful: number; rate: number }>;
    aggregateRate: number;
    ringSlices: PieSlice[];
  };
```

- [ ] **Step 2: Verify TypeScript catches all references**

Run: `cd /home/dan/Repos/claude-code-monitoring/dashboard && npx tsc --noEmit 2>&1 | head -30`

Expected: Type errors in `queries.ts` and `App.tsx` referencing `toolDecisions`. This confirms we've correctly broken the old references.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/types/index.ts
git commit -m "refactor: replace toolDecisions type with actSuccess in DashboardData"
```

---

### Task 2: Update queries to fetch Act success data

**Files:**
- Modify: `dashboard/src/api/queries.ts:53-153`

- [ ] **Step 1: Replace toolDecisions query with two Act tool queries**

In `dashboard/src/api/queries.ts`, replace the destructured variable `toolDecisions` (line 59) with `actToolTotal` and `actToolSuccess`, adding one more entry to the Promise.all array.

Replace lines 53-114 (the entire destructuring + Promise.all block) with:

```typescript
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
```

- [ ] **Step 2: Compute actSuccess data from query results**

In the same file, replace the `toolDecisions: seriesToPie(toolDecisions),` line (line 147) in the return block with the computed actSuccess object. Add this computation before the return statement (after the existing `commitsSeries` line 127):

```typescript
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
```

Then in the return object, replace:

```typescript
    toolDecisions: seriesToPie(toolDecisions),
```

with:

```typescript
    actSuccess: actSuccessData,
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/dan/Repos/claude-code-monitoring/dashboard && npx tsc --noEmit 2>&1 | head -30`

Expected: Only errors remaining should be in `App.tsx` (still referencing `toolDecisions` and `DECISION_COLORS`).

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/api/queries.ts
git commit -m "feat: replace toolDecisions query with act success rate queries"
```

---

### Task 3: Update RingGauge with center/legend override props

**Files:**
- Modify: `dashboard/src/components/RingGauge.tsx`

- [ ] **Step 1: Add optional override props to RingGauge**

Replace the entire `dashboard/src/components/RingGauge.tsx` with:

```tsx
import ReactECharts from "echarts-for-react";
import type { PieSlice } from "../types";
import { CHART_PALETTE } from "../utils/colors";

interface RingGaugeProps {
  data: PieSlice[];
  colorMap?: Record<string, string>;
  height?: string;
  centerValue?: number;
  centerLabel?: string;
  centerColor?: string;
  legendLabels?: Record<string, string>;
}

export default function RingGauge({
  data,
  colorMap,
  height = "100%",
  centerValue,
  centerLabel,
  centerColor,
  legendLabels,
}: RingGaugeProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const hasData = data.length > 0 && total > 0;
  const dominant = data[0];
  const dominantPct = hasData && dominant ? Math.round((dominant.value / total) * 100) : 0;
  const dominantName = dominant?.name ?? "";
  const shortName =
    dominantName.length > 10 ? dominantName.split(/[-_]/)[0] ?? dominantName : dominantName;

  const displayPct = centerValue !== undefined ? centerValue : dominantPct;
  const displayLabel = centerLabel ?? shortName;
  const displayColor = centerColor ?? "#e2e8f0";

  const centerText = hasData
    ? `{pct|${displayPct}%}\n{sub|${displayLabel}}`
    : "{nodata|No data}";

  const option = {
    animation: true,
    animationDuration: 800,
    tooltip: {
      trigger: "item" as const,
      backgroundColor: "rgba(10,14,23,0.95)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
      formatter: (params: { name: string; percent: number }) =>
        `${params.name}: ${params.percent}%`,
    },
    series: [
      {
        type: "pie" as const,
        radius: ["52%", "75%"],
        center: ["30%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: { borderWidth: 2, borderColor: "#0a0e17" },
        label: {
          show: true,
          position: "center" as const,
          formatter: centerText,
          rich: {
            pct: { fontSize: 20, fontWeight: 700, color: displayColor, lineHeight: 26 },
            sub: { fontSize: 10, color: "#5a6a7a", lineHeight: 14 },
            nodata: { fontSize: 11, fontWeight: 500, color: "#5a6a7a", lineHeight: 16 },
          },
        },
        emphasis: {
          label: { show: true, fontSize: 20, fontWeight: 700 },
        },
        data: hasData
          ? data.map((d, i) => ({
            name: d.name,
            value: d.value,
            itemStyle: {
              color: colorMap?.[d.name] ?? CHART_PALETTE[i % CHART_PALETTE.length],
            },
          }))
          : [{ name: "", value: 1, itemStyle: { color: "#1e2a3a" } }],
      },
    ],
    legend: {
      orient: "vertical" as const,
      right: 0,
      top: "center",
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: "#8a94a6", fontSize: 10 },
      formatter: (name: string) => {
        if (legendLabels?.[name]) return legendLabels[name];
        const item = data.find((d) => d.name === name);
        const pct = total > 0 && item ? Math.round((item.value / total) * 100) : 0;
        return `${name}  ${pct}%`;
      },
    },
  };

  return <ReactECharts option={option} style={{ height, width: "100%" }} opts={{ renderer: "canvas" }} />;
}
```

- [ ] **Step 2: Verify existing ring gauges still work (no regression)**

Run: `cd /home/dan/Repos/claude-code-monitoring/dashboard && npx tsc --noEmit 2>&1 | head -30`

Expected: Errors only in `App.tsx` (DECISION_COLORS import and toolDecisions reference). No new errors from RingGauge callers since all new props are optional.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/RingGauge.tsx
git commit -m "feat: add centerValue, centerLabel, centerColor, legendLabels props to RingGauge"
```

---

### Task 4: Update colors — replace DECISION_COLORS with ACT_TOOL_COLORS

**Files:**
- Modify: `dashboard/src/utils/colors.ts:40-44`

- [ ] **Step 1: Replace DECISION_COLORS with ACT_TOOL_COLORS**

In `dashboard/src/utils/colors.ts`, replace lines 40-44:

```typescript
export const DECISION_COLORS: Record<string, string> = {
  config: COLORS.blue,
  user_temporary: COLORS.amber,
  user_permanent: COLORS.green,
};
```

with:

```typescript
export const ACT_TOOL_COLORS: Record<string, string> = {
  Bash: COLORS.green,
  Edit: COLORS.blue,
  Write: COLORS.purple,
};
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/utils/colors.ts
git commit -m "refactor: replace DECISION_COLORS with ACT_TOOL_COLORS"
```

---

### Task 5: Update App.tsx to render Act Success Rate panel

**Files:**
- Modify: `dashboard/src/App.tsx:10,99-101`

- [ ] **Step 1: Update imports**

In `dashboard/src/App.tsx`, replace line 10:

```typescript
import { COLORS, TOKEN_TYPE_COLORS, DECISION_COLORS, AGENT_TYPE_COLORS, colorForModel } from "./utils/colors";
```

with:

```typescript
import { COLORS, TOKEN_TYPE_COLORS, ACT_TOOL_COLORS, AGENT_TYPE_COLORS, colorForModel } from "./utils/colors";
```

- [ ] **Step 2: Add success rate color helper**

Add this after the `modelColorMap` block (after line 43, before the return statement):

```typescript
  // Act Success Rate center color
  const actRate = data?.actSuccess?.aggregateRate ?? 0;
  const actCenterColor = actRate >= 95 ? "#73BF69" : actRate >= 80 ? "#FF9830" : "#F2495C";
  const actLegendLabels: Record<string, string> = {};
  if (data?.actSuccess) {
    for (const t of data.actSuccess.tools) {
      actLegendLabels[t.name] = `${t.name}  ${t.rate}%`;
    }
  }
```

- [ ] **Step 3: Replace the Tool Decisions panel**

In `dashboard/src/App.tsx`, replace lines 99-101:

```tsx
          <ChartCard title="Tool Decisions">
            <RingGauge data={data?.toolDecisions ?? []} colorMap={DECISION_COLORS} />
          </ChartCard>
```

with:

```tsx
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
```

- [ ] **Step 4: Verify full TypeScript compilation**

Run: `cd /home/dan/Repos/claude-code-monitoring/dashboard && npx tsc --noEmit 2>&1`

Expected: Clean compilation, zero errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/App.tsx
git commit -m "feat: replace Tool Decisions panel with Act Success Rate"
```

---

### Task 6: Build, verify visually, and fix any issues

**Files:** None (verification only)

- [ ] **Step 1: Rebuild the dashboard container**

Run: `cd /home/dan/Repos/claude-code-monitoring && docker compose up -d --build dashboard`

Expected: Container builds and starts successfully.

- [ ] **Step 2: Take a full-page screenshot**

Use `mcp__claude-in-chrome__computer` screenshot on the dashboard tab (localhost:3002). Verify the dashboard loads and the "Act Success Rate" panel appears in the correct grid position (row 3, right sidebar, bottom).

- [ ] **Step 3: Zoom into the Act Success Rate panel**

Use `mcp__claude-in-chrome__computer` zoom on the panel region. Verify:
- Panel title says "Act Success Rate"
- Ring shows colored segments for Bash (green), Edit (blue), Write (purple)
- Center text shows aggregate percentage with "success" label
- Center text color is green (if 95%+), amber (80-94%), or red (below 80%)
- Legend on right shows per-tool success rates (e.g., "Bash 87%", "Edit 98%", "Write 100%")

- [ ] **Step 4: Check no-data state if needed**

If the time range shows no Act tool data, verify the "No Data" state renders correctly.

- [ ] **Step 5: Final commit if any visual fixes were needed**

If any adjustments were required, commit them:
```bash
git add -A
git commit -m "fix: visual adjustments to Act Success Rate panel"
```
