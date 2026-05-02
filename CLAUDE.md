# CLAUDE.md

## Project

Custom telemetry monitoring stack for Claude Code. OTel Collector receives telemetry, Prometheus stores metrics, Loki stores event logs, and a custom React dashboard (`:4000`) visualizes everything. Grafana is commented out but available for debugging on `:3001`.

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

### Trust But Verify

Never assume a change works — always verify with evidence before claiming success.

- **After every subagent dispatch**, check the result yourself. Subagents report "done" but may have introduced visual regressions, missed edge cases, or misunderstood the task.
- **After every data/query fix**, verify the actual rendered output in the browser, not just that the code compiles.
- **Use typed verification agents** to cross-check state. Dispatch `Explore` agents (Haiku model) for quick checks like "is the container running?", "how many commits exist?", "what does Loki return for this query?". These are cheap and generate useful telemetry.
- **Always type your agent dispatches** — use `subagent_type` (Explore, Plan, superpowers:code-reviewer, etc.) rather than defaulting to general-purpose. This makes the Agent Types telemetry meaningful and shows intentional tool use.
- **Verification agents should use Haiku or Sonnet** — they don't need Opus. Save expensive models for implementation and judgment calls.

### Commit Frequently

- Every functional change gets its own commit — this generates telemetry data that appears in the dashboard itself.
- The meta-story (dashboard showing its own build telemetry) depends on granular commits.

### Session Discipline

The goal is **maximum output per Max 5x session-limit unit**, not minimum cost. Burn the budget on work that compounds (planning, judgment, verification); avoid work that doesn't (re-reads, redundant Opus on rote work, dispatched subagents for trivial tasks).

**Model selection is the highest-leverage knob.** Opus is ~5× the per-token cost of Sonnet, and Max 5x has a tighter Opus-specific quota that trips first under sub-agent-heavy Opus workloads.

| Model | Use for |
|---|---|
| **Opus** (main) | Architecture, debugging unknown causes, judgment on tradeoffs, review of subagent output, planning multi-step changes |
| **Sonnet** (most subagents) | Default for implementation, mechanical edits, single-component changes, refactors with a clear shape |
| **Haiku** (verification subagents) | "Is X up?", "how many Y?", "what does Loki return for this query?", build-status checks |

**Phase rhythm: Plan (Opus) → Execute (Sonnet subagents) → Verify (Haiku subagents).** Front-load Opus on planning so execution is mechanical. Don't replan because of execution confusion — that's a 2× cost multiplier.

**Subagents are NOT free.** They re-read files and re-think — pay full token cost. They're worth it when (a) they offload main's context window, OR (b) they use a cheaper model. Bad: dispatching a subagent to read one file. Good: a Sonnet subagent for a multi-file mechanical change, or a Haiku Explore for a "where is X?" question that would otherwise take 3+ greps.

**Anti-patterns to catch in real time:**
- Re-reading files you already read in this session (subagent results live in your context).
- Dispatching a Sonnet subagent for work that fits in one Bash one-liner.
- Letting Opus do mechanical sed-like edits across N files.
- Fixing things outside scope ("while I'm here") — usually a 2-3× cost multiplier with marginal value.
- Auto-compaction is a big cacheCreation hit — start a new session for a genuinely different project rather than dragging compacted state along.

**Dashboard signals to watch on `:4000`:**
- **Cost (USD) by Model**: if Opus share > ~30% of cost, you're spending too much on rote work.
- **Tokens by Source**: subagent share > 60% is healthy (offloading main); main share > 80% means you're not delegating.
- **Active Time vs Total Tokens**: low ratio = burning tokens on idle / repeat reads.
- **Agent Types**: high "general-purpose" share = you're not categorizing intent. Type your dispatches.

## Dashboard Development

### Rebuilding

```bash
docker compose up -d --build dashboard
```

Changes to `dashboard/src/` require rebuilding the Docker container. The Vite dev server (`npx vite` in `dashboard/`) can be used for faster iteration during development, with the proxy config handling API routing.

### Common Pitfalls

- **ECharts x-axis auto-scales to data range** — always pass `timeRangeMs` prop to pin axes to the selected time range.
- **ECharts y-axis shows decimals for integer data** — use `integerAxis` prop (sets `minInterval: 1`) on count-based charts.
- **Ring gauge center text** — use pie `label` with `position: "center"` and `rich` formatting. Avoid `graphic` overlays (they don't auto-center on the ring).
- **Loki timestamps are nanoseconds** — multiply by 1e9 when sending, divide by 1e6 when receiving (to get ms).
- **Prometheus `increase()` range** — use the step interval for time series charts, use the full range for aggregate/pie queries.

### Color Palette

Consistent color identity throughout the dashboard:
- Blue `#5794F2` — tokens, cacheRead, config decisions
- Green `#73BF69` — lines of code, input tokens, Bash tool
- Purple `#B877D9` — active time, cacheCreation, opus model, **auxiliary query_source**
- Amber `#FF9830` — commits, output tokens, agent calls, **main query_source**
- Teal `#4ECDC4` — MCP tools, Explore agent, haiku model, **subagent query_source**, **cost (USD)**

`QUERY_SOURCE_COLORS` and the Cost stat card share teal/amber/purple identity with the model and tool families they conceptually align with (subagents tend to run on Sonnet/Haiku → teal; main tends to be Opus heavy but its agent-call signature is amber).

## Stack Notes

- Port 4000 is the custom dashboard (default)
- Port 3001 is reserved for Grafana (commented out in docker-compose, re-enable for debugging)
- Loki structured metadata fields (`event_name`, `tool_name`, etc.) are NOT stream labels — query with filter pipeline, not label matchers
