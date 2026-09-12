---
status: Accepted
date: 2026-09-12
author: PM
---

# ADR-0074: Graft as a Multi-Platform Fleet Surface — Committed Repo Config, Machine-Local Hosts

## Context

graft (`@nanonets/graft`) — the repo context graph that indexes each repository into `graft/` markdown cards plus a call-graph — has been in use at the workspace root since 2026-09-06, but only for Claude Code and only by hand. The 2026-09-12 fleet investigation established:

- **Templates (L1) ship a fraction of the surface.** `templates/common` carries the graft SKILL.md (hand-placed, commit `a3a65621`) and the `.gemini/settings.json` MCP entry (`70f0878c`). A scaffolded project gets graft MCP for Gemini CLI/Antigravity only; Claude Code in a fresh project has no graft source at all.
- **The 11-project fleet has effectively zero graft.** Root cause verified in `scripts/lib/upgrade-policy.ts`: `.claude/skills/**` is claimed by the `sync-skills.ts (platform mirror)` rule, and graft is deliberately not in the SSOT `skills/` — so no upgrade pass ever delivered it. Root-level `.mcp.json`/`opencode.json` did not exist in the template.
- **Launcher drift**: the same server is launched three ways (`npx` in root `.mcp.json`/`opencode.json`, `bunx` in `.gemini/settings.json`, native binary in machine-global `~/.codex/config.toml`).
- **Host coverage is implicit**: Codex works only because the machine-global Codex config happens to register graft. Antigravity's global registry is unconfigured; Claude Desktop is unsupported by `graft init` and undocumented.

Requirement (user, 2026-09-12): graft must work on **Codex, Claude Code, Claude Desktop App, Antigravity (IDE/CLI), Gemini CLI, and OpenCode**, in new projects from scaffold time and in the existing fleet.

## Decision

1. **Per-host delivery matrix** (design D1): repo-level MCP registration wherever the host supports project config (Claude Code `.mcp.json`, Gemini/Antigravity `.gemini/settings.json`, Codex `.codex/config.toml`, OpenCode `opencode.json`); instruction blocks in `AGENTS.md`/`CLAUDE.md`/`GEMINI.md` (Codex reads `AGENTS.md` natively); machine-global registration where the host has no project scope (Antigravity registry via `graft init --agents antigravity`, Codex global, Claude Desktop hand-written `claude_desktop_config.json` with an **absolute repo path** argument — `graft mcp [dir]` accepts the root; cwd-less hosts must pass it).
2. **`bunx @nanonets/graft mcp` is the one committed launcher** (D2). Machine-global configs may use the native binary. Root `npx` launchers are converted in the same change.
3. **The template (L1) is the distribution point** (D3): the full 8-surface graft config lands in `templates/common`; both scaffold flows (`create-l3-scaffold.ts`, `new-project.ts`) deliver it by construction, plus a non-fatal first `graft build`.
4. **The fleet is served by the upgrade engine, not by new passes** (D4, extending ADR-0073's deliver-by-default engine): `.mcp.json`/`opencode.json` join `JSON_MERGE_FILES` (project-owned MCP servers survive the union); `.claude/skills/graft/**` is special-cased to the TEMPLATE TREE SYNC pass before the platform-mirror rule (the skill is hand-maintained outside the SSOT, so `sync-skills.ts` can never deliver it — the verified fleet-gap root cause); `.codex/**` is `ADD_IF_MISSING` (co-abap/co-safety own their config); doc blocks and `.gitignore` ride the existing MERGE pass via `WORKSPACE-MANAGED` markers.
5. **The graft skill stays Claude-only and hand-maintained** (D6) — two byte-identical copies (root + `templates/common`), outside the SSOT `skills/`, preserving the C-CM-05 single-platform exception; a validate-templates anti-drift check pins the copies. Other platforms consume graft through MCP + instruction blocks, not skill files.
6. **Freshness stays manual** (D8, user decision 2026-09-12): graft tools self-refresh before answering; no CI or pre-push `graft check` gate.

## Consequences

- **Positive**: any repo (workspace, new scaffold, existing project) gets graft on every host the workspace targets; the "template has it but no project received it" incident class is closed at the engine level; project-owned MCP configs are structurally safe (JSON_MERGE union, ADD_IF_MISSING seeds).
- **Cost**: `.codex/config.toml` is seed-only — future template-side graft changes to that file do not reach projects that already own it (accepted: the file is per-project by nature). The hand-maintained skill copies carry drift risk (mitigated by the byte-equality check). Claude Desktop setup remains a manual, machine-local step.
- **Neutral**: files already owned by dedicated upgrade passes keep their behavior; `templates/co-*` variant templates are left to the reconcile pipeline.

## References

- Design: `docs/designs/2026-09-12-graft-multiplatform-rollout-design.md` (D1–D8, verification §6)
- ADR-0073 (policy-driven upgrade coverage — the engine this ADR extends), ADR-0021 (platform settings parity — `.gemini/settings.json` shared by Gemini CLI and Antigravity), ADR-0031 (L1/L2 fork model)
- C-CM-05 (`scripts/validate-templates.ts`) — graft claude-only exception + new anti-drift check
