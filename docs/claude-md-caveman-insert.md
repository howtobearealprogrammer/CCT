## Caveman — Token-Efficient Communication

You have the Caveman plugin installed (`JuliusBrussee/caveman`). It reduces output tokens ~65-75% by stripping filler while keeping full technical accuracy. Use it for long sessions or when context is getting large.

### Commands

| Command | Effect |
|---|---|
| `/caveman` | Activate at default (full) intensity |
| `/caveman lite` | Drop filler/hedging, keep grammar |
| `/caveman full` | Drop articles, fragments OK, short synonyms |
| `/caveman ultra` | Maximum compression, telegraphic |
| `stop caveman` or `normal` | Deactivate |

### Additional Skills

- `/caveman:compress` — Rewrites memory/config files (CLAUDE.md, todos, preferences) into compressed format. Saves ~45% input tokens per session. Creates `.human-readable` backup.
- `/caveman:caveman-commit` — Terse commit messages in Conventional Commits format. Subject ≤50 chars, body only when "why" isn't obvious.
- `/caveman:caveman-review` — One-line code review comments: location, problem, fix.

### When to Activate

- Long implementation sessions where output volume is high
- When context window is filling up and you need to conserve tokens
- User says "caveman", "less tokens", or activates via command
- Deactivates automatically for: security warnings, irreversible action confirmations, or when user says "normal"/"stop caveman"

### Boundaries

Code blocks, commit messages, and PR descriptions are always written in normal English regardless of caveman mode.
