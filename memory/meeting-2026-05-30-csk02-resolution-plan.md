# Meeting Transcript
**Date**: 2026-05-30
**Topic**: C-SK-02 Warning Resolution — Migrating Variant pm.md to Partial Override Form
**Participants**: PM, Architect, Lifecycle Manager, Scaffolding Expert
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Agenda

1. Round 1: Diagnose the 31 C-SK-02 warnings and choose resolution strategy
2. Round 2: Define migration procedure and identify secondary issues

---

## Round 1: Diagnosis and Strategy Selection

**PM**: (Round 1 — Open)

Two simultaneous warnings: C-SK-02 (28 invariant section mismatches) and anti-swelling (pm overridden by 4/4 variants). What do they mean together, and how to resolve?

---

**Lifecycle Manager**: (Round 1)

Both warnings mean all 4 variant pm.md files are still FULL files (complete pm definition) rather than PARTIAL override files (variant-specific sections only).

Current state:
- common/agents/pm.md = 7 invariant sections + 3 VARIANT-SECTION placeholders
- co-design/agents/pm.md = 7 invariant sections (slightly different content) + 3 variant sections

Target state:
- common/agents/pm.md = 7 invariant sections + 3 VARIANT-SECTION placeholders (unchanged)
- co-design/agents/pm.md = 3 variant sections ONLY (invariant sections removed)

Two options:
- **Option 1 (immediate alignment)**: Remove invariant sections from all 4 variant pm.md files now → warnings resolve immediately
- **Option 2 (gradual migration)**: Keep current state, lower C-SK-02 to INFO, apply correct structure only to new variants → technical debt accumulates

Recommendation: **Option 1**. Encoding artifacts (??PM vs → PM) in co-security will cause future bugs if left unresolved.

---

**Scaffolding Expert**: (Round 1)

Supporting Option 1. Each variant pm.md goes from ~140 lines to ~60 lines after removing 7 invariant sections.

Key prerequisite: diff each variant's invariant sections against skeleton BEFORE deleting — some minor differences may deserve promotion to the skeleton rather than simple deletion.

---

**Architect**: (Round 1)

Anti-swelling warning for pm is a **false positive by design**. Agent Roster and Governance Workflow are necessarily variant-specific — all 4 variants MUST override pm. This is intentional, not a structural smell.

Fix: add `"expected_override_all_variants": true` to the pm entry in `common-contract.json`. The anti-swelling check should skip agents with this flag.

lifecycle-manager has `variant_sections: []` — no variant sections exist — so any override of lifecycle-manager would be a genuine anti-swelling signal.

---

**PM**: (Round 1 — Close)

Decision: Option 1 (immediate alignment). Prerequisites: diff scan first. Anti-swelling false positive: fix via common-contract.json flag.

---

## Round 2: Migration Procedure

**PM**: (Round 2 — Open)

Lifecycle Manager defines the 5-step procedure. Scaffolding Expert and Architect identify secondary issues.

---

**Lifecycle Manager**: (Round 2)

5-step migration procedure:

1. **Diff scan**: Compare each variant's invariant sections against skeleton. Classify differences as: (a) encoding artifacts/whitespace → skeleton wins, delete from variant; (b) meaningful additions → promote to skeleton first
2. **Finalize skeleton**: Apply any promote decisions to common/agents/pm.md
3. **Shrink variant files**: Remove all 7 invariant sections from each variant pm.md; keep only 3 variant-specific sections + frontmatter variant-specific keys
4. **Scaffolding verification**: Run test-new-project.ts — scaffolded pm.md must contain both invariant sections and variant sections
5. **C-SK-02 re-validation**: Should be 0 warnings after migration

---

**Scaffolding Expert**: (Round 2)

Critical secondary issue: **YAML frontmatter merge bug**.

The current VARIANT-SECTION substitution logic in new-project.sh handles `## Section` level substitution only. YAML frontmatter is not handled. If variant pm.md contains a frontmatter block AND skeleton also has frontmatter, the scaffolded project will have TWO `---` frontmatter blocks — a YAML parse error.

Required fix: update new-project.sh to merge YAML frontmatter key-by-key:
1. Use skeleton frontmatter as base
2. If variant pm.md has frontmatter block, override skeleton keys with variant values
3. Result: single merged frontmatter block, no duplicates

Variant pm.md format after migration should include ONLY variant-specific frontmatter keys (description, examples, formal_name, tier) — not `name: pm` or `status: active` (inherited from skeleton).

---

**Architect**: (Round 2)

Three parallel work items:

1. **Skeleton finalization** (promote + skeleton update)
2. **Variant file shrinking** (remove invariant sections, keep variant keys + 3 sections)
3. **new-project.sh frontmatter merge improvement** (YAML key-by-key merge)

After all three complete:
- C-SK-02: 0 warnings
- Anti-swelling: resolved via expected_override_all_variants flag in common-contract.json

---

**PM**: (Round 2 — Close)

Final action items below.

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| A-01 | lifecycle-manager | Diff all 4 variant pm.md invariant sections against skeleton; classify as encoding-artifact vs promote-candidate; update skeleton if promote needed | Immediate |
| A-02 | lifecycle-manager | Shrink all 4 variant pm.md to partial override form (3 variant sections + variant-specific frontmatter keys only) | After A-01 |
| A-03 | automation-engineer | Fix new-project.sh/.ps1: add YAML frontmatter key-by-key merge for agent files (prevent double frontmatter block) | Immediate (parallel with A-01) |
| A-04 | architect | Add `expected_override_all_variants: true` to pm entry in common-contract.json; update validate-templates.ts anti-swelling check to skip agents with this flag | Immediate (parallel) |
| A-05 | scaffolding-expert | Run test-new-project.ts after A-02+A-03 complete; verify scaffolded pm.md has complete content (no markers, no double frontmatter) | After A-02+A-03 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | C-SK-02 warnings: 0 | bun scripts/validate-templates.ts shows no C-SK-02 warnings |
| AC-02 | Anti-swelling warning for pm: suppressed | common-contract.json has expected_override_all_variants: true; no anti-swelling warning for pm |
| AC-03 | Scaffolded project pm.md has no VARIANT-SECTION markers | grep for <!-- VARIANT-SECTION in scaffolded output |
| AC-04 | Scaffolded project pm.md has exactly one YAML frontmatter block | head -20 of scaffolded pm.md shows single --- block |
| AC-05 | Scaffolded project pm.md contains all 7 invariant sections | Check section headings present |
