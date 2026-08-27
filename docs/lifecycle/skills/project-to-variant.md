# project-to-variant — Skill Lifecycle

## Phase History

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| Phase A | Accepted | 2026-07-31 | Registered in SKILLS.md; frontmatter standardized to metadata.triggers format |
| Phase B | — | — | Not yet promoted to variant template |

## Acceptance Criteria

- [x] SKILL.md exists in `skills/project-to-variant/`
- [x] Registered in `skills/SKILLS.md` Workspace Skills table
- [x] Frontmatter follows standard format (`metadata.triggers:`)
- [x] `last_reviewed` field present
- [x] Lifecycle doc created (`docs/lifecycle/skills/project-to-variant.md`)

## Variant Readiness Gate (enforced)

`scripts/project-to-variant.ts` runs **`scripts/validate-variant-readiness.ts`** after generating
the variant. The lightweight pipeline **blocks** (exit 1) if the gate reports any blocking error —
unless invoked with `--force`. This prevents an improperly variant-ized template from being
reflected.

The generator also:
- scans `agents/` **recursively** and emits the real nested `file` paths, and
- emits `promotionChecklist: "PROMOTION_CHECKLIST.md"` and creates a starter `PROMOTION_CHECKLIST.md`.

See [`docs/designs/variant-readiness-gate.md`](../../../docs/designs/variant-readiness-gate.md).
