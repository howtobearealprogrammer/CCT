# Timeline Scrubber Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a draggable timeline scrubber at the top of the dashboard that lets the user move the existing view window backward through Loki history, with an activity histogram for context.

**Architecture:** Add `endSeconds` state to `useTimeRange` (null = live). All existing panel queries already consume `start`/`end` so they pick up historical mode automatically. New `TimelineScrubber` component renders a Loki activity histogram + a brush overlay; new `useActivityHistogram` hook fetches earliest log time and bucketed activity counts.

**Tech Stack:** React + TypeScript + ECharts + Vite + Loki, dockerized.

**Repo conventions:** No unit-test framework in this dashboard codebase — verification is "build + browser screenshot." Each task ends with `docker compose up -d --build dashboard` and a Chrome MCP screenshot, then a commit.

**Spec:** `docs/superpowers/specs/2026-04-07-timeline-scrubber-design.md`

---

## Task 1: Extend `useTimeRange` with `endSeconds`

**Files:**
- Modify: `dashboard/src/hooks/useTimeRange.ts`

- [ ] **Step 1: Replace the hook with end-aware version**

```ts
import { useState, useMemo, useCallback } from "react";
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
  // null = live (end follows now); number = frozen unix seconds
  const [endSeconds, setEndSeconds] = useState<number | null>(null);

  const isLive = endSeconds === null;

  const jumpToNow = useCallback(() => setEndSeconds(null), []);

  const queryParams = useMemo(() => {
    const end = endSeconds ?? Math.floor(Date.now() / 1000);
    const start = end - rangeSeconds;
    const step = Math.max(Math.floor(rangeSeconds / 100), 15);
    return { start, end, step };
  }, [rangeSeconds, endSeconds]);

  const refreshQueryParams = useCallback(() => {
    const end = endSeconds ?? Math.floor(Date.now() / 1000);
    const start = end - rangeSeconds;
    const step = Math.max(Math.floor(rangeSeconds / 100), 15);
    return { start, end, step };
  }, [rangeSeconds, endSeconds]);

  return {
    rangeSeconds,
    setRangeSeconds,
    refreshSeconds,
    setRefreshSeconds,
    endSeconds,
    setEndSeconds,
    jumpToNow,
    isLive,
    queryParams,
    refreshQueryParams,
  };
}
```

- [ ] **Step 2: Build & verify nothing regressed**

Run: `docker compose up -d --build dashboard`
Then take a screenshot of localhost:3002. Expected: dashboard renders identically to before (no scrubber yet, but `useTimeRange` now exposes new fields).

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/hooks/useTimeRange.ts
git commit -m "feat(scrubber): add endSeconds state to useTimeRange"
```

---

## Task 2: Add Loki helpers for earliest event + activity histogram

**Files:**
- Modify: `dashboard/src/api/loki.ts`

- [ ] **Step 1: Append two helpers to `loki.ts`**

```ts
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
```

- [ ] **Step 2: Build & verify it still compiles**

Run: `docker compose up -d --build dashboard`
Expected: build succeeds, dashboard still renders.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/api/loki.ts
git commit -m "feat(scrubber): add Loki helpers for earliest event + activity histogram"
```

---

## Task 3: `useActivityHistogram` hook

**Files:**
- Create: `dashboard/src/hooks/useActivityHistogram.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useEffect, useState, useCallback } from "react";
import { lokiEarliestEventTime, lokiActivityHistogram } from "../api/loki";
import { useInterval } from "./useInterval";

const SERVICE_FILTER = `{service_name="claude-code"}`;
// Sum of all events that produce a metric series in the dashboard.
const ACTIVITY_EXPR = `sum(count_over_time(${SERVICE_FILTER} [$__interval]))`;

// Loki doesn't expand $__interval — we substitute step manually inside the helper.
// The helper computes step from (end-start)/bins, so use a literal interval here.
function exprWithStep(stepSeconds: number) {
  return `sum(count_over_time(${SERVICE_FILTER} [${stepSeconds}s]))`;
}

interface UseActivityHistogramResult {
  earliestSeconds: number | null;
  histogram: { t: number; count: number }[];
  refresh: () => void;
}

export function useActivityHistogram(refreshMs: number = 30000): UseActivityHistogramResult {
  const [earliestSeconds, setEarliestSeconds] = useState<number | null>(null);
  const [histogram, setHistogram] = useState<{ t: number; count: number }[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      // Find earliest, refreshing periodically so the bar stretches as logs accumulate.
      const earliest = await lokiEarliestEventTime(`${SERVICE_FILTER}`);
      setEarliestSeconds(earliest);
      const end = Math.floor(Date.now() / 1000);
      const start = earliest ?? end - 3600;
      const span = Math.max(end - start, 1);
      const bins = 120;
      const step = Math.max(Math.floor(span / bins), 15);
      const data = await lokiActivityHistogram(exprWithStep(step), start, end, bins);
      setHistogram(data);
    } catch {
      // swallow — keep previous state
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useInterval(fetchAll, refreshMs);

  return { earliestSeconds, histogram, refresh: fetchAll };
}
```

- [ ] **Step 2: Build & verify**

Run: `docker compose up -d --build dashboard`
Take a screenshot. Expected: dashboard unchanged, no console errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/hooks/useActivityHistogram.ts
git commit -m "feat(scrubber): add useActivityHistogram hook"
```

---

## Task 4: `TimelineScrubber` component

**Files:**
- Create: `dashboard/src/components/TimelineScrubber.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import { COLORS } from "../utils/colors";

interface Props {
  earliestSeconds: number | null;
  rangeSeconds: number;
  endSeconds: number | null; // null = live
  onEndChange: (s: number | null) => void;
  histogram: { t: number; count: number }[];
}

function fmt(unixSec: number) {
  const d = new Date(unixSec * 1000);
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TimelineScrubber({
  earliestSeconds,
  rangeSeconds,
  endSeconds,
  onEndChange,
  histogram,
}: Props) {
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const i = setInterval(() => setNowSeconds(Math.floor(Date.now() / 1000)), 5000);
    return () => clearInterval(i);
  }, []);

  const earliest = earliestSeconds ?? nowSeconds - 3600;
  const fullSpan = Math.max(nowSeconds - earliest, 1);
  const isLive = endSeconds === null;
  const effectiveEnd = endSeconds ?? nowSeconds;
  const effectiveStart = effectiveEnd - rangeSeconds;
  const scrubbingDisabled = rangeSeconds >= fullSpan;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startEnd: number } | null>(null);

  const pctFromTime = useCallback(
    (t: number) => ((t - earliest) / fullSpan) * 100,
    [earliest, fullSpan]
  );

  const brushLeftPct = Math.max(0, pctFromTime(effectiveStart));
  const brushWidthPct = Math.min(100 - brushLeftPct, (rangeSeconds / fullSpan) * 100);

  const commitEndFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const t = earliest + ratio * fullSpan;
      // Treat the click position as the END of the window.
      const clamped = Math.min(nowSeconds, Math.max(earliest + rangeSeconds, Math.floor(t)));
      onEndChange(clamped >= nowSeconds ? null : clamped);
    },
    [earliest, fullSpan, nowSeconds, onEndChange, rangeSeconds]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (scrubbingDisabled) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = { startX: e.clientX, startEnd: effectiveEnd };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const dxRatio = (e.clientX - dragState.current.startX) / rect.width;
    const newEnd = dragState.current.startEnd + dxRatio * fullSpan;
    const clamped = Math.min(nowSeconds, Math.max(earliest + rangeSeconds, Math.floor(newEnd)));
    onEndChange(clamped >= nowSeconds ? null : clamped);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    dragState.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const onTrackClick = (e: React.MouseEvent) => {
    if (scrubbingDisabled) return;
    if (dragState.current) return;
    commitEndFromClientX(e.clientX);
  };

  const chartOption = useMemo(() => {
    const maxCount = histogram.reduce((m, p) => Math.max(m, p.count), 0);
    return {
      grid: { left: 0, right: 0, top: 4, bottom: 4 },
      xAxis: {
        type: "time",
        min: earliest * 1000,
        max: nowSeconds * 1000,
        show: false,
      },
      yAxis: { type: "value", min: 0, max: Math.max(maxCount, 1), show: false },
      tooltip: { show: false },
      animation: false,
      series: [
        {
          type: "bar",
          data: histogram.map((p) => [p.t * 1000, p.count]),
          itemStyle: { color: COLORS.blue, opacity: 0.55 },
          barCategoryGap: "10%",
          large: true,
        },
      ],
    };
  }, [histogram, earliest, nowSeconds]);

  return (
    <div className="flex items-center gap-3 px-1 h-full">
      <span
        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
          isLive
            ? "bg-[#73BF69]/20 text-[#73BF69]"
            : "bg-[#FF9830]/20 text-[#FF9830]"
        }`}
      >
        {isLive ? "LIVE" : "HISTORICAL"}
      </span>
      <div className="text-[10px] text-[#8a94a6] tabular-nums w-[150px] text-right">
        {fmt(effectiveStart)}
      </div>
      <div
        ref={trackRef}
        onClick={onTrackClick}
        className="relative flex-1 h-[48px] rounded bg-white/[0.04] border border-white/[0.06] overflow-hidden cursor-pointer select-none"
      >
        <ReactECharts
          option={chartOption}
          style={{ height: "100%", width: "100%" }}
          notMerge
          lazyUpdate
        />
        {!scrubbingDisabled && (
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="absolute top-0 bottom-0 cursor-grab active:cursor-grabbing"
            style={{
              left: `${brushLeftPct}%`,
              width: `${brushWidthPct}%`,
              background: "rgba(255,152,48,0.18)",
              borderLeft: "2px solid #FF9830",
              borderRight: "2px solid #FF9830",
            }}
          />
        )}
      </div>
      <div className="text-[10px] text-[#8a94a6] tabular-nums w-[150px]">
        {fmt(effectiveEnd)}
      </div>
      <button
        onClick={() => onEndChange(null)}
        disabled={isLive}
        className={`text-[11px] px-2 py-1 rounded border ${
          isLive
            ? "border-white/[0.06] text-[#5a6373] cursor-default"
            : "border-[#FF9830] text-[#FF9830] hover:bg-[#FF9830]/10 cursor-pointer"
        }`}
      >
        Now
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Build & verify it compiles (component not yet wired in)**

Run: `docker compose up -d --build dashboard`
Expected: build succeeds, dashboard unchanged.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/TimelineScrubber.tsx
git commit -m "feat(scrubber): add TimelineScrubber component"
```

---

## Task 5: Wire scrubber into `App.tsx`

**Files:**
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Update `App.tsx`**

Replace the existing imports/header/grid with:

```tsx
import { useCallback, useMemo } from "react";
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

  const timeRangeMs = useMemo(() => {
    const end = (endSeconds ?? Math.floor(Date.now() / 1000)) * 1000;
    const start = end - rangeSeconds * 1000;
    return { start, end };
  }, [rangeSeconds, endSeconds, lastUpdated]);
```

(keep the rest of the existing computed values — `tokens`, `lines`, `active`, `commitCount`, `modelColorMap`, `actRate`, `actCenterColor`, `actLegendLabels` — unchanged.)

Then change the JSX root grid template and insert the scrubber as a new top row:

```tsx
  return (
    <div
      className="h-screen w-screen p-3 grid gap-3"
      style={{
        gridTemplateRows: "56px 48px 80px 1fr 1fr 0.7fr",
        background: COLORS.bg,
      }}
    >
      {/* Row 0: Timeline Scrubber */}
      <TimelineScrubber
        earliestSeconds={earliestSeconds}
        rangeSeconds={rangeSeconds}
        endSeconds={endSeconds}
        onEndChange={setEndSeconds}
        histogram={histogram}
      />

      {/* Row 1: Top Bar */}
      <TopBar
        rangeSeconds={rangeSeconds}
        onRangeChange={setRangeSeconds}
        refreshSeconds={refreshSeconds}
        onRefreshChange={setRefreshSeconds}
        isLive={!error && lastUpdated !== null && isLive}
      />
```

(keep all subsequent rows — Stat Cards, Token Story, Tool Story, Agent & MCP — exactly as they are.)

- [ ] **Step 2: Build**

Run: `docker compose up -d --build dashboard`
Expected: build succeeds.

- [ ] **Step 3: Browser verification**

Take a screenshot of localhost:3002. Expected: a new ~56px row at the very top showing the LIVE pill, two timestamps, a histogram with an amber brush at the right edge, and a "Now" button. Existing dashboard content unchanged below.

- [ ] **Step 4: Functional verification — scrubbing**

In the browser:
1. Drag the brush leftward.
2. Verify the LIVE pill flips to HISTORICAL, the "Now" button becomes amber/active, and the panels below refresh with data from the past window.
3. Click "Now" — verify it snaps back, pill flips to LIVE.
4. Switch the range selector from 1h to 6h while in historical mode — verify the brush widens leftward and the end timestamp stays put.

Take screenshots of (a) live state and (b) scrubbed-back state showing populated panels.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/App.tsx
git commit -m "feat(scrubber): wire timeline scrubber into dashboard"
```

---

## Self-review notes

- Spec coverage: histogram ✓, brush drag ✓, click-to-jump ✓, Now button ✓, mode pill ✓, anchored-end on duration change ✓, clamping ✓, disabled when window ≥ full range ✓, no logs edge case (earliest fallback to now-1h) ✓.
- All panels pick up `endSeconds` automatically through `refreshQueryParams` — no per-panel changes needed.
- Auto-refresh in historical mode returns the frozen `end`, so polling won't drift.
