# CLAUDE.md

## Project

Custom telemetry monitoring stack for Claude Code. OTel Collector receives telemetry, Prometheus stores metrics, Loki stores event logs, and a custom React dashboard (`:3002`) visualizes everything. Grafana is commented out but available for debugging on `:3001`.

## Development Workflow

### Use Subagents Aggressively

- **Dispatch subagents for all mechanical edits** — file creation, single-component changes, config updates. Use Sonnet for these, not Opus.
- **Use parallel subagents** when tasks are independent (e.g., fixing two unrelated components simultaneously).
- **Reserve Opus for judgment calls** — architecture decisions, debugging complex issues, code review. The telemetry dashboard will show if you're burning expensive tokens on simple tasks.
- **Use Explore agents** for codebase investigation instead of reading files manually in the main context.

### Verify Every Visual Change

- **MANDATORY: Screenshot after EVERY rebuild.** No exceptions. Use chrome MCP tools (`mcp__claude-in-chrome__computer` screenshot, zoom) immediately after `docker compose up -d --build dashboard`. Never assume a change looks right — verify it.
- **Zoom into the specific panel you changed** to check details like axis labels, ring gauge text, sparkline rendering, bar counts. A full-page screenshot is not enough for small components.
- **Check at target resolution** (1920x1080) — use `resize_window` to test viewport fit.
- **If you dispatched a subagent to make a visual change**, you must still verify the result yourself with a screenshot before moving on.

### Commit Frequently

- Every functional change gets its own commit — this generates telemetry data that appears in the dashboard itself.
- The meta-story (dashboard showing its own build telemetry) depends on granular commits.

## Dashboard Development

### Rebuilding

```bash
docker compose up -d --build dashboard
```

Changes to `dashboard/src/` require rebuilding the Docker container. The Vite dev server (`npx vite` in `dashboard/`) can be used for faster iteration during development, with the proxy config handling API routing.

### Common Pitfalls

- **ECharts x-axis auto-scales to data range** — always pass `timeRangeMs` prop to pin axes to the selected time range.
- **ECharts y-axis shows decimals for integer data** — use `integerAxis` prop (sets `minInterval: 1`) on count-based charts.
- **Ring gauge center text** — use ECharts `graphic` overlay rather than pie `label` with `position: "center"` (the latter only works reliably for the first data item).
- **Loki timestamps are nanoseconds** — multiply by 1e9 when sending, divide by 1e6 when receiving (to get ms).
- **Prometheus `increase()` range** — use the step interval for time series charts, use the full range for aggregate/pie queries.

### Color Palette

Consistent color identity throughout the dashboard:
- Blue `#5794F2` — tokens, cacheRead, config decisions
- Green `#73BF69` — lines of code, input tokens, Bash tool
- Purple `#B877D9` — active time, cacheCreation, opus model
- Amber `#FF9830` — commits, output tokens, agent calls
- Teal `#4ECDC4` — MCP tools, Explore agent, haiku model

## Stack Notes

- Port 3000 is used by another local service (SimpleClub API)
- Port 3001 is Grafana (commented out in docker-compose)
- Port 3002 is the custom dashboard
- Loki structured metadata fields (`event_name`, `tool_name`, etc.) are NOT stream labels — query with filter pipeline, not label matchers
