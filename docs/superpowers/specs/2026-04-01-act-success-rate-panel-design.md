# Act Success Rate Panel Design

## Summary

Replace the "Tool Decisions" ring gauge panel with an "Act Success Rate" panel that shows the first-attempt success rate of Act-category tools (Edit, Write, Bash). This provides an honest self-assessment metric for Claude's execution quality, designed to be reviewed via screenshot during sessions.

## Motivation

The current "Tool Decisions" panel shows permission source distribution (config/user_temporary/user_permanent), which is almost always "100% config" — not useful or visually interesting. The new panel serves a self-improvement purpose: when Claude takes a screenshot and reviews the dashboard, the Act Success Rate gives immediate, honest feedback about execution quality.

LinkedIn narrative: the AI monitors itself, provides data-backed self-assessment, and can make validated claims like "95%+ first-attempt success rate on tool execution."

## Data Definition

### What counts as an "Act" tool

| Tool | Why it's an Act tool |
|------|---------------------|
| **Edit** | Modifying existing files — failure means `old_string` didn't match (didn't read properly) |
| **Write** | Creating/overwriting files — failure indicates bad content or wrong path |
| **Bash** | Executing shell commands — failure means wrong command, bad flags, or incorrect assumptions |

### What we exclude

- **Read, Grep, Glob, ToolSearch** — Observe tools. Failures are exploratory ("file not found"), not quality issues.
- **Agent, Skill** — Delegate tools. Success/failure is about the sub-task, not execution precision.
- **MCP tools, TaskCreate, TaskUpdate** — Interact tools. Different failure semantics.

### Data source

Loki `tool_result` events with structured metadata fields `tool_name` and `success`.

### Queries

Two Loki queries over the selected time range (`${range}` = full window):

**Total Act calls per tool:**
```
sum by (tool_name)(count_over_time({service_name="claude-code"} | event_name="tool_result" | tool_name=~"Edit|Write|Bash" [${range}]))
```

**Successful Act calls per tool:**
```
sum by (tool_name)(count_over_time({service_name="claude-code"} | event_name="tool_result" | tool_name=~"Edit|Write|Bash" | success="true" [${range}]))
```

**Derived metrics (computed in frontend):**
- Per-tool success rate: `successful[tool] / total[tool] * 100`
- Aggregate success rate: `sum(all successful) / sum(all total) * 100`

## Visual Design

### Panel position

Same grid slot as current "Tool Decisions" — row 3 right sidebar, below "Tool Distribution".

### Panel title

"Act Success Rate"

### Ring gauge

- **Ring segments** show proportion of total Act calls per tool (volume distribution, not success rate). E.g., if Bash=55 calls, Edit=35, Write=10, ring shows 55%/35%/10%.
- **Center text** shows aggregate success rate as large percentage (e.g., "94%") with label "success" beneath.
- **Legend** (right side) lists each tool with its individual success rate: `Bash 87%`, `Edit 98%`, `Write 100%`.

### Colors

Per-tool colors (reusing existing palette):
- Bash: `#73BF69` (green)
- Edit: `#5794F2` (blue)
- Write: `#B877D9` (purple)

Center text color (based on aggregate rate):
- 95%+: `#73BF69` (green) — strong performance
- 80-94%: `#FF9830` (amber) — room for improvement
- Below 80%: `#F2495C` (red) — needs attention

### No Data state

When no Act tool calls exist in the time range, show "No Data" using the existing RingGauge no-data pattern (already implemented).

## Component Changes

### `queries.ts`

- Remove `toolDecisions` query (Loki query grouped by `source`)
- Add two new queries: `actToolTotal` and `actToolSuccess`
- Compute `actSuccessRate` data structure in `fetchDashboardData`

### New type

```typescript
interface ActSuccessData {
  tools: Array<{
    name: string;      // "Bash", "Edit", "Write"
    total: number;     // total calls
    successful: number; // successful calls
    rate: number;      // success percentage
  }>;
  aggregateRate: number; // overall success percentage
  ringSlices: PieSlice[]; // volume distribution for ring segments
}
```

### `RingGauge.tsx`

The existing RingGauge accepts `PieSlice[]` and shows the dominant slice percentage in center. For Act Success Rate, we need the center to show the *aggregate success rate* (not the dominant slice proportion). Two options:

**Option A:** Add an optional `centerOverride` prop to RingGauge that replaces the auto-calculated center text. This keeps RingGauge general-purpose.

**Option B:** Create a variant component. Rejected — too much duplication for one panel.

**Decision: Option A.** Add `centerValue?: number` and `centerLabel?: string` props. When provided, these override the auto-calculated dominant-slice display. Also add `centerColor?: string` for the conditional coloring.

### `colors.ts`

- Remove `DECISION_COLORS`
- Add `ACT_TOOL_COLORS`:
  ```typescript
  export const ACT_TOOL_COLORS: Record<string, string> = {
    Bash: COLORS.green,   // #73BF69
    Edit: COLORS.blue,    // #5794F2
    Write: COLORS.purple, // #B877D9
  };
  ```

### `App.tsx`

- Replace `<RingGauge data={data?.toolDecisions} colorMap={DECISION_COLORS} />` with new Act Success Rate rendering
- Pass `centerValue={data?.actSuccess?.aggregateRate}`, `centerLabel="success"`, `centerColor` based on threshold

### `types/index.ts`

- Remove `toolDecisions: PieSlice[]` from `DashboardData`
- Add `actSuccess: ActSuccessData`

## Legend Format

The legend needs a different format than other ring gauges. Other gauges show `name proportion%` (e.g., "cacheRead 99%"). This panel shows `name successRate%` — the percentage is per-tool success rate, not share of the ring.

The RingGauge component auto-generates legend from pie data using `{b} {d}%` (name + proportion). To show success rates instead, pass a `legendData` map that overrides the legend label per tool. Decision: add `legendLabels?: Record<string, string>` prop to RingGauge. The App passes `{ Bash: "Bash 87%", Edit: "98%", Write: "100%" }` — pre-formatted strings computed from `actSuccess.tools`. The RingGauge legend uses these labels when provided instead of auto-calculating from pie proportions.

## Testing

- Verify with screenshot after rebuild
- Check that aggregate rate matches manual calculation
- Test no-data state (empty time range)
- Zoom into panel to verify legend shows per-tool rates
- Confirm center text color changes at thresholds (may need to verify with synthetic data if current rate is 95%+)
