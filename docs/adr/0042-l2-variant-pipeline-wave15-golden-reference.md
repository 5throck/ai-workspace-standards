# ADR-0042: L2-to-Variant Pipeline — Wave 1.5 Normalization Stage and Golden Reference Comparison

Date: 2026-06-19
Status: Accepted
Deciders: architect, automation-engineer, scaffolding-expert, auditor

## Context and Problem Statement

The L2-to-Variant pipeline (3-Wave: Scan → Reconcile → Generate) has two structural gaps:

**Gap 1 — Stage 1 (Wave 1): No semantic analysis of agent/skill content.**
`scan-l2-project.ts` classifies files by path and version hash only. It cannot detect whether an agent file contains skill content (step-by-step procedures, output templates) mixed in with governance content (Role, Responsibilities, Constraints). As a result, variant generation copies agent files verbatim, leaving skill process content embedded in the agent body — requiring costly manual cleanup post-generation (as seen with the co-deck variant).

**Gap 2 — Stage 2 (Wave 3): No structural alignment with existing variants.**
`generate-variant.ts` runs `normalizeAgentFrontmatter()` (frontmatter field normalization only) but does not compare the generated agent/skill bodies against the canonical section structure defined in `docs/designs/variant-specialist-agent-structure.md`. Missing required sections (e.g., `## Meeting Participation`, `## Dispatch Protocol`) are undetected until manual review.

## Decision

**Add Wave 1.5** (Agent/Skill Normalization) between Wave 1 and Wave 2, and **extend Wave 3** with golden reference comparison.

### Wave 1.5 — `normalize-agent-skills.ts`

A new helper inserted after Wave 1 (scan) and before Wave 2 (reconcile). It operates on agent and skill files in the L2 scan result and produces a normalized file set for Wave 2 to reconcile.

**Agent file processing:**
1. Parse frontmatter to read `required_skills` — validate that referenced skill slugs exist.
2. Detect skill content patterns in the body with confidence levels:
<!-- Korean text in code example is intentional source material -->
   - **HIGH** (`## Step N`, `## 절차`, `Next Step:`, `## Process Steps`): auto-extract to `skills/<slug>/SKILL.md` draft.
   - **MEDIUM** (`## Process`, `## How To`, 3+ sequential bullet items): flag in normalization report, require user approval before extraction.
   - **LOW** (`## Tools`, `## Output`): ignore (valid in both agent and skill bodies).
3. After extraction, remove extracted content from agent body and add `Full instructions: see skills/<slug>/SKILL.md`.
4. Validate agent body sections against Layer 1 required sections; emit warnings for missing sections.

**Skill file processing:**
1. Parse frontmatter; add missing standard fields (`status: active`, `owner`, `last_reviewed`, `prerequisites: none`) using defaults.
2. Rename non-standard section headers:
   - `## Role` → `## Context`
   - `## When to Invoke` → `## When to Use`
   - `## Step N: ...` (flat numbered) → preserved under `## Execution Steps` wrapper if not already grouped.
3. Add `## Related Skills` stub if absent.

### Wave 3 Extension — `golden-reference-loader.ts`

Before writing each agent or skill file, Wave 3 calls `golden-reference-loader.ts` with the `variantType` to obtain the expected section structure (Layer 1 + Layer 2), then performs a structural gap check.

**Layer 1 — Common Required Sections (all variantTypes):**

Agent files:
1. `## Role`
2. `## ⚠️ PM-ONLY INVOCATION`
3. `## Responsibilities`
4. `## Output Format`
5. `## Constraints`
6. `## Meeting Participation`
7. `## Dispatch Protocol`

Skill files:
1. `## Context`
2. `## When to Use`
3. `## Execution Steps`
4. `## Output Format`
5. `## Related Skills`

**Layer 2 — variantType-Specific Sections (optional, loaded from existing variant):**
Loaded dynamically from `templates/co-<type>/agents/` (or `skills/`). If no existing variant has the same `variantType`, only Layer 1 is applied.

**Gap check behavior:**
- Missing Layer 1 section → **WARNING** in console output + written to `_pipeline_report.md` in the variant root.
- Missing Layer 2 section → **INFO** only (variantType-specific sections are optional).
- The pipeline does NOT fail on structural warnings — it proceeds and reports.

## Consequences

**Positive:**
- Eliminates the manual agent/skill cleanup step that was required for co-deck.
- Future variants generated from L2 projects will have structurally correct agent and skill files.
- Golden reference comparison provides a runnable audit trail (`_pipeline_report.md`).

**Negative / Trade-offs:**
- Wave 1.5 adds processing time (proportional to number of agent/skill files; typically < 2 seconds for 10 agents).
- MEDIUM-confidence detections require a user approval step, interrupting fully automated runs. Mitigated by `--auto` flag that treats MEDIUM as LOW (skip extraction, log only).
- `golden-reference-loader.ts` adds a dependency on the existence of at least one other variant with the same `variantType`. If no such variant exists, only Layer 1 is checked.

## Related

- `scripts/helpers/normalize-agent-skills.ts` — Wave 1.5 implementation
- `scripts/helpers/golden-reference-loader.ts` — Wave 3 golden reference
- `scripts/l2-to-variant-pipeline.ts` — orchestrator (Wave 1.5 integration)
- `docs/designs/variant-specialist-agent-structure.md` — Layer 1 agent section spec
- `docs/designs/variant-specialist-skill-structure.md` — Layer 1 skill section spec (new)
