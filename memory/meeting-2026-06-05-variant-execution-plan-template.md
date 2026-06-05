# Meeting Transcript

**Date**: 2026-06-05
**Topic**: Creating variant execution plan template based on safety-os-plan analysis
**Participants**: pm, architect, docs-writer, scaffolding-expert
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[PM]**: (Opening)

Today's meeting discusses creating a reusable **design document template** for new variants based on analysis of safety-os-plan.md and safety-os-plan_ko.md.

**Background**:
The user pointed out that safety-os-plan related documents are essential design documents for new variant work. These documents include:
- Complete execution plan structure
- Clear architecture definitions
- Phase-by-phase development strategy
- Folder structure definitions
- Agent/Skill catalogs

**Goals**:
1. Extract common patterns from safety-os-plan
2. Propose variant-neutral design document template structure
3. Decide on template storage and usage methods

Participants, please analyze the safety-os-plan structure and propose template approaches from your expert perspectives.

---

**[Architect]**: (Round 1)

I analyzed the safety-os-plan.md structure from an architecture perspective.

**Key Structural Elements**:
```
1. Frontmatter (name, description, metadata.type)
2. Header (Created, Last Updated, Current Status, Language Link)
3. Background & Objectives (Why, What, How)
4. Overall Architecture
   - Governance Hierarchy
   - Layer Architecture
   - Workflow Tier
   - Agent Prompt Structure
5. Development Strategy (Phases)
6. Full Folder Structure
7. Agent/Skill Catalogs
8. Execution Roadmap (Phases, Steps, Deliverables)
```

**Quality as a Design Document**:
This document is excellent because it combines **"reference architecture"** with **"execution plan"**:
- Architecture decisions are clear (e.g., 5-Layer Architecture, 3-Tier Workflow)
- Phase-by-phase strategy is concrete (e.g., Phase A = Independent Prototype, Phase B = Workspace Promotion)
- Deliverables are versioned (v3.0~v4.0)

**Template Considerations**:
When templating, we must separate variant-specific elements (Safety OS governance hierarchy, 5-Layer Architecture) from variant-neutral elements (Phase structure, Deliverable versioning).

docs-writer, from a document structure perspective, which sections do you think are suitable as templates?

---

**[Docs-writer]**: (Round 1)

architect, accurate analysis. From a document structure perspective, safety-os-plan has a **3-layer structure**:

**Layer 1: Meta & Header** (variant-neutral)
- frontmatter: name, description, metadata.type
- header: Created, Last Updated, Current Status, Language links

**Layer 2: Strategic Framework** (80% variant-specific, 20% templateable)
- Background & Objectives: Why/What/How structure is reusable, content only variant-specific
- Development Strategy: Phase A (Independent Prototype) → Phase B (Workspace Promotion) pattern is reusable
- Folder Structure: Common patterns exist (common inherited vs variant-specific)

**Layer 3: Technical Artifacts** (100% variant-specific)
- Architecture definitions (Governance Hierarchy, Layer Architecture, etc.)
- Agent/Skill catalogs
- Industry profiles
- Execution roadmap

**Templatization Proposal**:
We should separate as follows:
```
1. variant-execution-plan-template.md (neutral)
   - Layer 1 (Meta & Header)
   - Layer 2 framework only (empty Why/What/How, Phase structure)

2. Variant-specific documents start from template and fill content only
```

**But Important Question**:
scaffolding-expert, where do we store this template and how do we provide it? Currently safety-os-plan.md is in `memory/`. Should we put the template in `templates/` or `docs/`?

---

**[Scaffolding-expert]**: (Round 1)

docs-writer, good question. From a scaffolding perspective, there are 3 storage options.

**Option A: docs/templates/variant-execution-plan-template.md**
- Pros: Document exists at workspace root, easy reference
- Cons: new-project.sh/ps1 doesn't automatically copy it
- Usage: Manual copy or reference

**Option B: templates/common/docs/variant-execution-plan-template.md**
- Pros: Auto-propagated to L2 via publish-to-template.ts
- Cons: Template also copied to generated projects (unnecessary)
- Usage: Reference only from L1 (templates/common/)

**Option C: scripts/create-variant-execution-plan.ts**
- Pros: Interactive CLI generates variant-specific design document
- Cons: Script maintenance burden
- Usage: `bun run scripts/create-variant-execution-plan.ts co-xxx`

**Recommendation**:
I recommend **Option B (templates/common/docs/)**. Reasons:
1. Easy reference from workspace root
2. Auto-propagated to L2 (variant templates)
3. Team members can reference from templates/co-xxx/docs/ during variant creation
4. new-project.sh/ps1 copies docs/, so template exists in generated projects (future reference)

architect, which sections need to be parameterizable for the template structure to be variant-neutral?

---

**[Architect]**: (Round 2)

scaffolding-expert, I have a concrete parametrization proposal.

**Template Structure (4-section design)**:

```markdown
---
name: [VARIANT-NAME]-execution-plan
description: [Brief 1-line description of variant purpose]
metadata:
  type: project
  domain: [domain-category]  # new field
---

# [Variant Name] Execution Plan
**Created**: YYYY-MM-DD
**Last Updated**: YYYY-MM-DD
**Current Status**: [Draft | Plan Confirmed | In Progress | Completed]
**Language**: [Link to translated version if any]

---

## 1. Background & Objectives

### Why
[TARGET AUDIENCE] faces [PROBLEM]. [VARIANT NAME] addresses [SPECIFIC PAIN POINTS].

### What
```
Deliverables:
  vX.Y  [Deliverable 1]
  vX.Y  [Deliverable 2]
  ...
```

### How
Follows existing workspace **Harness Engineering methodology**:
- Discover → Reuse → Adapt → Create
- GitHub-Native: all artifacts version-controlled
- [VARIANT-SPECIFIC PRINCIPLE 1]
- [VARIANT-SPECIFIC PRINCIPLE 2]

---

## 2. Overall Architecture

### Governance Hierarchy
[Variant-specific governance structure]

### [Layer/Tier/Component Architecture]
[Variant-specific architecture definition]

---

## 3. Development Strategy (2 Phases)

### Phase A — Independent Prototype
**Location**: `Projects/[variant-name]/`
**Principle**: develop independently without touching workspace root

**Common drift prevention**:
- `_ORIGIN.md`: list of files copied from common
- `_COMMON_VERSION.md`: workspace common version snapshot

### Phase B — Workspace Promotion
**Condition**: [PROMOTION_CRITERIA]
**Location**: create `templates/co-[variant]/` → propagate to workspace root

**Propagation Path**:
```
L1 (Workspace Root)      ← editing SSOT
      ↓
L2 (templates/co-xxx/)   ← variant definition
      ↓
L3 (Projects/xxx/)       ← creation-time snapshot
```

---

## 4. Folder Structure

[Variant-specific folder structure]

---

## 5. Agent/Skill Catalogs

[Agent definitions]

[Skill definitions]

---

## 6. Execution Roadmap
[Phased execution plan with milestones]
```

**Parameterizable Fields** (total 8):
1. `domain`: variant category (design, work, safety, security, consulting...)
2. `TARGET AUDIENCE`: who this variant serves
3. `PROBLEM`: what problem it solves
4. `Deliverables`: variant-specific outputs
5. `VARIANT-SPECIFIC PRINCIPLES`: unique methodology elements
6. `Governance Hierarchy`: variant-specific governance
7. `Layer/Tier/Component Architecture`: architectural patterns
8. `PROMOTION_CRITERIA`: conditions for Phase B

**Validation check**:
pm, do you think this template structure is actually variant-neutral? And is the Phase A→Phase B pattern applicable to all variants?

---

**[PM]**: (Round 2)

architect, excellent template structure. I reviewed from 3 perspectives.

**1. Variant-neutrality Verification**:
✅ **Meta section**: Completely neutral
✅ **Background & Objectives**: Why/What/How framework only provided
✅ **Development Strategy**: Phase A→Phase B pattern is **applicable to all variants**
   - co-design: design prototype → design promotion
   - co-work: content prototype → work promotion
   - co-security: security prototype → security promotion
   - co-safety: safety prototype → safety promotion
✅ **Execution Roadmap**: Milestone-based planning is universal

**2. Phase A→Phase B Pattern Applicability**:
This pattern is a **validated best practice** in the current workspace:
- co-safety is already proceeding with this pattern
- Guarantees workspace root stability
- Common drift prevention mechanism (_ORIGIN.md, _COMMON_VERSION.md)
- Promotion checklist (PROMOTION_CHECKLIST.md)

**3. Template Parameter Count**:
The 8 parameters architect proposed are appropriate. More makes the template too complex, less makes it impossible to express variant-specificity.

docs-writer, once the template content is finalized, can you handle saving it as a markdown file and propagating to templates/common/docs/?

---

**[Docs-writer]**: (Round 2)

pm, I agree with the template structure. I have a proposal for the documentation work.

**Final Template File Name**:
`docs/templates/variant-execution-plan-template.md`

**Template Content**:
1. **Usage Guide** (as comments at template top)
   - Purpose of this template
   - How to use (copy → fill parameters → save to memory/)
   - Example (reference safety-os-plan.md)

2. **Template Body** (architect's proposed structure as-is)
   - Parameterizable fields marked with [BRACKETS]
   - Brief description added to each section

3. **Example Reference** (as appendix at template bottom)
   - Extract actual examples from safety-os-plan.md
   - "See safety-os-plan.md for actual examples"

**Version Management**:
- Template itself is version-managed (register in docs/TEMPLATES.md)
- Documents generated from template are independent (stored in each variant's memory/)

**Question**:
scaffolding-expert, if the template file is in docs/templates/, will publish-to-template.ts automatically propagate it to templates/common/docs/? It seems docs/ is not included in current propagation-map.json.

---

**[Scaffolding-expert]**: (Round 2)

docs-writer, accurate point. I checked current propagation-map.json:

**Current propagation-map.json domains**:
```
scripts, scripts-hooks, scripts-helpers, scripts-lib
claude-skills, gemini-skills
gemini-settings
```

**docs/ is NOT included!**

**2 Solution Options**:

**Option A**: Add docs/ domain to propagation-map.json
```json
"docs": {
  "description": "Documentation and templates",
  "source": "docs",
  "target": "templates/common/docs",
  "include_pattern": "*.md",
  "recursive": true
}
```

**Pros**: All of docs/ automatically propagated L1→L2
**Cons**: All docs/ files propagated (may include unnecessary files)

**Option B**: Manually copy only templates/common/docs/variant-execution-plan-template.md
**Pros**: Selectively propagate only template
**Cons**: Not automated (manual work required)

**Recommendation**:
I recommend **Option A**. Reasons:
1. Only template files under docs/templates/ propagated with include_pattern: "*.md"
2. Important documents like docs/ADR, docs/constitution also referenceable from variants
3. Improved reusability

pm, do you approve adding docs/ domain to propagation-map.json?

---

**[PM]**: (Closing)

We've reached comprehensive agreement.

---

## Synthesis

**[Auditor]**: (Synthesis)

### Points of Agreement

1. **Template Structure Confirmed**: Proceed with architect's proposed 4-section design (Meta, Background, Architecture, Development Strategy, Folder Structure, Catalogs, Roadmap)
2. **Parameterizable Fields**: 8 fields confirmed (domain, target audience, problem, deliverables, principles, governance, architecture, promotion criteria)
3. **Template Storage**: `docs/templates/variant-execution-plan-template.md` → propagate to `templates/common/docs/`
4. **Propagation-map Extension**: Add docs/ domain for automatic L1→L2 propagation
5. **Phase A→Phase B Pattern**: Confirmed as validated best practice applicable to all variants

### Open Disagreements or Unresolved Questions

None. All participants agreed on template structure, storage, and propagation approach.

### Concrete Next Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| B-01 | docs-writer | Medium | Create `docs/templates/variant-execution-plan-template.md` with 4-section design, 8 parameters, usage guide, and example reference | L0-only | Phase 4 |
| B-02 | scaffolding-expert | Low | Add docs/ domain to propagation-map.json with source: "docs", target: "templates/common/docs", include_pattern: "*.md", recursive: true | L0-only | Phase 4 |
| B-03 | pm | Medium | Publish docs/ to templates/common/docs/ via publish-to-template.ts and validate propagation to all 5 variants | L0-only | Phase 6 |
| B-04 | auditor | Medium | Create docs/TEMPLATES.md registry to track version history of variant-execution-plan-template.md | L0-only | Phase 4 |

---

**[PM]**: (Closing Action)

We've established the execution plan.

**Impact of This Templatization**:
- **Standardization**: All new variants use identical execution plan structure
- **Reusability**: Share best practices like Phase A→Phase B pattern, promotion criteria
- **Governance**: Track template version history via docs/TEMPLATES.md

**Next Steps**:
I'll execute B-01~B-04 sequentially to create and propagate the template. Do you agree?

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| B-01 | docs-writer | Medium | Create `docs/templates/variant-execution-plan-template.md` with 4-section design, 8 parameters, usage guide, and example reference | L0-only | Phase 4 |
| B-02 | scaffolding-expert | Low | Add docs/ domain to propagation-map.json with source: "docs", target: "templates/common/docs", include_pattern: "*.md", recursive: true | L0-only | Phase 4 |
| B-03 | pm | Medium | Publish docs/ to templates/common/docs/ via publish-to-template.ts and validate propagation to all 5 variants | L0-only | Phase 6 |
| B-04 | auditor | Medium | Create docs/TEMPLATES.md registry to track version history of variant-execution-plan-template.md | L0-only | Phase 4 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| B-01 | Template file created at docs/templates/variant-execution-plan-template.md with all 8 parameters and usage guide | Manual file read and verification |
| B-02 | docs/ domain added to propagation-map.json with correct fields | Verify scripts/propagation-map.json |
| B-03 | Template propagated to all 5 variant templates (templates/co-*/docs/) | Run publish-to-template.ts and verify |
| B-04 | docs/TEMPLATES.md registry created with template entry | Verify docs/TEMPLATES.md exists and contains entry |
