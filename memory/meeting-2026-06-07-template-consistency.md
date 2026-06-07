# Meeting Transcript

**Date**: 2026-06-07
**Topic**: Template consistency issues - pm.md/context.md relationships unclear, information duplication across common and variants, missing synchronization mechanism
**Participants**: architect, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Agenda

PM Facilitator opened the meeting to discuss three critical template consistency issues:

1. **pm.md relationship ambiguity**: `variant-pm-spec.md` specifies an `extends` pattern, but actual implementation uses only `<!-- VARIANT-SECTION -->` markers
2. **context.md complete duplication**: common/docs/context.md and all variant context.md files are identical at 274 lines
3. **Missing synchronization mechanism**: No automated sync between common and variant context.md files

---

## Round 1

### **architect** (Round 1)

Structural analysis reveals fundamental design flaws:

**Problem 1: Inheritance vs Substitution Mismatch**
- `variant-pm-spec.md` explicitly specifies an "extends" pattern where variant pm.md should inherit from common/pm.md and override only `## Role` (first paragraph) and `## Agent Roster` sections
- **Actual implementation**: Variant pm.md files use marker-based substitution with `<!-- VARIANT-SECTION -->` comments
- These two patterns are mutually exclusive - they cannot work together

**Problem 2: No True Inheritance**
Variant pm.md files are standalone minimal templates with markers, not actual code-level extensions of common/pm.md. There's no real relationship between them.

Asked docs-writer about context.md situation: identical 274-line files duplicated across 5 locations with no clear single source of truth.

---

### **docs-writer** (Round 1)

Context.md creates massive confusion from documentation management perspective:

**Internal Contradictions**:
- File states: "Variant-specific configuration → docs/<variant-name>.context.md"
- File states: "⚠️ This file is IMMUTABLE after project creation"
- **Reality**: No variant-specific context files exist (co-design.context.md, co-work.context.md don't exist)
- Only identical duplicates of context.md exist in common and all variants

**Maintenance Nightmare**:
- 5 locations (common + 4 variants) contain identical copies
- Any change requires manual update to all 5 files
- No synchronization mechanism exists

Asked architect: from structural perspective, how can we avoid this duplication without complex inheritance?

---

## Round 2

### **architect** (Round 2)

Proposed **3-Tier Layered Architecture** to resolve both issues:

**Layer Structure**:
1. **L1 (Common Base)**: `templates/common/docs/context.md` - single source of truth
2. **L2 (Variant Extension)**: Each variant's `docs/<variant>.context.md` - variant-specific additions
3. **L3 (Merged Output)**: At scaffold time, merge L1 + L2 to generate project

**This Addresses**:
- Problem 1: Clear inheritance pattern with explicit extension points
- Problem 2: Single source of truth at L1, with optional L2 customizations
- Clarifies relationship between common and variants

Asked docs-writer: Is this approach viable from documentation management perspective, especially regarding merge complexity and language policy?

---

### **docs-writer** (Round 2)

Acknowledges structural validity but raises implementation concerns:

**Concern 1: Merge Complexity**
- L1 + L2 merge requires complex logic in scaffolding scripts (`create-l2-scaffold.ts`, `new-project.ts`)
- Current scripts are simple copy operations
- Adding merge logic increases bug risk and maintenance burden

**Concern 2: context.md Character Contradiction**
- File contains project-specific placeholders (e.g., "## Project Overview" with "[One-sentence description]" placeholder)
- This conflicts with "IMMUTABLE" designation
- Implies per-project customization is expected

**Alternative Proposal**:
- **Abolish variant-specific context.md**, instead put variant-specific context in each variant's `CLAUDE.md`/`GEMINI.md`
- **Keep context.md only in common**, with variants either referencing it (symlink-like) or removing it entirely
- **Change timing**: context.md changes use explicit opt-in via `--docs` flag (`publish-to-template.ts`)

Asked architect: Does this approach maintain structural simplicity while reducing docs-writer maintenance burden?

---

## Synthesis

### Points of Agreement

1. **Current Structure Problems Acknowledged**:
   - pm.md extends pattern (spec) vs marker-based substitution (implementation) contradiction
   - context.md 5-location duplication with no synchronization
   - Absence of single source of truth

2. **Structural Principle Agreement**:
   - L1/common as single source is valid
   - Variant-specific extensions (if needed) should be in L2
   - Implementation complexity must be minimized

### Open Disagreements or Unresolved Questions

1. **pm.md Structure Decision**: Implement actual extends pattern, or formalize marker-based substitution?
2. **context.md Character**: Is it truly "IMMUTABLE" or is per-project customization expected?
3. **Merge vs Reference**: Add complex merge logic, or adopt reference/symlink approach?

### Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | High | Decide pm.md inheritance/substitution pattern and write ADR - choose between actual extends implementation or formalize marker-based approach | Both | Phase 1-2 |
| A-02 | docs-writer | Medium | Decide context.md deduplication approach - common single source, variant reference method, or symlink usage | Both | Phase 1-2 |
| A-03 | automation-engineer | Low | Implement selected pattern - modify pm.md and context.md structure, update sync scripts | Both | Phase 4 |
| A-04 | docs-writer | Medium | Update variant-pm-spec.md - reflect final pattern decision, resolve marker/extends contradiction | Both | Phase 4 |
| A-05 | auditor | Medium | Add synchronization audit - add context.md consistency check logic to audit.ts | Both | Phase 6 |

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | ADR published documenting chosen pm.md pattern | docs/adr/ directory contains decision record |
| AC-02 | context.md duplication eliminated | Only one canonical copy exists in templates/common/ |
| AC-03 | Variant relationship clearly documented | variant-pm-spec.md updated without contradictions |
| AC-04 | Audit script detects inconsistencies | `bun scripts/audit.ts` fails when common/variant drift detected |
| AC-05 | Scaffolding produces consistent output | `bun scripts/new-project test-project` generates valid structure |

---

*Transcript created by: pm*
*Synthesis by: auditor (cross-domain agent)*