# Graft Platform Integration Guide

How graft (repo context graph, `@nanonets/graft`) is wired into every AI host this
workspace targets — per-repo (committed, delivered by scaffold + upgrade) and
machine-global (one-time local setup, never committed).

**Policy**: ADR-0074 · **Design**: `docs/designs/2026-09-12-graft-multiplatform-rollout-design.md`

## Surface matrix

| Host | Instructions | MCP registration | Scope |
|---|---|---|---|
| Claude Code | `CLAUDE.md` graft block | `.mcp.json` + `.claude/settings.json` hooks/statusline + `.claude/helpers/` + `.claude/skills/graft/` | repo (committed) |
| Gemini CLI | `GEMINI.md` graft block | `.gemini/settings.json` `mcpServers.graft` | repo (committed) |
| Antigravity IDE | `GEMINI.md` (shared file, ADR-0021) | same `.gemini/settings.json` + global registry (below) | repo + global |
| Antigravity CLI | `AGENTS.md`/`GEMINI.md` graft blocks | global registry (below) | global |
| Codex | `AGENTS.md` graft block (Codex's native entrypoint) | `.codex/config.toml` `[mcp_servers.graft]` | repo (committed, seed-only) |
| Codex (any repo) | — | `~/.codex/config.toml` | global |
| Claude Desktop App | — | `claude_desktop_config.json` (below) | global, hand-written |
| OpenCode | `AGENTS.md` graft block | `opencode.json` `mcp.graft` | repo (committed) |

`graft mcp [dir]` accepts the repo root as a positional argument (default: nearest
ancestor with a `graft/` index). Hosts that cannot set a working directory MUST pass
the path explicitly.

## Committed repo config (automatic)

Everything repo-level ships from `templates/common` and reaches projects two ways:

- **New projects**: scaffold copies the overlay and runs `bunx @nanonets/graft build`
  (`create-l3-scaffold.ts` Step 8.5, `new-project.ts` §7.7). Verify with the graft item
  in the `create-variant` verification checklist.
- **Existing projects**: `bun scripts/upgrade-project.ts Projects/<name> --dry-run` first,
  then run. Delivery classes (`scripts/lib/upgrade-policy.ts`): `.mcp.json`/`opencode.json`
  and the settings files JSON_MERGE (project-owned MCP servers survive); `.claude/skills/graft/`
  syncs via the TEMPLATE TREE SYNC pass; `.codex/config.toml` is ADD_IF_MISSING (projects
  owning a Codex config are never touched — copy the `[mcp_servers.graft]` section in
  manually); `CLAUDE.md`/`GEMINI.md`/`AGENTS.md` graft blocks and the `.gitignore` `/graft/`
  entry ride the MERGE pass via WORKSPACE-MANAGED markers.

The committed launcher is always `bunx @nanonets/graft mcp`. Each repo builds its own
`graft/` index (gitignored, regenerable): `bunx @nanonets/graft build`.

## Machine-global setup (one-time per machine, never committed)

### Codex CLI

Check `~/.codex/config.toml`:

```toml
[mcp_servers.graft]
command = "bunx"
args = ["@nanonets/graft", "mcp"]
```

(A native `command = "graft"` works too if the binary is on PATH — run
`npm i -g @nanonets/graft` to install/upgrade it. Codex spawns MCP servers with the
session's working directory, so the repo resolves automatically.)

### Antigravity (IDE / CLI)

Register graft in Antigravity's machine-global MCP registry with graft's own writer —
it owns the correct path for the installed version, so never hand-code it:

```bash
graft init --agents antigravity    # or: bunx @nanonets/graft init --agents antigravity
```

### Claude Desktop App

The Desktop config is one machine-global file and Desktop can neither set a working
directory nor see an nvm PATH — register one entry per repo you query, with **absolute
paths** on both:

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json  (macOS)
// %APPDATA%\Claude\claude_desktop_config.json                      (Windows)
{
  "mcpServers": {
    "graft-ai-workspace": {
      "command": "/Users/<you>/.nvm/versions/node/v24.15.0/bin/graft",
      "args": ["mcp", "/Users/<you>/git/ai_workspace"]
    }
  }
}
```

Find the binary with `which graft`. Prefer `npx -y @nanonets/graft mcp <abs-repo>` only
if a stable `npx` is on the GUI process's PATH (it usually is not). Name entries per
repo (`graft-ai-workspace`, `graft-co-newbiz`, …); the fleet-wide registry is not
recommended for a single global file.

## Verification

```bash
cd <repo>
bunx @nanonets/graft check     # index freshness (manual — no CI gate by decision, ADR-0074 D8)
grep -c graft CLAUDE.md GEMINI.md AGENTS.md
```

In Claude Code, `graft` MCP tools appear as `graft_find_code`, `graft_find_all`,
`graft_trace_calls`, `graft_file_api`, `graft_repo_map`, `graft_check_freshness`.
