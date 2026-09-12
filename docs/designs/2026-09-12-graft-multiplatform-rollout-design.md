# Design: Graft Multi-Platform Rollout — root cleanup, template parity, fleet delivery

- **Spec ID**: 2026-09-12-graft-multiplatform-rollout
- **Date**: 2026-09-12
- **Status**: approved (plan v2, user-approved 2026-09-12)
- **Owners**: architect (design), automation-engineer (scripts/settings), docs-writer (docs/skills)
- **Affected artifacts**: `.mcp.json`, `opencode.json`, `.claude/skills/graft/SKILL.md` (root + template copies), `docs/VERSION_MANIFEST.md`, `docs/templates/common-contract.json`, `templates/common/**` (8 surfaces), `scripts/lib/upgrade-policy.ts`, `scripts/upgrade-project.ts`, `scripts/create-l3-scaffold.ts`, `scripts/new-project.ts`, `skills/create-variant/SKILL.md`, `scripts/validate-templates.ts`

## 1. Problem

graft (repo context graph, `@nanonets/graft`) has been running at the workspace root (L0) since 2026-09-06, but only for Claude Code, and only by hand:

- **Templates (L1) ship a fraction of the surface**: `templates/common` carries the graft SKILL.md (hand-placed) and the `.gemini/settings.json` MCP entry — and nothing else. A newly scaffolded project gets graft MCP for Gemini CLI/Antigravity only; Claude Code in that project has no graft source at all (no `.mcp.json`, no hooks, no helpers).
- **The existing fleet (11 `Projects/co-*` repos) has effectively zero graft**: no skill, no helpers, no MCP entries except a stale `npx` launcher in co-architect's `.gemini/settings.json`. Root cause (verified against `upgrade-policy.ts`): `.claude/skills/**` is claimed by the `sync-skills.ts (platform mirror)` rule and graft is not in the SSOT `skills/`, so no pass ever delivered it; root-level `.mcp.json`/`opencode.json` didn't exist in the template at all.
- **Launcher drift**: the same MCP server is launched three ways — `npx` (root `.mcp.json`, `opencode.json`), `bunx` (`.gemini/settings.json`, switched 2026-09-12 commit `70f0878c`), and the native `graft` binary (machine-global `~/.codex/config.toml`, local install v0.16.0 vs npm v0.18.0).
- **Host coverage is implicit**: Codex works today only because the user's machine-global `~/.codex/config.toml` happens to register graft; Antigravity's global registry and Claude Desktop are unconfigured/undocumented.

## 2. Goals

1. graft works on **Codex, Claude Code, Claude Desktop App, Antigravity (IDE/CLI), Gemini CLI, and OpenCode** — repo-level where the host supports it, machine-global where it does not.
2. **New projects get the full surface automatically** at scaffold time (both `create-l3-scaffold.ts` and `new-project.ts` flows), including a first `graft build`.
3. **Existing 11 projects receive the surface through the standard upgrade channel** (`upgrade-project.ts`), with project-owned MCP servers preserved.
4. One committed launcher standard; no behavior change for existing upgrade passes.

## 3. Non-goals

- Moving the graft skill into the SSOT `skills/` (sync-skills would mirror it to `.gemini/skills` + `.agents/skills`, breaking the claude-only design pinned by the C-CM-05 exception in `validate-templates.ts`).
- CI freshness gating (`graft check`) — user decision 2026-09-12: keep manual. Graft tools self-refresh before answering, so the graph is effectively fresh without a gate.
- ~~Rolling graft into `templates/co-*` variant templates by hand~~ **Superseded during implementation**: the 13 variant templates own `.claude/settings.json`/`.gemini/settings.json` (variant wins in the effective tree), so `templates/common`-only settings changes never reach the 9 fleet projects that pair with a variant template. All 13 L2 templates received the same graft additions via merge-preserving injection (`mergeSettingsJson` — variant-only keys such as co-price's `pricing-sim` MCP server survive), the WORKSPACE-MANAGED graft block in their `AGENTS.md`, and `/graft/` in their `.gitignore`. Variant `CLAUDE.md`/`GEMINI.md` are mostly absent — the MERGE pass's common fallback delivers the block for those.
- Per-repo Claude Desktop entries for the whole fleet — the Desktop config is one machine-global file; document the snippet, register frequently-used repos only.

## 4. Decisions

### D1 — Per-host surface matrix

| Host | Instructions | MCP registration | Scope |
|---|---|---|---|
| Claude Code | `CLAUDE.md` graft block | repo `.mcp.json` + hooks/statusline/helpers | repo |
| Gemini CLI | `GEMINI.md` graft block | repo `.gemini/settings.json` `mcpServers.graft` | repo |
| Antigravity IDE | `GEMINI.md` (shared file, ADR-0021) | repo `.gemini/settings.json` (shared) + machine-global `~/.gemini/config/mcp_config.json` via `graft init --agents antigravity` | repo + global |
| Antigravity CLI | `AGENTS.md`/`GEMINI.md` graft blocks | machine-global registry (same as IDE) | global |
| Codex | `AGENTS.md` graft block (Codex's native entrypoint) | repo `.codex/config.toml` `[mcp_servers.graft]` (precedent: co-abap, co-safety) + machine-global `~/.codex/config.toml` (already registered on this machine) | repo + global |
| Claude Desktop App | — | machine-global `claude_desktop_config.json` with **absolute repo path**: `{"command":"<abs>/graft","args":["mcp","/abs/repo"]}` (graft resolves its root from cwd; the Desktop host cannot set cwd, GUI launch has no nvm PATH) | global, hand-written |
| OpenCode | `AGENTS.md` graft block | repo `opencode.json` `mcp.graft` | repo |

`graft mcp [dir]` accepts the repo root as a positional argument (default: nearest ancestor with a `graft/` index) — cwd-less hosts MUST pass the path.

### D2 — Launcher standard: `bunx` for everything committed

Every committed MCP registration uses `bunx @nanonets/graft mcp` (Bun is the workspace standard runtime; verified 2026-09-12, commit `70f0878c`). Machine-global configs may use the native binary. Root `.mcp.json` and `opencode.json` are switched `npx` → `bunx` in the same change. The local global install should be upgraded to npm latest (0.16.0 → 0.18.0) as machine maintenance.

### D3 — Template (L1) graft surface (8 changes to `templates/common`)

1. `.mcp.json` — new, graft entry only.
2. `opencode.json` — new, graft entry only.
3. `.codex/config.toml` — new, `[mcp_servers.graft]` only (project entries never overwritten — D4).
4. `.claude/settings.json` — graft permission lines (`Bash(graft:*)`, `Bash(npx graft:*)`, `Bash(graft-dev:*)`, `Bash(node dist/cli.js:*)`), 5 hook blocks (post-edit, tool-savings, session-start, prompt, stop), `statusLine`, `subagentStatusLine`, `footerLinksRegexes` — mirroring root `.claude/settings.json`.
5. `.claude/helpers/graft-hooks.cjs` + `graft-statusline.cjs` — copied from root.
6. `CLAUDE.md` / `GEMINI.md` / `AGENTS.md` — the `<!-- graft:start/end -->` instruction block, each wrapped in a `<!-- WORKSPACE-MANAGED: graft repo context graph -->` block so the upgrade MERGE pass delivers it (blocks absent from a project file are appended, `mergeWorkspaceManaged` semantics).
7. `.gitignore` — `/graft/` added **inside** the existing WORKSPACE-MANAGED block (merge-managed, so existing projects receive it).
8. `docs/templates/common-contract.json` — new `.claude/settings.json` keys registered `claude_only` (`hooks.UserPromptSubmit`, `hooks.Stop`, `statusLine`, `subagentStatusLine`, `footerLinksRegexes`).

### D4 — Fleet delivery via upgrade-policy classifications

`scripts/lib/upgrade-policy.ts`:

- `JSON_MERGE_FILES` += `.mcp.json`, `opencode.json` — deep merge preserves co-newbiz/co-safety/co-abap domain MCP servers (objects recurse, project-only keys preserved).
- `.claude/skills/graft/**` → `SYNC` via `TEMPLATE TREE SYNC`, special-cased **before** the platform-mirror rule — the skill is hand-maintained outside the SSOT, so `sync-skills.ts` can never deliver it (this is the verified root cause of the fleet gap).
- `.codex/**` → `ADD_IF_MISSING` via `TEMPLATE TREE SYNC` — co-abap/co-safety own their `config.toml` (project MCP + codex hooks); their graft section is added by a one-time TOML edit, not a file overwrite.
- `scripts/upgrade-project.ts` tree-sync loop gains an `ADD_IF_MISSING` branch (seed-only semantics, matching the PROCEDURES pass).

Doc blocks and `.gitignore` need no new code — they ride the existing MERGE pass once wrapped in managed markers (D3.6/3.7).

### D5 — Scaffold integration

- `create-l3-scaffold.ts`: new non-fatal Step 8.5 between `bunInstall()` and the post-scaffold audit — `bunx @nanonets/graft build` in the project (try/catch, same pattern as the audit step); AGENTS.md generation appends the graft block extracted from `templates/common/AGENTS.md` via the existing marker-extraction pattern (same as the COMMON-AGENTS block).
- `new-project.ts`: the same non-fatal graft-build post-step (files flow from the template tree automatically).
- `skills/create-variant/SKILL.md`: document the automatic graft step, add graft presence to the verification checklist, and note the AGENTS.md graft block.

### D6 — Skill stays hand-maintained; drift check added

The graft SKILL.md exists as exactly two copies (root `.claude/skills/graft/`, `templates/common/.claude/skills/graft/`), byte-identical, outside the SSOT. `validate-templates.ts` C-CM-05 gains an anti-drift comparison of the two copies (fails when they diverge), alongside the existing anti-rot existence check. `triggers` metadata is added to fix the VERSION_MANIFEST warning, and the "covers: spans" prose is corrected to describe the actual card format (signature bullets with line spans).

### D7 — Machine-local host setup (documented, never committed)

- Codex global: already registered (`~/.codex/config.toml`); upgrade the binary.
- Antigravity: run `graft init --agents antigravity` once (writes the machine-global registry; the exact path is owned by the installed graft version — never hand-code it in the repo).
- Claude Desktop: snippet in the platform guide; absolute graft binary path + absolute repo root per entry.

### D8 — Freshness: manual (user decision)

No CI/pre-push gate. Graft tools self-refresh before answering; `graft check` remains a manual command.

## 5. Accessibility & Preview (ADR-0065 / ADR-0070)

Non-UI work (config files, CLI scripts, documentation). **Accessibility: exempt** — no user-facing interface is created or modified. **Preview verification: exempt** — no rendered UI; verification is script/audit-based (§6).

## 6. Verification

1. `bun scripts/validate-templates.ts all` — no new errors/warnings.
2. `bun scripts/check-upgrade-coverage.ts` — classification matrix clean for the new surfaces.
3. `bun scripts/simulate-pipeline.ts --mode project-creation` (or equivalent disposable scaffold) — new project contains the full graft surface and `graft build` produced an index.
4. `upgrade-project.ts --dry-run` on co-newbiz (existing `.mcp.json` merge) and co-architect (stale npx launcher) — expected delivery list, no project-owned key loss.
5. Pilot rollout on the two pilot projects, then the remaining 9 (separate PRs in each project repo via the project-resync channel).

## 7. Trade-offs

- **SYNC overwrite risk vs ADD_IF_MISSING conservatism**: `.codex/config.toml` is seed-only, so future template-side graft config changes would not reach projects that already have the file — accepted; the file is per-project by nature (project MCP servers + codex hooks) and fleet-wide TOML merging is not worth the engine complexity for 1 section.
- **Hand-maintained skill copies** carry drift risk — mitigated by the D6 byte-equality check.
- **Claude Desktop remains manual** — a global config file cannot be committed per-repo; documented instead of automated.
