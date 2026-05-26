# Meeting Transcript
**Date**: 2026-05-27
**Topic**: Workspace root and template lifecycle management review and MD file consistency check
**Participants**: PM, Architect, Auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[PM (Facilitator)]**

Hello everyone. Today's meeting is "Reviewing agent, skill, and script lifecycle management across workspace root and templates, and checking MD file consistency to improve operational stability and maintainability."

Following the recent CONSTITUTION.md hub-and-spoke restructure, lifecycle-related content has been significantly strengthened. However, we need to examine how this impacts actual operations and whether any improvements are needed.

Architect, could you review how agent, skill, and script lifecycle management is currently implemented across the workspace root and templates, and whether the connections between each lifecycle are properly maintained?

---

**[Architect]**

Yes, PM. First, let me examine this from a structural perspective.

**Current Status:**

1. **Agent Lifecycle**: §5.6 has added a States table (active/deprecated/retired) and ownership concept. Each agent in the agents/ directory now clarifies its current state through the status field. `agent-lifecycle-audit.ts` performs health checks.

2. **Skill Lifecycle**: §6 was renamed to "06-skill-lifecycle.md," reorganizing around lifecycle. Creation workflow, registration checklist, and version bump rules (patch/minor/major) are now clear. `skill-lifecycle-audit.ts` manages this.

3. **Script Lifecycle**: §6.5 has added dependency tracking. The SCRIPTS.md Registry has a `depends_on` field, and `verify-scripts.ts` checks for circular dependencies.

**Problems Found:**

However, there's an important **broken link** risk:

- **AGENTS.md** agent table has references to `CONSTITUTION.md §5`, but with the hub-and-spoke split, actual links might break. The hub has section summaries, but detailed content is in separate files, so links like `CONSTITUTION.md#5-multi-agent-architecture` still work, but direct references to specific subsections (e.g., §5.1) within text might break.

- **Template variant context.md files**: co-develop, co-design, co-work's `docs/context.md` (immutable) and `docs/*.context.md` (mutable) have references like `CONSTITUTION.md §5`, `CONSTITUTION.md §6` using relative paths, which will break after deployment.

---

**[Auditor]**

Correct, Architect. Let me report additional issues found from actual operations perspective.

**audit.sh Execution Results:**
- ✅ Constitution section files: All exist and non-empty
- ✅ Agent audit: All agents healthy
- ✅ Skill audit: All skills healthy

**But Consistency Issues:**

1. **MD File Reference Consistency:**
   - `AGENTS.md` → `CONSTITUTION.md §5` reference: Hub works but direct subsection reference is risky
   - `docs/context.md` → `CONSTITUTION.md §8` reference: Using relative path → breaks after deployment
   - Template variant CLAUDE.md/GEMINI.md: Modified to reference `templates/common/docs/context.md` (good)

2. **Data Consistency Risk:**
   - When an agent is deprecated, AGENTS.md and the agent's status field must sync, but there's no audit rule enforcing this
   - When a skill is deprecated, how do we update references in co-design.context.md, co-work.context.md?

3. **Operational Burden Unclear:**
   - Who updates the L0 template (common/scripts) SCRIPTS.md Registry and when?
   - Who performs moving/deleting deprecated agents/skills to archive after 90 days?
   - Without automation, these are easy to miss.

---

**[PM]**

Good. Architect identified structural issues, Auditor identified operations/consistency issues.

I see **three key improvement areas**:

1. **Solve Dead Link Problem**: Change direct subsection references in AGENTS.md etc. to safe methods (anchor ID usage or hub section summary reference)
2. **Post-Deployment Path Problem**: Standardize relative paths to absolute paths or web URLs
3. **Automation Strengthening**: Need automation scripts for archive move/delete after deprecated period, approver state sync

Auditor, which of these three improvements should we prioritize?

---

**[Auditor]**

Priority is as follows:

**Urgent (Stability Threat):**
1. **Post-Deployment Path Standardization**: Relative path → web URL (partially done already)
2. **Dead Link Resolution**: Change direct subsection references to section header anchor IDs

**Medium-term (Operational Efficiency):**
3. **Automation Scripts**: Deprecated → archive/cleanup automation
4. **Data Sync Strengthening**: Strengthen errors on state mismatch during audit

**Long-term (Structure):**
5. **Establish Lifecycle Management Workflow**: Automate PM-led regular review and cleanup meetings

Architect, how about starting with items 1 and 2 (Dead Link, path standardization)?

---

**[Architect]**

Yes, I'll start with item 1 (Dead Link resolution).

**Dead Link Resolution Approach:**

**Option A: Anchor ID-based Reference**
- Pro: Anchor ID remains even if section header changes
- Con: Readability might decrease (when header text changes)

**Option B: Hub Section Summary + Anchor ID Mix**
- Pro: Natural context, safe when used with ID
- Con: Need to define anchor ID rules

**Proposal:**
- **AGENTS.md**: `CONSTITUTION.md §5.1` → `CONSTITUTION.md#agent-file-format-standard-frontmatter` (add anchor ID)
- **Template context.md**: Change subsection references to anchor IDs
- Keep hub one-line summary (for readability)

Shall we proceed with this approach?

---

**[Auditor]**

Yes, proceed with that approach. However, anchor IDs need to be rule-governed.

**Anchor ID Rule Proposal:**
- Use lowercase, hyphens, numbers only after `#` in section header
- Example: `# 5.1 Agent File Format` → `#agent-file-format-standard-frontmatter`
- Example: `## Workspace Overview` → `#workspace-overview`

Architect, with this rule, we also need to organize header IDs in docs/constitution/ section files. Currently section files are pure numbers without anchor IDs (`01-folder-structure.md`, `02-memory-system.md`, etc.).

---

**[Architect]**

Correct. I'll define anchor ID rules and update section file headers.

**Anchor ID Rules:**
- Use only lowercase, hyphens, numbers
- Convert section title to kebab-case
- Example: `5.1` → `agent-file-format-standard-frontmatter`

**Work Scope:**
1. Create header IDs for 10 docs/constitution/ files (01-folder-structure.md → #folder-structure)
2. Change AGENTS.md subsection references to anchor IDs
3. Change template context.md file references to anchor IDs
4. Test: Run audit.sh then check links with gh pr preview

Auditor, is this work scope appropriate?

---

**[PM]**

Yes, appropriate. And let's also proceed with **post-deployment path standardization**.

**Current Status:**
- templates/common/docs/context.md: Already changed to web URL ✅
- templates/co-design/docs/context.md, templates/co-work/docs/context.md: Need to change to web URL
- CONSTITUTION.md hub: Section summary + subsection anchor ID reference

**Work Sequence:**
1. **Phase 1** (Architect): docs/constitution/ header ID creation + AGENTS.md anchor ID reference
2. **Phase 2** (Architect): Template context.md files web URL + anchor ID reference
3. **Phase 3** (Auditor): audit.sh additional verification (link break test)
4. **Phase 4** (PM): Commit complete then create PR

Shall we start?

---

**[Architect]**

(Round 2)

Yes, let's start. First, I'll create header IDs for docs/constitution/ section files and organize subsection references.

**Phase 1: docs/constitution/ Header ID Definition**

| File | Current Header | New Anchor ID |
|------|----------------|---------------|
| 01-folder-structure.md | # 1. Standard Folder Structure | #standard-folder-structure |
| 02-memory-system.md | # 2. Memory System | #memory-system |
| 03-pr-workflow.md | # 3. GitHub PR Workflow | #github-pr-workflow |
| 04-i18n.md | # 4. Internationalization (i18n) | #internationalization |
| 05-multi-agent-architecture.md | # 5. Multi-Agent Architecture | #multi-agent-architecture |
| 05.6-agent-lifecycle.md | # 5.6 Agent Lifecycle Management | #agent-lifecycle-management |
| 06-skill-lifecycle.md | # 6. Skills | #skills |
| 06.5-script-lifecycle.md | # 6.5 Script Lifecycle Management | #script-lifecycle-management |
| 07-new-project.md | # 7. New Project Initialization | #new-project-initialization |
| 08-coding-guidelines.md | # 8. Coding Behavior Guidelines | #coding-behavior-guidelines |

**Phase 2: AGENTS.md Reference Update**

Current: `CONSTITUTION.md §5.1` → New: `CONSTITUTION.md#agent-file-format-standard-frontmatter`

**Phase 3: Template context.md Reference Update**

- `CONSTITUTION.md §5` → `CONSTITUTION.md#multi-agent-architecture`
- `CONSTITUTION.md §6` → `CONSTITUTION.md#skills`
- `CONSTITUTION.md §8` → `CONSTITUTION.md#coding-behavior-guidelines`

**Phase 4: Web URL Standardization**

- `https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md#anchor`

I think proceeding in this order is good. Auditor, do you agree?

---

**[Auditor]**

Yes, I agree. And it would be good to define **automation scripts** together.

**Automation Script Proposal:**

1. **Agent/State Sync Script**:
   - When `status: deprecated` setting in `agents/*.md` is detected
   - Automatically change agent's status in AGENTS.md to deprecated
   - Move to `agents/_archive/` after 30 days

2. **Skill/State Sync Script**:
   - When `status: deprecated` setting in `skills/*/SKILL.md` is detected
   - Automatically update Skills table in AGENTS.md and docs/context.md
   - Move to `skills/_archive/` after 30 days

3. **Script/State Sync Script**:
   - Check `status: deprecated` items in SCRIPTS.md
   - Display warning message when dev-sync.sh runs

PM, shall we include implementing these automation scripts?

---

**[PM]**

Yes, let's include them and proceed in the following 4 steps:

**A-01** (Architect): docs/constitution/ header ID creation + reference anchor ID update
**A-02** (Architect): Template context.md web URL + anchor ID reference update
**A-03** (Auditor): Link verification with audit.sh
**A-04** (Automation-Engineer): Automation script implementation (deprecated detection → archiving/deletion)

---

**[PM]**

(Synthesis)

## Summary of Agreements

### 1. Agreements

**A. Dead Link Resolution and Anchor ID Standardization**
- Change docs/constitution/ section file headers to kebab-case anchor IDs
- Change subsection references in AGENTS.md and template context.md to anchor ID-based
- Web URL standardization for post-deployment operation (`https://raw.githubusercontent.com/...`)

**B. Automation Strengthening**
- Agent/Skill deprecated state detection → automatic archiving/move, AGENTS.md sync
- Script deprecated state confirmation → dev-sync.sh warning message
- This automation clarifies operational burden and ensures stability

**C. Template Integration**
- Delete individual variant context.md → keep only templates/common/docs/context.md
- Integrate Lifecycle Management section as common

### 2. Unresolved Issues

- **Subsection Reference Links**: Risk of breaking after deployment when directly referencing subsections in AGENTS.md etc.
- **Lack of Automation**: No process to manually handle deprecated agents/skills
- **Unclear Operational Burden**: Person responsible for archive move/deletion work not clear

### 3. Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | Architect | docs/constitution/ header ID creation + AGENTS.md anchor ID reference update | Implementation |
| A-02 | Architect | Template context.md web URL + anchor ID reference update | Implementation |
| A-03 | Auditor | Link verification and testing with audit.sh | Verification |
| A-04 | Automation-Engineer | Agent/Skill deprecated detection → archiving/move automation | Implementation |
| A-05 | PM | Commit complete then create PR and merge | Finalization |

---

**[PM]**

Meeting adjourned. Thank you, Architect and Auditor.

---