# Branch Purpose: de-personalise

Remove all individual developer-specific content, documentation, and assumptions to prepare this repo for publication as a public repository ("Claude Code Telemetry Dashboard") targeting a critical, technically savvy audience of developers and AI enthusiasts.

---

## What Needs to Change

### README.md

1. **Line 27 — SimpleClub reference:** Remove "Port 3000 is used by the SimpleClub API server" explanation. Replace with a generic note that the dashboard port is configurable (default 3000).
2. **Line 37 — Grafana password note:** "password has been changed from default" is personal state. Reset to document the default `admin`/`admin` credentials from docker-compose.yml.
3. **Lines 539–546 — MCP Servers section:** Documents personal `~/.claude.json` MCP config (playwright, chrome-devtools). Remove this section entirely — it's the developer's personal machine config, not part of the project.

### CLAUDE.md

4. **Line 67 — SimpleClub API reference:** Remove "Port 3000 is used by another local service (SimpleClub API)". Replace Stack Notes with generic port allocation (no personal service names).
5. **Lines 68–69 — Port table:** Rewrite to document the default ports without explaining them as workarounds for personal conflicts.

### docker-compose.yml

6. **Line 69 — Dashboard port:** Change `"3002:80"` to `"3000:80"`. The 3002 choice was a personal workaround. Public default should be 3000.

### docs/copy-paste.md

7. **Line 97 — Clone URL:** Replace `https://github.com/howtobearealprogrammer/CCT.git` with a placeholder like `<repo-url>` or the eventual public repo URL.
8. **Lines 92, 105, 138, 150, 210, etc. — Default path:** `~/Repos/claude-code-monitoring` reflects one developer's directory convention. Change to a more generic default like `~/claude-code-monitoring` or just `<install-path>`.
9. **Lines 129, 133 — Port references:** Update references to `"3002:80"` as the current docker-compose state to `"3000:80"` (matching the new default after item 6).
10. **Section 1.5 port check:** Currently checks port 3000. This is correct for the new default. Verify the guide's flow still makes sense with 3000 as the shipping default (it should — the guide already asks the user and detects conflicts).

### docs/superpowers/plans/

11. **Entire directory:** Contains AI-generated implementation plans with hardcoded `/home/dan/Repos/` paths (13+ occurrences in `2026-04-01-custom-dashboard.md`, 5 in `2026-04-01-act-success-rate-panel.md`). These are internal development artifacts. Either:
    - **Option A:** Delete the entire `docs/superpowers/` directory (recommended — these are session artifacts, not project documentation)
    - **Option B:** Add `docs/superpowers/` to `.gitignore` and remove from tracking

---

## What Does NOT Need to Change

- **Telemetry env var docs** — generic, applies to all users
- **OTel/Prometheus/Loki config files** — no personal content
- **Dashboard source code** — no personal content
- **docs/claude-md-caveman-insert.md, docs/claude-md-mempalace-insert.md** — generic plugin docs referencing public GitHub repos
- **docs/claude-md-telemetry-guide.md** — generic workflow guidance
- **Grafana provisioning files** — generic dashboard definitions
- **Color palette, common pitfalls, lessons learned** — all generic project knowledge

---

## Audience for the Public Repo

The target audience is **developers and AI enthusiasts** who:
- Already use Claude Code (or are evaluating it)
- Are comfortable with Docker and command-line tools
- Will scrutinise the README and docs critically
- May not have the same local environment (different ports occupied, different OS flavour, different directory conventions)

Every piece of documentation should work for someone who just cloned the repo with zero context about the original developer's machine.

---

## Verification Checklist

After all changes:
- [ ] `grep -ri "simpleclub" .` returns nothing
- [ ] `grep -ri "howtobearealprogrammer" .` returns nothing
- [ ] `grep -r "/home/dan" .` returns nothing (excluding `.git/`)
- [ ] `grep -ri "password has been changed" .` returns nothing
- [ ] `docker-compose.yml` dashboard port is `"3000:80"`
- [ ] `docker compose up -d` still works
- [ ] Dashboard loads at `localhost:3000`
- [ ] No `docs/superpowers/plans/` directory in tracked files
