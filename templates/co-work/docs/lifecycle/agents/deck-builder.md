# Agent Governance Record — deck-builder

## Overview

- **Agent Name**: deck-builder
- **Role**: Native PPTX deck authoring specialist (canonical SVG + DrawingML export chain)
- **Phase**: production

## Phase History

- **2026-11-03**: Initial release — created with the native PPTX deck capability (spec `2026-11-03-co-work-native-pptx-deck-design`, DEC-20261103-01). Tier medium; registered as `optional[]` in the agent manifest (dispatched only when a PPTX deliverable is requested); owns the `svg-slide-authoring`, `svg-quality-gate`, and `pptx-export` skills and the `svg-check.ts` / `svg-to-pptx.ts` script chain.
- **2026-11-07**: v1.1.0 — export engine swap + gate port (design `2026-11-06-deck-emitter-ppt-master-rebase-design`, DEC-20261106-04): export chain is now `ppt-master-adapter.ts` + the ppt-master v6.8.0 (MIT) deterministic chain (their delivery/OPC validators are the package oracle); quality gate is the python `svg_check.py` 2.0.0 (byte-identical port of the retired `svg-check.ts`, proven by `scripts/deck/tests/test_svg_check_parity.py`); previews via `render_previews.py` (white-underlay, resvg-py). `svg-to-pptx.ts` deleted; `svg-check.ts` retained only as the parity harness's differential oracle.
- **2026-11-07**: v1.2.0 — checker oracle retirement + exec-cut reverse diff: `svg-check.ts` DELETED — `svg_check.py` is the single checker (2.1.0: exec-cut contract support, the `W-CONTENT-UNRENDERED` reverse diff active for `## E01`–`## E12` contracts with structured-field awareness; real exec-cut contract at `unrendered_runs` 0, `## Page <n>` output byte-identical, main fingerprint `aa3baf43…` unchanged). The differential harness retired into the python-only semantics suite `scripts/deck/tests/test_svg_check.py` (real-deck fingerprints `aa3baf43…` main / `ffa4d390…` exec cut pinned; an E-contract mutation pin proves the reverse diff fires exactly once on the injected page). `svg-quality-gate` skill → 1.3.0.

## Acceptance Criteria

- [x] Defined in `agents/deck-builder.md`
- [x] Follows standard agent structure
- [x] Validated by `scripts/validate-agents.ts`
- [x] Design Gate: spec registered (`2026-11-03-co-work-native-pptx-deck-design`, approved) before implementation dispatch
