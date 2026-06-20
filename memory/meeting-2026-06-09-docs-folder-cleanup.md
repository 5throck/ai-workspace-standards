# Meeting Transcript
**Date**: 2026-06-09
**Topic**: docs Folder Structural Redesign - Consolidation, Cleanup, superpowers Removal
**Participants**: architect, docs-writer, auditor, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**PM (Facilitator)**: 

Starting meeting for docs folder cleanup addressing three agenda items.

**Agenda 1: constitution vs designs folder integration**
- CONSTITUTION.md exists at root, but docs/constitution/ subfolder also exists
- docs/designs/ contains design documents
- Need to review integration approach and feasibility

**Agenda 2: Removing superpowers-related content**
- Whether to remove superpowers plugin-related content from all design documents
- If removed, need to also remove from GEMINI.md, CLAUDE.md

**Agenda 3: Organizing variant-related files**
- Variant-related files scattered throughout docs/
- templates/ and variant/ subfolders organization approach

Participants, please provide analysis and proposals from your respective expertise areas on these three agenda items.

---

**[Architect]**: (Round 1)

As an architecture-specialist, I will analyze the three agenda items from a technical perspective.

**Agenda 1: constitution vs designs folders**

**Current Situation Analysis**:
- `CONSTITUTION.md` (workspace root) - main document
- `docs/constitution/` - CONSTITUTION.md subsections (00-ssot-architecture.md, 05-multi-agent-architecture.md, etc.)
- `docs/designs/` - design documents (pm-md-*, deploy-to-l1-*, agents-md-*, etc.)

**Technical Analysis**:
- constitution/ contains subsections of already split CONSTITUTION.md
- designs/ contains design documents for specific features/systems
- Two folders serve different purposes: constitution=governance, designs=technical design

**Proposal**: **Maintain separation**
- constitution/ remains as "governance rules" folder
- designs/ remains as "technical design" folder
- Do not integrate as purposes are clearly different

---

**Agenda 2: Removing superpowers-related content**

**Current Situation Analysis**:
- superpowers is a Claude Code-specific plugin
- Not available in Antigravity environment
- Design documents may contain superpowers references

**Technical Analysis**:
- Platform-dependent content should be delegated to platform configuration files
- superpowers is Claude Code-specific, so should only exist in CLAUDE.md
- GEMINI.md should have Antigravity-equivalent content

**Proposal**: **Remove and delegate**
- Completely remove superpowers-related content from design documents
- Replace with platform-neutral terms like "multi-agent dispatch" or "subagent orchestration"
- Keep superpowers content in CLAUDE.md only
- No content needed in GEMINI.md (Antigravity approach already exists)

---

**Agenda 3: Organizing variant-related files**

**Current Situation Analysis**:
- Variant-related files scattered throughout docs/
- Variant folders exist under templates/
- docs/variant/ folder may exist separately

**Technical Analysis**:
- Variant-related documents logically belong in templates/{variant}/docs/
- docs/ root should only contain documents for entire workspace (L0)
- L1/L2 variant documents should be in respective variant folders

**Proposal**: **Relocate and consolidate**
- Move variant-related documents to templates/{variant}/docs/
- If docs/variant/ exists, distribute contents to appropriate variant folders
- Maintain only workspace-wide documents at docs/ root

docs-writer, please confirm if this technical proposal is valid from a documentation perspective.

---

**[Docs-writer]**: (Round 1)

As a documentation-specialist, I will supplement architect's proposal from a documentation perspective.

**Agenda 1: constitution vs designs folders**

**Documentation Perspective Analysis**:
- ✅ **Agree to maintain separation**
- constitution/ is "rules" folder (what must be done)
- designs/ is "how-to" folder (how things were designed)
- This separation clarifies document purpose, so maintain it

**Additional Proposal**:
- Could make folder names more explicit:
  - constitution/ → governance/ (more explicit terminology)
  - designs/ → design-specs/ (plural form for clarity)
- However, existing names are already established, so change is optional

---

**Agenda 2: Removing superpowers-related content**

**Documentation Perspective Analysis**:
- ✅ **Agree to remove**
- Design documents should be platform-neutral
- superpowers is Claude Code-specific plugin, so remove from design documents

**Additional Proposal**:
- Use Grep to find superpowers references
- Establish replacement terminology:
  - "superpowers plugin" → "Claude Code plugin" or "multi-agent orchestration"
  - "subagent-driven-development" → "parallel agent execution"
- Keep superpowers section in CLAUDE.md
- No additional work needed for GEMINI.md (Antigravity content already exists)

---

**Agenda 3: Organizing variant-related files**

**Documentation Perspective Analysis**:
- ✅ **Agree to relocate**
- docs/ root is for workspace-wide governance
- Variant-related documents should be in respective variant folders

**Actual File Cleanup Plan**:
1. Distribute docs/variant/ contents to appropriate templates/{variant}/docs/
2. If docs/templates/ exists, review contents and merge or delete
3. Keep templates/common/docs/ as-is (L1 common documents)

lifecycle-manager, please confirm if these proposals are appropriate from a lifecycle perspective.

---

**[Lifecycle-manager]**: (Round 1)

As a lifecycle-management-specialist, I will evaluate the two experts' proposals from a lifecycle perspective.

**Agenda 1: constitution vs designs folders**

**Lifecycle Perspective Analysis**:
- ✅ **Approve maintaining separation**
- constitution/ contains governance rules (rarely changed)
- designs/ contains technical designs (added/modified as project progresses)
- Separation maintenance is valid as lifecycle patterns differ

**Additional Proposal**:
- Consider folder name changes as breaking changes
- Existing names are well-established, so do not change
- Instead, recommend adding README.md to each folder to clarify purpose

---

**Agenda 2: Removing superpowers-related content**

**Lifecycle Perspective Analysis**:
- ⚠️ **Need careful approach to removal**
- Need to find superpowers-related references
- May exist in ADRs as well as design documents

**Proposal**:
- **Phase 1**: Use grep to find all superpowers references
- **Phase 2**: Remove from design documents and replace with platform-neutral terms
- **Phase 3**: Review and modify CLAUDE.md/GEMINI.md as needed
- **Phase 4**: Review and modify ADRs as needed

---

**Agenda 3: Organizing variant-related files**

**Lifecycle Perspective Analysis**:
- ✅ **Approve relocation**
- Variant documents should be managed together with variant lifecycle
- templates/{variant}/docs/ is the logical location

**Actual Cleanup Plan**:
- Need to identify current variant-related files in docs/
- Use git mv for moves to preserve history
- ADR index update required if exists

architect, docs-writer, please provide your opinions on this lifecycle perspective proposal.

---

**[Architect]**: (Round 2)

I will supplement lifecycle-manager's proposal from a technical perspective.

**Agenda 1: constitution vs designs folders**
- ✅ **Confirm maintaining separation**
- Agree to add README.md to clarify purpose

**Agenda 2: superpowers removal**
- ✅ **Confirm 4-phase approach**
- Agree to grep survey then removal approach

**Agenda 3: variant cleanup**
- ✅ **Confirm relocation**
- Agree to use git mv

**Additional Technical Execution Plan**:
- grep command: `grep -r "superpowers" docs/ --include="*.md" -i`
- Replacement terms: "multi-agent orchestration", "parallel agent execution", "Claude Code plugin"
- Removal targets: design documents, ADRs (selective)
- Keep targets: CLAUDE.md (Claude Code-specific sections)

docs-writer, please confirm the final execution plan.

---

**[Docs-writer]**: (Round 2)

I will provide final confirmation synthesizing technical and lifecycle proposals.

**Final Agreement**:

**Agenda 1: constitution vs designs**
- ✅ **Maintain separation confirmed**
- Clarify purpose with README.md addition
- No folder name changes (avoid breaking changes)

**Agenda 2: superpowers removal**
- ✅ **Removal confirmed** (4-phase approach)
- Phase 1: grep comprehensive survey
- Phase 2: Remove from design documents and replace
- Phase 3: Review CLAUDE.md/GEMINI.md
- Phase 4: Review ADRs

**Agenda 3: variant cleanup**
- ✅ **Relocation confirmed**
- Use git mv to preserve history
- Move to templates/{variant}/docs/

**Additional Work**:
- ADR index update (reflect variant document moves)
- docs/README.md update (reflect new structure)

auditor, please confirm if this final agreement is approvable from a review perspective.

---

**[Auditor]**: (Round 2)

I will provide final evaluation from a review perspective on the three experts' agreement.

**Agenda 1: constitution vs designs separation**
- ✅ **Approve** - Separation maintenance is valid as purposes are clearly different
- ⚠️ **Review requirement** - When adding README.md, verify actual readability

**Agenda 2: superpowers removal**
- ✅ **Approve** - 4-phase approach is prudent and appropriate
- ⚠️ **Review requirement** - Need to identify actual superpowers references before removal

**Agenda 3: variant relocation**
- ✅ **Approve** - git mv usage is appropriate and safe
- ⚠️ **Review requirement** - After move, verify ADR index and internal links

**Final Review Conclusion**:
- ✅ **Overall approval** - All agenda items are valid with appropriate approaches
- ⚠️ **Pre-investigation needed** - Need grep analysis and file confirmation to understand current state
- ⚠️ **Verification phase needed** - Link validation and ADR index update after changes

---

**[Auditor]**: (Synthesis)

**Points of Agreement**:
1. **Maintain constitution vs designs separation**: Purposes are different, maintain separation, clarify with README.md
2. **Remove superpowers (4-phase)**: grep survey → remove from design docs → review CLAUDE.md/GEMINI.md → review ADRs
3. **Relocate variant files**: Use git mv to move to templates/{variant}/docs/, preserve history
4. **Pre-investigation needed**: Current state analysis via grep and file confirmation required
5. **Verification phase needed**: Link validation and ADR index update after changes

**Open Disagreements or Unresolved Questions**:
- None (full agreement reached)

**Concrete Next Action Items**:

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | auditor | Medium | docs/ folder current state analysis (superpowers grep, variant file confirmation) | L0-only | Phase 1 |
| A-02 | architect | High | docs/ structure redesign final specification (including README content) | L0-only | Phase 2 |
| A-03 | automation-engineer | Low | superpowers removal script (batch document processing) | L0-only | Phase 4 |
| A-04 | automation-engineer | Low | Variant file relocation script (using git mv) | L0-only | Phase 4 |
| A-05 | docs-writer | Medium | Create README.md (for constitution/, designs/) | L0-only | Phase 4 |
| A-06 | docs-writer | Medium | Update ADR index (reflect variant moves) | L0-only | Phase 6 |
| A-07 | auditor | Medium | Link validation and final QA | L0-only | Phase 6 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | docs/ state analysis completed | Grep results and file inventory documented |
| AC-02 | README.md files created | constitution/ and designs/ have descriptive README.md |
| AC-03 | All superpowers references removed | Design documents are platform-neutral |
| AC-04 | Variant files relocated | All variant docs in templates/{variant}/docs/ |
| AC-05 | ADR index updated | All variant-related ADR references correct |
| AC-06 | All links validated | No broken internal links after reorganization |
| AC-07 | Final QA audit passes | audit.ts runs with zero failures |
