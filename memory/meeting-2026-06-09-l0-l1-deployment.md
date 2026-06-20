# Meeting Transcript
**Date**: 2026-06-09
**Topic**: L0→L1→L2 Deployment Strategy — workspace root file templates/common Deployment and L1 per-variant pm.md Creation Design
**Participants**: architect, docs-writer, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**PM (Facilitator)**: 

Today's meeting aims to derive a design approach for important deployment and template management tasks. There are 3 agenda items:

1. **workspace root CLAUDE.md/GEMINI.md → templates/common deployment strategy**
   - How to utilize deployment scripts
   - How to remove L0-specific content
   - How to reference template\common\docs\context.md

2. **workspace root pm.md → templates/common deployment strategy**
   - Remove L0-specific sections like Governance Workflow, Updated Role
   - Change to AGENTS.md reference method

3. **L1 variant-specific pm.md generation strategy**
   - How to consider each variant's characteristics

Participants, please share your perspectives from your respective expertise areas regarding the technical, documentation, and lifecycle aspects of this work.

---

**[Architect]**: (Round 1)

As an architecture-specialist, I will first analyze the technical aspects of this work.

**Current Problem:** L0-specific content leaks during the L0→L1 deployment process. This conflicts with the L1-L2 Fork Model defined in ADR-0031.

**Technical Analysis:**
1. **CLAUDE.md/GEMINI.md Deployment**: Currently, these files are not properly synced between L0(workspace root) and L1(templates/common). We need to apply the YAML Extends Pattern from ADR-0033 so that L1 files extend L0.

2. **Removing L0-Specific Content**: 
   - Sections related to L0→L1→L2 deployment strategy
   - Lifecycle Management Rules (scripts/.ts, templates/, agents/*.md sync rules)
   - Parts of Workspace & Template Boundary Policy
   
3. **context.md Reference Method**: To prevent L0 Leakage, change L0's CONSTITUTION.md reference to L1's template\common\docs\context.md reference.

**Technical Proposal:**
- For deployment script, extend the template sync functionality of `scripts/sync-template.ts` or `scripts/audit.ts`
- Maintain YAML frontmatter extends chain (comply with ADR-0033)

docs-writer, please confirm if this technical proposal is valid from a documentation perspective.

---

**[Docs-writer]**: (Round 1)

As a documentation-specialist, I will supplement the architect's proposal from a documentation perspective.

**Documentation Perspective Analysis:**
1. **Deployment Script Utilization**: Current scripts mainly focus on file change detection and sync between workspace root ↔ templates/common. This deployment task requires a **new script with manual trigger**.

2. **L0-Specific Content Removal Scope**: In addition to the sections mentioned by architect, we also need to remove detailed content related to execution plan boilerplate by delegating to AGENTS.md to eliminate duplication. This was recently completed.

3. **context.md Reference**: This is a **fundamental change to document structure**. At L0, we say "read CONSTITUTION.md", and at L1, we say "read context.md" - building a document reference hierarchy appropriate for each level.

**Documentation Perspective Proposal:**
- New deployment script: `scripts/deploy-to-l1.ts` (or similar name)
- This script should:
  1. Read L0 files
  2. Filter L0-specific sections
  3. Change to L1-specific references (CONSTITUTION.md → context.md)
  4. Write L1 files
  5. Update ADR index

lifecycle-manager, please confirm if this new deployment script is appropriate from a lifecycle perspective.

---

**[Lifecycle-manager]**: (Round 1)

As a lifecycle-management-specialist, I will evaluate the two experts' proposals from a lifecycle perspective.

**Lifecycle Perspective Analysis:**
1. **Lifecycle Classification of New Script**: 
   - `deploy-to-l1.ts` is classified as a **Tier 1 script** (workspace-wide templates/ configuration management)
   - Must be provided as `.sh` / `.ps1` pairs
   - Must be registered in SCRIPTS.md

2. **Change Scope Impact Analysis**:
   - **CLAUDE.md/GEMINI.md**: Platform parity mandatory - apply same changes to both platform files
   - **pm.md**: AGENTS.md update needed (reflect L1 pm.md changes)
   - **ADR index**: Need to create ADR for new deployment process

3. **variant pm.md Generation Strategy**:
   - L1 variants (co-consult, co-design, co-develop, co-security, co-work) already have pm.yaml files
   - Following YAML Extends Pattern (ADR-0033), configure these pm.yaml files to extend `templates/common/agents/pm.md`
   - This is a **confirmation of existing patterns, not a change**

**Lifecycle Perspective Proposal:**
- Phase 0: Write design document (create ADR)
- Phase 2: Architect design approval
- Phase 4: automation-engineer implements script
- Phase 6: docs-writer updates SCRIPTS.md and ADR index

architect, please confirm if this lifecycle workflow conflicts with technical implementation.

---

**[Architect]**: (Round 2)

I will respond to lifecycle-manager's proposal from a technical perspective.

**Technical Agreement and Supplement:**
1. **Script Location**: Agree with Tier 1 classification. `scripts/deploy-to-l1.ts` + `.sh`/`.ps1` pair is appropriate.

2. **YAML Extends Pattern Confirmation**: As lifecycle-manager mentioned, L1 variants' pm.yaml already follows ADR-0033 pattern. This task is **updating the extends chain**:
   - L0 pm.md changes → L1 pm.md changes → Confirm L2 pm.yaml's extends is still valid

3. **Additional Technical Considerations**:
   - Deployment script should provide **dry-run mode** (preview changes before actual file modification)
   - During L0→L1 deployment, confirm **file permission preservation** (maintain executable bit)
   - After deployment, **run audit.ts** to verify L0 Leakage

**Final Technical Design:**
```
scripts/deploy-to-l1.ts:
  Input: L0 CLAUDE.md/GEMINI.md/pm.md
  Process:
    1. Filter L0-specific sections (regex or section header-based)
    2. Change to L1-specific references (CONSTITUTION.md → templates/common/docs/context.md)
    3. Write L1 files (with backup creation)
    4. Run audit.ts (verification)
  Output: Deployed L1 files + audit results
```

docs-writer, please confirm if this design is clear from a documentation perspective, and if there are additional documentation tasks needed.

---

**[Docs-writer]**: (Round 2)

I will provide final confirmation from a documentation perspective on the architecture-specialist's final design.

**Documentation Perspective Final Opinion:**
1. **ADR Creation Necessity**: This task establishes a **new standard for L0→L1 deployment process**, so it needs to be documented as ADR-0034.
   - Title: "L0→L1 Automatic Deployment Strategy"
   - Status: Accepted (after task completion)
   - Content: Deployment script usage, section filtering rules, verification procedures

2. **Document Change Scope Final Confirmation**:
   - **CLAUDE.md/GEMINI.md**: L0→L1 deployment (2 files)
   - **pm.md**: L0→L1 deployment (1 file)
   - **AGENTS.md**: Reflect L1 pm.md changes
   - **SCRIPTS.md**: Register deploy-to-l1.ts
   - **docs/adr/0034-*.md**: Create new ADR
   - **CHANGELOG.md**: Record changes in [Unreleased] section

3. **L1 variant pm.yaml Confirmation**: As lifecycle-manager mentioned, this is a confirmation of existing patterns. Just need to verify that each variant's `agents/pm.yaml` properly extends `templates/common/agents/pm.md`.

**Additional Documentation Tasks:**
- Add **usage comments** to deployment script (specify which sections to filter)
- Save **file diff report** generated after deployment to docs/drafts/ (ensure transparency)

lifecycle-manager, please provide final confirmation from a lifecycle perspective regarding this documentation task scope.

---

**[Lifecycle-manager]**: (Round 2)

I will provide final approval/rejection opinion from a lifecycle perspective, synthesizing the two experts' input.

**Final Lifecycle Evaluation:**
1. **Script Classification and Location**: ✅ Approve - Tier 1 `scripts/deploy-to-l1.ts` + `.sh`/`.ps1` pair

2. **Document Change Scope**: ✅ Approve - All necessary files included (ADR, SCRIPTS.md, AGENTS.md, CHANGELOG.md)

3. **variant pm.yaml Confirmation**: ✅ Approve - Confirmation of existing pattern, only need validity verification after deployment

4. **Additional Lifecycle Requirements**:
   - **Prevent File Deletion**: As confirmed in the context.md recovery task, deployment script needs **file deletion prevention safeguard**
   - **Preserve Execution Permissions**: Executable bit maintenance mentioned by architect is a required script feature

**Final Proposal (Execution Plan)**:

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | Write ADR-0034 (L0→L1 deployment strategy) | docs-writer | Medium | claude-sonnet-4-6 |
| 2 | Design deploy-to-l1.ts script | architect | High | claude-opus-4-7 |
| 3 | Implement deploy-to-l1 script (.ts + .sh + .ps1) | automation-engineer | Low | claude-haiku-4-5 |
| 4 | Script testing and dry-run mode verification | auditor | Medium | claude-sonnet-4-6 |
| 5 | Execute L0 CLAUDE.md/GEMINI.md/pm.md → L1 deployment | lifecycle-manager (workspace) | Medium | claude-sonnet-4-6 |
| 6 | Update AGENTS.md, SCRIPTS.md | docs-writer | Medium | claude-sonnet-4-6 |
| 7 | Verify L1 variant pm.yaml extends chain | auditor | Medium | claude-sonnet-4-6 |
| 8 | Final QA Audit and ADR index update | auditor (workspace) | Medium | claude-sonnet-4-6 |

**Execution Order**: Sequential (each phase depends on completion of previous phase)

---

**[Auditor]**: (Synthesis)

**Points of Agreement:**
1. **Deployment Script Necessity**: `deploy-to-l1.ts` script for automating L0→L1 deployment should be placed at Tier 1 location
2. **L0-Specific Content Removal**: Need to filter L0-related sections from CLAUDE.md/GEMINI.md/pm.md
3. **context.md Reference Method**: Change L0's CONSTITUTION.md reference to `templates/common/docs/context.md` reference at L1
4. **ADR Documentation**: Need to create ADR-0034
5. **Change Scope**: CLAUDE.md/GEMINI.md/pm.md deployment + AGENTS.md/SCRIPTS.md update + ADR creation
6. **variant pm.yaml Confirmation**: Validity verification of existing YAML Extends Pattern

**Open Disagreements or Unresolved Questions:**
- None (all participants agreed)

**Concrete Next Action Items:**

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | docs-writer | Medium | ADR-0034: L0→L1 deployment strategy document | L0-only | Phase 2 |
| A-02 | architect | High | deploy-to-l1.ts script design (section filtering rules, dry-run mode) | L0-only | Phase 2 |
| A-03 | automation-engineer | Low | deploy-to-l1 script implementation (.ts + .sh + .ps1 pair) | L0-only | Phase 4 |
| A-04 | auditor | Medium | Script testing and safeguard verification | L0-only | Phase 4 |
| A-05 | lifecycle-manager | Medium | Execute L0→L1 deployment (CLAUDE.md/GEMINI.md/pm.md) | L0-only | Phase 6 |
| A-06 | docs-writer | Medium | Update AGENTS.md, SCRIPTS.md, ADR index | L0-only | Phase 6 |
| A-07 | auditor | Medium | Verify L1 variant pm.yaml extends chain + final QA | L0-only | Phase 6 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | ADR-0034 created and reviewed | ADR file exists in docs/adr/ with complete content |
| AC-02 | deploy-to-l1 script implements all required features | Script includes dry-run mode, file permission preservation, and L0 section filtering |
| AC-03 | L0→L1 deployment executed successfully | templates/common/CLAUDE.md, GEMINI.md, pm.md updated without L0 leakage |
| AC-04 | All documentation updated | AGENTS.md, SCRIPTS.md, ADR index reflect deployment changes |
| AC-05 | All variants pass verification | L1 variant pm.yaml files properly extend L1 pm.md |
| AC-06 | Final QA audit passes | audit.ts runs with zero failures |