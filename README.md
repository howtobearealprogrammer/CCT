# Claude Code Telemetry Monitoring Stack

Local observability stack for tracking Claude Code usage metrics on this machine. Captures token usage, sessions, tool use, productivity metrics, and event logs — visualized in a Grafana dashboard. Designed for solo development with Claude Code on a Max plan (cost tracking is omitted).

## Architecture

```
                                                          ┌──Prometheus export──▶ Prometheus ──▶ Grafana
Claude Code (host) ──OTLP/gRPC──▶ OpenTelemetry Collector─┤                      :9090          :3001
                                   :4317 (gRPC)            └──OTLP/HTTP────────▶ Loki ──────────┘
                                   :4318 (HTTP)                                  :3100
                                   :8889 (metrics)
```

All four services run as Docker containers on a shared Docker Compose network. Claude Code runs on the host and sends telemetry to the OTel Collector via the mapped gRPC port (`localhost:4317`). Metrics go to Prometheus; event logs (tool use, API requests, prompts) go to Loki.

## Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `otel-collector` | `otel/opentelemetry-collector-contrib:0.120.0` | 4317, 4318, 8889 | Receives OTLP telemetry from Claude Code, exports metrics to Prometheus and logs to Loki |
| `prometheus` | `prom/prometheus:v3.3.0` | 9090 | Scrapes and stores time-series metrics (30-day retention) |
| `loki` | `grafana/loki:3.4.2` | 3100 | Stores event logs (tool use, API requests, prompts) via OTLP ingestion |
| `grafana` | `grafana/grafana:11.6.0` | 3001 | Dashboard visualization |

**Why port 3001 for Grafana?** Port 3000 is used by the SimpleClub API server.

**Why the `-contrib` OTel image?** The base `otel/opentelemetry-collector` image does not include the Prometheus exporter. The `-contrib` variant is required.

## Access

- **Grafana**: http://localhost:3001 (username: `admin`, password has been changed from default)
- **Prometheus UI**: http://localhost:9090
- **Prometheus Targets**: http://localhost:9090/targets (both should show "UP")
- **Loki**: http://localhost:3100 (queried via Grafana; direct API at `/loki/api/v1/query`)

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
| `claude-code-monitoring_grafana_data` | Grafana configuration, user preferences, alerts |
| `claude-code-monitoring_loki_data` | Loki log storage (tool use events, API requests, prompts) |

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

### Counter Metrics

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

### Event Logs (via OTLP logs pipeline → Loki)

These are stored in Loki and queryable in Grafana. OTLP resource attributes (e.g., `service_name`) become stream labels; log record attributes (e.g., `tool_name`, `success`, `duration_ms`) become **structured metadata** and must be queried with the filter pipeline (`| event_name="tool_result"`) rather than label matchers:

| Event | Description | Key Fields |
|-------|-------------|------------|
| `claude_code.user_prompt` | User prompt submitted | `prompt_length` |
| `claude_code.tool_result` | Tool execution completed | `tool_name`, `success`, `duration_ms` |
| `claude_code.api_request` | API call to Claude | `model`, `cost_usd`, `duration_ms`, token counts |
| `claude_code.api_error` | API call failed | `error`, `status_code`, `duration_ms` |
| `claude_code.tool_decision` | Tool permission decision | `tool_name`, `decision`, `source` |

### Standard Attributes on All Metrics

- `session.id` — unique per CLI session
- `organization.id` — Anthropic org
- `user.account_uuid` — account identifier
- `user.email` — authenticated email
- `terminal.type` — terminal emulator (e.g., vscode, tmux)
- `os.type`, `os.version`, `host.arch` — system info

## Dashboards

Two dashboards are auto-provisioned on startup in the "Claude Code" folder. Both share the same queries and data sources.

| Dashboard | File | Purpose |
|-----------|------|---------|
| **Claude Code Telemetry v2** | `claude-code-dashboard-v2.json` | Refined layout optimized for 1920x1080 — set as **home dashboard** |
| Claude Code Telemetry | `claude-code-dashboard.json` | Original dashboard kept as reference |

### v2 Layout (fits 1920x1080)

**Stats** — 4 transparent stat panels with colored text (no solid backgrounds)
| Panel | Source | Color |
|-------|--------|-------|
| Total Tokens | Prometheus | `#5794F2` blue |
| Lines of Code | Prometheus | `#73BF69` green |
| Commits | Prometheus | `#FF9830` amber |
| Active Time | Prometheus | `#B877D9` purple |

**Trends** — 2 time series panels side by side
| Panel | Source | Notes |
|-------|--------|-------|
| Token Usage Over Time | Prometheus | Stacked area, opacity gradient, uses `$interval` variable |
| Tool Calls Over Time | Loki | Stacked bars broken down by `tool_name` |

**Breakdowns** — 4 donut charts with compact bottom legends
| Panel | Source | Notes |
|-------|--------|-------|
| Token Usage by Type | Prometheus | input, output, cacheRead, cacheCreation |
| Tokens by Model | Prometheus | Distribution across models (opus, sonnet, haiku) |
| Tool Distribution | Loki | Which tools are used most frequently |
| Tool Decision Sources | Loki | config, user_permanent, user_temporary — uses `source` field |

**Agent Use** — 3 panels tracking Agent tool behavior
| Panel | Source | Notes |
|-------|--------|-------|
| Agent Calls Over Time | Loki | Bar chart of Agent tool invocations |
| Agent Duration | Loki | Avg and max duration via `unwrap duration_ms` |
| Agent Types | Loki | Donut of `subagent_type` extracted from `tool_input` via regexp |

**Event Log** — collapsed row (click to expand)
| Panel | Source | Notes |
|-------|--------|-------|
| All Events Over Time | Loki | Stacked bar chart of all event types |
| Event Stream | Loki | Live scrolling log with formatted output |

### Dashboard Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `$interval` | Rate window for time series panels | 5m (options: 1m, 5m, 15m, 30m, 1h, auto) |

Both dashboards auto-refresh every 15 seconds and default to a 6-hour time window.

## File Structure

```
claude-code-monitoring/
├── docker-compose.yml                 # Service definitions and volumes
├── otel-collector-config.yaml         # OTLP receivers, processors, exporters
├── prometheus.yml                     # Scrape targets and intervals
├── README.md                          # This file
└── grafana/
    └── provisioning/
        ├── datasources/
        │   └── datasource.yml         # Auto-configures Prometheus + Loki datasources
        └── dashboards/
            ├── dashboards.yml                 # Dashboard file provider config
            ├── claude-code-dashboard.json     # v1 — original dashboard
            └── claude-code-dashboard-v2.json  # v2 — refined layout (home dashboard)
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

## Troubleshooting

**No metrics appearing in Grafana:**
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

**Dashboard not loading:**
- Check Grafana logs: `docker compose logs grafana`
- Verify the dashboard JSON is mounted: the file at `grafana/provisioning/dashboards/claude-code-dashboard.json` is mounted to `/var/lib/grafana/dashboards/` inside the container

## Resource Usage

Typical idle/light-use memory footprint (single user):

| Container | Memory |
|-----------|--------|
| OTel Collector | ~30 MiB |
| Prometheus | ~30 MiB |
| Loki | ~40 MiB |
| Grafana | ~75 MiB |
| **Total** | **~175 MiB** |

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
