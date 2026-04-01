# Custom Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Grafana with a custom Vite + React + ECharts dashboard that queries Prometheus and Loki directly, producing a visually stunning single-page telemetry view at 1920x1080.

**Architecture:** Static React app served by Nginx. Nginx reverse-proxies `/api/prometheus/*` and `/api/loki/*` to the existing Prometheus and Loki containers. ECharts handles all chart rendering with animated transitions on 30s polling. CSS Grid enforces the 100vh no-scroll layout.

**Tech Stack:** Vite, React 18, TypeScript, Apache ECharts (echarts-for-react), Tailwind CSS v4, Nginx, Docker

---

## File Map

```
dashboard/
├── index.html                    # Vite HTML entry, loads Inter font
├── package.json                  # Dependencies: react, echarts, echarts-for-react, tailwindcss
├── vite.config.ts                # Vite config with proxy for dev server
├── tailwind.config.ts            # Tailwind config (not needed for v4, uses CSS-based config)
├── tsconfig.json                 # TypeScript strict mode
├── Dockerfile                    # Multi-stage: node build → nginx serve
├── nginx.conf                    # Proxy /api/prometheus → prometheus:9090, /api/loki → loki:3100
├── src/
│   ├── main.tsx                  # React DOM entry
│   ├── index.css                 # Tailwind v4 imports + global styles (Inter font, #0a0e17 bg)
│   ├── App.tsx                   # Root: CSS Grid layout, data orchestration, controls
│   ├── api/
│   │   ├── prometheus.ts         # queryRange(expr, start, end, step) → TimeSeries[]
│   │   ├── loki.ts               # queryRange(expr, start, end, step) → TimeSeries[]
│   │   └── queries.ts            # All PromQL/LogQL strings + fetch orchestrators
│   ├── hooks/
│   │   ├── useInterval.ts        # setInterval hook, clears on unmount/change
│   │   ├── useDashboardData.ts   # Fetches all data, transforms for ECharts
│   │   └── useTimeRange.ts       # Time range + refresh state, computes start/end/step
│   ├── components/
│   │   ├── TopBar.tsx            # Title, LIVE/OFFLINE badge, dropdowns
│   │   ├── StatCard.tsx          # Gradient card with value + sparkline
│   │   ├── ChartCard.tsx         # Glassmorphism container with title
│   │   ├── AreaChart.tsx         # ECharts stacked area with gradient fills
│   │   ├── RingGauge.tsx         # ECharts pie as ring with center label
│   │   └── HorizontalBar.tsx    # ECharts horizontal bar chart
│   ├── utils/
│   │   ├── formatters.ts         # formatNumber(45300000) → "45.3M", formatDuration(5400) → "1.5 hrs"
│   │   └── colors.ts             # COLORS constant object + CHART_PALETTE array
│   └── types/
│       └── index.ts              # TimeSeries, DashboardData, TimeRange interfaces
└── public/
    └── favicon.svg               # Simple Claude-themed icon
```

---

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/index.html`
- Create: `dashboard/vite.config.ts`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/src/main.tsx`
- Create: `dashboard/src/index.css`
- Create: `dashboard/src/App.tsx`
- Create: `dashboard/public/favicon.svg`

- [ ] **Step 1: Initialize the project**

```bash
cd /home/dan/Repos/claude-code-monitoring
mkdir -p dashboard/src dashboard/public
cd dashboard
npm init -y
npm install react@18 react-dom@18 echarts echarts-for-react
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Create tsconfig.json**

Write `dashboard/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

Write `dashboard/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3002,
    proxy: {
      "/api/prometheus": {
        target: "http://localhost:9090",
        rewrite: (path) => path.replace(/^\/api\/prometheus/, ""),
      },
      "/api/loki": {
        target: "http://localhost:3100",
        rewrite: (path) => path.replace(/^\/api\/loki/, ""),
      },
    },
  },
});
```

- [ ] **Step 4: Create index.html**

Write `dashboard/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=1920" />
    <title>Claude Code Telemetry</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create index.css**

Write `dashboard/src/index.css`:
```css
@import "tailwindcss";

body {
  margin: 0;
  background: #0a0e17;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  color: #e2e8f0;
  overflow: hidden;
}
```

- [ ] **Step 6: Create main.tsx and App.tsx placeholder**

Write `dashboard/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Write `dashboard/src/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <h1 className="text-2xl font-semibold text-[#e2e8f0]">
        Claude Code Telemetry
      </h1>
    </div>
  );
}
```

- [ ] **Step 7: Create favicon**

Write `dashboard/public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#0a0e17"/>
  <text x="16" y="22" text-anchor="middle" font-family="Inter,system-ui" font-size="18" font-weight="700" fill="#5794F2">C</text>
</svg>
```

- [ ] **Step 8: Verify dev server runs**

```bash
cd /home/dan/Repos/claude-code-monitoring/dashboard
npx vite --open
```
Expected: browser opens at localhost:3002 showing "Claude Code Telemetry" on dark background.

Kill the dev server after confirming.

- [ ] **Step 9: Commit**

```bash
cd /home/dan/Repos/claude-code-monitoring
git add dashboard/
git commit -m "feat: scaffold Vite + React + Tailwind dashboard project"
```

---

### Task 2: Types, colors, and formatters

**Files:**
- Create: `dashboard/src/types/index.ts`
- Create: `dashboard/src/utils/colors.ts`
- Create: `dashboard/src/utils/formatters.ts`

- [ ] **Step 1: Create types**

Write `dashboard/src/types/index.ts`:
```typescript
export interface TimeSeriesPoint {
  timestamp: number; // Unix seconds
  value: number;
}

export interface TimeSeries {
  label: string;
  data: TimeSeriesPoint[];
}

export interface PieSlice {
  name: string;
  value: number;
}

export interface TimeRangeOption {
  label: string;
  seconds: number;
}

export interface RefreshOption {
  label: string;
  seconds: number | null; // null = off
}

export interface DashboardData {
  totalTokens: { value: number; series: TimeSeriesPoint[] };
  linesOfCode: { value: number; series: TimeSeriesPoint[] };
  activeTime: { value: number; series: TimeSeriesPoint[] };
  commits: { value: number; series: TimeSeriesPoint[] };
  tokenUsageOverTime: TimeSeries[];
  tokensByType: PieSlice[];
  tokensByModel: PieSlice[];
  toolCallsOverTime: TimeSeries[];
  toolDistribution: PieSlice[];
  toolDecisions: PieSlice[];
  agentCallsOverTime: TimeSeries[];
  mcpToolCallsOverTime: TimeSeries[];
  agentTypes: PieSlice[];
}
```

- [ ] **Step 2: Create colors**

Write `dashboard/src/utils/colors.ts`:
```typescript
export const COLORS = {
  bg: "#0a0e17",
  cardBg: "rgba(255,255,255,0.03)",
  cardBorder: "rgba(255,255,255,0.06)",
  blue: "#5794F2",
  green: "#73BF69",
  purple: "#B877D9",
  amber: "#FF9830",
  teal: "#4ECDC4",
  coral: "#FF6B6B",
  textPrimary: "#e2e8f0",
  textSecondary: "#8a94a6",
  textMuted: "#5a6a7a",
} as const;

export const CHART_PALETTE = [
  COLORS.blue,
  COLORS.green,
  COLORS.purple,
  COLORS.amber,
  COLORS.teal,
  COLORS.coral,
  "#9FE2BF",
  "#FFD700",
] as const;

export const TOKEN_TYPE_COLORS: Record<string, string> = {
  cacheRead: COLORS.blue,
  cacheCreation: COLORS.purple,
  input: COLORS.green,
  output: COLORS.amber,
};

export const MODEL_COLORS: Record<string, string> = {
  opus: COLORS.purple,
  haiku: COLORS.teal,
  sonnet: COLORS.blue,
};

export const DECISION_COLORS: Record<string, string> = {
  config: COLORS.blue,
  user_temporary: COLORS.amber,
  user_permanent: COLORS.green,
};

export const AGENT_TYPE_COLORS: Record<string, string> = {
  "general-purpose": COLORS.amber,
  Explore: COLORS.teal,
  Plan: COLORS.purple,
};

export function colorForModel(model: string): string {
  if (model.includes("opus")) return MODEL_COLORS.opus;
  if (model.includes("haiku")) return MODEL_COLORS.haiku;
  if (model.includes("sonnet")) return MODEL_COLORS.sonnet;
  return COLORS.blue;
}
```

- [ ] **Step 3: Create formatters**

Write `dashboard/src/utils/formatters.ts`:
```typescript
export function formatNumber(n: number): { value: string; suffix: string } {
  if (n >= 1_000_000) return { value: (n / 1_000_000).toFixed(1), suffix: "M" };
  if (n >= 1_000) return { value: (n / 1_000).toFixed(2), suffix: "K" };
  return { value: Math.round(n).toString(), suffix: "" };
}

export function formatDuration(seconds: number): { value: string; suffix: string } {
  if (seconds >= 3600) return { value: (seconds / 3600).toFixed(1), suffix: "hrs" };
  if (seconds >= 60) return { value: (seconds / 60).toFixed(0), suffix: "min" };
  return { value: Math.round(seconds).toString(), suffix: "s" };
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/dan/Repos/claude-code-monitoring
git add dashboard/src/types/ dashboard/src/utils/
git commit -m "feat: add types, color palette, and formatters"
```

---

### Task 3: API layer (Prometheus + Loki clients)

**Files:**
- Create: `dashboard/src/api/prometheus.ts`
- Create: `dashboard/src/api/loki.ts`
- Create: `dashboard/src/api/queries.ts`

- [ ] **Step 1: Create Prometheus client**

Write `dashboard/src/api/prometheus.ts`:
```typescript
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
```

- [ ] **Step 2: Create Loki client**

Write `dashboard/src/api/loki.ts`:
```typescript
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
```

- [ ] **Step 3: Create query definitions and orchestration**

Write `dashboard/src/api/queries.ts`:
```typescript
import { prometheusQueryRange } from "./prometheus";
import { lokiQueryRange } from "./loki";
import type { DashboardData, TimeSeries, PieSlice } from "../types";

const SERVICE = `{service_name="claude-code"}`;

function sumSeries(series: TimeSeries[]): number {
  return series.reduce((total, s) => {
    const last = s.data[s.data.length - 1];
    return total + (last?.value ?? 0);
  }, 0);
}

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
```

- [ ] **Step 4: Commit**

```bash
cd /home/dan/Repos/claude-code-monitoring
git add dashboard/src/api/
git commit -m "feat: add Prometheus/Loki API clients and query orchestration"
```

---

### Task 4: Hooks (time range, interval, data orchestration)

**Files:**
- Create: `dashboard/src/hooks/useTimeRange.ts`
- Create: `dashboard/src/hooks/useInterval.ts`
- Create: `dashboard/src/hooks/useDashboardData.ts`

- [ ] **Step 1: Create useTimeRange hook**

Write `dashboard/src/hooks/useTimeRange.ts`:
```typescript
import { useState, useMemo } from "react";
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

  const queryParams = useMemo(() => {
    const end = Math.floor(Date.now() / 1000);
    const start = end - rangeSeconds;
    const step = Math.max(Math.floor(rangeSeconds / 100), 15);
    return { start, end, step };
  }, [rangeSeconds]);

  return {
    rangeSeconds,
    setRangeSeconds,
    refreshSeconds,
    setRefreshSeconds,
    queryParams,
    refreshQueryParams() {
      const end = Math.floor(Date.now() / 1000);
      const start = end - rangeSeconds;
      const step = Math.max(Math.floor(rangeSeconds / 100), 15);
      return { start, end, step };
    },
  };
}
```

- [ ] **Step 2: Create useInterval hook**

Write `dashboard/src/hooks/useInterval.ts`:
```typescript
import { useEffect, useRef } from "react";

export function useInterval(callback: () => void, delayMs: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => savedCallback.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}
```

- [ ] **Step 3: Create useDashboardData hook**

Write `dashboard/src/hooks/useDashboardData.ts`:
```typescript
import { useState, useEffect, useCallback } from "react";
import { fetchDashboardData } from "../api/queries";
import { useInterval } from "./useInterval";
import type { DashboardData } from "../types";

interface UseDashboardDataResult {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

export function useDashboardData(
  refreshQueryParams: () => { start: number; end: number; step: number },
  refreshSeconds: number | null
): UseDashboardDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { start, end, step } = refreshQueryParams();
      const result = await fetchDashboardData(start, end, step);
      setData(result);
      setError(null);
      setLastUpdated(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [refreshQueryParams]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling
  useInterval(fetchData, refreshSeconds ? refreshSeconds * 1000 : null);

  return { data, loading, error, lastUpdated };
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/dan/Repos/claude-code-monitoring
git add dashboard/src/hooks/
git commit -m "feat: add time range, interval, and data orchestration hooks"
```

---

### Task 5: Reusable chart components (ChartCard, AreaChart, RingGauge, HorizontalBar)

**Files:**
- Create: `dashboard/src/components/ChartCard.tsx`
- Create: `dashboard/src/components/AreaChart.tsx`
- Create: `dashboard/src/components/RingGauge.tsx`
- Create: `dashboard/src/components/HorizontalBar.tsx`

- [ ] **Step 1: Create ChartCard**

Write `dashboard/src/components/ChartCard.tsx`:
```tsx
import type { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export default function ChartCard({ title, children, className = "" }: ChartCardProps) {
  return (
    <div
      className={`rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3.5 flex flex-col ${className}`}
    >
      <div className="text-xs font-medium text-[#8a94a6] mb-2">{title}</div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create AreaChart**

Write `dashboard/src/components/AreaChart.tsx`:
```tsx
import ReactECharts from "echarts-for-react";
import type { TimeSeries } from "../types";
import { CHART_PALETTE, TOKEN_TYPE_COLORS } from "../utils/colors";

interface AreaChartProps {
  series: TimeSeries[];
  colorMap?: Record<string, string>;
  stacked?: boolean;
  showLegend?: boolean;
  height?: string;
}

export default function AreaChart({
  series,
  colorMap,
  stacked = true,
  showLegend = true,
  height = "100%",
}: AreaChartProps) {
  const option = {
    animation: true,
    animationDuration: 500,
    grid: {
      top: 8,
      right: 8,
      bottom: showLegend ? 28 : 8,
      left: 40,
    },
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: "rgba(10,14,23,0.95)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
    },
    xAxis: {
      type: "time" as const,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#5a6a7a", fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#5a6a7a", fontSize: 10 },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
    },
    legend: showLegend
      ? {
          bottom: 0,
          textStyle: { color: "#5a6a7a", fontSize: 10 },
          icon: "roundRect",
          itemWidth: 10,
          itemHeight: 3,
        }
      : undefined,
    series: series.map((s, i) => {
      const color = colorMap?.[s.label] ?? CHART_PALETTE[i % CHART_PALETTE.length];
      return {
        name: s.label,
        type: "line" as const,
        stack: stacked ? "total" : undefined,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2, color },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color + "80" },
              { offset: 1, color: color + "05" },
            ],
          },
        },
        data: s.data.map((p) => [p.timestamp * 1000, p.value]),
      };
    }),
  };

  return <ReactECharts option={option} style={{ height, width: "100%" }} opts={{ renderer: "canvas" }} />;
}
```

- [ ] **Step 3: Create RingGauge**

Write `dashboard/src/components/RingGauge.tsx`:
```tsx
import ReactECharts from "echarts-for-react";
import type { PieSlice } from "../types";
import { CHART_PALETTE } from "../utils/colors";

interface RingGaugeProps {
  data: PieSlice[];
  colorMap?: Record<string, string>;
  height?: string;
}

export default function RingGauge({ data, colorMap, height = "100%" }: RingGaugeProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const dominant = data[0];
  const dominantPct = total > 0 && dominant ? Math.round((dominant.value / total) * 100) : 0;
  const dominantName = dominant?.name ?? "";
  // Shorten label for center display
  const shortName =
    dominantName.length > 10 ? dominantName.split(/[-_]/)[0] ?? dominantName : dominantName;

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
        radius: ["58%", "78%"],
        center: ["35%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: { borderWidth: 2, borderColor: "#0a0e17" },
        label: {
          show: true,
          position: "center" as const,
          formatter: [`{pct|${dominantPct}%}`, `{sub|${shortName}}`].join("\n"),
          rich: {
            pct: { fontSize: 18, fontWeight: 700, color: "#e2e8f0", lineHeight: 24 },
            sub: { fontSize: 9, color: "#5a6a7a", lineHeight: 14 },
          },
        },
        data: data.map((d, i) => ({
          name: d.name,
          value: d.value,
          itemStyle: {
            color: colorMap?.[d.name] ?? CHART_PALETTE[i % CHART_PALETTE.length],
          },
        })),
      },
    ],
    // Right-side legend
    legend: {
      orient: "vertical" as const,
      right: 0,
      top: "center",
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: "#8a94a6", fontSize: 10 },
      formatter: (name: string) => {
        const item = data.find((d) => d.name === name);
        const pct = total > 0 && item ? Math.round((item.value / total) * 100) : 0;
        return `${name}  ${pct}%`;
      },
    },
  };

  return <ReactECharts option={option} style={{ height, width: "100%" }} opts={{ renderer: "canvas" }} />;
}
```

- [ ] **Step 4: Create HorizontalBar**

Write `dashboard/src/components/HorizontalBar.tsx`:
```tsx
import ReactECharts from "echarts-for-react";
import type { PieSlice } from "../types";
import { CHART_PALETTE } from "../utils/colors";

interface HorizontalBarProps {
  data: PieSlice[];
  height?: string;
}

export default function HorizontalBar({ data, height = "100%" }: HorizontalBarProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const sorted = [...data].sort((a, b) => b.value - a.value);

  const option = {
    animation: true,
    animationDuration: 500,
    grid: { top: 4, right: 40, bottom: 4, left: 60 },
    xAxis: { type: "value" as const, show: false },
    yAxis: {
      type: "category" as const,
      data: sorted.map((d) => d.name),
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#8a94a6", fontSize: 10 },
    },
    tooltip: {
      backgroundColor: "rgba(10,14,23,0.95)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
    },
    series: [
      {
        type: "bar" as const,
        data: sorted.map((d, i) => ({
          value: d.value,
          itemStyle: {
            color: {
              type: "linear" as const,
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: CHART_PALETTE[i % CHART_PALETTE.length]! },
                { offset: 1, color: CHART_PALETTE[i % CHART_PALETTE.length]! + "99" },
              ],
            },
            borderRadius: [0, 3, 3, 0],
          },
        })),
        barWidth: "55%",
        label: {
          show: true,
          position: "right" as const,
          color: "#5a6a7a",
          fontSize: 10,
          formatter: (params: { value: number }) =>
            total > 0 ? `${Math.round((params.value / total) * 100)}%` : "0%",
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height, width: "100%" }} opts={{ renderer: "canvas" }} />;
}
```

- [ ] **Step 5: Commit**

```bash
cd /home/dan/Repos/claude-code-monitoring
git add dashboard/src/components/ChartCard.tsx dashboard/src/components/AreaChart.tsx dashboard/src/components/RingGauge.tsx dashboard/src/components/HorizontalBar.tsx
git commit -m "feat: add ChartCard, AreaChart, RingGauge, and HorizontalBar components"
```

---

### Task 6: TopBar and StatCard components

**Files:**
- Create: `dashboard/src/components/TopBar.tsx`
- Create: `dashboard/src/components/StatCard.tsx`

- [ ] **Step 1: Create TopBar**

Write `dashboard/src/components/TopBar.tsx`:
```tsx
import { TIME_RANGES, REFRESH_OPTIONS } from "../hooks/useTimeRange";

interface TopBarProps {
  rangeSeconds: number;
  onRangeChange: (seconds: number) => void;
  refreshSeconds: number | null;
  onRefreshChange: (seconds: number | null) => void;
  isLive: boolean;
}

export default function TopBar({
  rangeSeconds,
  onRangeChange,
  refreshSeconds,
  onRefreshChange,
  isLive,
}: TopBarProps) {
  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-[#e2e8f0] tracking-tight">
          Claude Code Telemetry
        </h1>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded ${
            isLive
              ? "bg-[#5794F2]/15 text-[#5794F2]"
              : "bg-[#FF9830]/15 text-[#FF9830]"
          }`}
        >
          {isLive ? "LIVE" : "OFFLINE"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={rangeSeconds}
          onChange={(e) => onRangeChange(Number(e.target.value))}
          className="bg-white/[0.06] border border-white/[0.08] rounded-md px-3 py-1 text-xs text-[#8a94a6] outline-none cursor-pointer"
        >
          {TIME_RANGES.map((r) => (
            <option key={r.seconds} value={r.seconds}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          value={refreshSeconds ?? "off"}
          onChange={(e) =>
            onRefreshChange(e.target.value === "off" ? null : Number(e.target.value))
          }
          className="bg-white/[0.06] border border-white/[0.08] rounded-md px-3 py-1 text-xs text-[#8a94a6] outline-none cursor-pointer"
        >
          {REFRESH_OPTIONS.map((r) => (
            <option key={r.label} value={r.seconds ?? "off"}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create StatCard**

Write `dashboard/src/components/StatCard.tsx`:
```tsx
import ReactECharts from "echarts-for-react";
import type { TimeSeriesPoint } from "../types";

interface StatCardProps {
  label: string;
  value: string;
  suffix: string;
  color: string;
  sparklineData: TimeSeriesPoint[];
}

export default function StatCard({ label, value, suffix, color, sparklineData }: StatCardProps) {
  const sparkOption = {
    animation: false,
    grid: { top: 0, right: 0, bottom: 0, left: 0 },
    xAxis: { type: "time" as const, show: false },
    yAxis: { type: "value" as const, show: false },
    series: [
      {
        type: "line" as const,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 1.5, color },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color + "66" },
              { offset: 1, color: color + "00" },
            ],
          },
        },
        data: sparklineData.map((p) => [p.timestamp * 1000, p.value]),
      },
    ],
  };

  return (
    <div
      className="rounded-[10px] px-4 py-3 flex items-center justify-between"
      style={{
        background: `linear-gradient(135deg, ${color}1F 0%, ${color}0A 100%)`,
        border: `1px solid ${color}26`,
      }}
    >
      <div>
        <div className="text-[10px] uppercase tracking-[1px] text-[#5a6a7a] mb-1.5">
          {label}
        </div>
        <div className="text-[28px] font-bold leading-none tracking-tight" style={{ color }}>
          {value}
          {suffix && (
            <span className="text-sm font-normal ml-0.5 opacity-70">{suffix}</span>
          )}
        </div>
      </div>
      <div className="w-[70px] h-[28px]">
        <ReactECharts
          option={sparkOption}
          style={{ height: "28px", width: "70px" }}
          opts={{ renderer: "canvas" }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/dan/Repos/claude-code-monitoring
git add dashboard/src/components/TopBar.tsx dashboard/src/components/StatCard.tsx
git commit -m "feat: add TopBar and StatCard components"
```

---

### Task 7: App layout — wire everything together

**Files:**
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Build the full App layout**

Overwrite `dashboard/src/App.tsx`:
```tsx
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
```

- [ ] **Step 2: Test in dev server**

```bash
cd /home/dan/Repos/claude-code-monitoring/dashboard
npx vite
```
Open http://localhost:3002 — the dashboard should render with the full layout. If Prometheus/Loki are running, data should appear. If not, panels will show empty states.

- [ ] **Step 3: Commit**

```bash
cd /home/dan/Repos/claude-code-monitoring
git add dashboard/src/App.tsx
git commit -m "feat: wire up full dashboard layout with all panels"
```

---

### Task 8: Docker setup (Nginx + Dockerfile + docker-compose)

**Files:**
- Create: `dashboard/nginx.conf`
- Create: `dashboard/Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create nginx.conf**

Write `dashboard/nginx.conf`:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/prometheus/ {
        proxy_pass http://prometheus:9090/;
        proxy_set_header Host $host;
    }

    location /api/loki/ {
        proxy_pass http://loki:3100/;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: Create Dockerfile**

Write `dashboard/Dockerfile`:
```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 3: Add build script to package.json**

Add to the `"scripts"` section of `dashboard/package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 4: Update docker-compose.yml**

Comment out the grafana service and add the dashboard service. The full updated `docker-compose.yml`:

```yaml
services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.120.0
    container_name: otel-collector
    restart: unless-stopped
    command: ["--config=/etc/otelcol/config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otelcol/config.yaml:ro
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
      - "8889:8889"   # Prometheus metrics endpoint

  prometheus:
    image: prom/prometheus:v3.3.0
    container_name: prometheus
    restart: unless-stopped
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    depends_on:
      - otel-collector
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'

  loki:
    image: grafana/loki:3.4.2
    container_name: loki
    restart: unless-stopped
    volumes:
      - loki_data:/loki
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml

  dashboard:
    build:
      context: ./dashboard
      dockerfile: Dockerfile
    container_name: dashboard
    restart: unless-stopped
    ports:
      - "3002:80"
    depends_on:
      - prometheus
      - loki

  # Grafana kept for debugging — uncomment to re-enable
  # grafana:
  #   image: grafana/grafana:11.6.0
  #   container_name: grafana
  #   restart: unless-stopped
  #   environment:
  #     - GF_SECURITY_ADMIN_USER=admin
  #     - GF_SECURITY_ADMIN_PASSWORD=admin
  #     - GF_SERVER_HTTP_PORT=3001
  #     - GF_USERS_ALLOW_SIGN_UP=false
  #     - GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH=/var/lib/grafana/dashboards/claude-code-dashboard-v2.json
  #   volumes:
  #     - grafana_data:/var/lib/grafana
  #     - ./grafana/provisioning:/etc/grafana/provisioning:ro
  #     - ./grafana/provisioning/dashboards/claude-code-dashboard.json:/var/lib/grafana/dashboards/claude-code-dashboard.json:ro
  #     - ./grafana/provisioning/dashboards/claude-code-dashboard-v2.json:/var/lib/grafana/dashboards/claude-code-dashboard-v2.json:ro
  #     - ./grafana/provisioning/dashboards/claude-code-dashboard-v3.json:/var/lib/grafana/dashboards/claude-code-dashboard-v3.json:ro
  #   ports:
  #     - "3001:3001"
  #   depends_on:
  #     - prometheus
  #     - loki

volumes:
  prometheus_data:
  # grafana_data:
  loki_data:
```

- [ ] **Step 5: Build and test with Docker**

```bash
cd /home/dan/Repos/claude-code-monitoring
docker compose up -d --build dashboard
```

Open http://localhost:3002 — should show the dashboard served by Nginx with data from Prometheus/Loki.

- [ ] **Step 6: Commit**

```bash
git add dashboard/nginx.conf dashboard/Dockerfile dashboard/package.json docker-compose.yml
git commit -m "feat: add Docker setup with Nginx proxy, comment out Grafana"
```

---

### Task 9: Visual polish and viewport verification

**Files:**
- Modify: `dashboard/src/App.tsx` (if grid tuning needed)
- Modify: any component files for visual tweaks

- [ ] **Step 1: Open dashboard at 1920x1080**

Open http://localhost:3002 in Chrome. Resize window to 1920x1080 (or use F11 fullscreen on a 1080p monitor).

- [ ] **Step 2: Verify all panels fit without scrolling**

Check that:
- All 4 stat cards are visible in the top row
- Token Usage area chart + 2 ring gauges fill the second row
- Tool Calls area chart + bar chart + ring gauge fill the third row
- Agent/MCP 3 panels fill the bottom row
- No vertical scrollbar appears

If panels overflow, adjust `gridTemplateRows` in `App.tsx` — reduce the stat row or bottom row height.

- [ ] **Step 3: Verify data is rendering**

Check that:
- Stat cards show real values from Prometheus/Loki
- Area charts show time series data with gradient fills
- Ring gauges show percentages with center labels
- Horizontal bar chart shows tool distribution
- Tooltips work on hover

- [ ] **Step 4: Verify animated transitions**

Wait for the 30s refresh cycle (or temporarily set to 10s). Confirm that:
- Stat card values update smoothly
- Area charts animate from old to new data points
- Ring gauges transition slice sizes smoothly

- [ ] **Step 5: Fix any visual issues found**

Apply CSS/component adjustments as needed. Common fixes:
- Grid row heights via `gridTemplateRows` tweaking
- Chart margins via ECharts `grid` option
- Font sizes and spacing

- [ ] **Step 6: Commit**

```bash
cd /home/dan/Repos/claude-code-monitoring
git add -A
git commit -m "fix: visual polish and viewport verification at 1920x1080"
```

---

### Task 10: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Add a new section documenting the custom dashboard, update the architecture diagram to show the dashboard container instead of Grafana as the primary frontend, and update the Access section with the new URL (`:3002`). Note that Grafana is commented out but available for debugging.

- [ ] **Step 2: Commit**

```bash
cd /home/dan/Repos/claude-code-monitoring
git add README.md
git commit -m "docs: update README for custom dashboard, document Grafana deprecation"
```
