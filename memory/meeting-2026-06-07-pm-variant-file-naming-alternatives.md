# Meeting Transcript

**Date**: 2026-06-07
**Topic**: Alternative approaches for L1-L2 variant management structure
**Participants**: architect, docs-writer, automation-engineer
**Rounds**: 1
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**[architect]**:

Good. I will present the TEXT ONLY constrained alternatives. Besides the currently agreed `variant.md` and the user-suggested `<variant>.pm.md`, let's consider other alternatives.

**Alternative 1: variant.md (current agreement)**
- Pros: File name clearly expresses variant purpose
- Cons: Inconsistent with existing agents/ folder structure
- Scaffolding impact: Medium (new file type)

**Alternative 2: <variant>.pm.md (user suggestion)**
- Pros: Reuse existing pm.md filename, maintain folder structure
- Cons: "pm" agent name is not variant-specific
- Scaffolding impact: Minimal (use existing structure)

**Alternative 3: metadata.json**
- Pros: JSON is easy to parse, tooling-friendly
- Cons: Not markdown, reduced human readability, inconsistent with CLAUDE.md/GEMINI.md style
- Scaffolding impact: High (add JSON parsing logic)

**Alternative 4: config.yaml (or settings.yaml)**
- Pros: YAML matches proposed schema format
- Cons: Filename too generic, potential confusion with other config files
- Scaffolding impact: Medium

**Alternative 5: Hybrid structure (L1=common, L2=specific)**
- Structure: `templates/<variant>/agents/common.md` + `templates/<variant>/agents/specific.md`
- Pros: Clear separation of common/specific
- Cons: Increased complexity from file dispersion
- Scaffolding impact: High

**Alternative 6: COMMON-* marker section extension (within existing pm.md)**
- Structure: Only `<!-- VARIANT-SPECIFIC -->` sections managed by variant
- Pros: Maintain existing file structure, minimal change
- Cons: Filename still pm.md, potential confusion
- Scaffolding impact: Minimal

**Alternative 7: profiles/ folder structure**
- Structure: `templates/<variant>/profiles/<variant>.md`
- Pros: "profile" noun well expresses variant-specific characteristics
- Cons: Introduce new folder structure
- Scaffolding impact: Medium

I ask docs-writer. From these alternatives, considering **compatibility with existing scaffolding scripts**, which approach is most realistic? And which alternative best fits automation-engineer's "reuse existing pm.md file" proposal?

---

**[docs-writer]**:

Analyzing the alternatives architect presented, there's a clear ranking.

**From scaffolding compatibility perspective**:
1. **Alternative 2 (<variant>.pm.md)**: Minimal change - existing scripts already look for pm.md
2. **Alternative 6 (COMMON-* marker extension)**: Minimal change - no file structure change
3. **Alternative 1 (variant.md)**: Medium change - add new file logic

But there's a **fundamental problem**. All proposed alternatives focus on "where to store variant characteristics." But they all agree on **"how to store"** as YAML schema.

Reviewing automation-engineer's "reuse existing pm.md file" proposal:
- Filename: pm.md (unchanged)
- Content: YAML frontmatter + markdown body
- Role: Define variant-specific overrides in L0→L1→L2 extends chain

This approach is similar to **Alternative 6 (COMMON-* marker extension)** but uses more structured YAML frontmatter.

My opinion: **Alternative 2 (<variant>.pm.md) + YAML frontmatter** format is most realistic. Reasons:
1. Maintain existing folder structure
2. Minimize script changes
3. YAML frontmatter is already markdown standard
4. ".pm.md" clearly expresses "PM agent's variant-specific configuration"

automation-engineer, do you agree with this view? And how difficult is it for existing scripts to read YAML frontmatter from pm.md and reflect it in context.md?

---

**[automation-engineer]**:

docs-writer's analysis is correct. Existing scripts are hardcoded to find `templates/<variant>/agents/pm.md`, so **maintaining filename is important from practical perspective**.

**YAML frontmatter load implementation complexity**:
```typescript
// Current script logic
const pmMd = readFileSync(`templates/${variant}/agents/pm.md`, 'utf-8');

// Add YAML parsing (gray-matter library)
const { content, data } = matter(pmMd);
// data: { variant_overrides: {...} }
```

This is **not separate complex logic**. `gray-matter` or similar YAML frontmatter parser is already used in workspace.

But one **important verification** is needed. Checking current `templates/co-consult/agents/pm.md` file shows 356 lines of body content. In docs-writer's "YAML frontmatter + markdown body" structure:

1. **YAML part**: variant-specific override definitions
2. **Markdown body**: Parts variant additionally overrides from content inherited via L1 extends

Is this understanding correct? Or is it a "pure config file" with only YAML frontmatter and empty body?

architect, **structural clarity is needed**. What should L2 pm.md file **contain**?

---

**[architect]**:

As automation-engineer pointed out, **structural clarity** is needed.

**Proposed L2 pm.md file structure**:

```yaml
---
extends: ../../common/agents/pm.md
variant_overrides:
  agent_roster:
    - phase: Triage
      agents: [engagement-leader, strategy-analyst]
    - phase: Analysis
      agents: [data-analyst, industry-expert]
  workflow_phases:
    - { name: "Triage", description: "Initial client assessment" }
    - { name: "Analysis", description: "Deep dive investigation" }
  dispatch_rules:
    can_lead_phases: [0, 2, 6]
    auto_dispatch_to: [engagement-leader, solutions-architect]
  governance:
    client_approval_required: true
---
```

**Body content**: **Empty (pure config file)**

Reasons:
1. L1 is pure extends file (inherits only from L0)
2. L2 defines only variant-specific overrides in YAML
3. All content resolved via extends chain
4. Empty body makes "config file" role clear

docs-writer and automation-engineer, do you agree with this structure?

---

**[docs-writer]**:

I agree with architect's proposal. **Pure YAML config file** approach is clearest.

**Final agreement**:
- **Filename**: `pm.md` (reuse existing pm.md filename, NOT `<variant>.pm.md`)
- **Location**: `templates/<variant>/agents/pm.md`
- **Content**: YAML frontmatter only, empty body
- **Role**: Define variant-specific overrides (for extends chain)

This approach:
- ✅ Minimal change to existing scaffolding scripts
- ✅ Follow YAML standard
- ✅ Clear as config file
- ✅ Consistent with L0→L1→L2 extends chain

automation-engineer, are there technical obstacles to implementing this final agreement? Also A-02 Action Item needs to change from "variant.md YAML schema definition" to "pm.md YAML schema definition".

---

**[automation-engineer]**:

There are no technical obstacles. Using `gray-matter` parser to read YAML frontmatter and resolve extends chain logic is already used elsewhere.

**Implementation direction**:
1. A-02 Action Item: "variant.md YAML schema definition" → "pm.md YAML variant schema definition"
2. Scaffolding script modification: Add YAML parser to existing `pm.md` load logic
3. Reflect variant_overrides in context.md generation

docs-writer, how specifically should A-02 Action Item be modified?

---

**[docs-writer]**:

A-02 Action Item modification:

**Before**: "Define variant.md YAML schema - specify structure for variant metadata, agent roster, workflow phases, dispatch rules, governance requirements"

**After**: "Define pm.md YAML variant schema - specify structure for variant_overrides including agent roster, workflow phases, dispatch rules, governance requirements in YAML frontmatter format"

**Final Action Items (updated)**:

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | High | Redesign L1 pm.md as pure extends file - remove all content, add extends directive to L0 with overrides for Agent Roster/Governance Workflow sections | L0-only | Phase 1-2 |
| A-02 | docs-writer | High | Define pm.md YAML variant schema - specify structure for variant_overrides including agent roster, workflow phases, dispatch rules, governance requirements in YAML frontmatter format | L0-only | Phase 1-2 |
| A-03 | automation-engineer | Medium | Update scaffolding scripts to read pm.md YAML frontmatter - modify new-project.ts, create-l2-scaffold.ts, l2-to-variant-pipeline.ts, create-new-variant.ts to parse YAML variant_overrides and integrate into context.md generation | L0-only | Phase 4 |
| A-04 | automation-engineer | Low | Remove unused lifecycle-manager from L1 - delete templates/common/agents/lifecycle-manager.md | L0-only | Phase 4 |
| A-05 | architect | Low | Update ADR-0033 to document new L1→L2 extends pattern - add YAML variant schema documentation, clarify pure template approach with pm.md config files | L0-only | Phase 4 |

architect, do you agree with this final agreement?

---

**[architect]**:

I agree. **Final agreement**:

1. **Filename**: `pm.md` (reuse existing filename, NOT `<variant>.pm.md`)
2. **Location**: `templates/<variant>/agents/pm.md`
3. **Structure**: YAML frontmatter (variant_overrides) + empty body
4. **Role**: Define variant-specific overrides

docs-writer and automation-engineer, this completes **Round 1**. Any additional discussion, or shall we proceed to synthesizer?

---

**[docs-writer]**:

No additional discussion. Proceed to synthesizer.

---

**[automation-engineer]**:

Agreed. Proceed to synthesizer.

---

**[auditor]** (Synthesis):

**Points of Agreement**:
1. **Filename decision**: Reuse existing `pm.md` filename (do NOT introduce new `variant.md`)
2. **File format**: YAML frontmatter (variant_overrides) + empty body
3. **Location**: `templates/<variant>/agents/pm.md` (maintain existing location)
4. **Role**: Define variant-specific overrides in L0→L1→L2 extends chain
5. **Scaffolding impact**: Minimized (add YAML parser to existing pm.md load logic)

**Open Disagreements or Unresolved Questions**:
- None

**Concrete Next Action Items**:

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | High | Redesign L1 pm.md as pure extends file - remove all content, add extends directive to L0 with overrides for Agent Roster/Governance Workflow sections | L0-only | Phase 1-2 |
| A-02 | docs-writer | High | Define pm.md YAML variant schema - specify structure for variant_overrides including agent roster, workflow phases, dispatch rules, governance requirements in YAML frontmatter format | L0-only | Phase 1-2 |
| A-03 | automation-engineer | Medium | Update scaffolding scripts to read pm.md YAML frontmatter - modify new-project.ts, create-l2-scaffold.ts, l2-to-variant-pipeline.ts, create-new-variant.ts to parse YAML variant_overrides and integrate into context.md generation | L0-only | Phase 4 |
| A-04 | automation-engineer | Low | Remove unused lifecycle-manager from L1 - delete templates/common/agents/lifecycle-manager.md | L0-only | Phase 4 |
| A-05 | architect | Low | Update ADR-0033 to document new L1→L2 extends pattern - add YAML variant schema documentation, clarify pure template approach with pm.md config files | L0-only | Phase 4 |

---
*Transcript created by: pm*
*Synthesis by: auditor (cross-domain agent)*
