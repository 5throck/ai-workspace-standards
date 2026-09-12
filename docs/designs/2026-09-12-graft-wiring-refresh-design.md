# graft 0.18.0 Agent Wiring Refresh — Single-Install Alignment & Tool-Managed Skill Exception

- **Date**: 2026-09-12
- **Status**: Implemented (maintenance refresh; no code changes)
- **Related**: ADR-0076 (graft multi-platform fleet rollout — introduced the committed wiring), ADR-0077 (Codex platform support — `.codex` MCP seed precedent)
- **Scope**: Tool-generated configuration reconciliation only. No scripts, templates, or schemas are modified.

---

## 1. Background

The graft fleet rollout (ADR-0076) committed graft 0.16.0-generated agent wiring: `.mcp.json`, `.gemini/settings.json`, `opencode.json`, `.claude/helpers/graft-{hooks,statusline}.cjs`, and `.claude/skills/graft/SKILL.md`. Two divergent execution paths then emerged:

| Path | Version | Trigger |
|---|---|---|
| Local CLI (`graft`) | 0.16.0 (npm global, later shadowed by bun global 0.18.0) | `graft ask/build/...` run by agents |
| graft MCP server | latest at launch (0.18.0) via `bunx`/`npx` | Claude/Gemini/Opencode session start |

The graft MCP server refreshes agent wiring whenever it starts on a newer version than what wrote the current wiring. This produced recurring uncommitted churn in exactly those 6 files after every graft release — including one refresh that baked a **bunx temp-cache path** (`AppData\Local\Temp\bunx-*/…`) into the helper shims, which breaks when bunx prunes its cache. Separately, graft 0.18.0's regenerated `SKILL.md` dropped the workspace-added frontmatter (`version`, `metadata.triggers`), re-litigating the fleet rollout's customization on every release.

## 2. Decisions

1. **Single graft install; CLI and MCP versions aligned.** The npm-global graft (0.16.0, which shadowed bun's install on PATH) was removed; the bun-global install (`~/.bun/bin/graft`, 0.18.0) is the one canonical graft on this machine. `bun install -g @nanonets/graft@latest` is the supported upgrade path; `graft upgrade` is acceptable.
2. **graft's canonical MCP launcher accepted.** All three MCP configs now carry `graft mcp` (plain PATH resolution) instead of `bunx`/`npx -y`. This removes the per-launch package-cache resolution that caused the temp-path regression and guarantees MCP runs the same version as the CLI.
3. **`SKILL.md` is tool-owned; workspace frontmatter additions deprecated for this one skill.** graft regenerates `.claude/skills/graft/SKILL.md` on every version bump, so any manually re-added `version:`/`metadata.triggers` is guaranteed future churn. graft's canonical frontmatter (`name`, `description`) is sufficient: `bun scripts/validate-skills.ts` passes (0 errors) without the extra fields, and the skill has no `skills.json` registry entry whose triggers depend on them. The fleet rollout's added frontmatter is intentionally not restored.
4. **Copilot wiring excluded.** graft 0.18.0 newly detects `copilot` and would create `.github/copilot-instructions.md`. The workspace platform set is Claude/Gemini/Codex/Antigravity (ADR-0075/0077); adding a fifth surface is out of scope and left to a future decision.

## 3. Refresh Runbook (post-graft-upgrade)

```bash
bun install -g @nanonets/graft@latest   # or: graft upgrade
graft init --agents claude agents gemini antigravity --no-global
git diff                                 # expect only graft-managed files
# commit via /sync: "chore(graft): refresh graft <version> agent wiring"
```

`--no-global` keeps machine-level wiring (`~/.codex`, `~/.claude`, `~/.gemini`) untouched by repo work; copilot is omitted until a decision adopts it.

## 4. Alternatives Considered

- **Pin the MCP server to an exact version** (`@nanonets/graft@0.18.0`) — rejected: reintroduces CLI/MCP drift and stalls security fixes behind a manual bump.
- **Re-attach workspace frontmatter after each refresh** — rejected: guaranteed recurring churn with no consumer; validator does not require it.
- **Commit the earlier `npx -y` state** — rejected: superseded by graft's own canonical `graft mcp` form; `npx` was an intermediate 0.18.0 write observed before single-install alignment.

## 5. Verification

- `graft --version` → 0.18.0 (single PATH hit, bun global)
- `bun scripts/validate-skills.ts` → 0 errors / 0 warnings (77 files)
- `bun scripts/audit.ts` → all checks passed (including platform parity and skill-graph drift gate)
- `graft init --agents … --no-global` re-run produces no further changes (churn loop closed)
