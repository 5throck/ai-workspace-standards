---
lang: ko
lang_reason: source-material
---

# Design: co-architect Identity Separation from Origin Template co-work

- **Date**: 2026-08-29
- **Status**: Implemented
- **Decision**: user (2026-08-29) — "co-architect는 co-work에서 파생되었지만, co-architect로 구분해서 관리가 되어야 한다."

## Context

`Projects/co-architect` was scaffolded from `templates/co-work/` (v0.5.3) and
has since diverged into an architecture-domain team (34 skills vs co-work
template's 2; own 24-agent roster, 4 procedures, own PROMOTION_CHECKLIST
declaring "Variant: co-architect"). Its identity metadata, however, still
pointed at co-work, causing co-work's variant-specific template assets to be
re-inherited on every upgrade and its documents to self-describe as co-work.

## Decision

Manage the project as a **distinct variant `co-architect`**, keeping only a
provenance record of its origin:

| Item | Change |
|------|--------|
| `.claude/template-version.txt` | `variant=co-work` → `variant=co-architect` |
| `variant.json` | new `derivedFrom` field recording the co-work origin and the separation date |
| `procedures/*.yaml` + `_output-types.yaml` | `procedure_id` / `variant` / step targets renamed `co-work-*` → `co-architect-*` |
| `docs/phase-definitions.md` | self-description co-work → co-architect |
| `docs/co-work.context.md` | deleted (placeholder template copy; superseded by `docs/co-architect.context.md`) |
| `skills/*/SKILL.md` (`scope:`) + prose mentions | co-work → co-architect where they self-describe |
| Upgrade tooling | `upgrade-project.ts` 1.17.0: self-declared variant without a template dir upgrades in **common-only mode** |

Not changed: historical records (CHANGELOG, memory logs, docs/superpowers
plans, `docs/context.md` version footer) — they document what was true at the
time. `skills/project-review` SKILL.md's generic variant list keeps co-work as
an example of the workspace's variants.

## Constraints honored

- **Promotion hold stays** (`variant.json promotionHold`): distinct management
  is an identity decision, NOT approval to create `templates/co-architect/`.
- Until that template exists, upgrades run in common-only mode: co-work's
  variant-specific assets are no longer pulled in (which is the point), and
  co-work's own future changes do not leak here.

## Verification

- `bun scripts/generate-skill-graph.ts` + `verify-skill-graph.ts`: pass
  (69 nodes / 50 edges; 4 procedures with renamed ids, invariants OK).
- `bun scripts/audit.ts`, `audit-variant.ts` (5/5): pass.
- `upgrade-project.ts --dry-run`: auto-detects `co-architect`, runs
  common-only mode, completes cleanly.
