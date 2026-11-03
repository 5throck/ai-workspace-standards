# Agent Governance Record — deck-builder

## Overview

- **Agent Name**: deck-builder
- **Role**: Native PPTX deck authoring specialist (canonical SVG + DrawingML export chain)
- **Phase**: production

## Phase History

- **2026-11-03**: Initial release — created with the native PPTX deck capability (spec `2026-11-03-co-work-native-pptx-deck-design`, DEC-20261103-01). Tier medium; registered as `optional[]` in the agent manifest (dispatched only when a PPTX deliverable is requested); owns the `svg-slide-authoring`, `svg-quality-gate`, and `pptx-export` skills and the `svg-check.ts` / `svg-to-pptx.ts` script chain.

## Acceptance Criteria

- [x] Defined in `agents/deck-builder.md`
- [x] Follows standard agent structure
- [x] Validated by `scripts/validate-agents.ts`
- [x] Design Gate: spec registered (`2026-11-03-co-work-native-pptx-deck-design`, approved) before implementation dispatch
