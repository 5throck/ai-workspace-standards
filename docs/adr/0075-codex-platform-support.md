---
status: Accepted
date: 2026-09-12
author: PM
---

# ADR-0075: OpenAI Codex as a Fourth Platform Directory — CODEX.md Twin, `.codex/` Mirror Delivery, Dual-Surface Coverage

## Context

The workspace supports 4 AI surfaces across 3 platform directories: `.claude/` (Claude Code CLI + Claude Desktop App), `.gemini/` (Gemini CLI), and `.agents/` (Antigravity IDE/CLI). Platform behavior is split between instruction twins (`CLAUDE.md` ↔ `GEMINI.md`, marker-managed) and a neutral registry (`AGENTS.md`). Codex already appears only as fragments: ADR-0074 seeded `templates/common/.codex/config.toml` as `ADD_IF_MISSING` for MCP, `rootAllowlist` pre-approves `.codex`, and the co-abap project runs a live `~/.codex`-style config (`[features] codex_hooks`, `[mcp_servers.*]`, `[[skills.config]]`).

Requirement (user, 2026-09-12): extend the ecosystem to **OpenAI Codex CLI and Codex Desktop App** — raising surfaces 4 → 6 and platform directories 3 → 4 — with full pipeline coverage (templates, new projects, existing fleet), keeping the security-gate and pruning governance on a single code path.

## Decision

1. **One directory, two surfaces** (mirroring how `.claude/` serves CLI + Desktop App): `.codex/` = `config.toml` + `skills/` + `prompts/`; machine-global `~/.codex/config.toml` stays the fallback for surfaces without project scope (ADR-0074 per-host matrix precedent).
2. **`CODEX.md` is the platform twin** (L0 + L1), built from the analyzed CLAUDE.md/GEMINI.md section skeleton with Codex substitutions — no native subagent tool (single-session PM execution), hook-free prompt self-enforcement (CONSTITUTION §11 Antigravity precedent), literal model IDs, `.codex/prompts/` command table, `COMMON-CODEX` marker domain joining the VA-05 marker-sync scheme. AGENTS.md gains the pointer line. **Pointer-follow is a live verification gate per surface; fallback promotes Codex-essential rules into an AGENTS.md annex.**
3. **Skills mirror the SSOT; never point Codex at `skills/` directly** (rejecting the co-abap direct-pointer pattern for the platform): `sync-skills.ts` gains a 4th target so B-03 security-gate exclusion and country/variant-scoped pruning apply unchanged.
4. **Fleet delivery fix**: `.codex/skills/**` and `.codex/prompts/**` resolve to TEMPLATE_TREE_SYNC *before* the blanket `.codex/**` ADD_IF_MISSING claim — otherwise fleet mirrors never receive updates (the same incident class ADR-0074 fixed for `.claude/skills/graft`).
5. **Model registry (user-confirmed)**: `models.codex = { high: gpt-5.6-sol, medium: gpt-5.6-terra, low: gpt-5.6-luna }`; companion update moves `gemini`/`antigravity`/`gemini-cli` medium/low to `gemini-3.8-flash` (the three keys stay in lockstep). Agent frontmatter gains `tier.codex` across all 8 root agents.
6. **Commands**: `.claude/commands/` mirrors to `.codex/prompts/`, gated on CLI verification; if unsupported, codex is commands-parity-exempt (gateguard/.agents precedent). **Hooks**: deferred to optional Phase 2 (CLI-only `.codex/hooks.json`); Phase 1 documents prompt self-enforcement.
7. **ADR-0021 amended**: codex classification added to `platform_settings`; TOML config is excluded from the VA-04 JSON parity loop in favor of a dedicated parse + required-blocks check.
8. **Fleet & template distribution guarantee (D11 amendment)**: model-ID literals live only inside the managed marker sections of CLAUDE.md / GEMINI.md / CODEX.md / AGENTS.md plus the `workspace-schema.json` SSOT, so registry changes propagate the existing chain automatically (governance-l1 L0→L1 → COMMON-AGENTS injection L1→L2 → MERGE/SYNC passes L3). W2 relocates today's outside-marker mappings (GEMINI §3, CLAUDE §6, AGENTS §3.6) and wires `--governance-l1` into dev-sync, adding CODEX.md to its file list (correcting the original propagation-map assumption); W3 adds a P-01 regression check that FAILs on model literals outside managed sections; W5 rolls out per project repo (T-20260912-002 pattern) with a `templates/**` + `Projects/**` grep post-check. Agent files stay Fork-Model (ADR-0043) — refreshed by the W2 manual sweep, deliberately not mechanized.

## Consequences

- **Positive**: Codex users get the full workspace contract (PM Gateway, skills, prompts, MCP) from scaffold time and across the fleet with no governance bypass; the twin/marker model extends cleanly (`COMMON-CODEX`) instead of forking; the fleet-mirror-update gap is closed at the engine level before rollout.
- **Cost**: three new mirror copies of skills/prompts (disk + drift surface) — absorbed by the existing idempotent sync pipeline; validator work stays pair-based in this effort (N-platform constant refactor deferred to a follow-up governance ticket); pointer-follow risk on Desktop App handled by the annex fallback. Relocating model mappings into managed sections means future model changes intentionally overwrite those sections in projects (conflict-warned) — that is the distribution mechanism working; project-owned files with model literals (hand-added `.env.sample` keys, project configs) are out of delivery scope and surfaced by the W5 post-check.
- **Neutral**: `both` platform-profile value keeps its legacy meaning (claude+antigravity); `codex` joins as a new profile value; `.agents/` scaffold-overlay exclusion is left as-is and noted for the follow-up ticket.

## References

- Design: `docs/designs/2026-09-12-codex-platform-support-design.md` (§4 section-parity analysis, §5 layer distribution matrix, D1–D10, waves W1–W5, verification §8)
- ADR-0074 (graft fleet — `.codex/config.toml` seed, ADD_IF_MISSING, per-host matrix), ADR-0021 (settings parity, amended), ADR-0035/ADR-0048 (AGENTS.md structure/SSOT)
- CONSTITUTION §6, §10, §11 — prose counts to update in W2 ("all three platform directories", "all 4 supported platforms")
- Live precedent: `Projects/co-abap/.codex/config.toml`, `templates/co-abap/AGENTS.md`
