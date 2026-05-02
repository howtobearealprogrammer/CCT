## Session Discipline — Cost-Efficient Output Maximization

The goal is **maximum output per Max 5x session-limit unit**, not minimum cost. Burn the budget on work that compounds (planning, judgment, verification); avoid work that doesn't (re-reads, redundant Opus on rote work, dispatched subagents for trivial tasks).

### Model selection (highest leverage)

Opus is ~5× the per-token cost of Sonnet, and Max 5x has a tighter Opus-specific quota that trips first under sub-agent-heavy Opus workloads.

| Model | Use for |
|---|---|
| **Opus** (main) | Architecture, debugging unknown causes, judgment on tradeoffs, review of subagent output, planning multi-step changes |
| **Sonnet** (most subagents) | Default for implementation, mechanical edits, single-component changes, refactors with a clear shape |
| **Haiku** (verification subagents) | "Is X up?", "how many Y?", "what does this query return?", build-status checks |

### Phase rhythm

**Plan (Opus) → Execute (Sonnet subagents) → Verify (Haiku subagents).**

Front-load Opus on planning so execution is mechanical. Don't replan because of execution confusion — that's a 2× cost multiplier.

### Subagent dispatch discipline

Subagents are NOT free — they re-read files and re-think, paying full token cost. They're worth it when (a) they offload the main context window, OR (b) they use a cheaper model.

- Bad: dispatching a subagent to read one file. Just `Read`.
- Good: a Sonnet subagent for a multi-file mechanical change, or a Haiku Explore for a "where is X?" question that would otherwise take 3+ greps.
- Always type the dispatch (`subagent_type=Explore/Plan/general-purpose`).
- Parallel subagents only when work is genuinely independent. Faking parallelism wastes tokens because results conflict and one gets thrown away.

### Anti-patterns to catch in real time

- Re-reading files you already read in this session (subagent results live in your context).
- Dispatching a Sonnet subagent for work that fits in one Bash one-liner.
- Letting Opus do mechanical sed-like edits across N files.
- Fixing things outside scope ("while I'm here") — usually a 2-3× cost multiplier with marginal value.
- Auto-compaction is a big cacheCreation hit — start a new session for a genuinely different project rather than dragging compacted state along.

### Dashboard signals (if CCT is installed)

If the Claude Code Telemetry stack is running on this machine, monitor these on the dashboard:

- **Cost (USD) by Model**: if Opus share > ~30% of cost, you're spending too much on rote work.
- **Tokens by Source**: subagent share > 60% is healthy (offloading main); main share > 80% means you're not delegating.
- **Active Time vs Total Tokens**: low ratio = burning tokens on idle / repeat reads.
- **Agent Types**: high "general-purpose" share = you're not categorizing intent. Type your dispatches.
