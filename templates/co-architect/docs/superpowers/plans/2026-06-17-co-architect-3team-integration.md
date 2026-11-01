---
lang: ko
lang_reason: proper-noun
---

# co-architect 3-Team Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge co-design agents/skills into co-architect and restructure into 3 distinct teams (Design / Research / Project) with a shared PM and team-lead routing.

**Architecture:** Keep `agents/` flat directory structure; add `team:` frontmatter field to all agent files; organize AGENTS.md into 3 team sections; PM routes to design-lead / analyst / project-coordinator as team leads at Phase 0. The storyteller from co-design becomes `design-storyteller.md` to avoid collision with the existing org storyteller.

**Tech Stack:** Bun (audit scripts), Markdown frontmatter (YAML), Git (bash cp for file rename)

---

## File Map

### Modify
| File | Change |
|------|--------|
| `docs/context.md` | Replace "co-work" → "co-architect" in title + 3 references |
| `README.md` | Replace "co-work" / "Co-Work" branding |
| `README_ko.md` | Replace "co-work" branding (Korean) |
| `AGENTS.md` | Full restructure → 3-team sections + fix co-work refs |
| `agents/README.md` | Fix co-work reference (2 occurrences) |
| `agents/README_ko.md` | Fix co-work reference (2 occurrences) |
| `agents/analyst.md` | Add `team: research`, fix "co-work" → "co-architect" in body |
| `agents/content-writer.md` | Add `team: research`, fix "co-work" → "co-architect" |
| `agents/storyteller.md` | Add `team: research`, fix "co-work" → "co-architect" |
| `agents/project-coordinator.md` | Add `team: project`, fix "co-work" → "co-architect" |
| `agents/technical-writer.md` | Add `team: project`, fix "co-work" → "co-architect" |
| `agents/ms365-expert.md` | Add `team: project`, fix "co-work" → "co-architect" |
| `agents/pm.md` | Add team-routing section (3 team leads + team dispatch table) |
| `docs/co-work.context.md` | Rename → `docs/co-architect.context.md` + full rewrite |

### Create
| File | Source |
|------|--------|
| `agents/design-lead.md` | co-design (update "co-design" → "co-architect", add `team: design`) |
| `agents/ux-researcher.md` | co-design (update + `team: design`) |
| `agents/visual-designer.md` | co-design (update + `team: design`) |
| `agents/prototype-engineer.md` | co-design (update + `team: design`) |
| `agents/service-designer.md` | co-design (update + `team: design`) |
| `agents/typography-expert.md` | co-design (update + `team: design`) |
| `agents/design-storyteller.md` | co-design/agents/storyteller.md (rename + update + `team: design`) |
| `.claude/skills/service-design/SKILL.md` | co-design (copy verbatim) |
| `.claude/skills/ui-ux-design-intelligence/SKILL.md` | co-design (copy verbatim) |

### Delete
| File | Reason |
|------|--------|
| `docs/co-work.context.md` | Replaced by `docs/co-architect.context.md` |

---

## Task 1: Phase A — Identity Cleanup (docs/context.md + README files)

**Files:**
- Modify: `docs/context.md`
- Modify: `README.md`
- Modify: `README_ko.md`

- [ ] **Step 1: Update docs/context.md title and variant file references**

  Edit lines 1, 6, 9, 44, 59 of `docs/context.md`:
  - Line 1: `# co-work — Project Context` → `# co-architect — Project Context`
  - Line 6: `→ docs/co-work.context.md` → `→ docs/co-architect.context.md`
  - Line 9: `All project-specific changes belong in docs/co-work.context.md` → `All project-specific changes belong in docs/co-architect.context.md`
  - Line 44: `├── docs/         # context.md (this file) + co-work.context.md + ADRs` → `├── docs/         # context.md (this file) + co-architect.context.md + ADRs`
  - Line 59 table row: `docs/co-work.context.md` → `docs/co-architect.context.md`

- [ ] **Step 2: Update README.md branding**

  Replace in `README.md`:
  - `# co-work` → `# co-architect`
  - `**Co-Work**` → `**Co-Architect**`
  - `Co-Work` (all occurrences in body text) → `Co-Architect`
  - `co-work` (all lowercase) → `co-architect`

- [ ] **Step 3: Update README_ko.md branding**

  Same replacements as Step 2 in `README_ko.md`.

- [ ] **Step 4: Verify no stray co-work refs in these 3 files**

  ```bash
  grep -n "co-work" docs/context.md README.md README_ko.md
  ```
  Expected: no matches.

---

## Task 2: Phase A — Rename Variant Context File

**Files:**
- Rename: `docs/co-work.context.md` → `docs/co-architect.context.md`

- [ ] **Step 1: Copy + rewrite variant context file**

  ```bash
  cp docs/co-work.context.md docs/co-architect.context.md
  ```

  Then Edit `docs/co-architect.context.md`:
  - Line 1: `# co-work —co-work Configuration` → `# co-architect — co-architect Configuration`
  - Line 8: `2. docs/co-work.context.md` → `2. docs/co-architect.context.md`
  - All occurrences of `co-work` → `co-architect`

- [ ] **Step 2: Add Design Stack section after Tool Stack section**

  Insert after the Tool Stack table (before `## Agents`):

  ```markdown
  ## Design Stack

  | Layer | Technology / Standard |
  |-------|----------------------|
  | **Design Tokens** | Figma Variables / CSS Custom Properties |
  | **Component Library** | Custom / shadcn/ui |
  | **Prototyping Tool** | Figma / Framer |
  | **Handoff Format** | Figma Dev Mode / Storybook |
  | **Research Tools** | Maze, UserTesting |
  ```

- [ ] **Step 3: Replace Agents section with 3-team table**

  Replace the single agent table in the `## Agents` section with:

  ```markdown
  ## Agents

  <!-- context-proximity: agent roles summarized here for AI context window efficiency; authoritative definitions in agents/*.md -->
  <!-- Status: active | deprecated | experimental -->

  ### Design Team (Lead: design-lead)

  | Agent | File | Role | Status |
  |-------|------|------|--------|
  | Design PM (Orchestrator) | `agents/pm.md` | Cross-team orchestration, dispatch, quality gates | active |
  | Design Lead | `agents/design-lead.md` | Team lead; design system, visual direction | active |
  | UX Researcher | `agents/ux-researcher.md` | User research and usability insights | active |
  | Visual Designer | `agents/visual-designer.md` | Visual designs and component specs | active |
  | Prototype Engineer | `agents/prototype-engineer.md` | Interactive prototypes and handoff | active |
  | Service Designer | `agents/service-designer.md` | End-to-end service experience | active |
  | Typography Expert | `agents/typography-expert.md` | Type hierarchy and font systems | active |
  | Design Storyteller | `agents/design-storyteller.md` | Design philosophy and narrative foundation | active |

  ### Research Team (Lead: analyst)

  | Agent | File | Role | Status |
  |-------|------|------|--------|
  | Analyst | `agents/analyst.md` | Team lead; research, data synthesis, evidence gathering | active |
  | Content Writer | `agents/content-writer.md` | Documentation and written communications | active |
  | Storyteller | `agents/storyteller.md` | Organizational culture and change narratives | active |

  ### Project Team (Lead: project-coordinator)

  | Agent | File | Role | Status |
  |-------|------|------|--------|
  | Project Coordinator | `agents/project-coordinator.md` | Team lead; schedule, stakeholder management | active |
  | Technical Writer | `agents/technical-writer.md` | Technical documentation and specifications | active |
  | MS365 Expert | `agents/ms365-expert.md` | MS365 / SharePoint automation and publishing | active |
  ```

- [ ] **Step 4: Update Agent Dispatch Order section**

  Replace the `### Agent Dispatch Order (co-work standard)` block with:

  ```markdown
  ### Agent Dispatch Order

  ```
  Co-Architect PM
    — [Design workflow]
        design-lead → ux-researcher → visual-designer
                    → service-designer, typography-expert
                    → prototype-engineer (handoff)
                    → design-storyteller (narrative)
    — [Research workflow]
        analyst → content-writer, storyteller (parallel)
    — [Project workflow]
        project-coordinator → technical-writer, ms365-expert
  ```
  ```

- [ ] **Step 5: Delete old docs/co-work.context.md**

  ```bash
  rm docs/co-work.context.md
  ```

- [ ] **Step 6: Verify rename complete**

  ```bash
  ls docs/co-work.context.md 2>/dev/null && echo "ERROR: old file still exists" || echo "OK"
  ls docs/co-architect.context.md && echo "OK: new file present"
  grep -c "co-work" docs/co-architect.context.md
  ```
  Expected: old file absent, new file present, 0 co-work matches.

---

## Task 3: Phase A — Fix Agent README Files

**Files:**
- Modify: `agents/README.md`
- Modify: `agents/README_ko.md`

- [ ] **Step 1: Update agents/README.md**

  Replace both occurrences:
  - `co-work collaboration workflow` → `co-architect team workflow`
  - `docs/co-work.context.md § Agents` → `docs/co-architect.context.md § Agents`

- [ ] **Step 2: Update agents/README_ko.md**

  Same replacements in Korean file:
  - `co-work 협업 워크플로우` → `co-architect 팀 워크플로우`
  - `docs/co-work.context.md § Agents` → `docs/co-architect.context.md § Agents`

---

## Task 4: Phase B — Add Team Frontmatter to Existing Agents

**Files:**
- Modify: `agents/analyst.md`
- Modify: `agents/content-writer.md`
- Modify: `agents/storyteller.md`
- Modify: `agents/project-coordinator.md`
- Modify: `agents/technical-writer.md`
- Modify: `agents/ms365-expert.md`

For EACH agent file, perform these two operations:

- [ ] **Step 1: Add team field to frontmatter**

  Insert `team: <team>` after `status: active` line in each file's YAML frontmatter:
  - `analyst.md` → `team: research`
  - `content-writer.md` → `team: research`
  - `storyteller.md` → `team: research`
  - `project-coordinator.md` → `team: project`
  - `technical-writer.md` → `team: project`
  - `ms365-expert.md` → `team: project`

- [ ] **Step 2: Replace "co-work" with "co-architect" in each agent body**

  In each file, find the line like:
  `You are the [Role] for **co-work**.`
  Replace `**co-work**` with `**co-architect**`.

- [ ] **Step 3: Verify**

  ```bash
  grep -l "co-work" agents/analyst.md agents/content-writer.md agents/storyteller.md agents/project-coordinator.md agents/technical-writer.md agents/ms365-expert.md
  ```
  Expected: no output (no matches).

---

## Task 5: Phase C — Transplant Design Team Agents

Source directory: `C:/git/ai_workspace/Projects/co-design/agents/`

For each of the 6 design agents + 1 design-storyteller:

- [ ] **Step 1: Copy design-lead.md**

  ```bash
  cp C:/git/ai_workspace/Projects/co-design/agents/design-lead.md agents/design-lead.md
  ```
  Then Edit `agents/design-lead.md`:
  - Add `team: design` after `status: active`
  - Add `role_type: lead` after `team: design`
  - Replace `for **co-design**` → `for **co-architect**`

- [ ] **Step 2: Copy ux-researcher.md**

  ```bash
  cp C:/git/ai_workspace/Projects/co-design/agents/ux-researcher.md agents/ux-researcher.md
  ```
  Edit: add `team: design` frontmatter, replace `for **co-design**` → `for **co-architect**`.

- [ ] **Step 3: Copy visual-designer.md**

  ```bash
  cp C:/git/ai_workspace/Projects/co-design/agents/visual-designer.md agents/visual-designer.md
  ```
  Edit: add `team: design` frontmatter, replace `for **co-design**` → `for **co-architect**`.

- [ ] **Step 4: Copy prototype-engineer.md**

  ```bash
  cp C:/git/ai_workspace/Projects/co-design/agents/prototype-engineer.md agents/prototype-engineer.md
  ```
  Edit: add `team: design` frontmatter, replace `for **co-design**` → `for **co-architect**`.

- [ ] **Step 5: Copy service-designer.md**

  ```bash
  cp C:/git/ai_workspace/Projects/co-design/agents/service-designer.md agents/service-designer.md
  ```
  Edit: add `team: design` frontmatter, replace `for **co-design**` → `for **co-architect**`.

- [ ] **Step 6: Copy typography-expert.md**

  ```bash
  cp C:/git/ai_workspace/Projects/co-design/agents/typography-expert.md agents/typography-expert.md
  ```
  Edit: add `team: design` frontmatter, replace `for **co-design**` → `for **co-architect**`.

- [ ] **Step 7: Create design-storyteller.md from co-design's storyteller**

  ```bash
  cp C:/git/ai_workspace/Projects/co-design/agents/storyteller.md agents/design-storyteller.md
  ```
  Edit `agents/design-storyteller.md`:
  - Change `name: storyteller` → `name: design-storyteller`
  - Change `formal_name: Design Storyteller & Brand Philosopher` (keep)
  - Add `team: design` after `status: active`
  - Replace `for **co-design**` → `for **co-architect**`
  - In all references to "co-work" (if any) → "co-architect"

- [ ] **Step 8: Verify all 7 agent files exist and have team field**

  ```bash
  ls agents/design-lead.md agents/ux-researcher.md agents/visual-designer.md agents/prototype-engineer.md agents/service-designer.md agents/typography-expert.md agents/design-storyteller.md
  grep "^team:" agents/design-lead.md agents/ux-researcher.md agents/visual-designer.md agents/prototype-engineer.md agents/service-designer.md agents/typography-expert.md agents/design-storyteller.md
  ```
  Expected: all 7 files exist, each shows `team: design`.

---

## Task 6: Phase D — Update PM with Team Routing

**Files:**
- Modify: `agents/pm.md`

- [ ] **Step 1: Add team field to PM frontmatter**

  Add after `status: active`:
  ```yaml
  team: orchestration
  ```

- [ ] **Step 2: Add Team Routing section to pm.md**

  Insert after the `## Agent Roster` section (before `## Dispatch Protocol` / `<!-- VARIANT-SECTION -->`):

  ```markdown
  ## Team Structure

  This project uses a 3-team model. At Phase 0 (Project Initiation), PM selects the
  appropriate team based on project type and dispatches the relevant team lead.

  | Team | Lead | Trigger Keywords | Members |
  |------|------|-----------------|---------|
  | **Design Team** | `design-lead` | design, UI, UX, wireframe, prototype, visual, typography, service design | ux-researcher, visual-designer, prototype-engineer, service-designer, typography-expert, design-storyteller |
  | **Research Team** | `analyst` | research, analysis, report, documentation, writing, content | content-writer, storyteller |
  | **Project Team** | `project-coordinator` | schedule, coordination, stakeholders, MS365, SharePoint, publication | technical-writer, ms365-expert |

  **PM Team Selection Protocol (Phase 0)**:
  1. Classify request by trigger keywords above
  2. Dispatch ONLY the relevant team lead first
  3. Team lead assembles sub-team specialists
  4. Cross-team work: dispatch multiple team leads in parallel if request spans teams

  **Cross-Team Dispatch Example**:
  > "Create a service design report with MS365 publication"
  > → dispatch design-lead (design team) + project-coordinator (project team) in parallel
  ```

- [ ] **Step 3: Update examples in PM frontmatter**

  Update the `examples` block to include team-routing examples:
  ```yaml
  examples:
    - user: "Design our mobile onboarding flow"
      assistant: "Routing to Design Team. Dispatching design-lead as team lead."
    - user: "Research competitor pricing models"
      assistant: "Routing to Research Team. Dispatching analyst as team lead."
    - user: "Create a project status report for stakeholders"
      assistant: "Routing to Project Team. Dispatching project-coordinator as team lead."
  ```

---

## Task 7: Phase E — Copy Platform Skills

**Files:**
- Create: `.claude/skills/service-design/SKILL.md`
- Create: `.claude/skills/ui-ux-design-intelligence/SKILL.md`

- [ ] **Step 1: Create service-design skill directory and copy**

  ```bash
  mkdir -p .claude/skills/service-design
  cp C:/git/ai_workspace/Projects/co-design/.claude/skills/service-design/SKILL.md .claude/skills/service-design/SKILL.md
  ```

- [ ] **Step 2: Create ui-ux-design-intelligence skill directory and copy**

  ```bash
  mkdir -p .claude/skills/ui-ux-design-intelligence
  cp C:/git/ai_workspace/Projects/co-design/.claude/skills/ui-ux-design-intelligence/SKILL.md .claude/skills/ui-ux-design-intelligence/SKILL.md
  ```

- [ ] **Step 3: Verify both skill files exist**

  ```bash
  ls .claude/skills/service-design/SKILL.md .claude/skills/ui-ux-design-intelligence/SKILL.md
  ```
  Expected: both files present.

---

## Task 8: Phase F — Restructure AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update AGENTS.md header**

  Change line: `# AGENTS.md - Co-Work Variant` → `# AGENTS.md - Co-Architect`

- [ ] **Step 2: Update phase summary table**

  Replace `**co-work follows the standard 7-phase workflow**` with:
  `**co-architect follows the standard 7-phase workflow** across two named workflows (see below).`

- [ ] **Step 3: Add Dual Workflow section after Phase Summary table**

  Insert after the Phase Summary table:

  ```markdown
  ### Workflow Selection (Phase 0)

  PM selects workflow at project initiation based on request type:

  | Workflow | Trigger | Team Lead | Phase Notes |
  |----------|---------|-----------|------------|
  | `workflow: design` | Design, UI/UX, prototyping requests | design-lead | Phase 1: ux-researcher + design-storyteller; Phase 2: design-lead gate; Phase 3: visual-designer, service-designer, typography-expert; Phase 4: prototype-engineer |
  | `workflow: research` | Research, documentation, reporting requests | analyst | Phase 1: analyst + storyteller; Phase 3: content-writer + technical-writer; Phase 4: project-coordinator + ms365-expert |
  ```

- [ ] **Step 4: Restructure Agent Roster into 3 sections**

  Replace current `## Agent Roster` section with:

  ```markdown
  ## Agent Roster

  ### 🛠️ Orchestration
  | Agent | File | Tier | Role |
  |-------|------|------|------|
  | **Co-Architect PM** | [`agents/pm.md`](../../../agents/pm.md) | High | Cross-team orchestrator; routes to Design / Research / Project team leads |

  ---

  ### 🎨 Design Team (Lead: design-lead)
  | Agent | File | Tier | Role |
  |-------|------|------|------|
  | **Design Lead** | [`agents/design-lead.md`](../../../agents/design-lead.md) | High | Team lead; design system architecture and visual direction |
  | **UX Researcher** | [`agents/ux-researcher.md`](../../../agents/ux-researcher.md) | Medium | User research, usability analysis, insight synthesis |
  | **Visual Designer** | [`agents/visual-designer.md`](../../../agents/visual-designer.md) | Medium | Visual designs, design tokens, component specifications |
  | **Prototype Engineer** | [`agents/prototype-engineer.md`](../../../agents/prototype-engineer.md) | Medium | Interactive prototypes and handoff artifacts |
  | **Service Designer** | [`agents/service-designer.md`](../../../agents/service-designer.md) | Medium | End-to-end service experience and journey mapping |
  | **Typography Expert** | [`agents/typography-expert.md`](../../../agents/typography-expert.md) | Medium | Font selection, type hierarchy, readability |
  | **Design Storyteller** | [`agents/design-storyteller.md`](../../../agents/design-storyteller.md) | Medium | Design philosophy, brand narrative, meaning coherence |

  ---

  ### 📊 Research Team (Lead: analyst)
  | Agent | File | Tier | Role |
  |-------|------|------|------|
  | **Analyst** | [`agents/analyst.md`](../../../agents/analyst.md) | Medium | Team lead; systematic research, data synthesis, evidence gathering |
  | **Storyteller** | [`agents/storyteller.md`](../../../agents/storyteller.md) | High | Organizational culture, change narratives, historical context |
  | **Content Writer** | [`agents/content-writer.md`](../../../agents/content-writer.md) | Medium | Transforms research into documentation and communications |

  ---

  ### 📅 Project Team (Lead: project-coordinator)
  | Agent | File | Tier | Role |
  |-------|------|------|------|
  | **Project Coordinator** | [`agents/project-coordinator.md`](../../../agents/project-coordinator.md) | Low | Team lead; schedule, stakeholder communication, delivery |
  | **Technical Writer** | [`agents/technical-writer.md`](../../../agents/technical-writer.md) | Medium | Technical documentation, API references, architecture guides |
  | **MS365 Expert** | [`agents/ms365-expert.md`](../../../agents/ms365-expert.md) | Low | Microsoft 365 platform, SharePoint, Teams integration |
  ```

- [ ] **Step 5: Fix remaining co-work references in AGENTS.md**

  ```bash
  grep -n "co-work" AGENTS.md
  ```
  Replace any remaining `co-work` with `co-architect`.

- [ ] **Step 6: Verify AGENTS.md**

  ```bash
  grep -c "co-work" AGENTS.md
  ```
  Expected: 0 matches.

---

## Task 9: Phase G — QA Validation

- [ ] **Step 1: Run audit script**

  ```bash
  bun scripts/audit.ts
  ```
  Expected: exits 0. If failures, fix flagged issues before proceeding.

- [ ] **Step 2: Validate agents**

  ```bash
  bun scripts/validate-agents.ts
  ```
  Expected: all 14 agents pass validation (pm + 6 design + 3 research + 3 project + design-storyteller).

- [ ] **Step 3: Grep-check all co-work references**

  ```bash
  grep -rn "co-work" docs/ agents/ README.md AGENTS.md --include="*.md" | grep -v "DYNAMIC_SKILLS\|template-variant\|co-work.context\|scripts-snapshot\|2025-06-15\|2026-06-1"
  ```
  Expected: only intentional references (e.g., skill enum lists like `co-work | co-design`).

- [ ] **Step 4: Verify 3-team frontmatter coverage**

  ```bash
  grep -l "^team:" agents/*.md | wc -l
  ```
  Expected: 13 (all agents except pm.md which has `team: orchestration`). Total = 14.

- [ ] **Step 5: Verify platform skills**

  ```bash
  ls .claude/skills/service-design/SKILL.md .claude/skills/ui-ux-design-intelligence/SKILL.md
  ```
  Expected: both files present.

- [ ] **Step 6: Verify docs/co-architect.context.md structure**

  ```bash
  grep "^##" docs/co-architect.context.md
  ```
  Expected output includes:
  ```
  ## Tool Stack
  ## Design Stack
  ## Agents
  ## Skills
  ## Scripts
  ## Development Workflow
  ```

---

## Acceptance Criteria Summary

| # | Criterion | Verification Command |
|---|-----------|---------------------|
| AC-1 | No stray "co-work" in core docs | `grep -rn "co-work" docs/ agents/ README.md AGENTS.md` |
| AC-2 | `docs/co-work.context.md` deleted | `ls docs/co-work.context.md 2>/dev/null` → no output |
| AC-3 | All 14 agents have `team:` field | `grep -l "^team:" agents/*.md \| wc -l` → 14 |
| AC-4 | Design team: 7 agents exist | `ls agents/design-lead.md agents/ux-researcher.md agents/visual-designer.md agents/prototype-engineer.md agents/service-designer.md agents/typography-expert.md agents/design-storyteller.md` |
| AC-5 | 2 platform skills copied | `ls .claude/skills/service-design/ .claude/skills/ui-ux-design-intelligence/` |
| AC-6 | audit.ts passes | `bun scripts/audit.ts` → exit 0 |
| AC-7 | AGENTS.md has 3 team sections | `grep "Design Team\|Research Team\|Project Team" AGENTS.md` → 3 matches |
