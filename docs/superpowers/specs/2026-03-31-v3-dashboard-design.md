# v3 Dashboard Design Spec

## Goal

Create a visually stunning v3 Grafana dashboard for Claude Code telemetry that shows the same data as v2 but with a reorganized layout and elevated visual styling. The primary use case is a screenshot at 1920x1080 for a LinkedIn post — it must look impressive at a glance.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Aesthetic | Vibrant / Energetic | 4-5 accent colors, each metric has its own color identity. Evolves v2's palette rather than replacing it. |
| Layout | Chart + Sidebar Donuts (Approach B) | Magazine-style: time series charts get 2/3 width, paired donut charts stacked vertically on the right. Strong visual rhythm, larger donuts than v2. |
| Density | Dense — no scrolling | Everything visible on 1920x1080 (32 grid units). Optimized for screenshot impact. |
| Theme | Dark mode | Deep navy background (#0d1117 range), not pure black. Grafana dark theme as base. |

## Color Palette

Based on analysis of 100+ dashboard screenshots, these are the accent colors for the vibrant aesthetic:

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Primary Blue | Blue | `#5794F2` | Total Tokens, Token Usage charts, Token by Type donut |
| Secondary Green | Green | `#73BF69` | Lines of Code, Tool Calls chart, Tool Distribution donut |
| Tertiary Purple | Purple | `#B877D9` | Active Time, Tokens by Model donut |
| Quaternary Amber | Amber | `#FF9830` | Commits, Agent Calls chart, Agent Types donut |
| Accent Teal | Teal | `#4ECDC4` | MCP Tool Calls chart |
| Accent Coral | Coral | `#FF6B6B` | Used sparingly in multi-series overlays |

Text colors:
- Primary: `#e2e8f0` (near-white, ~90% opacity)
- Secondary/labels: `#8a94a6` (muted gray, ~55% opacity)
- Tertiary: `#4a5568` (dim gray)

## Layout Grid

Total height budget: 32 grid units (fits 1920x1080 with Grafana chrome).

```
Row 1 — Stats (y:0, h:4)
┌──────────┬──────────┬──────────┬──────────┐
│  Tokens  │  Lines   │  Active  │ Commits  │
│  #5794F2 │  #73BF69 │  #B877D9 │  #FF9830 │
│   w:6    │   w:6    │   w:6    │   w:6    │
└──────────┴──────────┴──────────┴──────────┘

Row 2 — Token Story (y:4, h:10)
┌─────────────────────────┬────────────┐
│                         │ Token Type │
│  Token Usage Over Time  │   Donut    │
│  (stacked area, w:16)   │   w:8,h:5  │
│                         ├────────────┤
│                         │ Tokens by  │
│                         │   Model    │
│                         │   w:8,h:5  │
└─────────────────────────┴────────────┘

Row 3 — Tool Story (y:14, h:10)
┌─────────────────────────┬────────────┐
│                         │    Tool    │
│  Tool Calls Over Time   │   Distrib  │
│  (stacked area, w:16)   │   Donut    │
│                         │   w:8,h:5  │
│                         ├────────────┤
│                         │ Tool Perm  │
│                         │  Sources   │
│                         │   w:8,h:5  │
└─────────────────────────┴────────────┘

Row 4 — Agent & MCP (y:24, h:7)
┌────────────┬────────────┬────────────┐
│   Agent    │  MCP Tool  │   Agent    │
│   Calls    │   Calls    │   Types    │
│   w:8,h:7  │   w:8,h:7  │   w:8,h:7  │
└────────────┴────────────┴────────────┘

Row 5 — Event Log (y:31, h:1, collapsed)
├─ Event Log (collapsed row) ──────────┤
```

Total visible: 4 + 10 + 10 + 7 + 1 = **32 grid units** (exactly fills the viewport).

## Panel Specifications

### Row 1: Stat Panels (4 panels)

All stat panels share:
- `transparent: true` — float on dashboard background
- `colorMode: "value"` — colored text only, no background
- `graphMode: "area"` — sparkline beneath the value
- Sparkline uses `gradientMode: "opacity"` for the gradient fade effect
- Each panel has a unique `fixedColor` matching the palette

| Panel | Source | Color | Query | Notes |
|-------|--------|-------|-------|-------|
| Total Tokens | Prometheus | `#5794F2` | `sum(increase(claude_code_token_usage_tokens_total[$__range]))` | Unit: `short` |
| Lines of Code | Prometheus | `#73BF69` | `sum(increase(claude_code_lines_of_code_count_total[$__range]))` | Unit: `short` |
| Active Time | Prometheus | `#B877D9` | `sum(increase(claude_code_active_time_seconds_total[$__range]))` | Unit: `s` (auto-formats to hours) |
| Commits | Loki | `#FF9830` | `sum(count_over_time({service_name="claude-code"} \| event_name="tool_result" \| tool_name="Bash" \| line_format ...\| json git_commit_id="git_commit_id" \| git_commit_id != "" [$__auto]))` | `queryType: "range"`, `calcs: ["sum"]` |

### Row 2: Token Story (3 panels)

**Token Usage Over Time** (w:16, h:10):
- Type: `timeseries`
- Query: `sum by (type)(increase(claude_code_token_usage_tokens_total[$interval]))` 
- Stacked area: `stacking.mode: "normal"`
- `lineInterpolation: "smooth"`, `lineWidth: 2`
- `fillOpacity: 25`, `gradientMode: "opacity"`
- `showPoints: "never"`
- Color overrides per type to use palette colors:
  - `cacheRead` → `#5794F2` (dominant, blue)
  - `cacheCreation` → `#B877D9` (purple)
  - `input` → `#73BF69` (green)
  - `output` → `#FF9830` (amber)
- Legend: `displayMode: "list"`, `placement: "bottom"`
- Tooltip: `mode: "multi"`, `sort: "desc"`

**Token Usage by Type** (w:8, h:5, top-right):
- Type: `piechart`, `pieType: "donut"`
- Same query as above but with `$__range`
- Color overrides match the time series colors
- Legend: `displayMode: "list"`, `placement: "right"`, `values: ["percent"]`

**Tokens by Model** (w:8, h:5, bottom-right):
- Type: `piechart`, `pieType: "donut"`
- Query: `sum by (model)(increase(claude_code_token_usage_tokens_total[$__range]))`
- Color overrides:
  - `claude-opus-4-6[1m]` → `#B877D9`
  - `claude-sonnet-4-6` → `#5794F2`
  - `claude-haiku-4-5-*` → `#4ECDC4`
- Legend: `displayMode: "list"`, `placement: "right"`, `values: ["percent"]`

### Row 3: Tool Story (3 panels)

**Tool Calls Over Time** (w:16, h:10):
- Type: `timeseries`
- Query: `sum by (tool_name) (count_over_time({service_name="claude-code"} | event_name="tool_result" [$__auto]))`
- Stacked area: `stacking.mode: "normal"`
- `lineInterpolation: "smooth"`, `lineWidth: 2`
- `fillOpacity: 25`, `gradientMode: "opacity"`
- `showPoints: "never"`
- Uses `palette-classic` color mode (too many tool_name values for manual overrides)
- Legend: `displayMode: "list"`, `placement: "bottom"`

**Tool Distribution** (w:8, h:5, top-right):
- Type: `piechart`, `pieType: "donut"`
- Query: `sum by (tool_name) (count_over_time({service_name="claude-code"} | event_name="tool_result" [$__range]))`
- `queryType: "range"`, `calcs: ["sum"]`
- Legend: `displayMode: "list"`, `placement: "right"`, `values: ["percent"]`

**Tool Decision Sources** (w:8, h:5, bottom-right):
- Type: `piechart`, `pieType: "donut"`
- Query: `sum by (source) (count_over_time({service_name="claude-code"} | event_name="tool_decision" [$__range]))`
- Color overrides:
  - `config` → `#5794F2`
  - `user_temporary` → `#FF9830`
  - `user_permanent` → `#73BF69`
- Legend: `displayMode: "list"`, `placement: "right"`, `values: ["percent"]`

### Row 4: Agent & MCP (3 panels)

**Agent Calls Over Time** (w:8, h:7):
- Type: `timeseries`
- Query: `count_over_time({service_name="claude-code"} | event_name="tool_result" | tool_name="Agent" [$__auto])`
- Non-stacked area: `stacking.mode: "none"`
- `fillOpacity: 20`, `gradientMode: "opacity"`
- `lineInterpolation: "smooth"`, `lineWidth: 2`
- Fixed color: `#FF9830`

**MCP Tool Calls Over Time** (w:8, h:7):
- Type: `timeseries`
- Query: `sum by (mcp_tool_name) (count_over_time({service_name="claude-code"} | event_name="tool_result" | tool_name="mcp_tool" | line_format ... | json mcp_tool_name="mcp_tool_name" [$__auto]))`
- Stacked area: `stacking.mode: "normal"`
- `fillOpacity: 20`, `gradientMode: "opacity"`
- `lineInterpolation: "smooth"`, `lineWidth: 2`
- Uses `palette-classic` (varies by MCP tool)

**Agent Types** (w:8, h:7):
- Type: `piechart`, `pieType: "donut"`
- Query: `sum by (subagent_type) (count_over_time({service_name="claude-code"} | event_name="tool_result" | tool_name="Agent" | line_format ... | regexp ... [$__range]))`
- Color overrides:
  - `general-purpose` → `#FF9830`
  - `Explore` → `#4ECDC4`
  - `Plan` → `#B877D9`
  - Others → palette-classic
- Legend: `displayMode: "list"`, `placement: "right"`, `values: ["percent"]`

### Row 5: Event Log (collapsed)

Contains 2 sub-panels (identical to v2):
- **All Events Over Time** (h:6, stacked bar chart)
- **Event Stream** (h:8, log panel with formatted output)

## Visual Styling Rules

Applied consistently across all panels:

### Time Series Panels
```json
{
  "lineInterpolation": "smooth",
  "lineWidth": 2,
  "fillOpacity": 25,
  "gradientMode": "opacity",
  "showPoints": "never",
  "spanNulls": true,
  "axisBorderShow": false,
  "axisGridShow": true
}
```

### Donut Charts
- `pieType: "donut"` (never full pie)
- Legend on right side (`placement: "right"`) showing percentages
- This makes legends more compact vertically than bottom placement

### Stat Panels
- `transparent: true`
- `colorMode: "value"`
- `graphMode: "area"` (sparkline)
- No background color — colored text floats on dashboard background

### Dashboard Level
- `graphTooltip: 1` (shared crosshair across panels)
- `style: "dark"`
- Default time range: `now-1h`
- Auto-refresh: `30s`
- Tags: `["claude-code", "observability", "v3"]`

## Template Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `$DS_PROMETHEUS` | Prometheus datasource (hidden) | auto |
| `$interval` | Rate window for time series | 5m |

## Key Differences from v2

| Aspect | v2 | v3 |
|--------|----|----|
| Layout | Uniform grid (all rows same width split) | Magazine-style: 2/3 + 1/3 paired layout |
| Donut placement | Row of 4 small donuts | Stacked pairs beside their related time series |
| Donut legends | Bottom placement | Right placement with percentages |
| Fill opacity | 15 | 25 (richer gradients) |
| Token type colors | palette-classic (auto) | Manual overrides matching stat panel colors |
| Agent row | 3 equal columns (8+8+8) | 3 equal columns but h:7 instead of h:8 |
| Height budget | 29 visible units | 32 visible units (uses full viewport) |
| Color identity | Each stat has a color but charts use auto-palette | Color overrides create continuity between stats and charts |

## Color Continuity Principle

The key design principle that elevates v3 over v2: **each metric's color carries through from stat → time series → donut**. When Total Tokens is blue (#5794F2) in the stat panel, the cacheRead series (the dominant token type) is also blue in Token Usage Over Time, and the largest slice of Token Usage by Type is also blue. This creates visual coherence that makes the dashboard feel designed rather than auto-generated.

## File Output

- Dashboard JSON: `grafana/provisioning/dashboards/claude-code-dashboard-v3.json`
- UID: `claude-code-telemetry-v3`
- Title: `Claude Code Telemetry v3`
- Added to the "Claude Code" folder alongside v1 and v2
