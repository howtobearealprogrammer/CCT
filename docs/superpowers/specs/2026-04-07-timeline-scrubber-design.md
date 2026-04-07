# Timeline Scrubber — Design

**Date:** 2026-04-07
**Status:** Approved for implementation planning

## Problem

The dashboard always shows a window ending at "now". When the current view duration is short (e.g. 1h), the dashboard is empty during quiet periods, even though busy sessions exist earlier in the logs. There is no way to slide the view back to inspect those sessions — useful for screenshots, demos, and reviewing past activity.

## Goal

Add a timeline scrubber at the top of the dashboard that lets the user move the existing view window backward through history, from the earliest available log up to "now".

## Non-Goals

- Free-form start/end pickers (Grafana-style range editor)
- Keyboard shortcuts for scrubbing
- Persisting scrub position in the URL
- Multi-window comparison
- Changing the existing duration selector behavior

## UX

A new row at the very top of `App.tsx`, ~64px tall, above `TopBar`.

**Contents:**
- Horizontal activity histogram spanning **earliest log → now**, ~120 bins.
- A draggable "brush" overlay representing the current view window. Width = the currently selected `rangeSeconds`. Initially anchored to `now` (live mode).
- Mode pill: **LIVE** (green) when the window ends at now, **HISTORICAL** (amber) when scrubbed back.
- **"Now"** button on the right, visible/highlighted only in historical mode. Clicking it snaps the brush back to `now` and re-enters live mode.

**Interactions:**
- **Drag brush body** → scrubs the window. On release, commit the new end time and refresh all panels.
- **Click on histogram outside brush** → jump brush so its end aligns with the click point (clamped).
- **Change duration selector** while in historical mode → brush *width* changes; brush *end* stays anchored where it was.
- **Brush clamping:** end cannot exceed `now`; start cannot precede earliest log.
- **Edge case — window ≥ full range:** brush fills bar, scrubbing disabled, mode forced to LIVE.
- **Edge case — no logs yet:** histogram empty, scrubber shows LIVE only, brush hidden.

## Architecture

### State (`useTimeRange.ts`)

Add a new piece of state representing the *end* of the view window:

```ts
endSeconds: number | null  // null = live (end = now)
```

`queryParams` becomes:

```ts
const end = endSeconds ?? Math.floor(Date.now() / 1000);
const start = end - rangeSeconds;
```

Exports added:
- `endSeconds`
- `setEndSeconds(s: number | null)`
- `jumpToNow()` — convenience for `setEndSeconds(null)`
- `isLive` — derived: `endSeconds === null`

`refreshQueryParams()` behavior:
- **Live:** recomputes `end = now` each call (current behavior).
- **Historical:** returns the frozen `end = endSeconds` so polling does not drift the window.

Changing `rangeSeconds` in historical mode keeps `endSeconds` unchanged (anchored to end, brush width grows/shrinks leftward).

### Activity histogram data

New function in `dashboard/src/api/queries.ts` (or new `activityHistogram.ts`):

```ts
fetchEarliestEventTime(): Promise<number | null>     // unix seconds
fetchActivityHistogram(start, end, bins): Promise<{ t: number; count: number }[]>
```

- `fetchEarliestEventTime` issues a Loki `count_over_time({...}[30d])` (or similar wide range) and returns the timestamp of the first non-empty bucket. Called once on mount; refreshed every ~5 min.
- `fetchActivityHistogram` issues one Loki `count_over_time` query bucketed across `[earliest, now]` into `bins` (~120) buckets. Refreshed every 30s while live; on demand otherwise.

Both queries use the existing Loki client and follow the same `event` stream filter the rest of the dashboard uses.

### Component

New file: `dashboard/src/components/TimelineScrubber.tsx`

Props:
```ts
{
  earliestSeconds: number | null;
  nowSeconds: number;
  rangeSeconds: number;
  endSeconds: number | null;
  onEndChange: (s: number | null) => void;
  histogram: { t: number; count: number }[];
  isLive: boolean;
}
```

Implementation:
- ECharts bar chart for the histogram (no axes, no tooltip, transparent background, fixed colors from the palette).
- Brush rendered as an absolutely-positioned `div` overlay (not ECharts brush — simpler and more controllable for our needs). Plain pointer events for drag. Position computed from `endSeconds`/`rangeSeconds` against `[earliest, now]`.
- `onEndChange(null)` when the user clicks "Now"; otherwise emits the new end timestamp.
- Mode pill + Now button rendered inside the same row, right-aligned.

### `App.tsx`

- Add a new top row in the grid template (e.g. `64px 48px 80px ...`) and render `<TimelineScrubber/>` first.
- Pull `endSeconds`, `setEndSeconds`, `isLive` from `useTimeRange`.
- `timeRangeMs` becomes:
  ```ts
  const end = (endSeconds ?? Math.floor(Date.now() / 1000)) * 1000;
  const start = end - rangeSeconds * 1000;
  ```
- Fetch earliest time + histogram via `useDashboardData` or a small dedicated hook (`useActivityHistogram`) — TBD during implementation, prefer the latter to keep `useDashboardData` focused.

### Data flow

All existing panel queries already consume `start`/`end` from `queryParams`. Threading `endSeconds` through `useTimeRange` is sufficient to make every panel respect the historical window automatically — no per-panel changes expected.

## Color & Visual

- Histogram bars: `COLORS.blue` at low opacity (~0.5).
- Brush overlay: 1px border in `COLORS.amber`, fill `rgba(255,152,48,0.15)`.
- LIVE pill: `COLORS.green` background.
- HISTORICAL pill: `COLORS.amber` background.
- Now button: ghost button, becomes solid amber in historical mode.

## Files Touched

- **New:** `dashboard/src/components/TimelineScrubber.tsx`
- **New:** `dashboard/src/hooks/useActivityHistogram.ts`
- **Modified:** `dashboard/src/api/queries.ts` — add `fetchEarliestEventTime`, `fetchActivityHistogram`
- **Modified:** `dashboard/src/hooks/useTimeRange.ts` — add `endSeconds` state, `jumpToNow`, `isLive`
- **Modified:** `dashboard/src/App.tsx` — new top row, pass `endSeconds` through

## Verification

After implementation:
1. `docker compose up -d --build dashboard`
2. Screenshot full page at 1920×1080.
3. Zoom into the scrubber row to verify histogram + brush rendering.
4. Drag brush back to a known busy session — confirm panels populate.
5. Click "Now" — confirm window snaps back to live.
6. Switch duration from 1h → 6h while in historical mode — confirm brush widens leftward, end stays put.
7. Switch to 7d range that exceeds remaining history — confirm brush fills bar and scrubbing is disabled.
