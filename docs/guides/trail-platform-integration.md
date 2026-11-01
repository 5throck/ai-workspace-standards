# Trail Platform Integration Guide

How trail (repo context graph, vendor rename of graft 0.28 — `@trailhq/trail-code`;
the graft-era package name `@nanonets/graft` still resolves) is wired into every
AI host this workspace targets — per-repo (committed, delivered by scaffold +
upgrade) and machine-global (one-time local setup, never committed).

**Policy**: ADR-0076 · **Migration**: `docs/designs/2026-10-31-graft-trail-migration-design.md` (the 2026-09-12 multi-platform rollout design remains the delivery-shape history)

## Surface matrix

| Host | Instructions | MCP registration | Scope |
|---|---|---|---|
| Claude Code | `AGENTS.md` trail block (tool-managed) | `.mcp.json` `mcpServers.trail` (template seed; the repo's own `trail init` deletes it and moves hooks to `.trail/hook.cjs`) | repo (committed) |
| Gemini CLI | `GEMINI.md` trail block | `.gemini/settings.json` `mcpServers.trail` | repo (committed) |
| Antigravity IDE | `GEMINI.md` (shared file, ADR-0021) | same `.gemini/settings.json` + global registry (below) | repo + global |
| Antigravity CLI | `AGENTS.md` trail block | global registry (below) | global |
| Codex | `AGENTS.md` trail block (Codex's native entrypoint) | `.codex/config.toml` `[mcp_servers.trail]` | repo (committed, seed-only) |
| Codex (any repo) | — | `~/.codex/config.toml` | global |
| Claude Desktop App | — | `claude_desktop_config.json` (below) | global, hand-written |
| OpenCode | `AGENTS.md` trail block | `opencode.json` `mcp.trail` | repo (committed) |

`trail mcp [dir]` accepts the repo root as a positional argument and otherwise
resolves the repo from the session's working directory. Hosts that cannot set a
working directory MUST pass the path explicitly.

MCP tool names keep the vendor's graft spelling (`graft_find_code`,
`graft_find_all`, `graft_trace_calls`, `graft_file_api`, `graft_repo_map`,
`graft_check_freshness`) — vendor-internal surface, not ours to rename
(migration design A1).

## Committed repo config (automatic)

Everything repo-level ships from `templates/common` (trail-era seeds) and
reaches projects two ways:

- **New projects**: scaffold copies the overlay and runs plain `trail build`
  (`create-l3-scaffold.ts` v1.19.0 Step 8.5, `new-project.ts` §7.7; non-fatal —
  every trail tool self-refreshes the graph, so a skipped build self-heals).
  Verify with the trail item in the `create-variant` verification checklist.
- **Existing projects**: `bun scripts/upgrade-project.ts Projects/<name> --dry-run` first,
  then run. Delivery classes (`scripts/lib/upgrade-policy.ts`): `.mcp.json`/`.agents/mcp.json`/`opencode.json`
  and the settings files JSON_MERGE (project-owned MCP servers survive);
  `.codex/config.toml` is ADD_IF_MISSING (projects owning a Codex config are
  never touched — copy the `[mcp_servers.trail]` section in manually);
  `CLAUDE.md`/`GEMINI.md`/`AGENTS.md` trail blocks ride the MERGE pass via
  tool-managed markers. A project already migrated by `trail init` (it carries
  the `.trail/` marker) gets the retired graft-era seeds skipped
  (`SEED_SKIP (retired-surface)`), so the upgrader never re-seeds over a
  trail-rewritten tree.

The repo's own `trail init` (runs automatically inside `trail upgrade`) finishes
the per-repo migration: it swaps the instruction-block markers, moves the graph
index to `.trail/cache/`, replaces helper hooks with `.trail/hook.cjs`, deletes
the tracked `.mcp.json`, and creates `.trail/` (cache self-gitignored,
`learnings/` committable).

Index lifecycle: `trail build` (rebuild) and `trail check` (freshness). Vendor
note (trail 0.28.1, migration design A1): `trail build` still defaults its graph
directory to `<repo>/graft`; pass `--dir .trail/cache` to target the migrated
layout (`trail ask`/`trail mcp` resolve both). Scaffolds run plain
`trail build` — each project migrates its graph at its own `trail init` visit.

## Machine-global setup (one-time per machine, never committed)

### Codex CLI

Check `~/.codex/config.toml`:

```toml
[mcp_servers.trail]
command = "trail"
args = ["mcp"]
```

(A native `command = "trail"` works too if the binary is on PATH — run
`npm i -g @trailhq/trail-code` to install/upgrade it. Codex spawns MCP servers with the
session's working directory, so the repo resolves automatically.)

### Antigravity (IDE / CLI)

Register trail in Antigravity's machine-global MCP registry with trail's own
writer — it owns the correct path for the installed version, so never hand-code
it. (Antigravity's documentation, antigravity.google/docs/mcp, gives
`~/.gemini/config/mcp_config.json` as the shared global file for the IDE and the
CLI. `scripts/install-upstream-mcp.ts` edits that file only when it already
exists; see ADR-0097.)

```bash
trail init --agents antigravity    # or: bunx @trailhq/trail-code init --agents antigravity
```

(On repos not yet migrated, the pre-rename spelling `graft init --agents
antigravity` does the same job — same tools, same flags.)

### Claude Desktop App

The Desktop config is one machine-global file and Desktop can neither set a working
directory nor see an nvm PATH — register one entry per repo you query, with **absolute
paths** on both:

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json  (macOS)
// %APPDATA%\Claude\claude_desktop_config.json                      (Windows)
{
  "mcpServers": {
    "trail-ai-workspace": {
      "command": "/Users/<you>/.local/bin/trail",
      "args": ["mcp", "/Users/<you>/git/ai_workspace"]
    }
  }
}
```

Find the binary with `which trail`. Prefer `npx -y @trailhq/trail-code mcp <abs-repo>` only
if a stable `npx` is on the GUI process's PATH (it usually is not). Name entries per
repo (`trail-ai-workspace`, `trail-co-newbiz`, …); the fleet-wide registry is not
recommended for a single global file.

## Verification

```bash
cd <repo>
trail check                 # index freshness (manual — no CI gate by decision, ADR-0076 D8)
ls .trail/cache/INDEX.md    # migrated layout; pre-migration repos still carry graft/
```

The `AGENTS.md` instruction block is tool-managed — do not hand-edit it; a
`trail init` rewrite refreshes it (details in `skills/trail/SKILL.md`).
