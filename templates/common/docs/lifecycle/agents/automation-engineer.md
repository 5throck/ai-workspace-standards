# Agent Governance Record — automation-engineer

## Overview

- **Agent Name**: automation-engineer
- **Role**: Common specialist — owns the `/sync` row, repository automation, and platform-layer implementation
- **Version**: 1.1.0
- **Phase**: production

## Phase History

- **2026-11-12**: Common agent established at version 1.1.0 (tier Medium). Folds the generic platform-implementation capabilities of the co-architect variant agent into one common body; co-architect's separate file and `tier_ceiling_exempt` are removed and its project-specific bindings move to its context document. The `/sync` row of every execution plan is owned by this agent; the PM verifies the landing afterwards.

## Acceptance Criteria

- [x] Defined in `agents/automation-engineer.md` with the standard frontmatter and the seven required body sections
- [x] Tier Medium (`sonnet` on Claude Code); the `/sync` row reads `automation-engineer | Medium | sonnet`
- [x] Sync Execution section: brief contract, fixed procedure, iteration cap, merge only on explicit user request
- [x] No workspace-root-only or variant-specific text in the body
- [x] Delivered to every scaffolded project from `templates/common/agents/`
