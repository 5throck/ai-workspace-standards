# Meeting Transcript

**Date**: 2026-06-08  
**Topic**: PM.md Variant-Specific Content Injection Issues Resolution Discussion  
**Participants**: architect, automation-engineer, auditor  
**Rounds**: 2  
**Language**: Korean (transcript saved in English)  
**Status**: Complete

---

## Transcript

**PM (Facilitator)**: Today's meeting is convened to resolve PM.md variant-specific content injection issues. We have identified 6 current problems:

1. Agent Roster Responsibility field empty
2. Phase Determination table shows L0 agents instead of variant agents  
3. Platform Note (L0-only) unnecessary
4. Root Configuration Changes terminology issue
5. MANDATORY dispatch list contains L0 agents
6. CONSTITUTION.md reference issue

The core issue is that merge-frontmatter.ts is not properly utilizing variant_overrides.agent_roster information. Let's hear from each expert.

---

**[Architect]**: (Round 1)

From a design perspective, the current problem is that **the intent of the L0→L1→L2 extends chain is not properly reflected in the implementation**.

ADR-0033 clearly states that L0 is the single source of truth for workspace governance, L1 is a pure intermediary, and L2 defines variant-specific characteristics. However, the actual merge-frontmatter.ts still processes L0 body content in a "copy-paste" manner.

In particular, the **Phase Determination table** is key. Currently, L0 has workspace-specific agents (automation-engineer, docs-writer, architect, auditor) hardcoded. This gets copied as-is to L2 variants, which is the problem.

Design Proposal:
1. **Layout Reconstruction v1.5.0+** implementation: dynamically reconstruct variant-specific sections
2. **Agent Type Mapping**: Extract agents from variant_overrides.agent_roster and map them to deliverable types
3. **Section Injection Strategy**: Transition from remove_sections + prepend variant sections approach to complete reconstruction

**automation-engineer**, from your perspective on the current merge-frontmatter.ts implementation, is this feasible?

---

**[Automation-engineer]**: (Round 1)

From a code perspective, **the current merge-frontmatter.ts can implement this.** However, there are some technical constraints:

Current Implementation Status:
- Lines 1136-1252 already contain PM file detection and layout reconstruction logic
- isPMFile = filePath.toLowerCase().endsWith('agents/pm.md') for detection
- PM_CUSTOM_SECTIONS array to manage custom sections

**Technical Feasibility**:
1. **Responsibility field**: variant_overrides.agent_roster doesn't have a responsibility field. The current YAML schema has `responsibility?: string`, but the template has empty values. **This is a template data issue.**

2. **Dynamic Phase Determination table generation**: **Feasible.** We can create AGENT_TYPE_MAP to:
   ```typescript
   const AGENT_TYPE_MAP = {
     design: extractFromRoster('design', variant_overrides.agent_roster),
     execution: extractFromRoster('execution', ...),
     qa: extractFromRoster('qa', ...)
   };
   ```
   Extract agent types from roster and dynamically generate the table.

3. **remove_sections processing**: Current code doesn't support this. L1's remove_sections list should apply to L2 as well, but this isn't implemented.

**Implementation Difficulty**:
- Dynamic Phase Determination table: Medium (~2-3 hours)
- remove_sections chain propagation: Low (~30 minutes)
- Platform Note removal: Trivial (~10 minutes)
- Template data population (Responsibility field): **This requires template modification**

**architect**, from a design perspective, how should we approach the Responsibility field? Should we modify the template or create fallback logic in merge-frontmatter.ts?

---

**[Auditor]**: (Round 1)

From a quality and validation perspective, **the current problem is a governance violation**.

**Critical Issues**:
1. **L0 Leakage**: Phase Determination table shouldn't show "ai-workspace-standards". This should be caught by audit.ts's L0 Leakage Detection, but current logic is missing it.

2. **Agent Name Contamination**: L0 agent names (automation-engineer, docs-writer) shouldn't appear in variant pm.md. Current audit is also missing this.

**Validation Strategy**:
```typescript
// Current audit.ts L0_INDICATORS
const L0_INDICATORS = [
  "ai-workspace-standards",
  "workspace root", 
  "cross-platform template scripts"
];
// This should also be checked within Phase Determination tables
```

**Test Coverage**:
- Edge case #1 Missing L0 Section: Not currently implemented
- Edge case #7 Conflicting variant_sections: Not currently implemented
- Agent Substitution Validation: Insufficient tests

**Quality Gate Enhancement Proposal**:
1. Add **Phase Determination Table Validation** to audit.ts
2. Add **Agent Substitution Map Completeness Check**
3. **Template YAML Validation**: Warn if responsibility field is empty

**automation-engineer**, can you take a test-first approach when implementing? Current test coverage is insufficient, creating high regression risk.

---

**[Architect]**: (Round 2)

Synthesizing **automation-engineer**'s and **auditor**'s inputs, I'll clarify the design approach.

**Responsibility Field Problem Resolution**:
I propose a **Template Modification + Fallback Logic** hybrid approach:
1. Add responsibility field to each L2 template's variant_overrides.agent_roster
2. If empty, fallback from group field: `responsibility: ${group} specialist`

**Why this approach**:
- Template data is the source (single source of truth)
- Fallback ensures backward compatibility
- Group-based fallback is semantically meaningful (Analysis → "Analysis specialist")

**Phase Determination Dynamic Generation Design**:
```typescript
// Pseudo-code
function generatePhaseDeterminationTable(variant_overrides) {
  const agentTypeMap = extractAgentTypes(variant_overrides.agent_roster);
  
  return {
    "New file design": { phase: "1-2", agent: agentTypeMap.design || 'architect', tier: 'High' },
    "Script implementation": { phase: "4", agent: agentTypeMap.execution || 'automation-engineer', tier: 'Low' },
    // ...
  };
}

function extractAgentTypes(roster) {
  // Extract agent type from roster based on group/phase
  // Design group → design type
  // Execution group → execution type  
  // Analysis group → qa type
}
```

**auditor**, is this approach governance-wise sound? Particularly, I need validation that the agent type inference logic is semantically valid.

---

**[Automation-engineer]**: (Round 2)

**architect**'s proposal is implementable. **Implementation Plan**:

**Phase 1: YAML Schema Extension** (30 min)
```yaml
// L2 template schema
agent_roster:
  - phase: Research
    group: Analysis
    agents:
      - name: analyst
        file: agents/analyst.md
        responsibility: "Domain knowledge and business analysis"  # NEW
```

**Phase 2: merge-frontmatter.ts Layout Reconstruction** (2-3 hours)
1. `generateAgentRosterTable()` function: Generate 4-column table with responsibility
2. `generatePhaseDeterminationTable()` function: Dynamic table generation
3. `extractAgentTypes()` function: Infer agent types from roster
4. `injectVariantDispatchList()` function: Update MANDATORY dispatch list
5. `removeL0OnlyContent()` function: Remove Platform Note

**Phase 3: remove_sections Chain Propagation** (30 min)
```typescript
// Inherit L1's remove_sections in L2 as well
const inheritedRemoveSections = [
  ...(l1RemoveSections || []),
  ...(l2RemoveSections || [])
];
```

**Phase 4: Test Suite** (1-2 hours)
```typescript
describe('PM.md Layout Reconstruction', () => {
  test('should populate Responsibility field from roster', () => {
    // Verify responsibility field is not empty
  });
  
  test('should generate Phase Determination with variant agents', () => {
    // Verify variant agents appear, not L0 agents
  });
  
  test('should remove Platform Note from L2 variants', () => {
    // Verify Platform Note removal
  });
  
  test('should update MANDATORY dispatch list', () => {
    // Verify update to variant agents
  });
});
```

**Total Estimated Time**: 4-6 hours

**architect**, can you clearly define the group → type mapping spec? I need explicit specification of which groups map to which types.

---

**[Auditor]**: (Round 2)

Reviewing both discussions and proposing **final validation from a quality and governance perspective**.

**Group → Type Mapping Spec Review**:
**architect**'s proposed semantic mapping is valid:
```
Design/Direction/Visual groups → design type
Execution/Prototype groups → execution type
Analysis/Research/Subject Matter groups → qa type
Coordination/Management → pm type (or orchestrator)
Tools/Office → infrastructure type
Content/Narrative → documentation type
```

**Risk Assessment**:
1. **Ambiguous Groups**: What if the group is "Strategy"? Unclear whether it's qa type or design type.
   - **Mitigation**: User warning + manual mapping required for ambiguous group names

2. **Missing Agent Types**: What if roster doesn't have a design type agent?
   - **Fallback**: Use architect as default (for workspace governance)

**Critical Validation Criteria**:
1. **No L0 Leakage**: Phase Determination table must never contain L0 agent names (automation-engineer, docs-writer, architect, auditor, security-expert, scaffolding-expert)
2. **Responsibility Completeness**: All roster entries must have non-empty responsibility
3. **MANDATORY Dispatch List Accuracy**: Must consist only of variant agents

**Test Requirements**:
```typescript
// Must-have tests
test('L0_AGENT_NAMES should not appear in Phase Determination', () => {
  const forbidden = ['automation-engineer', 'docs-writer', 'architect', 'auditor', 'security-expert', 'scaffolding-expert'];
  const generated = generatePhaseDeterminationTable(coWorkOverrides);
  forbidden.forEach(agent => {
    expect(generated).not.toContain(agent);
  });
});

test('All roster entries must have non-empty responsibility', () => {
  const roster = extractRoster(coWorkOverrides);
  roster.forEach(entry => {
    expect(entry.responsibility).toBeTruthy();
    expect(entry.responsibility.length).toBeGreaterThan(0);
  });
});
```

**Approval Criteria**:
1. After implementation, run audit.ts → all checks PASS
2. Generate new test project → manual pm.md review
3. Generate all 5 variants → validate each

Before starting implementation, are you confident you can meet these validation criteria?

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | architect | High | Define Group → Type Mapping Spec for all 5 variants (co-consult, co-design, co-develop, co-security, co-work) with fallback hierarchy | 1-2 |
| A-02 | architect | High | Update L2 template YAML schemas to include `responsibility` field in agent_roster entries | 1-2 |
| A-03 | automation-engineer | Medium | Implement `generateAgentRosterTable()` with responsibility field population in merge-frontmatter.ts | 4 |
| A-04 | automation-engineer | Medium | Implement `generatePhaseDeterminationTable()` with dynamic agent type extraction in merge-frontmatter.ts | 4 |
| A-05 | automation-engineer | Low | Implement `remove_sections` chain propagation (L1 → L2 inheritance) in merge-frontmatter.ts | 4 |
| A-06 | automation-engineer | Low | Implement `removeL0OnlyContent()` to strip Platform Note from L2 variants in merge-frontmatter.ts | 4 |
| A-07 | auditor | Medium | Create test suite for PM.md Layout Reconstruction (4 critical tests: L0 Leakage Prevention, Responsibility Completeness, Phase Determination Accuracy, MANDATORY Dispatch List) | 4 |
| A-08 | auditor | Medium | Implement `injectVariantDispatchList()` to update MANDATORY dispatch list with variant agents in merge-frontmatter.ts | 4 |
| A-09 | auditor | Low | Run audit.ts and manual validation on all 5 variants after implementation | 6 |

**Total Estimated Effort**: 6-8 hours (A-01, A-02: 2h | A-03, A-04, A-05, A-06, A-08: 4h | A-07, A-09: 2h)

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | No L0 agent names in Phase Determination table | Audit verification + manual review |
| AC-02 | All roster entries have non-empty Responsibility field | Test suite validation |
| AC-03 | Platform Note removed from L2 variants | Manual verification |
| AC-04 | MANDATORY dispatch list contains only variant agents | Test suite + manual verification |
| AC-05 | remove_sections properly inherited from L1 to L2 | Cross-variant validation |
