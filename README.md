# Claude Code Telemetry Monitoring Stack

Local observability stack for tracking Claude Code usage metrics on this machine. Captures token usage, sessions, tool use, productivity metrics, and event logs — visualized in a custom React dashboard. Designed for solo development with Claude Code on a Max plan (cost tracking is omitted).

## Architecture

```
                                                          ┌──Prometheus export──▶ Prometheus ──▶ Custom Dashboard
Claude Code (host) ──OTLP/gRPC──▶ OpenTelemetry Collector─┤                      :9090       ↗  :3002
                                   :4317 (gRPC)            └──OTLP/HTTP────────▶ Loki ───────
                                   :4318 (HTTP)                                  :3100
                                   :8889 (metrics)
```

All services run as Docker containers on a shared Docker Compose network. Claude Code runs on the host and sends telemetry to the OTel Collector via the mapped gRPC port (`localhost:4317`). Metrics go to Prometheus; event logs (tool use, API requests, prompts) go to Loki. The custom dashboard at `:3002` queries both Prometheus and Loki directly via an Nginx reverse proxy.

## Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `otel-collector` | `otel/opentelemetry-collector-contrib:0.120.0` | 4317, 4318, 8889 | Receives OTLP telemetry from Claude Code, exports metrics to Prometheus and logs to Loki |
| `prometheus` | `prom/prometheus:v3.3.0` | 9090 | Scrapes and stores time-series metrics (30-day retention) |
| `loki` | `grafana/loki:3.4.2` | 3100 | Stores event logs (tool use, API requests, prompts) via OTLP ingestion |
| `dashboard` | Custom (Nginx + Vite/React build) | 3002 | Primary dashboard — queries Prometheus and Loki directly |
| ~~`grafana`~~ | ~~`grafana/grafana:11.6.0`~~ | ~~3001~~ | Commented out in docker-compose; re-enable for debugging |

**Why port 3002 for the dashboard?** Port 3000 is used by the SimpleClub API server; port 3001 was previously used by Grafana.

**Why the `-contrib` OTel image?** The base `otel/opentelemetry-collector` image does not include the Prometheus exporter. The `-contrib` variant is required.

## Access

- **Custom Dashboard**: http://localhost:3002 (primary frontend)
- **Prometheus UI**: http://localhost:9090
- **Prometheus Targets**: http://localhost:9090/targets (both should show "UP")
- **Loki**: http://localhost:3100 (direct API at `/loki/api/v1/query`)
- ~~**Grafana**: http://localhost:3001~~ — commented out in docker-compose; re-enable for debugging (username: `admin`, password has been changed from default)

## Custom Dashboard

The primary frontend is a custom web app served at http://localhost:3002. It is built with **Vite + React + ECharts + Tailwind CSS** and served by **Nginx**, which also acts as a reverse proxy for the Prometheus and Loki APIs so the browser never needs direct access to those ports.

**Design:** Deep navy dark theme with glassmorphism cards. Animated transitions when data updates or the time range changes.

**Features:**
- Configurable time range (1h, 6h, 24h, 7d, 30d) and refresh interval (15s, 30s, 1m, 5m)
- ECharts area/line charts with smooth animated transitions
- Queries Prometheus (`/api/prometheus/`) and Loki (`/api/loki/`) via Nginx reverse proxy — no CORS issues

**Source:** `dashboard/` directory in the repo root. The `Dockerfile` builds the Vite app and packages it with an Nginx config that handles both static file serving and API proxying.

**Grafana (deprecated as primary frontend):** The Grafana service is commented out in `docker-compose.yml`. It can be re-enabled for ad-hoc debugging or query exploration — the provisioned dashboards and datasources are still present in `grafana/provisioning/`. To re-enable, uncomment the `grafana` service block and run `docker compose up -d grafana`.

## Managing the Stack

```bash
cd ~/Repos/claude-code-monitoring

# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f                    # all services
docker compose logs otel-collector -f     # just the collector
docker compose logs dashboard -f          # custom dashboard (Nginx)

# Check status
docker compose ps

# Check resource usage
docker stats --no-stream
```

All services have `restart: unless-stopped`, so the stack auto-starts on reboot (Docker is enabled at boot via systemd).

## Data Persistence

Three named Docker volumes preserve data across container restarts:

| Volume | Purpose |
|--------|---------|
| `claude-code-monitoring_prometheus_data` | Prometheus time-series database (30-day retention) |
| `claude-code-monitoring_loki_data` | Loki log storage (tool use events, API requests, prompts) |
| `claude-code-monitoring_grafana_data` | Grafana configuration, user preferences, alerts (only used if Grafana service is re-enabled) |

To fully reset data: `docker compose down -v` (destroys all volumes).

## Claude Code Configuration

Telemetry is enabled via environment variables in `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4317",
    "OTEL_METRIC_EXPORT_INTERVAL": "15000",
    "OTEL_LOG_TOOL_DETAILS": "1"
  }
}
```

| Variable | Value | Purpose |
|----------|-------|---------|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | `1` | Master switch — telemetry is opt-in |
| `OTEL_METRICS_EXPORTER` | `otlp` | Send metrics via OpenTelemetry protocol |
| `OTEL_LOGS_EXPORTER` | `otlp` | Send event logs (tool results, API requests) via OTLP |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` | Use gRPC (more efficient than HTTP for streaming) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | OTel Collector gRPC port on host |
| `OTEL_METRIC_EXPORT_INTERVAL` | `15000` | Export metrics every 15 seconds |
| `OTEL_LOG_TOOL_DETAILS` | `1` | Include tool parameters and inputs in log events |

These env vars only take effect for Claude Code sessions started **after** the settings were saved. Restarting a session picks them up automatically.

## Metrics Collected

Claude Code emits these metrics via OpenTelemetry. The OTel Collector's Prometheus exporter converts dots to underscores in metric names.

### Counter Metrics (Prometheus)

| OTel Name | Prometheus Name | Description | Key Attributes |
|-----------|----------------|-------------|----------------|
| `claude_code.cost.usage` | `claude_code_cost_usage_USD_total` | Session cost in USD | `model` |
| `claude_code.token.usage` | `claude_code_token_usage_tokens_total` | Tokens consumed | `type` (input, output, cacheRead, cacheCreation), `model` |
| `claude_code.session.count` | `claude_code_session_count_total` | CLI sessions started | — |
| `claude_code.lines_of_code.count` | `claude_code_lines_of_code_count_total` | Lines modified | `type` (added, removed) |
| `claude_code.commit.count` | `claude_code_commit_count_total` | Git commits created | — |
| `claude_code.pull_request.count` | `claude_code_pull_request_count_total` | PRs created | — |
| `claude_code.active_time.total` | `claude_code_active_time_total_seconds_total` | Active time in seconds | `type` (user, cli) |
| `claude_code.code_edit_tool.decision` | `claude_code_code_edit_tool_decision_total` | Tool permission decisions | `tool_name`, `decision`, `source` |

**Note on `commit.count`:** The Prometheus counter `claude_code_commit_count_total` only increments through Claude Code's internal commit tracking, which does not fire for commits made via the Bash tool (`git commit`). Since all commits in this workflow are made through Bash, the v2 dashboard uses a Loki-based query instead (see [Commits Panel](#commits-panel-loki-based)).

### Event Logs (via OTLP logs pipeline → Loki)

These are stored in Loki and queryable in Grafana. OTLP resource attributes (e.g., `service_name`) become stream labels; log record attributes (e.g., `tool_name`, `success`, `duration_ms`) become **structured metadata** and must be queried with the filter pipeline (`| event_name="tool_result"`) rather than label matchers:

| Event | Description | Key Fields |
|-------|-------------|------------|
| `claude_code.user_prompt` | User prompt submitted | `prompt_length` |
| `claude_code.tool_result` | Tool execution completed | `tool_name`, `success`, `duration_ms`, `tool_input`, `tool_parameters` |
| `claude_code.api_request` | API call to Claude | `model`, `cost_usd`, `duration_ms`, token counts |
| `claude_code.api_error` | API call failed | `error`, `status_code`, `duration_ms` |
| `claude_code.tool_decision` | Tool permission decision | `tool_name`, `decision`, `source` |

### Important: `tool_input` vs `tool_parameters`

Both are JSON strings on `tool_result` events, but serve different purposes:

- **`tool_input`** — the arguments Claude passed to the tool (e.g., `{"command":"git commit ...", "description":"Create initial commit"}`)
- **`tool_parameters`** — enriched metadata added by Claude Code itself, including derived fields like `bash_command`, `full_command`, `git_commit_id`, etc.

The `tool_parameters` field is more reliable for detecting specific outcomes (e.g., whether a Bash command was a git commit) because Claude Code populates it with structured data. The `tool_input` field is better for understanding intent (e.g., extracting `subagent_type` from Agent tool calls).

### Standard Attributes on All Events

- `session.id` — unique per CLI session
- `organization.id` — Anthropic org
- `user.account_uuid` — account identifier
- `user.email` — authenticated email
- `terminal.type` — terminal emulator (e.g., vscode, tmux)
- `os.type`, `os.version`, `host.arch` — system info

## Dashboards

Three dashboards are auto-provisioned on startup in the "Claude Code" folder.

| Dashboard | File | Purpose |
|-----------|------|---------|
| **Claude Code Telemetry v3** | `claude-code-dashboard-v3.json` | Magazine-style layout with vibrant gradients — optimized for screenshots |
| Claude Code Telemetry v2 | `claude-code-dashboard-v2.json` | Refined layout, set as **home dashboard** |
| Claude Code Telemetry | `claude-code-dashboard.json` | Original v1 dashboard kept as a "starting point" reference |

### v3 Layout (magazine-style, fits 1920x1080)

Default time range: **1 hour**. Auto-refresh: **30 seconds**.

**Design philosophy:** Magazine-style layout where time series charts (2/3 width) pair with related donut breakdowns (1/3 width). Color continuity across stats, charts, and donuts — each metric's color carries through all its panels. Gradient scheme fills (`gradientMode: "scheme"`) for rich, vibrant area charts. Legends hidden on time series (the paired donuts serve as legends). Designed for screenshot impact at LinkedIn scale.

**Stats** (y:0, h:3) — 4 transparent stat panels with colored text and sparklines

| Panel | Color | Notes |
|-------|-------|-------|
| Total Tokens | `#5794F2` blue | Prometheus |
| Lines of Code | `#73BF69` green | Prometheus |
| Active Time | `#B877D9` purple | Prometheus, unit: seconds |
| Commits | `#FF9830` amber | Loki (git_commit_id extraction) |

**Token Story** (y:3, h:8) — time series + 2 stacked donuts

| Panel | Position | Notes |
|-------|----------|-------|
| Token Usage Over Time | w:16, h:8 | Stacked area, color overrides match stat colors, legend hidden |
| Token Usage by Type | w:8, h:4 | Donut, right legend with percentages |
| Tokens by Model | w:8, h:4 | Donut, model-specific color overrides (opus=purple, sonnet=blue, haiku=teal) |

**Tool Story** (y:11, h:8) — time series + 2 stacked donuts

| Panel | Position | Notes |
|-------|----------|-------|
| Tool Calls Over Time | w:16, h:8 | Stacked area, palette-classic, legend hidden |
| Tool Distribution | w:8, h:4 | Donut, right legend with percentages |
| Tool Decision Sources | w:8, h:4 | Donut, color overrides (config=blue, user_temporary=amber, user_permanent=green) |

**Agent & MCP** (y:19, h:5) — 3 equal panels

| Panel | Notes |
|-------|-------|
| Agent Calls Over Time | Fixed amber color, `sum()` to merge streams, legend hidden |
| MCP Tool Calls Over Time | Stacked area by `mcp_tool_name`, legend hidden |
| Agent Types | Donut with right legend (general-purpose=amber, Explore=teal, Plan=purple) |

**Event Log** (y:24, collapsed) — same as v2

Total visible height: 3 + 8 + 8 + 5 + 1 = **25 grid units** (~750px). Fits in a standard 1920x1080 browser window. For best screenshot results, use F11 fullscreen or append `?kiosk` to the URL to remove the Grafana nav bar.

### v2 Layout (fits 1920x1080)

Default time range: **1 hour**. Auto-refresh: **30 seconds**.

**Stats** (y:0, h:4) — 4 transparent stat panels with colored text, no solid backgrounds

| Panel | Source | Color | Query |
|-------|--------|-------|-------|
| Total Tokens | Prometheus | `#5794F2` blue | `sum(increase(claude_code_token_usage_tokens_total[$__range]))` |
| Lines of Code | Prometheus | `#73BF69` green | `sum(increase(claude_code_lines_of_code_count_total[$__range]))` |
| Active Time | Prometheus | `#B877D9` purple | `sum(increase(claude_code_active_time_seconds_total[$__range]))` |
| Commits | Loki | `#FF9830` amber | See [Commits Panel](#commits-panel-loki-based) below |

**Trends** (y:4, h:8) — 2 time series panels side by side

| Panel | Source | Notes |
|-------|--------|-------|
| Token Usage Over Time | Prometheus | Stacked area, opacity gradient, uses `$interval` variable |
| Tool Calls Over Time | Loki | Stacked area broken down by `tool_name` |

**Breakdowns** (y:12, h:8) — 4 donut charts with compact bottom legends

| Panel | Source | Notes |
|-------|--------|-------|
| Token Usage by Type | Prometheus | input, output, cacheRead, cacheCreation |
| Tokens by Model | Prometheus | Distribution across models (opus, sonnet, haiku) |
| Tool Distribution | Loki | Which tools are used most frequently |
| Tool Decision Sources | Loki | config, user_permanent, user_temporary — uses `source` field |

**Agent & MCP Use** (y:20, h:8) — 3 panels tracking Agent and MCP tool behavior

| Panel | Source | Notes |
|-------|--------|-------|
| Agent Calls Over Time | Loki | Stacked area of Agent tool invocations |
| MCP Tool Calls Over Time | Loki | Stacked area broken down by `mcp_tool_name` (extracted from `tool_parameters` via `json` parser) |
| Agent Types | Loki | Donut of `subagent_type` extracted from `tool_input` via regexp |

**Event Log** (y:28, collapsed) — click row header to expand

| Panel | Source | Notes |
|-------|--------|-------|
| All Events Over Time | Loki | Stacked bar chart of all event types |
| Event Stream | Loki | Live scrolling log with formatted output |

### Commits Panel (Loki-based)

The Commits stat panel uses Loki instead of Prometheus because the Prometheus counter `claude_code_commit_count_total` does not fire for commits made via the Bash tool. The query detects commits by extracting the `git_commit_id` field from `tool_parameters`:

```
sum(count_over_time(
  {service_name="claude-code"}
  | event_name="tool_result"
  | tool_name="Bash"
  | line_format `{{.tool_parameters}}`
  | json git_commit_id="git_commit_id"
  | git_commit_id != ""
  [$__auto]
))
```

This works because Claude Code enriches Bash `tool_parameters` with a `git_commit_id` field (containing the short SHA) whenever a `git commit` command succeeds. The `json` parser extracts this as a top-level key, ignoring any Bash commands that merely mention "git_commit_id" as text in the command body.

**Query design notes:**
- Uses `[$__auto]` (not `[$__range]`) so Grafana gets time-bucketed data points for the sparkline graph
- Uses `queryType: "range"` with `calcs: ["sum"]` to total the buckets for the displayed number
- Wrapped in `sum()` because the `json` parser promotes `git_commit_id` to a stream label, creating one stream per unique commit SHA — without `sum()`, `lastNotNull` would only show 1 regardless of actual count

### Agent Types Panel (regexp extraction)

The Agent Types donut extracts `subagent_type` from the `tool_input` JSON string using `line_format` + `regexp`:

```
sum by (subagent_type) (count_over_time(
  {service_name="claude-code"}
  | event_name="tool_result"
  | tool_name="Agent"
  | line_format `{{.tool_input}}`
  | regexp `subagent_type.{3}(?P<subagent_type>[a-zA-Z][a-zA-Z0-9_-]+)`
  [$__range]
))
```

This is necessary because `subagent_type` is nested inside the `tool_input` JSON string, not a top-level structured metadata field. The `.{3}` matches the `":"` separator between the JSON key and value.

### Dashboard Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `$interval` | Rate window for time series panels | 5m (options: 1m, 5m, 15m, 30m, 1h, auto) |

### v1 vs v2 Style Differences

| Element | v1 (original) | v2 (refined) |
|---------|---------------|--------------|
| Stat colorMode | `background_solid` (garish) | `value` (colored text only) |
| Stat panels | Opaque colored backgrounds | `transparent: true` |
| Color palette | Mismatched purple/orange/blue/green | Cohesive `#5794F2`/`#73BF69`/`#FF9830`/`#B877D9` |
| Row headers | 5 explicit row panels | None (except collapsed Event Log) |
| Chart style | Stacked bar charts for Loki panels | Stacked area charts everywhere (consistent with Prometheus panels) |
| Time series fill | `fillOpacity: 30`, `gradientMode: "scheme"` | `fillOpacity: 15`, `gradientMode: "opacity"` |
| Legends | `displayMode: "table"` at various positions | `displayMode: "list"`, `placement: "bottom"` everywhere |
| Donut legends | Table with value + percent at right | List with percent only at bottom |
| Commits source | Prometheus (broken for Bash commits) | Loki (detects via `git_commit_id` in `tool_parameters`) |
| Agent Duration panel | Shows avg/max agent duration | Replaced with MCP Tool Calls Over Time |
| Event Log | Always visible (h:20) | Collapsed row (click to expand) |
| Default time range | 6 hours | 1 hour |
| Auto-refresh | 15 seconds | 30 seconds |

## File Structure

```
claude-code-monitoring/
├── .gitignore                         # Excludes .claude/ directory
├── docker-compose.yml                 # Service definitions and volumes (Grafana commented out)
├── otel-collector-config.yaml         # OTLP receivers, processors, exporters
├── prometheus.yml                     # Scrape targets and intervals
├── README.md                          # This file
├── dashboard/                         # Custom React dashboard (primary frontend, :3002)
│   ├── Dockerfile                     # Builds Vite app, packages with Nginx
│   ├── nginx.conf                     # Nginx config: static serving + API reverse proxy
│   ├── vite.config.ts                 # Vite build config
│   ├── index.html                     # App entry point
│   ├── package.json
│   └── src/                           # React + ECharts + Tailwind source
└── grafana/                           # Grafana config (kept for debugging; service commented out)
    └── provisioning/
        ├── datasources/
        │   └── datasource.yml         # Auto-configures Prometheus + Loki datasources
        └── dashboards/
            ├── dashboards.yml                 # Dashboard file provider config
            ├── claude-code-dashboard.json     # v1 — original dashboard
            ├── claude-code-dashboard-v2.json  # v2 — refined layout (home dashboard)
            └── claude-code-dashboard-v3.json  # v3 — magazine-style with vibrant gradients
```

## OTel Collector Pipeline

```
Receivers           Processors              Exporters
─────────           ──────────              ─────────
OTLP (gRPC)  ──▶   memory_limiter  ──▶     prometheus (metrics → :8889)
OTLP (HTTP)         batch                   otlphttp/loki (logs → Loki :3100/otlp)
                                            debug (metrics + logs → stdout)
```

- **memory_limiter**: Caps collector memory at 512 MiB (safety valve, typical usage is ~30 MiB)
- **batch**: Batches telemetry (1s timeout, 1024 batch size) to reduce export overhead
- **prometheus exporter**: Converts OTLP metrics to Prometheus format, metrics expire after 180 minutes of no updates
- **otlphttp/loki exporter**: Sends OTLP logs to Loki's native OTLP ingestion endpoint; resource attributes become stream labels, log record attributes become structured metadata
- **debug exporter**: Logs all received telemetry to stdout for troubleshooting (`docker compose logs otel-collector`)

## Lessons Learned

Hard-won knowledge from building and iterating on this stack. These are specific to Grafana + Loki + Prometheus in this configuration and are critical for future development.

### Loki structured metadata fields are NOT stream labels

Event attributes like `event_name`, `tool_name`, `success`, `duration_ms`, and `source` are stored as **structured metadata** in Loki, not as stream labels. You **cannot** use them in label matchers:

```
# WRONG — returns empty results
{event_name="tool_result"}

# CORRECT — filter in the pipeline
{service_name="claude-code"} | event_name="tool_result"
```

### Loki pie charts must use `queryType: "range"`, not `"instant"`

When using `sum by (label) (count_over_time(...))` queries in Grafana pie/donut charts with a Loki datasource, `queryType: "instant"` causes the legend to show **"Value #A"** instead of the actual label name. Switching to `queryType: "range"` fixes this — Grafana then correctly resolves `{{label}}` in `legendFormat`.

This affected the Tool Distribution, Tool Decision Sources, and Agent Types panels.

### Loki stat panels: `[$__range]` vs `[$__auto]` with range queries

For stat panels showing a count from Loki, **do not** use `count_over_time(... [$__range])` with `queryType: "range"` and `calcs: ["sum"]` — Grafana evaluates the query at multiple time steps, each returning the full-range count, then sums them all together (e.g., 1 commit displayed as 55).

Two working approaches:
1. **Instant query**: `count_over_time(... [$__range])` with `queryType: "instant"` and `calcs: ["lastNotNull"]` — correct count but **no sparkline** (single data point)
2. **Range query with `$__auto`**: `sum(count_over_time(... [$__auto]))` with `queryType: "range"` and `calcs: ["sum"]` — correct count **with sparkline** (time-bucketed data points that sum to the true total)

The Commits panel uses approach 2 for the sparkline. The `sum()` wrapper is essential because the `json` parser promotes extracted fields to stream labels, splitting results into one stream per unique value (see [json parser creates stream splits](#json-parser-creates-stream-splits)).

### json parser creates stream splits

Loki's `json` parser promotes extracted fields to stream labels. When extracting `git_commit_id` from `tool_parameters`, each unique commit SHA becomes a separate stream. Without `sum()`, aggregation functions like `count_over_time` return one result per stream, and `calcs: ["lastNotNull"]` picks only one — showing 1 instead of the true count.

### The `tool_decision` event uses `source`, not `decision_source`

The field name for how a tool permission was granted is `source` (values: `config`, `user_permanent`, `user_temporary`), not `decision_source` as might be assumed from the Prometheus metric name `claude_code_code_edit_tool_decision_total` which has a `source` attribute. Always verify Loki field names by querying actual events:

```bash
curl -s "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={service_name="claude-code"} | event_name="tool_decision"' \
  --data-urlencode 'limit=1' --data-urlencode 'start=...' --data-urlencode 'end=...'
```

### Extracting nested JSON fields from Loki structured metadata

Fields like `subagent_type` (inside `tool_input`) and `git_commit_id` (inside `tool_parameters`) are nested within JSON strings stored as structured metadata. To extract them:

1. **`line_format`** — replace the log line with the metadata field content: `| line_format "{{.tool_parameters}}"`
2. **`json` parser** — extract the nested key: `| json git_commit_id="git_commit_id"`
3. **Filter** — `| git_commit_id != ""`

The `json` parser only extracts **top-level keys** from the current log line. This is critical for avoiding false positives — a Bash command that mentions "git_commit_id" as text in its command body won't match because the text is nested inside the `full_command` string value, not a top-level JSON key.

For cases where you need a named capture group (e.g., `subagent_type` for `sum by`), use `regexp` instead of `json`:
```
| line_format `{{.tool_input}}`
| regexp `subagent_type.{3}(?P<subagent_type>[a-zA-Z][a-zA-Z0-9_-]+)`
```

### Avoid regex quantifier braces `{n}` in Grafana dashboard JSON

Grafana's template variable engine interprets `{` and `}` as variable delimiters. A regex like `[0-9a-f]{7}` in a LogQL query stored in dashboard JSON will be mangled. Workarounds:
- Repeat the character class manually: `[0-9a-f][0-9a-f][0-9a-f]...`
- Use `.{3}` only when Grafana doesn't try to resolve it (backtick-delimited strings in some contexts)
- Prefer the `json` parser approach over regex when possible

### MCP tool calls have granular metadata in `tool_parameters`

When `tool_name="mcp_tool"`, the `tool_parameters` field contains `mcp_server_name` (e.g., `claude-in-chrome`, `playwright`) and `mcp_tool_name` (e.g., `computer`, `navigate`, `browser_run_code`). These can be extracted with the `json` parser for granular MCP usage tracking:

```
sum by (mcp_tool_name) (count_over_time(
  {service_name="claude-code"}
  | event_name="tool_result"
  | tool_name="mcp_tool"
  | line_format `{{.tool_parameters}}`
  | json mcp_tool_name="mcp_tool_name"
  [$__auto]
))
```

### Prometheus counter metrics may not fire for Bash tool actions

Claude Code's Prometheus counters (like `claude_code_commit_count_total`) are incremented through internal tracking paths, not by observing Bash tool output. Since all git operations in this workflow go through the Bash tool, the Prometheus commit counter stays at zero. The solution is to query Loki's `tool_result` events and inspect `tool_parameters` for enriched fields like `git_commit_id` that Claude Code adds automatically.

### Dashboard height budget for 1920x1080

Grafana's chrome (top nav bar + dashboard toolbar) consumes ~92px. At ~30px per grid unit, the usable panel area is approximately **32 grid units**. The v2 dashboard uses 29 visible units (stats h:4 + trends h:8 + breakdowns h:8 + agent h:8 + collapsed row h:1), leaving a small margin. Panels with many legend entries (e.g., Tool Distribution with 12+ tools) can push content below the fold due to legend wrapping.

## Troubleshooting

**No metrics appearing in the dashboard:**
1. Check the stack is running: `docker compose ps`
2. Verify Prometheus targets are UP: http://localhost:9090/targets
3. Check OTel Collector is receiving data: `docker compose logs otel-collector --tail=50`
4. Ensure you started a **new** Claude Code session after updating settings.json
5. Query Prometheus directly: `curl 'http://localhost:9090/api/v1/query?query=claude_code_session_count_total'`

**OTel Collector not receiving data:**
- Verify `OTEL_EXPORTER_OTLP_ENDPOINT` uses `http://` not `https://`
- Check port 4317 is accessible: `curl -v http://localhost:4317` (will show "connection refused" for HTTP since it's gRPC, but proves the port is open if you get a response)

**Prometheus target down:**
- The OTel Collector metrics endpoint is `:8889` — verify it's responding: `curl http://localhost:8889/metrics`

**Loki panels showing "No data":**
- Loki only stores data from when it was added — there is no historical backfill
- Event attributes (`event_name`, `tool_name`, etc.) are structured metadata, not stream labels — queries must use the filter pipeline: `{service_name="claude-code"} | event_name="tool_result"` (not `{event_name="tool_result"}`)
- Check Loki is receiving data: `curl -s 'http://localhost:3100/loki/api/v1/label/service_name/values'` should return `["claude-code"]`

**Custom dashboard not loading:**
- Check Nginx logs: `docker compose logs dashboard`
- Verify the container is running: `docker compose ps dashboard`
- The dashboard proxies API requests to Prometheus (`/api/prometheus/`) and Loki (`/api/loki/`) via Nginx — if those services are down, panels will show errors

**Grafana (if re-enabled for debugging):**
- Check logs: `docker compose logs grafana`
- Verify dashboard JSON files are mounted: files in `grafana/provisioning/dashboards/` should be mounted inside the container

**Verifying Loki field names on events:**
```bash
# See all fields on a specific event type
now=$(date +%s); start=$((now - 3600))
curl -s "http://localhost:3100/loki/api/v1/query_range?start=${start}&end=${now}&limit=1" \
  --data-urlencode 'query={service_name="claude-code"} | event_name="tool_result"' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['data']['result'][0]['stream'], indent=2))"
```

## Resource Usage

Typical idle/light-use memory footprint (single user):

| Container | Memory |
|-----------|--------|
| OTel Collector | ~30 MiB |
| Prometheus | ~30 MiB |
| Loki | ~40 MiB |
| Dashboard (Nginx) | ~5 MiB |
| **Total** | **~105 MiB** |

Grafana (~75 MiB) is commented out; re-enable it for debugging if needed.

## MCP Servers

The following MCP servers are configured at user scope (`~/.claude.json`) for browser automation and debugging:

| Server | Command | Purpose |
|--------|---------|---------|
| `playwright` | `npx @playwright/mcp@latest` | Browser automation via structured accessibility snapshots (61 tools) |
| `chrome-devtools` | `npx chrome-devtools-mcp@latest` | Chrome DevTools access — performance traces, network inspection, Lighthouse audits (29 tools) |

Additionally, the **Claude in Chrome** first-party integration is available via `claude --chrome` or `/chrome` (requires the [Claude in Chrome extension](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn)).

## References

- [Anthropic Claude Code Monitoring Guide](https://github.com/anthropics/claude-code-monitoring-guide) — official reference repo this stack is based on
- [Claude Code Telemetry Docs](https://docs.anthropic.com/en/docs/claude-code/monitoring) — full metrics and configuration reference
- [OpenTelemetry Collector Contrib](https://github.com/open-telemetry/opentelemetry-collector-contrib) — collector with Prometheus exporter
