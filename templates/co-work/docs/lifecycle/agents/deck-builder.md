# Agent Governance Record — deck-builder

## Overview

- **Agent Name**: deck-builder
- **Role**: Native PPTX deck authoring specialist (canonical SVG + DrawingML export chain)
- **Phase**: production

## Phase History

- **2026-11-03**: Initial release — created with the native PPTX deck capability (spec `2026-11-03-co-work-native-pptx-deck-design`, DEC-20261103-01). Tier medium; registered as `optional[]` in the agent manifest (dispatched only when a PPTX deliverable is requested); owns the `svg-slide-authoring`, `svg-quality-gate`, and `pptx-export` skills and the `svg-check.ts` / `svg-to-pptx.ts` script chain.
- **2026-11-07**: v1.1.0 — export engine swap + gate port (design `2026-11-06-deck-emitter-ppt-master-rebase-design`, DEC-20261106-04): export chain is now `ppt-master-adapter.ts` + the ppt-master v6.8.0 (MIT) deterministic chain (their delivery/OPC validators are the package oracle); quality gate is the python `svg_check.py` 2.0.0 (byte-identical port of the retired `svg-check.ts`, proven by `scripts/deck/tests/test_svg_check_parity.py`); previews via `render_previews.py` (white-underlay, resvg-py). `svg-to-pptx.ts` deleted; `svg-check.ts` retained only as the parity harness's differential oracle.

## Acceptance Criteria

- [x] Defined in `agents/deck-builder.md`
- [x] Follows standard agent structure
- [x] Validated by `scripts/validate-agents.ts`
- [x] Design Gate: spec registered (`2026-11-03-co-work-native-pptx-deck-design`, approved) before implementation dispatch
