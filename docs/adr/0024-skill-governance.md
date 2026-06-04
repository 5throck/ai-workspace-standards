---
status: Accepted
date: 2026-06-04
author: architect, automation-engineer
---

# ADR-0024: Skill Governance — scope Field and publish-to-template Filtering

## Context

All skills in `skills/` were blindly copied to `templates/common/skills/` by `publish-to-template.ts`. This caused workspace-only skills (e.g., `simulate-project-creation`) to leak into L2 projects generated from those templates — exposing workspace management tooling to end-user projects where it has no place.

`validate-templates.ts` compensated with a hardcoded `SKILLS_FORBIDDEN_IN_COMMON` list (Check B-07), but that list was fragile: it lived only in the validator, was not shared with `publish-to-template.ts`, and required manual updates whenever a new workspace-only skill was added.

Additionally, `SCRIPTS.md` was not propagated from the L1 common template (`templates/common/scripts/`) to variant L2 directories (`templates/co-*/scripts/`). Each time a script version was bumped, the L2 `SCRIPTS.md` files drifted until manually corrected, causing audit failures in downstream projects.

## Decision

1. **Introduce a required `scope` field in SKILL.md frontmatter** with three valid values:
   - `workspace` — skill is for workspace management only; never copied to any template
   - `common` — skill is suitable for all projects; copied to `templates/common/` and all L2 variants
   - `variant` — skill is specific to a particular variant; not copied to common template

2. **`publish-to-template.ts` reads `scope` before copying.** Skills with `scope: workspace` are skipped entirely. A missing `scope` field defaults to `common` with a console warning (transition safety net).

3. **`SCRIPTS.md` is explicitly propagated L1 → all `co-*` variant L2 directories** by `publish-to-template.ts` after the main `.ts` file propagation step, eliminating version drift.

4. **`validate-templates.ts` Check B-07 is replaced** with a dynamic frontmatter scan: instead of a hardcoded forbidden list, it reads each skill's `scope` field and flags any `scope: workspace` skill found inside `templates/`.

## Consequences

**Positive:**
- Workspace-only skills cannot leak into L2 projects — enforcement is at the source, not the validator
- Single source of truth for skill scope lives in the skill's own `SKILL.md` frontmatter
- Adding a new workspace-only skill requires only setting `scope: workspace`; no other files need updating
- `SCRIPTS.md` drift between L1 and variant L2 is eliminated by automated propagation

**Negative / Trade-offs:**
- All existing skills require a `scope` field migration; transition default is `common` to preserve existing behavior
- `skill-lifecycle-audit.ts` warns on missing `scope` — temporary noise during migration period
- `publish-to-template.ts` must parse YAML frontmatter, adding a dependency on frontmatter parsing logic

**Migration:**
- [ ] Add `scope` field to all skills in `skills/` (migration default: `common`; workspace-only skills get `scope: workspace`)
- [ ] Validate with `bun scripts/skill-lifecycle-audit.ts` — confirm zero missing-scope warnings
- [ ] Confirm `validate-templates.ts` Check B-07 passes without hardcoded list
