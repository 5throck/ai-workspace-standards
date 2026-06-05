# Meeting Transcript

**Date**: 2026-06-05
**Topic**: New Variant Addition Propagation Gap and L1-L2 Fork Model
**Participants**: pm (facilitator), architect, automation-engineer, auditor
**Rounds**: 3
**Language**: Korean (transcript saved in English)
**Status**: Complete

## Key Context

User clarified design principle: after L2 scaffolded from L1, NO automatic L1->L2 propagation.
L2 changes reflected back only via explicit l2-to-variant-pipeline.ts.

## Findings

### Hardcoded variant lists (new variant addition gaps):
- new-project.sh: 6 locations hardcoded
- new-project.ps1: validVariants array hardcoded
- publish-to-template.ts publishDocs(): variants array hardcoded
- validate-templates.ts: dynamic readdirSync (no gap)

### Prior meeting A-03/A-04 conflict with Fork Model:
- A-03 (add L1->L2 to dev-sync): VIOLATES Fork Model
- A-04 (audit.ts L1<->L2 sync warning): VIOLATES Fork Model

## Architecture Decision: L1-L2 Fork Model

Principle 1: L1 delivers common infra to L2 at scaffold time, relationship ends.
Principle 2: After fork, L2 evolves independently. No auto L1->L2 propagation.
Principle 3: L2 changes to official template requires explicit l2-to-variant-pipeline.ts.
Principle 4: L0->L1 publish integrated into dev-sync pipeline.
Principle 5: L1 vs L2 drift check via --check-drift option (reporting only, no apply).

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | High | New ADR: L1-L2 Fork Model (5 principles + flow diagram) | L0-only | 1-2 |
| A-02 | docs-writer | Medium | CLAUDE.md §9 + GEMINI.md §9: Fork Model principles + --docs opt-in clarification | Both | 4 |
| A-03 | automation-engineer | Medium | publish-to-template.ts: remove L1->L2 sections, add --check-drift, propagation-map.json governance domains | L0-only | 4 |
| A-04 | automation-engineer | Low | new-project.sh + new-project.ps1: dynamic variant allowlist (git tag compatible) | L0-only | 4 |
| A-05 | automation-engineer | Low | dev-sync.ts: L0->L1 only; audit.ts: L2 structural integrity check | L0-only | 4 |
| A-06 | docs-writer | Medium | create-variant + promote-variant skills: remove Step 6 manual update, add Fork Model notes | Both | 4 |
| A-07 | lifecycle-manager | Medium | Version bump + SCRIPTS.md update + Fix-Then-Propagate (L0->L1 only) | L0-only | 4 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | ADR documents Fork Model with 5 principles | File exists in docs/adr/ |
| 2 | CLAUDE.md §9 states L1->L2 no-auto-propagation | grep Fork CLAUDE.md in §9 |
| 3 | publish-to-template.ts has no L1->L2 apply logic | No applyDiffs() for L2 |
| 4 | --check-drift reports drift without applying | Outputs table, no file writes |
| 5 | new-project.sh accepts new variant without script edit | Add templates/co-test, verify |
| 6 | /sync triggers L0->L1 publish at workspace root | /sync output shows step |
| 7 | create-variant skill no manual update step | No manually update in skill |
| 8 | bun scripts/audit.ts passes | Exit code 0 |
