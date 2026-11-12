# Agent Governance Record — contract-gate-engineer

## Overview

- **Agent Name**: contract-gate-engineer
- **Role**: Skill-owner agent — zod-contract-gate skill
- **Version**: 1.0.0
- **Phase**: production

## Phase History

- **2026-11-12**: Common agent established at version 1.0.0 (tier Medium) so that the owned skills' `owner:` resolves in every project that receives them (design `2026-11-12-common-agents-for-common-skills`, decision D1/D2). Coexists with same-domain variant agents under distinct names.

## Acceptance Criteria

- [x] Defined in `agents/contract-gate-engineer.md` with the standard frontmatter and the seven required body sections
- [x] Owns the skills named in `required_skills`; no variant-specific or workspace-root-only text in the body
- [x] Tier Medium, matching the other common agents
- [x] Delivered to every scaffolded project from `templates/common/agents/`
