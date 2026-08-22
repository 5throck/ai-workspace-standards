# Agent Governance Record — pm

## Overview

- **Agent Name**: pm
- **Role**: Project Manager (PM) Agent — variant override extending the workspace PM template
- **Phase**: production
- **Variant**: co-hr

## Phase History

- **2026-08-22**: Initial release — scaffolded by `create-l3-scaffold.ts`.

## Acceptance Criteria

- [x] Defined in `agents/pm.md`
- [x] Uses the `extends` pattern (ADR-0033) rather than duplicating the workspace PM
- [x] Carries `lifecycle` frontmatter with `phase` and `governance`
- [x] Validated by `scripts/validate-agents.ts`
- [ ] TODO: variant_overrides filled in (governance workflow, agent roster, dispatch protocol)
