# CCT Dashboard — Setup Guide for Claude Code

You are a Claude Code instance helping a user set up the Claude Code Telemetry (CCT) monitoring stack on their machine. This document is your complete instruction set. Execute each section in order. Every step has a verification check — do not proceed until it passes.

## What This Sets Up

A local observability stack that captures Claude Code telemetry (tokens, tool use, sessions, commits, active time) and visualizes it in a custom React dashboard. The architecture:

```
Claude Code (host) ──OTLP/gRPC──▶ OTel Collector ──▶ Prometheus (metrics)
                                   :4317              :9090
                                                  ──▶ Loki (event logs)
                                                      :3100
                                                  
Custom Dashboard ◀── queries both via Nginx reverse proxy
:4000 (default)
```

Four Docker containers. ~105 MiB total memory. Zero credentials or API keys required.

---

## Section 1: Pre-Flight Checks

Run these checks before doing anything else. If any fail, stop and tell the user what's missing.

### 1.1 Docker

```bash
docker --version
```

**If missing or fails:** Tell the user:
> "Docker is not installed. Install it with: https://docs.docker.com/engine/install/ubuntu/ — then run `sudo systemctl enable --now docker` and add your user to the docker group with `sudo usermod -aG docker $USER` (log out and back in for group change to take effect). Re-run this setup after."

Do NOT attempt to install Docker yourself.

### 1.2 Docker Compose

```bash
docker compose version
```

**If missing:** Docker Compose v2 ships with Docker Engine. If this fails but Docker exists, tell the user:
> "Docker Compose plugin is missing. Install it with: `sudo apt-get install docker-compose-plugin`"

### 1.3 Docker daemon running

```bash
docker info > /dev/null 2>&1
```

**If fails:** Tell the user:
> "Docker daemon is not running. Start it with: `sudo systemctl start docker`"

If the error mentions "permission denied", tell the user:
> "Your user is not in the docker group. Run: `sudo usermod -aG docker $USER` then log out and back in."

### 1.4 Git

```bash
git --version
```

**If missing:** Tell the user:
> "Git is not installed. Install it with: `sudo apt-get install git`"

### 1.5 Port availability

Check these ports are free: 4317, 4318, 8889, 9090, 3100, 4000.

```bash
for port in 4317 4318 8889 9090 3100 4000; do
  if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
    echo "CONFLICT: port ${port} is in use"
  else
    echo "OK: port ${port} is free"
  fi
done
```

**If any port shows CONFLICT:**
- Ports 4317, 4318, 8889, 9090, 3100 are required by the backend services — if occupied, identify what's using them (`ss -tlnp | grep :<port>`) and tell the user they need to free them.
- Port 4000 is the default dashboard port but is configurable — note the conflict and handle it in Section 3.

---

## Section 2: Clone the Repository

### 2.1 Ask the user where they want the repo

Suggest the default: `~/claude-code-monitoring`. If they want a different path, use that throughout.

### 2.2 Clone

```bash
git clone <repo-url> ~/claude-code-monitoring
```

Replace the URL and path with actuals if different.

### 2.3 Verify

```bash
ls ~/claude-code-monitoring/docker-compose.yml
```

Must exist. If it doesn't, the clone failed.

---

## Section 3: Configure the Dashboard Port

### 3.1 Ask the user

> "The dashboard defaults to port 4000. Would you like to use a different port? (Common alternatives: 3000, 3001, 3002, 8080)"

If a port 4000 conflict was detected in Section 1.5, mention it here.

### 3.2 If they choose a port other than 4000

Edit `docker-compose.yml` in the repo. Find the `dashboard` service's `ports` mapping and change it:

```yaml
    ports:
      - "<chosen-port>:80"
```

The file currently has `"4000:80"` — change the left side to whatever port the user chose.

### 3.3 If they choose port 4000 (default)

No changes needed — `docker-compose.yml` already ships with `"4000:80"`.

### 3.4 Verify

```bash
grep -A2 'ports:' ~/claude-code-monitoring/docker-compose.yml | grep '80"'
```

Should show the correct port mapping.

---

## Section 4: Start the Stack

### 4.1 Build and launch

```bash
cd ~/claude-code-monitoring && docker compose up -d
```

This pulls images and builds the dashboard container. First run takes 1-3 minutes depending on internet speed. The build step runs `npm ci` and `vite build` inside the container.

### 4.2 Wait for containers

```bash
sleep 10 && docker compose ps
```

All four containers should show `Up` or `running`:
- `otel-collector`
- `prometheus`
- `loki`
- `dashboard`

**If any container is restarting or exited:** Check logs:
```bash
docker compose logs <service-name> --tail=30
```

Common issues:
- **otel-collector restarting:** Config file not mounted correctly. Check `otel-collector-config.yaml` exists in repo root.
- **dashboard build failed:** npm registry unreachable or Node build error. Check `docker compose logs dashboard`.
- **loki exited:** Volume permissions. Try `docker compose down -v && docker compose up -d` (warning: destroys any existing data).

### 4.3 Verify each service

Run these checks:

```bash
# Prometheus is up and scraping
curl -s http://localhost:9090/api/v1/targets | grep -o '"health":"up"' | head -3

# Loki is reachable
curl -s http://localhost:3100/ready

# OTel Collector health check
curl -s http://localhost:13133/

# Dashboard serves HTML (use the port from Section 3)
curl -s http://localhost:<dashboard-port>/ | grep -o '<title>.*</title>'
```

Expected:
- Prometheus: at least one `"health":"up"`
- Loki: `ready`
- OTel Collector: HTTP 200 or JSON response
- Dashboard: `<title>` tag from the React app

### 4.4 Enable Docker on boot (optional but recommended)

```bash
sudo systemctl enable docker
```

This ensures the stack auto-restarts after a reboot (all containers have `restart: unless-stopped`).

Note: This requires `sudo`. Ask the user before running. If they decline, tell them:
> "The monitoring stack won't auto-start after a reboot. You'll need to run `cd ~/claude-code-monitoring && docker compose up -d` manually."

---

## Section 5: Configure Claude Code Telemetry

This is the most critical section. Claude Code must be configured to send telemetry to the local OTel Collector.

### 5.1 Read existing settings

```bash
cat ~/.claude/settings.json 2>/dev/null || echo "FILE_DOES_NOT_EXIST"
```

### 5.2 Write or merge settings

**If the file does not exist:**

Create `~/.claude/settings.json` with:

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

**If the file already exists:**

You MUST deep-merge. Do NOT overwrite the file. Read the existing JSON, merge the `env` keys above into the existing `env` object (or create it if absent), and preserve all other top-level keys. Use a strategy like:

```bash
python3 -c "
import json, sys

new_env = {
    'CLAUDE_CODE_ENABLE_TELEMETRY': '1',
    'OTEL_METRICS_EXPORTER': 'otlp',
    'OTEL_LOGS_EXPORTER': 'otlp',
    'OTEL_EXPORTER_OTLP_PROTOCOL': 'grpc',
    'OTEL_EXPORTER_OTLP_ENDPOINT': 'http://localhost:4317',
    'OTEL_METRIC_EXPORT_INTERVAL': '15000',
    'OTEL_LOG_TOOL_DETAILS': '1'
}

with open('$HOME/.claude/settings.json', 'r') as f:
    settings = json.load(f)

settings.setdefault('env', {}).update(new_env)

with open('$HOME/.claude/settings.json', 'w') as f:
    json.dump(settings, f, indent=2)
    f.write('\n')

print('Merged successfully')
"
```

If python3 is not available, use `jq` or Node.js — but the merge logic must be correct. Never clobber existing settings.

### 5.3 Verify settings

```bash
cat ~/.claude/settings.json | python3 -m json.tool
```

Confirm:
- Valid JSON
- `env.CLAUDE_CODE_ENABLE_TELEMETRY` is `"1"`
- `env.OTEL_EXPORTER_OTLP_ENDPOINT` is `"http://localhost:4317"`
- Any pre-existing settings are still present

---

## Section 6: Post-Setup Verification

### 6.1 Tell the user to start a new Claude Code session

> "Setup is complete! You need to **start a new Claude Code session** for telemetry to activate. Existing sessions won't pick up the new settings. Open a new terminal and run `claude` to start a fresh session."

### 6.2 After they've started a session and done some work

Wait for the user to interact with Claude Code for a minute or two, then verify data is flowing:

```bash
# Check OTel Collector is receiving data
docker compose -f ~/claude-code-monitoring/docker-compose.yml logs otel-collector --tail=10 2>&1 | grep -c "LogsExporter"

# Check Prometheus has Claude Code metrics
curl -s 'http://localhost:9090/api/v1/query?query=claude_code_session_count_total' | python3 -c "
import json, sys
data = json.load(sys.stdin)
results = data.get('data', {}).get('result', [])
if results:
    print(f'Prometheus has data: {len(results)} series found')
else:
    print('No data yet — this is normal if the session just started. Wait 30 seconds and retry.')
"

# Check Loki has events
curl -s 'http://localhost:3100/loki/api/v1/label/service_name/values' | python3 -c "
import json, sys
data = json.load(sys.stdin)
values = data.get('data', [])
if 'claude-code' in values:
    print('Loki is receiving events from Claude Code')
else:
    print('No events yet — use some tools in Claude Code and check again in 30 seconds')
"
```

### 6.3 Dashboard URL

Tell the user:

> "Your dashboard is live at: **http://localhost:<dashboard-port>**
>
> It may look empty at first — data populates as you use Claude Code. After a few minutes of activity you'll see token usage, tool calls, and session metrics appear.
>
> The dashboard auto-refreshes. Use the time range selector in the top bar to adjust the view window."

---

## Section 7: Troubleshooting

If the user reports issues after setup, run through these checks:

### No data in dashboard

1. **Is the stack running?** `docker compose -f ~/claude-code-monitoring/docker-compose.yml ps`
2. **Did they start a NEW session?** Settings only apply to sessions started after the config change.
3. **Is the OTel Collector receiving data?** `docker compose -f ~/claude-code-monitoring/docker-compose.yml logs otel-collector --tail=20` — look for `LogsExporter` or `MetricsExporter` lines.
4. **Is Prometheus scraping?** Visit `http://localhost:9090/targets` — both targets should show `UP`.
5. **Is the endpoint correct?** `grep OTEL_EXPORTER_OTLP_ENDPOINT ~/.claude/settings.json` — must be `http://localhost:4317` (not `https`).

### Dashboard shows errors or won't load

1. **Container running?** `docker ps | grep dashboard`
2. **Nginx logs:** `docker compose -f ~/claude-code-monitoring/docker-compose.yml logs dashboard --tail=20`
3. **Can the dashboard reach Prometheus/Loki?** The Nginx reverse proxy resolves `prometheus` and `loki` by Docker DNS. If those containers are down, API calls fail.

### Port conflicts after setup

If another service starts using a required port:
```bash
ss -tlnp | grep :<port>
```
Identify the conflicting process and either stop it or reconfigure the monitoring stack.

---

## Environment Variable Reference

These are the telemetry variables written to `~/.claude/settings.json`:

| Variable | Value | Purpose |
|----------|-------|---------|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | `1` | Master opt-in switch for telemetry |
| `OTEL_METRICS_EXPORTER` | `otlp` | Export metrics via OpenTelemetry protocol |
| `OTEL_LOGS_EXPORTER` | `otlp` | Export event logs via OpenTelemetry protocol |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` | Use gRPC transport (efficient, matches collector config) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | OTel Collector gRPC receiver on host |
| `OTEL_METRIC_EXPORT_INTERVAL` | `15000` | Export metrics every 15 seconds |
| `OTEL_LOG_TOOL_DETAILS` | `1` | Include tool parameters and file paths in log events |

### Optional extras (not included by default)

| Variable | What it unlocks |
|----------|----------------|
| `OTEL_LOG_USER_PROMPTS=1` | Prompt text in `user_prompt` events |
| `OTEL_LOG_TOOL_CONTENT=1` | Full tool I/O in trace spans (requires traces beta) |
| `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` | Distributed traces (spans pipeline) |

---

## What Was Set Up

After completing this guide, the user has:

- **4 Docker containers** running with `restart: unless-stopped` (auto-start on boot if Docker is enabled)
- **Prometheus** storing time-series metrics with 30-day retention at `:9090`
- **Loki** storing event logs (tool use, API requests, prompts) at `:3100`
- **OTel Collector** receiving OTLP telemetry at `:4317` (gRPC) and `:4318` (HTTP)
- **Custom React dashboard** at `:<chosen-port>` showing token usage, tool calls, sessions, commits, and more
- **Claude Code** configured to emit telemetry to the local collector

### Managing the stack

```bash
cd ~/claude-code-monitoring

# Stop
docker compose down

# Start
docker compose up -d

# View logs
docker compose logs -f

# Reset all data
docker compose down -v && docker compose up -d

# Rebuild dashboard after pulling updates
docker compose up -d --build dashboard
```

---

## Section 8: Optional Enhancements

These are Claude Code plugins that complement the telemetry dashboard. Only offer these after the core setup (Sections 1-6) is verified and working. Each is independent — the user can install one, both, or neither.

### 8.1 MemPalace — Persistent Memory Across Sessions

MemPalace gives Claude Code a persistent semantic memory system. Memories survive across conversations — architecture decisions, debugging context, user preferences, and project knowledge are stored and recalled automatically.

**What it does:** Organizes memories into wings (projects) → rooms (aspects like `decisions`, `architecture`) → drawers (individual memories). Includes a knowledge graph for structured facts and an agent diary for session journals.

**Why it pairs well with CCT:** The telemetry dashboard shows *what* Claude did (tool calls, tokens, sessions). MemPalace captures *why* — the decisions, context, and lessons learned during those sessions.

#### Install

```bash
# Step 1: Add the marketplace
claude plugins marketplace add mempalace --source github --owner milla-jovovich --repo mempalace

# Step 2: Install the plugin
claude plugins install mempalace@mempalace
```

#### Post-install: Fix Python dependency (may be needed)

The MemPalace MCP server requires the `mempalace` Python package. The plugin install may pull an outdated PyPI version (3.0.0) that's missing the hooks CLI. If you see errors mentioning `invalid choice: 'hook'`, fix with:

```bash
pip3 install --force-reinstall 'git+https://github.com/milla-jovovich/mempalace.git'
```

**Python 3.14 users:** chromadb 0.5.x/0.6.x crash on Python 3.14 due to a pydantic v1 incompatibility. After the above install, ensure chromadb 1.x is present:

```bash
pip3 install 'chromadb>=1.0,<2' --no-deps
```

#### Verify

Start a new Claude Code session and run `/mempalace:status`. You should see the palace structure (wings, rooms, drawer counts). If the MCP server isn't connecting, check `claude mcp list` for the mempalace entry.

#### Add to CLAUDE.md

After installation, append the MemPalace usage guide to the project's `CLAUDE.md` so future Claude instances know the tools are available. The insert text is at `docs/claude-md-mempalace-insert.md` in this repo — copy its contents and append to `CLAUDE.md`.

---

### 8.2 Caveman — Token-Efficient Communication

Caveman reduces Claude's output tokens by ~65-75% by stripping filler words, articles, and hedging while keeping full technical accuracy. Useful for long sessions or when context is getting large.

**What it does:** Activatable communication mode with intensity levels (lite → full → ultra). Code blocks, commit messages, and security warnings are always written in normal English.

**Why it pairs well with CCT:** The telemetry dashboard tracks token usage. With Caveman active, you'll see output token counts drop significantly — a visible before/after in your own dashboard.

#### Install

```bash
# Step 1: Add the marketplace
claude plugins marketplace add caveman --source github --owner JuliusBrussee --repo caveman

# Step 2: Install the plugin
claude plugins install caveman@caveman
```

No Python dependencies. No post-install fixes needed.

#### Verify

Start a new Claude Code session and type `/caveman`. Claude should switch to compressed communication mode. Type `stop caveman` or `normal` to deactivate.

#### Add to CLAUDE.md

After installation, append the Caveman usage guide to the project's `CLAUDE.md`. The insert text is at `docs/claude-md-caveman-insert.md` in this repo — copy its contents and append to `CLAUDE.md`.

---

## Section 9: Recommended CLAUDE.md Inserts (Unconditional)

These inserts are project-agnostic and apply regardless of which plugins the user has installed. Offer them after Sections 1-6 are verified — the user can append any subset to their existing project `CLAUDE.md` files.

### 9.1 Session Discipline — Cost-Efficient Output Maximization

A short set of model-selection norms (Opus / Sonnet / Haiku roles), phase rhythm (Plan → Execute → Verify), anti-patterns to avoid, and dashboard signals to watch. Distilled from observed Max 5x session telemetry.

**Why it pairs well with CCT:** The dashboard surfaces Cost (USD), Tokens by Source (main / subagent / auxiliary), and Agent Types. Without guidance on what those numbers *should* look like, the panels are decoration. This insert turns them into actionable thresholds (e.g. "Opus share > ~30% of cost = too much rote work on the expensive model").

**Why it stands alone:** The model-selection table and phase rhythm work even on a machine without CCT — the dashboard signals section is clearly marked "if CCT is installed" and degrades gracefully.

#### Add to CLAUDE.md

Append the contents of `docs/claude-md-session-discipline-insert.md` (in this repo) to the project's `CLAUDE.md`. No install step — it's pure prose guidance. Recommend appending near the top of the project's "Development Workflow" section if one exists, otherwise as a standalone H2 section.
