# Custom Dashboard Design Spec

## Goal

Replace Grafana with a custom web dashboard for Claude Code telemetry. Must be visually stunning — screenshot-worthy for LinkedIn at 1920x1080. Queries Prometheus and Loki APIs directly. Same data categories as the Grafana v3 dashboard. Single-user, single-page, dark mode.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Vite + React | Component model, hot reload, clean code organization |
| Charts | Apache ECharts (`echarts-for-react`) | Apache 2.0 license, rich dark themes, animated transitions, gradient fills |
| Styling | Tailwind CSS | Rapid dark theme iteration, utility classes |
| API | Direct fetch to Prometheus + Loki | No backend needed, browser queries APIs |
| Container | Nginx serving Vite build | Tiny image, same Docker Compose network |
| Port | `:3002` | Avoids conflict with Grafana `:3001` (kept for debugging) |
| Refresh | Polling with animated transitions | 30s default, configurable via UI dropdown (10s, 30s, 1m, 5m, off) |
| Viewport | 1920x1080, no scrolling | CSS Grid with `100vh`, scales proportionally at smaller viewports |

## Architecture

```
Browser (:3002)
  └── Custom Dashboard (Vite/React/ECharts/Tailwind)
        ├── fetch → Prometheus :9090/api/v1/query_range
        └── fetch → Loki :3100/loki/api/v1/query_range
```

The dashboard lives in a `dashboard/` directory at the repo root. It builds to static files served by an Nginx container in docker-compose alongside the existing OTel Collector, Prometheus, and Loki. Grafana remains in docker-compose but commented out for debugging access.

## Color Palette

| Role | Hex | Usage |
|------|-----|-------|
| Background | `#0a0e17` | Page background — deep navy, not pure black |
| Card surface | `rgba(255,255,255,0.03)` | Panel backgrounds with subtle glassmorphism |
| Card border | `rgba(255,255,255,0.06)` | Subtle card edges |
| Primary Blue | `#5794F2` | Total Tokens, cacheRead, Read tool, config decisions |
| Secondary Green | `#73BF69` | Lines of Code, input tokens, Bash tool |
| Tertiary Purple | `#B877D9` | Active Time, cacheCreation, mcp_tool, Plan agent |
| Quaternary Amber | `#FF9830` | Commits, output tokens, Agent Calls, general-purpose agent |
| Accent Teal | `#4ECDC4` | MCP Tool Calls, Explore agent, haiku model |
| Primary text | `#e2e8f0` | Values, headings |
| Secondary text | `#8a94a6` | Labels, legend text |
| Tertiary text | `#5a6a7a` | Axis labels, muted content |

## Layout

Full viewport, no scrolling. CSS Grid with fixed row heights.

```
┌─────────────────────────────────────────────────────────────┐
│ Top Bar (48px)                                              │
│ "Claude Code Telemetry" [LIVE]          [Last 3h ▾] [30s ▾]│
├──────────┬──────────┬──────────┬──────────────────────────────┤
│ Tokens   │ Lines    │ Active   │ Commits                     │
│ 45.3M ⌇ │ 2.29K ⌇  │ 1.5hrs ⌇ │ 7 ⌇                       │
│ (90px)   │          │          │                              │
├──────────────────────────────────┬────────────────────────────┤
│                                  │ Token Usage by Type        │
│ Token Usage Over Time            │ [ring gauge: 96% cache]    │
│ (stacked area, ~340px)           │ (h: ~170px)                │
│                                  ├────────────────────────────┤
│                                  │ Tokens by Model            │
│ w: ~66%                          │ [ring gauge: 95% opus]     │
│                                  │ (h: ~170px)                │
├──────────────────────────────────┬────────────────────────────┤
│                                  │ Tool Distribution          │
│ Tool Calls Over Time             │ [horizontal bar chart]     │
│ (stacked area, ~340px)           │ (h: ~170px)                │
│                                  ├────────────────────────────┤
│                                  │ Tool Decisions             │
│ w: ~66%                          │ [ring gauge: 85% config]   │
│                                  │ (h: ~170px)                │
├──────────────┬───────────────────┬────────────────────────────┤
│ Agent Calls  │ MCP Tool Calls   │ Agent Types                │
│ (area chart) │ (area chart)     │ [ring gauge]               │
│ (~240px)     │                  │                             │
└──────────────┴───────────────────┴────────────────────────────┘
```

Height budget at 1080px:
- Top bar: 48px
- Stats row: 90px
- Token story: 340px (area chart 2/3 width + 2 stacked ring gauges 1/3 width)
- Tool story: 340px (area chart 2/3 width + bar chart + ring gauge 1/3 width)
- Agent/MCP row: 240px
- Gaps (12px between rows x 4): 48px
- Outer padding: ~24px top/bottom
- **Total: ~1080px** (exactly fills viewport using CSS Grid `fr` units)

Enforced via: `height: 100vh; overflow: hidden` on the container, `grid-template-rows` with proportional `fr` units.

## Panel Specifications

### Top Bar

- Left: "Claude Code Telemetry" title (18px, semibold, `#e2e8f0`) + "LIVE" badge (blue pill, pulses when data refreshes)
- Right: Time range dropdown (Last 1h, 3h, 6h, 12h, 24h, 7d) + Refresh interval dropdown (10s, 30s, 1m, 5m, off)
- Height: 48px fixed

### Stat Cards (4 panels)

Each card:
- Background: linear gradient using the card's accent color at 12% → 4% opacity
- Border: 1px solid accent color at 15% opacity, border-radius 10px
- Layout: value on the left, embedded sparkline on the right
- Value: 28px, font-weight 700, colored in the accent color
- Unit suffix: 14px, font-weight 400, 70% opacity
- Label: 10px uppercase, letter-spacing 1px, `#5a6a7a`
- Sparkline: mini area chart (60x24px) using ECharts in mini mode — shows trend from the time series data

| Card | Color | Source | Query |
|------|-------|--------|-------|
| Total Tokens | `#5794F2` | Prometheus | `sum(increase(claude_code_token_usage_tokens_total[RANGE]))` |
| Lines of Code | `#73BF69` | Prometheus | `sum(increase(claude_code_lines_of_code_count_total[RANGE]))` |
| Active Time | `#B877D9` | Prometheus | `sum(increase(claude_code_active_time_seconds_total[RANGE]))` — formatted as hours |
| Commits | `#FF9830` | Loki | Count `tool_result` events where `tool_parameters` contains `git_commit_id` |

### Token Usage Over Time (area chart)

- Position: Row 2 left, ~66% width
- Type: ECharts stacked area chart
- Data: `sum by (type)(increase(claude_code_token_usage_tokens_total[STEP]))` over time range
- Styling:
  - Smooth curves (`smooth: true`)
  - Gradient area fills: each series fades from 50% opacity at the line to 2% at the baseline
  - Line width: 2px
  - No points shown
  - Animated transitions on data refresh
- Color overrides: cacheRead=`#5794F2`, cacheCreation=`#B877D9`, input=`#73BF69`, output=`#FF9830`
- Legend: small inline legend below the chart (colored line + label)
- Tooltip: crosshair showing all series values at hover point

### Token Usage by Type (ring gauge)

- Position: Row 2 right top, ~34% width, ~170px height
- Type: ECharts pie chart configured as a ring (radius: ['60%', '80%'])
- Center label: dominant percentage + category name (e.g., "96%" + "cache")
- Side legend: colored dots + name + percentage
- Animated entrance on load, smooth transition on data update

### Tokens by Model (ring gauge)

- Position: Row 2 right bottom, ~34% width, ~170px height
- Same ring gauge style as Token Usage by Type
- Color overrides: opus=`#B877D9`, haiku=`#4ECDC4`, sonnet=`#5794F2`
- Center label: dominant model percentage + short name

### Tool Calls Over Time (area chart)

- Position: Row 3 left, ~66% width
- Type: ECharts stacked area chart (same styling as Token Usage)
- Data: `sum by (tool_name)(count_over_time({service_name="claude-code"} | event_name="tool_result" [STEP]))` over time range
- Uses ECharts default color palette for the many tool names
- Legend: hidden (Tool Distribution panel beside it serves as the legend)
- Top-N filtering: show only the top 8 tools by volume, aggregate the rest as "other" to avoid visual noise

### Tool Distribution (horizontal bar chart)

- Position: Row 3 right top, ~34% width, ~170px height
- Type: ECharts horizontal bar chart
- Data: same query as Tool Calls but aggregated over the full range
- Bars: rounded ends, gradient fill (solid → 60% opacity), sorted by value descending
- Labels: tool name on the left, percentage on the right
- Show top 6 tools, omit the rest (available in tooltip)
- Each bar uses a different color from the palette

### Tool Decisions (ring gauge)

- Position: Row 3 right bottom, ~34% width, ~170px height
- Same ring gauge style
- Data: `sum by (source)(count_over_time(... | event_name="tool_decision" [RANGE]))`
- Color overrides: config=`#5794F2`, user_temporary=`#FF9830`, user_permanent=`#73BF69`

### Agent Calls Over Time (area chart)

- Position: Row 4 left, ~33% width
- Type: ECharts area chart (single series, not stacked)
- Fixed color: `#FF9830`
- Data: `sum(count_over_time(... | tool_name="Agent" [STEP]))`
- Gradient fill, smooth curve, no legend

### MCP Tool Calls Over Time (area chart)

- Position: Row 4 center, ~33% width
- Type: ECharts stacked area chart
- Data: Extract `mcp_tool_name` from `tool_parameters` via Loki query
- Uses ECharts default palette for the various MCP tools
- Top-N filtering: show top 5 MCP tools, aggregate rest as "other"
- Compact legend below chart

### Agent Types (ring gauge)

- Position: Row 4 right, ~33% width
- Same ring gauge style
- Data: Extract `subagent_type` from `tool_input` via Loki regexp query
- Color overrides: general-purpose=`#FF9830`, Explore=`#4ECDC4`, Plan=`#B877D9`

## Project Structure

```
dashboard/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── Dockerfile                    # Multi-stage: node build → nginx serve
├── nginx.conf                    # Proxy /api/prometheus → :9090, /api/loki → :3100
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root layout (CSS Grid, 100vh)
│   ├── api/
│   │   ├── prometheus.ts         # Prometheus query helpers
│   │   ├── loki.ts               # Loki query helpers
│   │   └── queries.ts            # All query definitions (reusable constants)
│   ├── hooks/
│   │   ├── useInterval.ts        # Polling timer hook
│   │   ├── useDashboardData.ts   # Orchestrates all queries, manages state
│   │   └── useTimeRange.ts       # Time range + refresh interval state
│   ├── components/
│   │   ├── TopBar.tsx            # Title, LIVE badge, time/refresh controls
│   │   ├── StatCard.tsx          # Stat card with sparkline
│   │   ├── AreaChart.tsx         # Reusable ECharts area chart wrapper
│   │   ├── RingGauge.tsx         # Reusable ring gauge with center label
│   │   ├── HorizontalBar.tsx     # Horizontal bar chart (Tool Distribution)
│   │   └── ChartCard.tsx         # Card container with title + glassmorphism
│   ├── utils/
│   │   ├── formatters.ts         # Number formatting (45.3M, 2.29K, 1.5hrs)
│   │   └── colors.ts             # Color palette constants
│   └── types/
│       └── index.ts              # TypeScript types for API responses, chart data
└── public/
    └── favicon.svg               # Claude Code icon
```

## Nginx Proxy

The Nginx container serves the static Vite build and reverse-proxies API requests to Prometheus and Loki (avoiding CORS issues):

```
/api/prometheus/*  →  http://prometheus:9090/*
/api/loki/*        →  http://loki:3100/*
```

This means the React app fetches from relative URLs (`/api/prometheus/api/v1/query_range`) and Nginx routes them to the right backend on the Docker network.

## Docker Compose Changes

1. **Add** `dashboard` service: Nginx container serving the built React app, port 3002
2. **Comment out** `grafana` service (keep for debugging, user will remove later)
3. **Keep** `otel-collector`, `prometheus`, `loki` unchanged

```yaml
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
```

## Visual Design Rules

- **Background**: `#0a0e17` — deep navy, never pure black
- **Cards**: `rgba(255,255,255,0.03)` background, `rgba(255,255,255,0.06)` border, `border-radius: 10px`
- **Stat card accents**: gradient background using accent color at 12% → 4%, border at 15%
- **Typography**: Inter font family (loaded from Google Fonts or bundled)
  - Values: 28px, weight 700, accent colored
  - Panel titles: 12px, weight 500, `#8a94a6`
  - Labels: 10px, uppercase, letter-spacing 1px, `#5a6a7a`
- **Charts**: smooth curves, gradient area fills (50% → 2% opacity), 2px line width, no visible points
- **Ring gauges**: inner radius 60%, outer radius 80%, rounded stroke ends, center value in `#e2e8f0`, sub-label in `#5a6a7a`
- **Animations**: ECharts default animation on load (~800ms ease), smooth transitions on data update (~500ms)
- **Hover**: crosshair tooltip on area charts, highlight on ring gauge segments
- **LIVE badge**: blue pill (`rgba(87,148,242,0.15)` bg, `#5794F2` text), pulses briefly on each data refresh

## Data Layer

### API Module (`api/`)

- `prometheus.ts`: Wraps `fetch` to Prometheus `query_range` API. Accepts a PromQL expression, start/end timestamps, and step. Returns typed data.
- `loki.ts`: Wraps `fetch` to Loki `query_range` API. Accepts a LogQL expression, start/end, and step. Returns typed data. Handles both metric and log query response formats.
- `queries.ts`: Exports all query strings as constants. These are the exact queries from the Grafana dashboards, parameterized by time range.

### Data Hook (`useDashboardData`)

- Calls all query functions in parallel via `Promise.all`
- Transforms raw API responses into the shapes ECharts components expect
- Manages loading/error states
- Re-fires on interval tick (from `useInterval`) or time range change

### Time Range Hook (`useTimeRange`)

- Stores selected time range (default: 1h) and refresh interval (default: 30s)
- Computes `start`, `end`, and `step` values for API queries
- `step` is auto-calculated: `range / 100` data points (e.g., 1h range = 36s step)

## Error Handling

- **API unreachable**: Show a subtle "Connection lost" indicator in the top bar (replaces LIVE badge with amber "OFFLINE" badge). Charts retain last known data.
- **Partial failure**: If Prometheus is up but Loki is down (or vice versa), show data for the working source and gray out panels for the failed source.
- **Empty data**: Show "No data" text centered in the chart area with a muted icon.

## What We're NOT Building

- No authentication (single-user, local network)
- No persistent settings (refresh/time range reset on reload)
- No alert rules or notifications
- No log exploration (that's what the commented-out Grafana is for)
- No mobile responsiveness (1920x1080 target only, graceful scaling at smaller desktop viewports)
