# Meeting Transcript
**Date**: 2026-06-19
**Topic**: L2-to-Variant Pipeline Enhancement — Stage 1 Agent/Skill Organization and Stage 2 Variant Structure Alignment
**Participants**: architect, automation-engineer, scaffolding-expert, auditor
**Rounds**: 3
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**architect**: Framed the problem as two layers. Stage 1 (scan/classify): `scan-l2-project.ts` classifies files into only 4 states (new/modified/identical/conflict) with no semantic analysis — cannot distinguish governance content (Role, Responsibilities, Constraints) from process/skill content (Step-by-Step procedures, tool lists, output templates). Stage 2 (generation): `normalizeAgentFrontmatter()` only normalizes frontmatter, does not validate body structure, and has no comparison against existing variant structure. Asked automation-engineer whether `reconcile-with-l0-l1.ts` has special handling for agent/skill files.

**automation-engineer**: Confirmed all files pass through the same version-hash comparison pipeline with no file-type branching. Identified two technical debts: (1) `SCAN_CATEGORIES` defines agent category by path only, no semantic analysis; (2) `generateAgentOverrides()` calls `normalizeAgentFrontmatter()` then writes file with no structural comparison against existing variant agents. Proposed adding a semantic analyzer to `scan-l2-project.ts` to parse frontmatter `required_skills` and detect skill pattern headers (`## Step`, `## Process`). Asked scaffolding-expert about Stage 2 structure alignment approach.

**scaffolding-expert**: Proposed a three-step improvement for Stage 2: (1) Golden reference loading — load existing variant agent files of the same variantType as golden references; (2) Structure gap detection — compare L2 agent body against golden reference at header level, warn on missing required sections; (3) Skill separation flag — extract skill content to `skills/<slug>/SKILL.md` when detected. Asked architect whether this conflicts with current pipeline architecture.

### Round 2

**architect**: Agreed with scaffolding-expert's three steps but proposed restructuring the Wave sequence itself. New proposed pipeline:
- Wave 1: Scan (+ semantic classification: agent/skill content marking)
- Wave 1.5: Agent/Skill Normalization (NEW) — extract skill content → generate `skills/<slug>/SKILL.md` drafts, clean agent body
- Wave 2: Reconciliation (existing)
- Wave 3: Generation (add golden reference comparison)

Proposed `normalize-agent-skills.ts` as the new Wave 1.5 helper. Asked automation-engineer about false positive risk in skill pattern detection.

**automation-engineer**: Strongly agreed with Wave 1.5. Proposed confidence levels to address false positives:
- HIGH: `## Step N`, `## 절차`, `Next Step:` — auto-extract to skill file
- MEDIUM: `## Process`, `## How To`, 3+ sequential bullets — warn, require user approval
- LOW: `## Tools`, `## Output` — ignore (also valid in agent body)

Listed implementation files needed: `normalize-agent-skills.ts`, `golden-reference-loader.ts`, `l2-to-variant-pipeline.ts` updates. Asked scaffolding-expert how to handle variantType differences in golden comparison.

**scaffolding-expert**: Proposed two-layer golden reference comparison leveraging `docs/designs/variant-specialist-agent-structure.md`:
- Layer 1 (all variants): 7 required sections (Role, PM-ONLY INVOCATION, Responsibilities, Output Format, Constraints, Meeting Participation, Dispatch Protocol)
- Layer 2 (variantType-specific): dynamic loading from `templates/co-<type>/agents/`

`golden-reference-loader.ts` receives variantType and returns combined Layer1+Layer2 expected structure. Also proposed retrospective validation of existing variant agents. Asked auditor about adding this check to `audit.ts`.

### Synthesis (auditor)

**Points of Agreement**:
- Wave 1.5 (Agent/Skill Normalization step) to be added between Wave 1 and Wave 2
- Semantic detection to use HIGH/MEDIUM/LOW confidence levels to suppress false positives
- Golden reference comparison split into Layer 1 (common required) + Layer 2 (variantType-specific)
- `docs/designs/variant-specialist-agent-structure.md` to serve as the golden standard

**Open Questions**:
- Scope of retrospective validation for existing variant agents
- Automation level in Wave 1.5 (fully automatic vs. user approval gate)
- Performance impact of adding Wave 1.5 to pipeline execution time

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | `scripts/helpers/normalize-agent-skills.ts` (new) — HIGH/MEDIUM/LOW confidence-based skill pattern detection and skill draft extraction | L0-only | Wave 1.5 |
| A-02 | automation-engineer | Low | `scripts/helpers/golden-reference-loader.ts` (new) — returns Layer1+Layer2 expected structure by variantType | L0-only | Wave 3 |
| A-03 | automation-engineer | Low | `scripts/l2-to-variant-pipeline.ts` update — integrate Wave 1.5, add golden reference comparison to Wave 3 | L0-only | All Waves |
| A-04 | architect | High | ADR — document Wave 1.5 addition and golden reference comparison architecture decision | L0-only | Phase 1 |
| A-05 | auditor | Medium | `scripts/audit.ts` update — add variant agent required sections (7) validation check, retroactive validation of existing variants | L0-only | QA Gate |
| A-06 | docs-writer | Medium | `docs/designs/variant-specialist-agent-structure.md` update — add Layer1/Layer2 distinction and variantType-specific optional sections spec | L0-only | Phase 1 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | Wave 1.5 detects skill content in agent files with HIGH confidence without false positives | Run pipeline on co-deck L2 source; verify `lecture-research/SKILL.md` is auto-extracted |
| C-02 | Wave 3 golden reference comparison reports missing required sections | Run pipeline with a minimal agent file missing `## Meeting Participation`; verify warning appears |
| C-03 | `audit.ts` rejects variant agent files missing any of the 7 required body sections | Add agent file without `## Dispatch Protocol`; verify audit fails |
| C-04 | Existing variant agents (co-develop, co-deck) all pass the new audit check | Run audit.ts after A-05 lands; expect all PASS |
