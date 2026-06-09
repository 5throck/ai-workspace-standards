# Meeting Transcript
**Date**: 2026-06-09
**Topic**: AGENTS.md 구조적 재설계 - 중복 제거 및 CONSTITUTION.md 위임
**Participants**: architect, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**PM (Facilitator)**: 

Today's meeting reviews the structural improvements for AGENTS.md. The user has presented 6 major improvement areas:

1. **Resolve §1/§2 duplication**: Consolidate Agent Ecosystem Overview and Individual Agent Definitions
2. **Integrate PM Gateway**: Consolidate scattered PM Gateway content
3. **Integrate PM Role Boundaries**: Consolidate duplicated role boundaries content
4. **Remove CLAUDE.md/GEMINI.md duplication**: Clean up Execution Plan, 3-Tier Strategy, Permission Denial, Language Policy, §5
5. **Delete Skill Registry**: Remove that section
6. **Delegate lifecycle content to CONSTITUTION.md**: Consolidate duplicates and use citation approach

Participants, please present the validity and specific design approach for these improvements from your respective expertise areas.

---

**[Architect]**: (Round 1)

As an architecture-specialist, I will analyze the current structural problems of AGENTS.md.

**Current Structural Problems:**
1. **§1 and §2 Duplication**: §1 introduces the overall agent ecosystem, and §2 describes individual agents in detail, but agent roster and roles appear in both sections

2. **Scattered PM Gateway Content**: PM Gateway is explained in multiple places
   - §3 introduces PM Gateway Workflow
   - §3.5, §3.6, §3.7 explain each detail
   - pm.md file also has duplicate content

3. **Duplication with CLAUDE.md/GEMINI.md**: 
   - Execution Plan Boilerplate: Detailed in AGENTS.md §3.7
   - 3-Tier Strategy: Explained in AGENTS.md §3.8
   - Permission Denial Protocol: Found in AGENTS.md §3.9
   - These also exist in CLAUDE.md §5 and GEMINI.md §5

**Structural Proposal:**
- **Redefine AGENTS.md Core Role**: Focus on agent roster and inter-agent relationships
- **Integrate PM Gateway into §3**: Consolidate currently scattered PM Gateway content into §3
- **Delegate to CLAUDE.md/GEMINI.md**: Execution Plan, 3-Tier Strategy, etc. delegate to platform configuration files

docs-writer, please confirm if this structural proposal is valid from a documentation perspective.

---

**[Docs-writer]**: (Round 1)

As a documentation-specialist, I will supplement architect's proposal from a documentation perspective.

**Documentation Perspective Analysis:**
1. **§1/§2 Integration**: Agree. Consolidate §1 into "Agent Ecosystem" and provide only a simple table. Individual details go in §2.

2. **PM Gateway Integration**: Currently PM Gateway is divided into multiple sections, making it difficult to find. Integrate into §3 "PM Gateway Workflow" and reorganize subsections:
   - §3.1: Phase Determination (Deliverable-Type Gate)
   - §3.2: Execution Plan Display (Mandatory Criteria)
   - §3.3: 3-Tier Strategy (Model Selection)
   - §3.4: Permission Denial Protocol
   - §3.5: Meeting Facilitation

3. **Delegation to CLAUDE.md/GEMINI.md**: Delegate duplicated content to each platform configuration file:
   - Execution Plan Boilerplate → Fully delegate to CLAUDE.md/GEMINI.md §5
   - 3-Tier Strategy → Delegate to CLAUDE.md/GEMINI.md §5
   - Permission Denial Protocol → Keep in AGENTS.md (agent permission management)
   - Language Policy → Delegate to CLAUDE.md/GEMINI.md

4. **Skill Registry Deletion**: Agree. Since SKILLS.md exists separately, delete from AGENTS.md.

5. **Lifecycle Content Delegation**: Currently AGENTS.md has §5.6 Agent Lifecycle Management, but this should be fully delegated to CONSTITUTION.md §5.6, and AGENTS.md should provide only a simple reference.

**Documentation Structure Proposal:**
```markdown
## §1: Agent Ecosystem
- Simple agent table
- Agent classification system

## §2: Individual Agent Definitions
- Detailed definition of each agent
- Required Tools

## §3: PM Gateway Workflow
- Phase Determination
- Execution Plan Display
- 3-Tier Strategy
- Permission Denial Protocol
- Meeting Facilitation

## §4: Agent Lifecycle
- Reference to CONSTITUTION.md §5.6

## §5: Cross-Platform Considerations
- Claude Code vs Antigravity differences
```

architect, please confirm if this structure is appropriate from a technical perspective.

---

**[Architect]**: (Round 2)

I will supplement docs-writer's structural proposal from a technical perspective.

**Technical Agreement and Modifications:**
1. **§1/§2 Integration**: ✅ Fully agree. §1 provides only simple table, §2 provides only detailed definitions.

2. **PM Gateway Integration**: ✅ Agree, but propose modification to §3 structure:
   - §3.1: Phase Determination (keep in AGENTS.md)
   - §3.2: Execution Plan Display (delegate to CLAUDE.md/GEMINI.md §5)
   - §3.3: 3-Tier Strategy (delegate to CLAUDE.md/GEMINI.md §5)
   - §3.4: Permission Denial Protocol (keep in AGENTS.md - agent permissions)
   - §3.5: Meeting Facilitation (keep)

3. **Skill Registry Deletion**: ✅ Agree. Delete since SKILLS.md exists separately.

4. **Lifecycle Content Delegation**: ✅ Agree. Simplify to §4 and cite CONSTITUTION.md.

**Additional Technical Considerations:**
- **Permission Denial Protocol Location**: Since it manages agent permissions, keep in AGENTS.md but currently duplicated in pm.md. This needs to change pm.md to "refer to AGENTS.md".
- **Cross-Platform Considerations**: Currently this content is scattered. Need to integrate into §5 to clearly state Claude Code vs Antigravity differences.

**Final Technical Structure Proposal:**
```markdown
## §1: Agent Ecosystem Overview
- Agent roster table (simple)
- Agent classification (Workspace vs Variant)

## §2: Individual Agent Definitions
- Detailed definition of each agent
- Required Tools

## §3: PM Gateway Workflow
- §3.1: Phase Determination (Deliverable-Type Gate)
- §3.2: Permission Denial Protocol (agent permission management)
- §3.3: Meeting Facilitation
- Note: Refer to CLAUDE.md/GEMINI.md §5 for Execution Plan Display and 3-Tier Strategy

## §4: Agent Lifecycle
- Refer to CONSTITUTION.md §5.6 Agent Lifecycle Management
- Provide only simple state transition diagram

## §5: Cross-Platform Considerations
- Claude Code vs Antigravity differences
- Platform-specific limitations
```

docs-writer, please confirm if this final structure is clear from a documentation perspective, and if there are additional documentation tasks needed.

---

**[Docs-writer]**: (Round 2)

I will provide final confirmation from a documentation perspective on architecture-specialist's final structural proposal.

**Documentation Perspective Final Opinion:**
1. **Structure Simplification**: ✅ Fully agree. Simplify to 5 sections with clear role division.

2. **Sections to Delete**:
   - ❌ Skill Registry (delete)
   - ❌ Execution Plan Boilerplate Policy (delegate to CLAUDE.md/GEMINI.md)
   - ❌ 3-Tier Strategy (delegate to CLAUDE.md/GEMINI.md)
   - ❌ Language Policy (delegate to CLAUDE.md/GEMINI.md)
   - ❌ §5 Execution Plan Templates (delegate to CLAUDE.md/GEMINI.md)

3. **Sections to Integrate**:
   - ✅ Integrate all PM Gateway related content into §3
   - ✅ Integrate PM Role Boundaries into §3.2 Permission Denial Protocol
   - ✅ Integrate lifecycle content into §4 and cite CONSTITUTION.md

4. **New §5**: Cross-Platform Considerations is a good proposal to integrate currently scattered content.

**Additional Documentation Tasks:**
- **Modify pm.md file**: Currently pm.md has detailed PM Gateway, Permission Denial content, which should be simplified to "refer to AGENTS.md §3"
- **ADR Creation Needed**: AGENTS.md structural redesign needs to be documented as ADR-0035
- **Migration Guide**: Document needed to inform users of structural changes

**Final Documentation Structure Fixed:**
```markdown
# AGENTS.md

## §1: Agent Ecosystem Overview
### Workspace Root Agents
### L1 Template Variants
### Agent Classification

## §2: Individual Agent Definitions
### Workspace Root Agents
### L1 Template Variants

## §3: PM Gateway Workflow
### §3.1: Phase Determination (Deliverable-Type Gate)
### §3.2: Permission Denial Protocol
### §3.3: Meeting Facilitation
> Note: Refer to CLAUDE.md/GEMINI.md §5 for Execution Plan Display and 3-Tier Strategy.

## §4: Agent Lifecycle
> For full lifecycle management, refer to [CONSTITUTION.md §5.6 Agent Lifecycle Management](CONSTITUTION.md#56-agent-lifecycle-management).

### State Transition Diagram
```
[active] → [deprecated] → [archived]
```

## §5: Cross-Platform Considerations
### Claude Code vs Antigravity
### Platform-specific Limitations
```

Since we're discussing without lifecycle-manager, is it okay to finalize this structure?

---

**[Auditor]**: (Synthesis)

**Points of Agreement:**
1. **§1/§2 Integration**: Simplify Agent Ecosystem Overview to simple table, provide only detailed definitions in Individual Agent Definitions
2. **PM Gateway Integration**: Integrate scattered PM Gateway content into §3
3. **Delegation to CLAUDE.md/GEMINI.md**: Fully delegate Execution Plan, 3-Tier Strategy, Language Policy etc. to platform configuration files
4. **Skill Registry Deletion**: Delete due to duplication with SKILLS.md
5. **Lifecycle Delegation**: Fully delegate to CONSTITUTION.md §5.6 and provide only simple reference
6. **Structure Simplification**: Reorganize into 5 sections

**Open Disagreements or Unresolved Questions:**
- None (docs-writer and architect reached agreement)

**Concrete Next Action Items:**

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | docs-writer | Medium | ADR-0035: AGENTS.md structural redesign document | L0-only | Phase 2 |
| A-02 | architect | High | AGENTS.md new structure design (detailed content per section) | L0-only | Phase 2 |
| A-03 | automation-engineer | Low | AGENTS.md structure reimplementation script | L0-only | Phase 4 |
| A-04 | docs-writer | Medium | pm.md simplification (change to AGENTS.md reference) | L0-only | Phase 4 |
| A-05 | auditor | Medium | Structural redesign verification and QA | L0-only | Phase 6 |
| A-06 | docs-writer | Medium | ADR index update and CHANGELOG recording | L0-only | Phase 6 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | ADR-0035 created and reviewed | ADR file exists in docs/adr/ with complete content |
| AC-02 | AGENTS.md restructured to 5 sections | New structure implemented with clear separation |
| AC-03 | All duplicated sections removed | Skill Registry, Execution Plan Boilerplate, 3-Tier Strategy removed |
| AC-04 | pm.md simplified to AGENTS.md reference | pm.md delegates to AGENTS.md instead of duplicating content |
| AC-05 | All references properly cited | CONSTITUTION.md and CLAUDE.md/GEMINI.md references work correctly |
| AC-06 | Final QA audit passes | audit.ts runs with zero failures |