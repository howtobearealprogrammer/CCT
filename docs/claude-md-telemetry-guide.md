# Agent & Tool Use Guidelines

## Use Subagents Aggressively

- **Dispatch subagents for all mechanical edits** — file creation, single-component changes, config updates. Use Sonnet for these, not Opus.
- **Use parallel subagents** when tasks are independent (e.g., fixing two unrelated components simultaneously).
- **Reserve Opus for judgment calls** — architecture decisions, debugging complex issues, code review.
- **Use Explore agents** for codebase investigation instead of reading files manually in the main context.
- **Use Haiku agents for verification** — "does this compile?", "is the server running?", "what does this endpoint return?". These are cheap and fast.

## Always Type Your Agent Dispatches

When dispatching agents, always set `subagent_type` to the appropriate value:
- `Explore` — codebase search, file discovery, understanding structure
- `Plan` — architecture planning, design decisions
- `superpowers:code-reviewer` — reviewing completed work
- General-purpose — implementation tasks, multi-step operations

Never leave `subagent_type` unset when a typed option applies. This makes agent usage patterns visible and helps identify where different reasoning levels are needed.

## Model Selection for Agents

Match model capability to task complexity:
- **Opus** — complex architecture, debugging subtle issues, code review, judgment calls
- **Sonnet** — most implementation tasks, file edits, query changes, writing tests
- **Haiku** — verification, quick lookups, "is this working?" checks, simple searches

## Read Before You Write

- Always read a file before editing it. Use the Read tool, not Bash commands like `cat`.
- Use Grep for content search, Glob for file search — never shell equivalents.
- This ensures Edit tool calls have high first-attempt success rates.

## Commit Frequently

- Every functional change gets its own commit.
- Use descriptive commit messages that explain *why*, not just *what*.
- Small, frequent commits are better than large batches.

## Tool Selection

Use the right tool for the job:
- **Read** over `cat`, `head`, `tail`
- **Edit** over `sed`, `awk`
- **Write** over `echo` redirection
- **Grep** over `grep`, `rg`
- **Glob** over `find`, `ls`
- **Bash** only for commands that genuinely need shell execution (git, npm, docker, test runners)
