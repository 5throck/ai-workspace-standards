# regenerate-agents-md L3 Mode — Prune Undelivered §6 Skill Rows

| Field | Value |
|-------|-------|
| Date | 2026-09-26 |
| Status | implemented |
| Spec ID | `regen-agents-md-l3-skill-prune` |
| Governing anchor | ADR-0031 (L1/L2 fork model); l2_propagate contract (AGENTS.md §6) |
| Related | `scripts/regenerate-agents-md.ts` v1.2.0 → v1.3.0; found while normalizing `Projects/co-abap/AGENTS.md` (1,068 → 583 lines, 2026-09-26) |

## Problem

`regenerate-agents-md.ts --source <L3>` derives the AGENTS.md from `templates/common/AGENTS.md`
verbatim, and the L1 §6 skills table includes L0-only skills (`l2_propagate: false` —
create-variant, promote-variant, simulate-pipeline) that are never delivered to a project.
Every regenerated L3 AGENTS.md therefore carried stale §6 rows, and the project audit failed
with 6 `stale §6 skill-table path` findings (`skills/create-variant/` etc. do not exist in a
project context). Worked around by hand in `Projects/co-abap` (PR 5throck/co-abap#157); the
defect resurfaced on every future regeneration and for every fleet project.

## Change

New `pruneUndeliveredSkillRows()` applied in `regenerateSource()` only (v1.3.0): after block
injection, drop §6 table rows whose second cell is a `skills/<dir>/` path (pipe-delimited
table row with the skill dir backticked) — whose
`skills/<dir>/SKILL.md` does not exist under the L3 source. This generalizes beyond the three
known rows — any future L0-only skill is pruned automatically, and genuinely delivered rows are
untouchable.

`--variant` (L2) mode is deliberately unchanged: an L2 template ships the superset table by
design (WS-07 keeps `skills/SKILLS.md` out of variants, but the §6 table is template content);
the scaffold (`new-project.ts` workspace-only sweep) and the upgrade engine own the
project-level table state.

## Verification

| Check | Expected |
|-------|----------|
| `bun scripts/regenerate-agents-md.ts --source Projects/co-abap` | output byte-identical to the hand-pruned file (empty git diff) |
| pruned rows in regenerated L3 AGENTS.md | 0 hits for create-variant / promote-variant / simulate-pipeline |
| `bun scripts/test-runner.ts scripts` | 7/7 test files pass |
| `scripts/SCRIPTS.md` | regenerate-agents-md row 1.2.0 → 1.3.0 |
