# Meeting Transcript

**Date**: 2026-06-05
**Topic**: Review and refinement of new variant creation workflow
**Participants**: pm, architect, scaffolding-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[PM]**: (Opening)

This meeting reviews the user-proposed new variant creation workflow, compares it with the current safety-os-plan Phase A→Phase B pattern, and derives the optimal workflow.

**User-Proposed Workflow**:
```
1. Design document creation
2. New project creation (without workspace root or template reflection)
3. Project refinement
4. Project migration (fitting into workspace root or template structure)
5. Template reflection and new variant creation
6. New variant validation
```

**Review Perspectives**:
- Architect: Workflow structure and step-by-step completeness
- Scaffolding-expert: Implementation feasibility and tooling support
- Auditor: Governance and quality validation perspectives

**Comparison Target**:
Current safety-os-plan Phase A→Phase B pattern:
- Phase A: Independent development in Projects/safety-os/
- Phase B: Create templates/co-safety/ → reflect to workspace root

Participants, please review the proposed workflow from your expert perspectives and identify enhancement points.

---

**[Architect]**: (Round 1)

I analyzed the user-proposed workflow from an architecture perspective.

**Workflow Structure Analysis**:

```
Step 1: Design document creation
         ↓
Step 2: New project creation (without template)
         ↓
Step 3: Project refinement
         ↓
Step 4: Project migration (workspace fitting)
         ↓
Step 5: Template reflection and variant creation
         ↓
Step 6: Validation
```

**Strengths**:
1. **Clear step separation**: Each step is clearly distinguished
2. **Iterative development**: Step 3 (refinement) → Step 4 (migration) allows progressive development
3. **Feedback loop**: Step 6 (validation) results can feedback to Steps 1-5

**Weaknesses**:
1. **Ambiguity in Step 4**: "Project migration (workspace fitting)" is unclear
   - How to handle workspace root's common/ dependencies?
   - How to separate variant-specific files?
2. **Duplication in Step 2 and Step 5**:
   - Step 2: Create project "without template"
   - Step 5: Create variant "with template"
   - Is this actually two creation tasks, or one project split into two stages?
3. **Mismatch with Phase A→Phase B**:
   - Safety-os-plan: Phase A (Projects/), Phase B (templates/ + workspace/)
   - User proposal: Step 2 (Projects/), Step 5 (templates/) - additional intermediate steps (3, 4)

**Improvement Proposal**:
Restructuring the user's workflow into **Phase A→Phase B→Phase C** makes it clearer:

```
Phase A: Prototype Development
  A-1. Design document creation (variant-execution-plan.md)
  A-2. New project creation (Projects/xxx/, common/ copy)
  A-3. Project refinement (variant-specific development)

Phase B: Workspace Integration
  B-1. Common drift verification (_ORIGIN.md, _COMMON_VERSION.md)
  B-2. Workspace fitting (organize common/ dependencies)
  B-3. Prepare promotion checklist

Phase C: Template Creation
  C-1. Create templates/co-xxx/
  C-2. Reflect to workspace root (L1→L0)
  C-3. Validation (new-project.sh/ps1 test)
```

scaffolding-expert, please review if this 3-phase structure is actually implementable.

---

**[Scaffolding-expert]**: (Round 1)

architect, excellent 3-phase structure proposal. I reviewed implementation feasibility from a scaffolding perspective.

**Current Safety-os-plan Structure**:
```
Projects/safety-os/
├── _ORIGIN.md          (list of common/ files)
├── _COMMON_VERSION.md  (workspace common version snapshot)
├── PROMOTION_CHECKLIST.md (7 promotion criteria)
├── CLAUDE.md, GEMINI.md, AGENTS.md (common/ copy)
├── agents/             (variant-specific + pm.md override)
├── skills/             (variant-specific)
└── regulations/        (variant-specific)
```

**User Proposal vs Architect Proposal Comparison**:

| Step | User Proposal | Architect Proposal | Actual Implementation |
|------|-------------|-------------------|----------------------|
| Design doc | Step 1 | A-1 | ✅ memory/xxx-plan.md |
| Project creation | Step 2 | A-2 | ✅ new-project.sh/ps1 |
| Refinement | Step 3 | A-3 | ✅ Develop agents/, skills/ |
| Migration | Step 4 | B-1~B-3 | ⚠️ Ambiguous |
| Template reflection | Step 5 | C-1~C-2 | ⚠️ Complex |
| Validation | Step 6 | C-3 | ✅ validate-templates.ts |

**3 Problems Identified**:

**1. Actual Work in Step 4 "Project Migration (Workspace Fitting)"**:
The user said "fitting into workspace root or template structure," but this is actually **two separate tasks**:
- **Workspace fitting**: Verify if Projects/xxx/ correctly uses workspace's common/ dependencies
- **Template fitting**: Verify if Projects/xxx/ structure matches templates/co-xxx/ expected structure

Doing both simultaneously in Step 4 is too complex. Needs separation.

**2. Ambiguity in Step 5 "Template Reflection and Variant Creation"**:
"Template reflection" and "variant creation" happen simultaneously, but actually:
- **Template reflection**: Copy files from Projects/xxx/ to templates/co-xxx/
- **Variant creation**: Create new project from templates/co-xxx/

Order should be reversed: First create template, then create new project from that template.

**3. Missing Promotion Criteria**:
Safety-os-plan has **PROMOTION_CHECKLIST.md** (7 criteria). The user's workflow doesn't specify this "promotion decision." Need to verify **promotion criteria satisfaction** before moving from Phase B to Phase C.

**Improvement Proposal**:
Accepting architect's 3-phase structure, I will **subdivide Phase B**:

```
Phase B: Workspace Integration & Promotion Decision
  B-1. Common drift verification (_ORIGIN.md, _COMMON_VERSION.md)
  B-2. Workspace fitting (verify common/ dependencies)
  B-3. Run promotion checklist (7 criteria)
  B-4. Promotion decision (proceed to Phase C if passed)
```

auditor, are there governance and quality validation perspectives to improve this workflow?

---

**[Auditor]**: (Round 1)

scaffolding-expert, excellent subdivision. I found improvements from a governance perspective.

**4 Enhancement Points Identified**:

**1. Missing Quality Gates** (Critical):
Current workflow lacks **quality gates**. Need **quality checks** at the end of each Phase:
- End of Phase A: "Does prototype meet requirements?"
- End of Phase B: "Is workspace integration complete?"
- End of Phase C: "Does template work correctly?"

**2. Insufficient Promotion Checklist Specificity** (High):
Safety-os-plan's PROMOTION_CHECKLIST.md has **7 criteria**:
1. Folder structure compliance
2. Agent completeness
3. Skill completeness
4. Common drift prevention
5. Platform parity
6. Documentation completeness
7. Test coverage

But scaffolding-expert's "B-3. Run promotion checklist" is too abstract. Need **concrete checklist**.

**3. Missing Rollback Mechanism** (Medium):
If problems are discovered during Phase C (Template Creation), **how to rollback**?
- Return to Phase A and start over?
- Redo workspace integration in Phase B?
- Need clear rollback strategy.

**4. Multi-Variant Parallel Development Consideration** (Low):
Current workflow assumes **single variant development**. But for **simultaneous development of 2+ variants**:
- How to share common elements between variants?
- How to resolve conflicts between variants?
- How to handle multi-variant testing?

**Improvement Proposal**:
I will improve the workflow with **explicit Quality Gates and Rollback Mechanism**:

```
Phase A: Prototype Development
  A-1. Design document creation (variant-execution-plan.md)
  A-2. New project creation (Projects/xxx/)
  A-3. Project refinement (variant-specific development)
  [Quality Gate A-1]: Prototype completeness check
  [Quality Gate A-2]: Platform parity check

Phase B: Workspace Integration & Promotion Decision
  B-1. Common drift verification (_ORIGIN.md)
  B-2. Workspace fitting (verify common/ dependencies)
  B-3. Run promotion checklist (7 criteria)
  B-4. Promotion decision
  [Rollback Option]: Return to Phase A (if promotion fails)

Phase C: Template Creation & Validation
  C-1. Create templates/co-xxx/
  C-2. Reflect to workspace root (L1→L0)
  C-3. Validation (validate-templates.ts)
  C-4. New project test (new-project.sh/ps1)
  [Quality Gate C-1]: Template validation
  [Quality Gate C-2]: Integration test
  [Rollback Option]: Return to C-1 (if validation fails)
```

pm, do you think this workflow matches the user's original intent?

---

**[PM]**: (Round 2)

auditor, excellent improvement. Let me compare with the user's proposal.

**User Proposal vs Improvement Comparison**:

| Step | User Proposal | Improvement (Auditor) | Match |
|------|-------------|---------------------|-------|
| Design doc creation | Step 1 | A-1 | ✅ Match |
| Project creation | Step 2 | A-2 | ✅ Match |
| Project refinement | Step 3 | A-3 | ✅ Match |
| Migration | Step 4 | B-1~B-4 | ⚠️ Subdivided |
| Template reflection | Step 5 | C-1~C-2 | ⚠️ Subdivided |
| Validation | Step 6 | C-3~C-4 | ✅ Match |

**Added Elements**:
1. **Quality Gates**: Quality checks at end of each Phase
2. **Rollback Options**: Explicit rollback paths on failure
3. **Promotion Criteria**: Concrete 7-item checklist

**Consistency with User Intent**:
The user's 6 steps correctly identified the **core workflow**. The improvement elaborates and specifies it.

**Additional Consideration**:
The user said "fitting into workspace root or template structure," which could mean **two scenarios**:

**Scenario 1**: Develop variant directly in workspace root
```
1. Design document creation (memory/xxx-plan.md)
2. Develop directly in workspace root (CLAUDE.md, agents/, skills/)
3. Refinement (in workspace root)
4. Workspace fitting (none - already in workspace root)
5. Extract template (workspace root → templates/co-xxx/)
6. Validation
```

**Scenario 2**: Develop variant in independent project (safety-os-plan approach)
```
1. Design document creation (memory/xxx-plan.md)
2. Independent development in Projects/xxx/
3. Refinement (in Projects/xxx/)
4. Workspace fitting (verify workspace common/ dependencies)
5. Create template (Projects/xxx/ → templates/co-xxx/)
6. Validation
```

architect, which scenario do you think is more appropriate?

---

**[Architect]**: (Round 2)

pm, excellent scenario analysis. I compared both scenarios.

**Scenario 1 vs Scenario 2 Comparison**:

| Perspective | Scenario 1 (Workspace Root) | Scenario 2 (Independent Project) |
|------------|---------------------------|--------------------------------|
| **Risk** | High (workspace root contamination possible) | Low (independent project) |
| **Speed** | Fast (work directly in workspace root) | Slow (copy to template process required) |
| **Failure Cost** | High (workspace root rollback on failure) | Low (just delete Projects/xxx/) |
| **Common Drift** | High (mixed with workspace common/) | Low (trackable via _ORIGIN.md) |
| **Actual Use Case** | co-consult (workspace-first) | co-safety (project-first) |

**Current Workspace Actual Use Cases**:
- **co-consult**: Developed first in workspace root, extracted to template later
- **co-safety**: Independent development in Projects/safety-os/, promotion later

**Recommendation**:
I recommend **Scenario 2 (Independent Project)**. Reasons:
1. **Safety**: Prevent workspace root contamination
2. **Failure Cost**: Independent project just needs deletion
3. **Common Drift Tracking**: Clear tracking via _ORIGIN.md, _COMMON_VERSION.md
4. **Safety-os-plan Validated**: Co-safety is proceeding successfully with this approach

**However**:
The user said "without template reflection in workspace root or template," which suggests they may have **intended Scenario 1**. Why?
- "Without template reflection in workspace root or template" = "directly in workspace root without going through template"
- This matches Scenario 1 definition

**Question**:
scaffolding-expert, if the user intended Scenario 1, can current workspace tooling (new-project.sh/ps1, etc.) support this? Or must we follow Scenario 2?

---

**[Scaffolding-expert]**: (Round 2)

architect, excellent question. I'll answer from a scaffolding tooling perspective.

**Current Workspace Tooling Support Status**:

| Tool | Scenario 1 Support | Scenario 2 Support | Notes |
|------|-------------------|-------------------|-------|
| new-project.sh/ps1 | ✅ Support (variant selection) | ✅ Support (variant selection) | Supports both scenarios |
| Workspace root development | ✅ Possible (work directly) | ⚠️ Not possible (need development in Projects/) | Scenario 1 only |
| Projects/xxx/ development | ✅ Possible (manual creation) | ✅ Possible (new-project.sh/ps1) | Supports both scenarios |
| Template extraction | ⚠️ Manual (workspace root → templates/) | ⚠️ Manual (Projects/xxx/ → templates/) | Automation lacking |
| validate-templates.ts | ✅ Support | ✅ Support | Supports both scenarios |

**Tooling Gap Identified**:
Currently for **both scenarios**, "Step 4/Step 5 template extraction/creation" must be done **manually**.

**Automation Need**:
Need a **script** to automate "Step 4 (migration) → Step 5 (template reflection)" proposed by the user:

**B-03 Needed**: (New action item proposal)
```
B-03 | scaffolding-expert | Low | Develop project-to-variant-pipeline.ts script
  - Automated conversion Projects/xxx/ → templates/co-xxx/
  - Automated extraction workspace root → templates/co-xxx/ (support both scenarios)
  - Automatic promotion criteria verification
  | L0-only | Phase 4
```

**Final Recommendation**:
**Use Scenario 2 (Independent Project) as default**, but develop tooling that **also supports Scenario 1**.

Reasons:
1. **Safety-os-plan Validated**: Scenario 2 is validated
2. **Flexibility**: Provide user choice
3. **Solve Tooling Gap**: Automate current manual work

pm, please finalize the workflow and configure action items.

---

**[PM]**: (Closing)

We've reached comprehensive agreement.

---

## Synthesis

**[Auditor]**: (Synthesis)

### Points of Agreement

1. **Workflow Structure Confirmation**: Agreed on 3-Phase (Prototype Development, Workspace Integration & Promotion, Template Creation & Validation) structure
2. **Scenario Selection**: Use Scenario 2 (Independent Project) as default, ensure flexibility to support Scenario 1
3. **Quality Gates Introduction**: Specify quality checks and rollback mechanisms at end of each Phase
4. **Tooling Gap Identification**: Recognized need for script to automate template extraction/creation
5. **Detailed Step Specification**: Expanded user's 6 steps into 12 detailed steps

### Open Disagreements or Unresolved Questions

None. All participants agreed on 3-Phase structure, Scenario 2 default approach, quality gates, and tooling needs.

### Concrete Next Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| B-01 | docs-writer | Medium | Update variant-execution-plan-template.md with 3-Phase workflow (A-1~A-3, B-1~B-4, C-1~C-4), quality gates, rollback options | L0-only | Phase 4 |
| B-02 | architect | High | Define 7-item promotion checklist (PROMOTION_CHECKLIST.md template structure) | L0-only | Phase 4 |
| B-03 | scaffolding-expert | Low | Develop project-to-variant-pipeline.ts script (Projects/xxx/ → templates/co-xxx/ automation) | L0-only | Phase 4 |
| B-04 | auditor | Medium | Create quality gate checklists for each Phase (Phase A, B, C criteria) | L0-only | Phase 4 |
| B-05 | pm | Medium | Document both scenarios (Scenario 1: workspace-first, Scenario 2: project-first) with pros/cons in template usage guide | L0-only | Phase 4 |

---

**[PM]**: (Closing Action)

We've established the execution plan.

**Impact of This Workflow Review**:
- **Standardization**: Standardize all variant development with 3-Phase workflow
- **Quality**: Guarantee development quality with quality gates and promotion criteria
- **Automation**: Automate manual work with project-to-variant-pipeline.ts
- **Flexibility**: Support two scenarios to provide user options

**Next Steps**:
I'll execute B-01~B-05 sequentially to complete variant execution plan template and tooling. Do you agree?

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| B-01 | docs-writer | Medium | Update variant-execution-plan-template.md with 3-Phase workflow (A-1~A-3, B-1~B-4, C-1~C-4), quality gates, rollback options | L0-only | Phase 4 |
| B-02 | architect | High | Define 7-item promotion checklist (PROMOTION_CHECKLIST.md template structure) | L0-only | Phase 4 |
| B-03 | scaffolding-expert | Low | Develop project-to-variant-pipeline.ts script (Projects/xxx/ → templates/co-xxx/ automation) | L0-only | Phase 4 |
| B-04 | auditor | Medium | Create quality gate checklists for each Phase (Phase A, B, C criteria) | L0-only | Phase 4 |
| B-05 | pm | Medium | Document both scenarios (Scenario 1: workspace-first, Scenario 2: project-first) with pros/cons in template usage guide | L0-only | Phase 4 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| B-01 | Template updated with 3-Phase workflow (12 steps), 3 quality gates (A-1, A-2, C-1, C-2), 2 rollback options | Manual file read and verification |
| B-02 | PROMOTION_CHECKLIST.md template structure defined with 7 criteria | Verify template structure created |
| B-03 | project-to-variant-pipeline.ts script developed and tested | Run script and verify automation |
| B-04 | Quality gate checklists created for Phase A (2 criteria), Phase B (integrated with B-02), Phase C (2 criteria) | Verify checklists exist |
| B-05 | Both scenarios documented in template usage guide with pros/cons analysis | Verify template guide includes scenarios |
