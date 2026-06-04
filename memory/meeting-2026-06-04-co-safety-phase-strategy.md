---
name: meeting-2026-06-04-co-safety-phase-strategy
description: Follow-up meeting resolving Phase A vs direct-templates debate for co-safety creation — Phase A + l2-to-variant-pipeline.ts adopted as final strategy
metadata:
  type: project
---

# Meeting Transcript
**Date**: 2026-06-04
**Topic**: co-safety Variant Creation — Phase A Strict vs Direct templates/ Approach (Follow-up)
**Participants**: architect, automation-engineer, scaffolding-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Previous meeting (meeting-2026-06-04-co-safety-creation-plan.md) concluded: skip Phase A, define `templates/co-safety/` directly as SSOT.

New opposing opinion: Phase A must be strictly followed (Projects/safety-os/ first), and `scripts/l2-to-variant-pipeline.ts` should be used for automated Phase B promotion.

Key discovery: `scripts/l2-to-variant-pipeline.ts` EXISTS in the workspace and is fully implemented.

---

## Transcript

### Round 1

**[architect]**: (Round 1)

The real differences between the two positions:

1. **Origin of Safety OS-specific files**: Direct approach = architect hand-designs domain files in templates/. Phase A approach = first build a working system in Projects/safety-os/, then pipeline reverse-extracts it as a template. The latter produces a "behavior-validated template."

2. **l2-to-variant-pipeline.ts is the key variable.** The previous meeting did not account for this script's existence. If it automates L2 → variant conversion, Phase A + pipeline produces templates/co-safety/ without manual work after Phase A completion.

Question to automation-engineer: what transformations does l2-to-variant-pipeline.ts actually perform, and does it include domain-specific structures (workflows/, regulations/) in the template?

---

**[automation-engineer]**: (Round 1)

Confirmed l2-to-variant-pipeline.ts source. 6-stage Wave pipeline:
1. scan-l2-project.ts — L2 project structure scan
2. reconcile-with-l0-l1.ts — identifies and removes files with identical content to L0/L1
3. generate-variant.ts — creates variant folder (unique files only)
4. beta-lifecycle.ts — initializes lifecycle state
5. validate-platform-parity.ts — validates .claude/ ↔ .gemini/ parity
6. integration-helpers.ts — integrates into templates/

variantType: 'security' is supported. Safety OS-exclusive structures not in L0/L1 (workflows/, regulations/, evidence-models/) survive reconcile and are included in template as-is.

---

**[scaffolding-expert]**: (Round 1)

Important practical clarification: new-project.sh requires `templates/co-{name}/` to exist before execution. Without a template, Projects/safety-os/ must be created manually in Phase A.

Comparison:

| Item | Direct templates/ | Phase A First |
|---|---|---|
| Initial creation method | Manual template authoring | Manual Projects/ authoring |
| Automation use point | new-project.sh (template→instance) | l2-to-variant-pipeline.ts (instance→template) |
| Validation point | Immediately after template complete | After Phase A development complete |
| Safety OS domain validation | Design-first, validate-later | Implement-first, template-later |

For a domain as complex as Safety OS, building a working prototype first and reverse-extracting as template may be more robust.

---

**[auditor]**: (Round 1)

Risk profile comparison:

**Direct templates/ risks**: Template is design-based without execution validation; Safety OS domain coherence only validated at design stage.

**Phase A first risks**: l2-to-variant-pipeline.ts compatibility with Safety OS structures unverified; long Phase A risks _COMMON_VERSION.md tracking burden from workspace common updates.

Key question: how does generate-variant.ts handle variantType: 'security' and does it correctly include Safety OS-specific structures? Must be confirmed in Round 2.

---

### Round 2

**[architect]**: (Round 2)

Conditional conclusion:

**Condition 1: Pipeline fully supports Safety OS structures** → Phase A first is superior. Domain logic validated before template creation, reconcile auto-removes common duplicates, aligns with safety-os-plan.md.

**Condition 2: Pipeline only partially supports Safety OS structures** → Direct templates/ is realistic.

Therefore: **S-00 must include pipeline compatibility check as mandatory item. This single check determines the entire strategy.**

---

**[automation-engineer]**: (Round 2)

variantType primarily affects metadata and governance rules. Actual file copy/transform logic reflects the actual L2 project file structure — whatever exists in Projects/safety-os/ will be in the template after reconciliation.

**Critical pitfall**: reconcile-with-l0-l1.ts removes files with identical content to L0. If Projects/safety-os/CLAUDE.md is a straight copy of workspace root CLAUDE.md, it will be removed from the template. Safety OS-specific sections must differ from L0 to survive reconcile.

Similarly: agents/pm.md with only CSO override may be nearly identical to workspace pm.md → risk of removal.

---

**[scaffolding-expert]**: (Round 2)

Practical recommendation: the principle "this file must differ from L0/L1 to survive in template" must be documented in _ORIGIN.md. Each file's differentiation point must be intentionally managed; otherwise pipeline execution may produce an empty template.

This is additional management burden, but when properly managed, produces a far more robust result than the direct approach.

---

**[auditor]**: (Synthesis)

**Key facts confirmed**:
- l2-to-variant-pipeline.ts exists and fully implements L2 → template conversion
- variantType: 'security' supported; domain-specific structures included in template after reconcile
- Reconcile removes files with identical content to L0/L1 — Safety OS-specific modifications must be explicit in each file

**Integrated conclusion from both meetings**:

| Aspect | Previous Meeting | New Opinion | Final |
|---|---|---|---|
| Starting location | templates/co-safety/ directly | Projects/safety-os/ first | **Phase A first** (conditional) |
| Automation use | new-project.sh | l2-to-variant-pipeline.ts | **Use pipeline** |
| Precondition | None | PROMOTION_CHECKLIST 7 items | **S-00 pipeline verification mandatory** |

**Final recommendation**: Adopt Phase A first approach, with mandatory pipeline compatibility verification in S-00.

Reasons:
1. Aligns with safety-os-plan.md design intent
2. l2-to-variant-pipeline.ts already exists, eliminating Phase B manual burden
3. "Working system first, template as reverse-extraction" suits domain complexity

---

## Action Items

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| A-01 | architect | High | S-00: l2-to-variant-pipeline.ts + generate-variant.ts compatibility verification; design dry-run test for reconcile handling of Safety OS files |
| A-02 | automation-engineer | Medium | Projects/safety-os/ manual scaffold checklist — includes reconcile survival conditions (L0/L1 differentiation points per file) |
| A-03 | scaffolding-expert | Medium | _ORIGIN.md template with "reconcile-surviving files and differentiation points" section |
| A-04 | architect + docs-writer | Medium | Phase A implementation: 7 agents, 4 skills, 6 workflows (CSO override, legal_basis obligation) |
| A-05 | automation-engineer | Medium | PROMOTION_CHECKLIST.md 7 conditions + scripts/safety-audit.ts legal_basis missing check |
| A-06 | auditor | Medium | Phase B: run l2-to-variant-pipeline.ts → generate templates/co-safety/ → full verification pass |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | l2-to-variant-pipeline.ts dry-run produces correct templates/co-safety/ structure | Manual inspection of pipeline output |
| C-02 | Safety OS-specific files survive reconcile (CLAUDE.md, pm.md, settings.json differ from L0/L1) | reconcile-with-l0-l1.ts output review |
| C-03 | PROMOTION_CHECKLIST.md 7 conditions all satisfied | bun scripts/safety-audit.ts pass |
| C-04 | All 7 agents registered in AGENTS.md | bun run agent:verify |
| C-05 | validate-templates.ts P-01 parity check passes | bun scripts/validate-templates.ts |
