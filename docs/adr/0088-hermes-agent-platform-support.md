---
status: Accepted
date: 2026-09-25
author: PM
---

# ADR-0088: NousResearch Hermes Agent as a Fifth Platform Directory — `.hermes/` Mirror, Native AGENTS.md Entry, No Twin

## Context

The workspace supports 6 AI surfaces across 4 platform directories: `.claude/` (Claude Code CLI + Desktop App), `.gemini/` (Gemini CLI), `.agents/` (Antigravity IDE/CLI), and `.codex/` (Codex CLI + Desktop App, ADR-0077). Skills flow from the SSOT `skills/` through `scripts/sync-skills.ts` to all four mirrors; instruction files follow the twin + neutral-registry model (`CLAUDE.md` ↔ `GEMINI.md` ↔ `CODEX.md`, with `AGENTS.md` as the neutral SSOT).

Requirement (user, 2026-09-24): projects scaffolded from `templates/co-*` should interoperate with **Hermes Agent** (NousResearch/hermes-agent) — a model-agnostic, open-source CLI/personal agent harness. A source-level verification spike (commit `59004a6`, 2026-09-24) established: (1) Hermes' SKILL.md frontmatter parser preserves unknown keys and gates on absent-by-default fields — workspace extension frontmatter is inert; (2) Hermes discovers project-local skills at `<git-root>/.hermes/skills` (primary) and `<git-root>/.agents/skills` (also scanned), gated by the user-side `skills.trusted_project_dirs` trust list; (3) Hermes loads `AGENTS.md` natively as its project instruction file (chain: `HERMES.md` → `AGENTS.md` → `CLAUDE.md` → `.cursorrules`, first-found-wins); (4) skill discovery is a directory scan with no manifest.

## Decision

1. **One directory, one surface**: `.hermes/` = `skills/` mirror only — surfaces 6 → 7, platform directories 4 → 5. Strictly additive: no existing target, skill, or validator behavior changes.
2. **No instruction twin (divergence from ADR-0077 D2, deliberate)**: Hermes reads `AGENTS.md` natively; a `HERMES.md` twin would shadow AGENTS.md in Hermes' first-found-wins context chain and fork the instruction SSOT. The AGENTS.md header pointer line is extended instead: Hermes Agent reads AGENTS.md itself. **Pointer-follow verified at source level; no annex fallback needed.**
3. **Skills mirror the SSOT; never point Hermes at `skills/` directly** (ADR-0077 D3 carried over): `sync-skills.ts` gains a 5th target so B-03 security-gate exclusion and country/variant-scoped pruning stay on one governance code path.
4. **No commands/prompts mirror** (divergence from ADR-0077 D4, verified): Hermes invokes skills natively as `/<skill-name>`; no Phase-1b analog exists to mirror.
5. **No registration file, no model-registry entry**: discovery is a directory `rglob` (no `skills.json`); Hermes is model-agnostic, so `docs/workspace-schema.json models` gains no key and agent `tier:` frontmatter is untouched.
6. **Fleet delivery ordering**: `.hermes/skills/**` resolves to SYNC in `upgrade-policy.ts` before any blanket `.hermes/**` ADD_IF_MISSING claim (ADR-0076/ADR-0077 incident class), and `.hermes` joins `KNOWN_TOP_DIRS` plus the mirror-sweep lists.
7. **`trusted_project_dirs` documented, never bypassed**: project skills auto-load in Hermes only for trusted project roots; onboarding docs carry the setup step. This is Hermes' prompt-injection defense and stays user-owned.
8. **Validators incremental**: `PLATFORM_MIRROR_DIRS` += `.hermes/skills` (auto-extends template freshness + variant-mirror-parity to all 14 templates); `verify-platform-lifecycle.ts` stays pair-based (existing `.codex` gap) and is ticketed, not silently extended.

## Consequences

- **Positive**: co-* scaffolded projects gain a first-class Hermes integration from scaffold time with zero skill rewrites — skills remain platform-neutral markdown served identically to all five mirrors; the existing four surfaces are byte-for-byte unaffected; baseline compatibility already existed via `.agents/skills` and now becomes governed and primary-path.
- **Cost**: a fifth mirror copy (disk + drift surface) — absorbed by the existing idempotent pipeline and now watched by the freshness validator; N-platform constant refactor remains deferred (second consecutive deferral — tracked in the follow-up ticket with `verify-platform-lifecycle.ts` generalization).
- **Neutral**: `--platform hermes` joins the scaffold profiles; `all` includes `.hermes/`; existing fleet repos receive `.hermes/` on their next routine `upgrade-project` run (no dedicated rollout — `.agents/skills` already provides a working fallback).

## References

- Design: `docs/designs/2026-09-25-hermes-agent-platform-support-design.md` (spike evidence F1–F4, layer distribution matrix, D1–D8, waves W1–W4, verification §7)
- ADR-0077 (Codex platform support — delivery pattern and deferred-refactor lineage), ADR-0076 (fleet-mirror-update incident class), ADR-0035/ADR-0048 (AGENTS.md structure/SSOT)
- Spike: `NousResearch/hermes-agent` @ `59004a62356f3a4697ab0fe8ad5086d2b405e2a6` — `agent/skill_utils.py` (`parse_frontmatter`, `PROJECT_SKILLS_SUBDIRS`), `agent/prompt_builder.py` (`build_context_files_prompt`)
- CONSTITUTION §6, §10, §11 — prose counts updated in W3 ("6 supported surfaces on 4 platform directories" → 7/5)
