## MemPalace — Persistent Memory

You have access to MemPalace, a persistent semantic memory system shared across all Claude Code instances. Use it to store and retrieve knowledge that should survive beyond a single conversation.

### When to Use

- **Search before starting work** — check if past sessions left context about this project, its architecture, decisions, or gotchas.
- **Store decisions and context** — when you learn something non-obvious (architectural decisions, why something was done a certain way, user preferences), file it.
- **Store facts to the knowledge graph** — people, relationships, temporal facts (e.g. "project X uses framework Y since 2026-01").
- **Write a diary entry at session end** — summarize what you worked on, what matters, what's unfinished. Future instances will thank you.

### How It Works

MemPalace is organized as: **wings** (projects/domains) → **rooms** (aspects like `decisions`, `architecture`, `debugging`) → **drawers** (individual memories stored verbatim).

There is also a **knowledge graph** for structured facts with temporal validity, and an **agent diary** for session journals.

### Key Tools

| Tool | When |
|---|---|
| `mempalace_search` | Search memories semantically. Use `wing` and `room` filters to narrow results. |
| `mempalace_add_drawer` | Store a memory. Pick a `wing` (project name) and `room` (aspect). Content is stored verbatim — be specific. |
| `mempalace_check_duplicate` | Check before adding — avoid filing the same thing twice. |
| `mempalace_list_wings` | See what projects/domains exist in the palace. |
| `mempalace_list_rooms` | See what rooms exist within a wing. |
| `mempalace_get_taxonomy` | Full overview: wing → room → drawer count. |
| `mempalace_kg_add` | Add a structured fact: subject → predicate → object, with optional time window. |
| `mempalace_kg_query` | Query an entity's relationships. Use `as_of` for point-in-time queries. |
| `mempalace_kg_invalidate` | Mark a fact as no longer true (ended). |
| `mempalace_diary_write` | Write a session diary entry in AAAK format. Use your agent name consistently. |
| `mempalace_diary_read` | Read past diary entries to understand what previous sessions did. |

### Guidelines

- **Search first, store later.** At the start of a session, search for context about the current project before diving in.
- **Be specific when storing.** "Auth uses JWT with RS256, tokens expire after 1h, refresh tokens after 30d" is useful. "We set up auth" is not.
- **Use the right wing name.** Use the project name as the wing so memories cluster correctly.
- **Check for duplicates** before adding a drawer — `mempalace_check_duplicate` prevents clutter.
- **Diary entries use AAAK format** — a compressed notation. Call `mempalace_get_aaak_spec` if you need the spec.
- **Knowledge graph facts are temporal.** Use `valid_from` when you know when something became true, and `kg_invalidate` when it stops being true.
