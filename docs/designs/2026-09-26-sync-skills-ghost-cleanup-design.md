# sync-skills 1.10.0 — Remove Ghost Platform Skill Mirrors in Project Contexts

| Field | Value |
|-------|-------|
| Date | 2026-09-26 |
| Status | implemented (amended 2026-10-01 — see Amendment) |
| Spec ID | `sync-skills-ghost-cleanup` |
| Governing anchor | ADR-0077 (platform mirrors); Fork Model delivery contract (ADR-0031) |
| Related | `scripts/sync-skills.ts` 1.9.0 → 1.10.0 (Phase 1c); found via the 2026-09-26 fresh-scaffold drift comparison |

## Problem

Platform skill mirrors were distributed SSOT→platform (Phase 1) but never pruned in the reverse
direction: a platform skill directory whose `skills/<name>/` SSOT counterpart no longer exists
stays forever and drifts per-project. Observed inconsistency (2026-09-26 comparison of
`Projects/e2e-co-abap` vs `Projects/co-abap`): fresh scaffolds carried workspace-process skills
(upgrade-project, project-to-variant, variant-feature) as platform mirrors in 4 of 5 platforms,
while the older project kept them only as `.codex` ghosts — plus a `graft` ghost in
`.claude/skills/` — with no SSOT counterpart anywhere.

## Change

New Phase 1c in `sync-skills.ts` (1.9.0 → 1.10.0): after SSOT distribution, any platform skill
directory (all 5 platforms) with no `skills/` SSOT counterpart is removed, with one log line per
removal. Gated to **project contexts only** (`.claude/template-version.txt` present): the
workspace root is the one place platform-only skill directories are legitimate
(AGENTS.md §6 — platform-specific skills live in `.claude/skills/`/`.gemini/skills/`).

Policy: a project's platform mirrors mirror its skills/ SSOT exactly. If the fleet later wants
workspace-process skills available in projects, they belong in the project skills/ SSOT
(delivery), and the mirrors follow — not the other way around.

## Verification

| Check | Expected |
|-------|----------|
| `sync-skills --dir Projects/co-abap` | removes `.codex/skills/{upgrade-project,project-to-variant,variant-feature}` + `.claude/skills/graft` (4 removals, logged) |
| second run | `No ghost platform mirrors found` (idempotent) |
| workspace-root run | Phase 1c skipped (no project marker) |
| `Projects/co-abap` audit after regenerating skill-graph + VERSION_MANIFEST | all checks passed |

## Amendment (2026-10-01) — provenance-based sweep; user-added skills are never removed

**Problem.** The Phase 1c rule above ("a project's platform mirrors mirror its skills/ SSOT exactly") deleted *any*
platform skill directory without a `skills/` counterpart — including skills a project's user added on purpose
(e.g. a `.claude/skills/<name>/` created after scaffolding) and `graft`. It also ran before Phase 2, so it
pre-empted the `.agents`-only back-sync. Requirement: a skill the user added must not be removed without an
explicit request.

**Change (sync-skills 1.11.0).** Ownership is provenance, not absence from the SSOT:

- sync-skills records the skills it mirrors in `skills/.sync-skills-managed.json` (project contexts only).
- Phase 1c removes a platform mirror only when its name is in that record **and** its `skills/` SSOT skill no
  longer exists (a retired workspace skill).
- Anything never mirrored by the tool is kept. With no manifest (first run after this change, fresh clone) or an
  unreadable one, nothing is removed — the failure mode is conservative.
- Legacy workspace-process ghosts in older projects are not Phase 1c's job: `upgrade-project`'s
  WORKSPACE-ONLY SKILL SWEEP removes stock copies and surfaces CONFLICTs for modified ones.

**Verified-safe other paths.** country/variant PRUNE (registry names, CONFLICT/KEEP), `--prune-removed`
(explicit flag), retired-skill PRUNE (explicit `status: retired|deprecated`), WORKSPACE-ONLY SWEEP (stock only).
Phase 1c was the only unguarded removal of unknown skills.

**Verification.** `tests/unit/sync-skills.test.ts` — "user-added platform skills are never removed" block
(survives repeated syncs; `.agents`-only back-sync; no-manifest keep; retired removal; corrupt manifest; workspace root).
