# sync-skills 1.10.0 — Remove Ghost Platform Skill Mirrors in Project Contexts

| Field | Value |
|-------|-------|
| Date | 2026-09-26 |
| Status | implemented |
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
