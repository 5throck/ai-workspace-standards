# AGENTS.md

**Workspace Root Agent Ecosystem**

> **🚨 For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI).

This document is the **Single Source of Truth (SSOT)** for the agent ecosystem, individual agent definitions, PM Gateway workflow, and execution plan templates.

---

## §1: Agent Ecosystem Overview

### 🎯 Agent Roster (Roles Overview)

| Agent | File | Tier | Role |
|-------|------|------|------|
| **Project Manager (PM) Agent** | [`agents/pm.md`](agents/pm.md) | High | Orchestrates team assembly (Phase 0), design validation (Phase 2), and lifecycle finalization (Phase 6). **PM does NOT execute code or documentation directly — all specialist work dispatched through PM.** |

<!-- VARIANT-AGENTS-START -->
| **design** | [`agents/design.md`](agents/design.md) | Medium | Locks visual design style — color palette, fonts, layout into design_spec.md |
| **html-build** | [`agents/html-build.md`](agents/html-build.md) | Medium | Generates HTML slides from slide_deck.md and design_spec.md; applies theme |
| **image-curator** | [`agents/image-curator.md`](agents/image-curator.md) | Medium | Searches and downloads commercial-use images → assets/images/ + image-manifest.json |
| **diagram-specialist** | [`agents/diagram-specialist.md`](agents/diagram-specialist.md) | Medium | Generates SVG concept diagrams and data charts from visual_spec → assets/diagrams/; SVG is primary delivery format for HTML, PNG optional for PDF export |
| **measure** | [`agents/measure.md`](agents/measure.md) | Medium | Auto-measures slide layout with Playwright; downloads TTF fonts for PDF |
| **pdf-export** | [`agents/pdf-export.md`](agents/pdf-export.md) | Medium | Generates sample and full PDF from slidedata.json and layout_spec.json |
| **research** | [`agents/research.md`](agents/research.md) | Medium | Gathers web sources and writes research_notes.md; loads lecture-profile.md |
| **source-verifier** | [`agents/source-verifier.md`](agents/source-verifier.md) | Medium | Validates URLs in research_notes.md → source-verification.md + Trust Score |
| **storyline** | [`agents/storyline.md`](agents/storyline.md) | Medium | Writes storyline.md and slide_deck.md with image_role/image_query fields |
| **version** | [`agents/version.md`](agents/version.md) | Low | Snapshots files before every edit; restores prior states on demand |
| **handbook-writer** | [`agents/handbook-writer.md`](agents/handbook-writer.md) | Medium | Writes handbook chapters, course overview, and instructor guide — H-Stages 2-4 |
| **handbook-reviewer** | [`agents/handbook-reviewer.md`](agents/handbook-reviewer.md) | Medium | Validates handbook HTML against AUTHORING_GUIDELINES.md — H-Stage 5 |
<!-- VARIANT-AGENTS-END -->
---

## §2: Individual Agent Definitions

See [`agents/pm.md`](agents/pm.md) for the PM Agent full definition.

<!-- VARIANT-AGENT-DETAILS-START -->
### design

| Field | Value |
|-------|-------|
| **File** | [`agents/design.md`](agents/design.md) |
| **Tier** | medium |
| **Phases** | 3 |
| **Role** | Locks visual design style — color palette, fonts, layout into design_spec.md |

### html-build

| Field | Value |
|-------|-------|
| **File** | [`agents/html-build.md`](agents/html-build.md) |
| **Tier** | medium |
| **Phases** | 4 |
| **Role** | Generates HTML slides from slide_deck.md and design_spec.md |

### measure

| Field | Value |
|-------|-------|
| **File** | [`agents/measure.md`](agents/measure.md) |
| **Tier** | medium |
| **Phases** | 4 |
| **Role** | Auto-measures slide layout with Playwright; downloads TTF fonts for PDF |

### pdf-export

| Field | Value |
|-------|-------|
| **File** | [`agents/pdf-export.md`](agents/pdf-export.md) |
| **Tier** | medium |
| **Phases** | 4, 5 |
| **Role** | Generates sample and full PDF from slidedata.json and layout_spec.json |

### research

| Field | Value |
|-------|-------|
| **File** | [`agents/research.md`](agents/research.md) |
| **Tier** | medium |
| **Phases** | 1 |
| **Role** | Gathers web sources and writes research_notes.md for storyline design |

### image-curator

| Field | Value |
|-------|-------|
| **File** | [`agents/image-curator.md`](agents/image-curator.md) |
| **Tier** | medium |
| **Phases** | 3.5 |
| **Role** | Searches and downloads commercial-use images via Pixabay (keyless), Unsplash, Pexels; outputs assets/images/ + image-manifest.json |

### diagram-specialist

| Field | Value |
|-------|-------|
| **File** | [`agents/diagram-specialist.md`](agents/diagram-specialist.md) |
| **Tier** | medium |
| **Phases** | 3.5 |
| **Role** | Generates SVG concept diagrams (cycle/flow/matrix/pyramid/timeline/comparison) and data charts (bar/line/pie) from visual_spec fields in slide_deck.md; outputs CSS-variable SVG as primary delivery format for HTML; PNG is optional and required only for PDF export; parallel to image-curator |

### source-verifier

| Field | Value |
|-------|-------|
| **File** | [`agents/source-verifier.md`](agents/source-verifier.md) |
| **Tier** | medium |
| **Phases** | 1.5 |
| **Role** | Validates URLs in research_notes.md via HTTP check + content cross-check; outputs source-verification.md with Trust Score; optional (--skip-verify) |

### storyline

| Field | Value |
|-------|-------|
| **File** | [`agents/storyline.md`](agents/storyline.md) |
| **Tier** | medium |
| **Phases** | 2, 3 |
| **Role** | Writes storyline.md and slide_deck.md with image_role/image_query fields; handles cover/divider confirmation |

### version

| Field | Value |
|-------|-------|
| **File** | [`agents/version.md`](agents/version.md) |
| **Tier** | low |
| **Phases** | 0, 1, 2, 3, 4, 5, 6 |
| **Role** | Snapshots files before every edit; restores prior states on demand |
<!-- VARIANT-AGENT-DETAILS-END -->
---

## §3: PM Gateway Workflow

**Integrated from pm.md, CLAUDE.md §5, GEMINI.md §5**

### §3.1 PM Gateway Policy

**Single Point of Entry**: PM is the ONLY agent that users may directly invoke.
All specialist agents require PM dispatch - enforced at 4 levels.

#### §3.1.1 PM Direct Execution Scope

PM is an escalation gateway, not an executor. **⚠️ CRITICAL**: PM MUST NOT perform Write/Edit on any file except `memory/*.md` and `CHANGELOG.md`. All file modifications MUST be dispatched to project specialists. See [PM Direct Execution Constraints](agents/pm.md#⚠️-critical-pm-direct-execution-constraints) in `agents/pm.md`.

| Category | Tools | Scope |
|----------|-------|-------|
| Unconditional | Read, Glob, Grep, Agent, TaskCreate, TaskUpdate, AskUserQuestion, Skill, ToolSearch | Always allowed |
| Conditional | Write, Edit | `memory/*.md` and `CHANGELOG.md` only |
| Conditional | Bash | Read-only: `git status/diff/log`, `bun scripts/audit.ts`, `ls`, `cat` |
| Forbidden | Write, Edit (all other paths) | Must delegate to project specialist |
| Forbidden | Bash (write/execute patterns) | Must delegate to specialist |

**Rationale**: PM is orchestrator, not executor. Direct execution violates governance separation of concerns. See [Role Clarification](agents/pm.md#⚠️-role-clarification) and [Task Tracking vs Execution](agents/pm.md#task-tracking-vs-execution) in `agents/pm.md`.

When a specialist agent's required tool is denied, PM applies the [Permission Denial Protocol](#§3.8-permission-denial-protocol) — never substitutes for the specialist.

#### §3.1.2 PM Role Boundaries

**What PM Does**:
- Orchestrate multi-agent workflows
- Create execution plans
- Dispatch specialist agents
- Enforce quality gates
- Track progress

**What PM Does NOT Do**:
- Directly Edit/Write files (except `memory/*.md`, `CHANGELOG.md`)
- Implement code or scripts
- Perform documentation updates (delegate to `[docs specialist]`)
- Perform design work (delegate to `[design specialist]`)

**Task Owner vs Executor Distinction**:
- **Task owner (PM)**: "Buck stops here" responsible person for tracking progress
- **Task executor (specialist)**: Agent who performs the actual work
- PM creates tasks (owner: pm), dispatches project specialists (executor: `[specialist agent]`), and updates task status upon completion

**User Communication for Specialist Tasks**:
When work requires specialist delegation, PM uses the following template:
```
PM: 🔍 [Task Analysis] 이 작업은 [specialist] 전문 영역입니다.
   Task: [description]
   Specialist: [specialist name]
   Reason: [why specialist needed]
PM: [specialist]를 dispatch할까요?
User: "Yes"
PM: ▶️ [specialist] dispatch...
```

**Co-deck Specific Exceptions**:
For the `co-deck` 11-Stage pipeline:

1. **Optional & Auto-Advance Gates/Stages**: For stages or tasks defined as optional or auto-advancing (e.g., Stage 1.5/Gate 1.5, Stage 3/Gate 3, Stage 4/Gate 4, Stage 5-8, Stage 9-10), the PM dispatches the specialist agent automatically *without* prompting the user for approval.
2. **Double Hop & Internal Delegation**: Secondary/internal subagent dispatches (such as a read-only specialist agent spawning a writer subagent to write output) are considered implementation details and MUST NOT trigger any user confirmation prompt.
3. **Gate 3.5 — Image Manifest (Mandatory when the deck uses images)**: Unlike the optional/auto-advance gates above, Gate 3.5 is a **hard gate**. After `image-curator` produces `image-manifest.json`, run `bun scripts/co-deck/validate-image-manifest.ts --workspace presentations/<project>`. The handoff to `html-build` is **BLOCKED** until it exits 0 (no duplicate `content_hash` ERRORs; aspect-ratio WARNs reviewed). Skipped only when the deck uses no images. See [agents/image-curator.md — Gate 3.5 Validation](agents/image-curator.md).
4. **Gate Protocol**: Mandatory gates require explicit user approval; optional gates proceed after review.
   - **Gate 2 (Mandatory)** — storyline.md + slide_deck.md ready: "⚠️ Approving starts design and HTML. Approve?"
   - **Gate 5 (Mandatory)** — sample_5slides.pdf ready: "Check layout and fonts. Generate full PDF? Approve?"
   - **Gate 1.5 (Optional)** — source-verification.md ready: Output Trust Score and proceed (halt only if Trust Score < 70% and source_verification is enabled).
   - **Gate 3 (Optional)** — design_spec.md ready: Output theme/spec summary and proceed.
   - **Gate 4 (Optional)** — HTML draft built: Output built file details and proceed.
5. **Theme × Style compatibility**: Before confirming `presentation.theme` and `presentation.style` at Stage 0, check `docs/html-themes/THEMES.md` compatibility matrix. Reject incompatible combinations and explain why — the compatibility matrix in THEMES.md is the SSOT.
6. **Stage 1.5 auto-dispatch**: After Stage 1 completes, ALWAYS read `source_verification` from the project's `lecture-profile.md`. If `true` (the default), auto-dispatch source-verifier immediately without prompting the user.
7. **Gate 1.5 Trust Score threshold**: Once source-verification.md is ready, evaluate Trust Score against `trust_score_thresholds` in `variant.json`. Halt only if Trust Score < 70% — otherwise proceed automatically.
8. **Stage 1 Write-Permissions**: Configure the Stage 1 Research Agent with write permissions (`enable_write_tools: true` or as `self`) so it can output research notes without requiring double-hop prompts.
9. **TypeScript first**: Use `bun scripts/co-deck/` TypeScript scripts for all automated operations. Python is only permitted when the task cannot be accomplished in TypeScript.

See [agents/pm.md](agents/pm.md) for common PM role definition and delegation protocols.

#### §3.1.3 Enforcement Layers
1. **Tool-Level**: Agent tool rejects non-PM specialist calls (hard enforcement)
2. **System Prompt-Level**: CLAUDE.md/GEMINI.md rules loaded first
3. **Agent File-Level**: All specialists have "PM-ONLY INVOCATION" section
4. **QA Gate-Level**: Auditor detects bypass in Phase 6 QA

#### §3.1.4 Specialist Agent Dispatch Flow
```
User Request → PM Triage → Design Approval → Specialist Dispatch → QA Gate → Finalization
```

#### §3.1.5 Specialist Agent Roster (PM-ONLY INVOCATION)

All specialist agents below are dispatched ONLY through PM:

<!-- VARIANT-DISPATCH-TRIGGERS-START -->
| `design` | Phase 3 | "lock design style", "pick colors and fonts", "create design_spec.md" |
| `html-build` | Phase 4 | "generate HTML slides", "build presentation", "create lecture HTML" |
| `image-curator` | Phase 3.5 | "find images for slides", "download slide images", "search Pixabay", "curate images" |
| `diagram-specialist` | Phase 3.5 | "generate diagrams", "create chart", "draw flow diagram", "visualize data", "SVG diagram" |
| `measure` | Phase 4 | "measure slide layout", "prepare for PDF", "extract coordinates" |
| `pdf-export` | Phase 4, Phase 5 | "generate PDF", "export to PDF", "create sample PDF" |
| `research` | Phase 1 | "research the topic", "collect sources", "write research notes" |
| `source-verifier` | Phase 1.5 | "verify sources", "check URLs", "validate research links", "run source check" |
| `storyline` | Phase 2, Phase 3 | "create storyline", "compose slide deck", "structure chapters" |
| `version` | Phase 0–6 | "snapshot before edit", "backup file", "restore prior version" |
| `handbook-writer` | H-2, H-3, H-4 | "write handbook chapters", "create course overview", "generate instructor guide" |
| `handbook-reviewer` | H-5 | "validate handbook", "run quality checks", "check authoring compliance" |
<!-- VARIANT-DISPATCH-TRIGGERS-END -->
**⚠️ IMPORTANT**: Do NOT invoke any specialist agent directly. All requests must go through PM.

> **Execution Plan Format**: For mandatory criteria, boilerplate table, and rules, see [AGENTS.md §5](AGENTS.md#§5-execution-plan-templates). For platform-specific dispatch instructions, see [CLAUDE.md §5](CLAUDE.md#5-agent-dispatch-rules) or [GEMINI.md §5](GEMINI.md#5-agent-dispatch-rules).

### §3.5 Phase Determination (Deliverable-Type Gate)

Before assigning an agent to any task, PM MUST classify the deliverable type:

| Deliverable Type | Phase | Required Agent | Tier | Notes |
|------------------|-------|----------------|------|-------|
| New file design, schema definition, ADR | Phase 1-2 | `[design specialist]` | High | Must precede implementation |
| New directory structure, template layout | Phase 1-2 | `[design specialist]` | High | Must precede implementation |
| Cross-platform convention, naming standard | Phase 1-2 | `[design specialist]` | High | Must precede implementation |
| Script/tool implementation (approved plan exists) | Phase 4 | `[implementation specialist]` | Low–Medium | Plan from design specialist required |
| Documentation update | Phase 4 | `[docs specialist]` | Medium | |
| Documentation writing | Phase 4 | `[docs specialist]` | Medium | |
| Security configuration | Phase 6 | `[security specialist]` | Medium | |
| Project setup | Phase 0 | pm | Low | PM handles initial setup directly |

<!-- VARIANT-PHASE-GATE-START -->
| design_spec.md (color palette, fonts, CSS variables) | Phase 3 | `design` | medium | |
| lecture_vN.html (single-file HTML slide deck + images) | Phase 4 | `html-build` | medium | |
| image-manifest.json + assets/images/ (downloaded slide images) | Phase 3.5 | `image-curator` | medium | **Gate 3.5 (mandatory when images are used)**: must pass `bun scripts/co-deck/validate-image-manifest.ts --workspace presentations/<project>` — 0 duplicate `content_hash` ERRORs — before `html-build` handoff. Skip only if the deck uses no images. |
| assets/diagrams/*.svg (+ optional *.png) + diagram-manifest.json | Phase 3.5 | `diagram-specialist` | medium | optional: skip if no visual_spec fields in slide_deck.md; SVG is primary delivery format for HTML, PNG optional for PDF export |
| pdf_layout_spec.md (pixel coordinates for PDF engine) | Phase 4 | `measure` | medium | |
| <project>.pdf (print-ready PDF output) | Phase 4 | `pdf-export` | medium | |
| research_notes.md (web sources and key facts) | Phase 1 | `research` | medium | |
| source-verification.md (URL accessibility + Trust Score) | Phase 1.5 | `source-verifier` | medium | optional: --skip-verify |
| storyline.md + slide_deck.md (narrative and per-slide content) | Phase 2 | `storyline` | medium | |
| _versions/ snapshots (pre-edit backups of lecture files) | Phase 0–6 | `version` | low | cross-cutting |
<!-- VARIANT-PHASE-GATE-END -->

<!-- VARIANT-HSTAGE-PIPELINE -->
### H-Stage Pipeline (Handbook Document Production)

When user requests **"make handbook"**, **"create handbook"**, **"build course site"**, or **"companion handbook"**, enter the H-Stage pipeline instead of the 11-Stage slide pipeline:

```
H-0: PM — Confirm: topic, language, output dir, companion mode
     Dark mode: auto (no preference needed)
H-1: research — Web research (standalone only)
     [Companion: Skip — reuse research_notes.md + images + diagrams + references + versions]
H-2: handbook-writer — Propose section types + chapter structure
H-3: handbook-writer — Write chapter content (SECTION_TYPES + AUTHORING_GUIDELINES)
H-4: handbook-writer — Generate Course Overview + Instructor Guide
H-5: handbook-reviewer — handbook-doctor.ts + check-authoring.ts → fix
H-6: PM/automation — Apply Theme (domain step) → Generate CSS → Search index → Meta
H-7: PM — Secret scan + deploy + verify
```

**Companion mode**: When companion=true, H-1 is skipped and the following cached outputs are reused:
- `research_notes.md` (Research Package)
- `assets/images/` from `image-manifest.json` (Image cache)
- `assets/diagrams/*.svg` (Diagram cache)
- References from `source-verification.md` (Reference cache)
- `_versions/` snapshots (Version cache)

For complete H-Stage spec, see `skills/handbook/SKILL.md`.
<!-- END VARIANT-HSTAGE-PIPELINE -->

**Tier Ceiling Rule**: An agent's tier may NOT be elevated beyond its defined tier.

> **Execution Plan Boilerplate Policy**: For mandatory and discretionary boilerplate cases, see [§3 (PM Gateway Workflow)](AGENTS.md#§3-pm-gateway-workflow) above.


### §3.6 3-Tier Strategy

When leading execution and improvement tasks, PM MUST use the 3-Tier model strategy:

- **High-tier**: Complex reasoning, architectural design, planning (claude-opus-4-7 / gemini-3.1-pro)
- **Medium-tier**: Code review, testing, PR review, quality gates (claude-sonnet-4-6 / gemini-3.5-flash)
- **Low-tier**: Fast, repetitive coding, script maintenance (claude-haiku-4-5 / gemini-3.5-flash)

### §3.7 Meeting Facilitation

When `/meeting` is invoked, the PM orchestrates structured multi-agent discussions.

**Meeting Process**:
1. **Open meeting**: Set agenda and objectives
2. **Facilitate dialogue**: Ensure all specialists contribute
3. **Synthesize outcomes**: Cross-domain agent synthesizes agreements
4. **Document results**: Write transcript to `memory/meeting-YYYY-MM-DD-[slug].md`

### §3.8 Permission Denial Protocol

When a specialist agent's required tool is denied, PM must **not** substitute for the specialist. Instead:

1. Identify the denial Type (A/B/C/D) using the classification in [`agents/pm.md`](agents/pm.md#permission-denial-protocol)
2. Output the Escalation Template immediately
3. Log the denial to `memory/YYYY-MM-DD.md`
4. Halt the blocked task — do not proceed without the required tool

---

<!-- COMMON-AGENTS:START -->
## Language Policy

**English-Only Documentation Rule**: All workspace documentation files (.md) must be written in English, with explicit exceptions for recognized locale translation zones and declared Korean legal/regulatory content (see Exceptions below).

### English Documentation Requirement
- All `.md` files outside `ko/` and `locales/ko/` directories MUST be in English
- Applies to: README.md, CLAUDE.md, GEMINI.md, AGENTS.md, context.md, CHANGELOG.md, all documentation in docs/, agents/, skills/
- Rationale: English documentation ensures global accessibility and cross-team collaboration

### Translation Zones (Locale Exceptions)
- `<lang-code>/` directories — language-specific documentation (e.g. `ko/`, `ja/`)
- `locales/<lang-code>/` — locale translation files for internationalization (e.g. `locales/ko/`, `locales/zh-CN/`)
- These are the ONLY locations where non-English `.md` files are permitted (except declared exceptions)
- Recognized locale codes (from `docs/workspace-schema.json` `i18n.locale_codes`):
  `ko`, `ja`, `zh-CN`, `zh-TW`, `de`, `es`, `fr`, `pt`, `vi`, `ms`, `id`, `th`, `ru`, `it`, `ar`

### Language Policy Exception — Korean Legal/Regulatory Content
The English-only policy admits a narrow exception for files where Korean is legally or academically mandatory. To declare an exception, add to the file's frontmatter:
```yaml
lang: ko
lang_reason: legal   # legal | source-material | proper-noun
```
- `legal`: Statutory texts, ordinances, regulations, contracts where Korean original has legal force.
- `source-material`: Primary source quotations where English translation would compromise academic accuracy or meaning.
- `proper-noun`: Files dominated by Korean proper nouns (institution/place/person names).

*Note: Exception is NOT available for: agents/*.md, skills/*.md, context.md, CLAUDE.md, GEMINI.md, AGENTS.md, or any variant context.md file.*

### Enforcement
- Pre-commit audit checks for Korean content outside ko/ and locales/ko/
- PR reviews reject non-English documentation outside translation zones
- Auditor validates compliance during Phase 6 QA gate

### Git/PR Artifacts Language Rule
- All commit messages: English
- All PR titles: English
- All PR descriptions: English
- All branch names: English
- Code comments: English (unless documenting locale-specific logic)

### Pluggable Variant Audit Hooks and Integrity Protection
- **Core Script Standardization**: The core synchronization and validation scripts (`scripts/dev-sync.ts` and `scripts/audit.ts`) must remain standardized and identical across all templates and variants. Direct modification of these core scripts in L2 projects is strictly forbidden.
- **Variant-Specific Audit Hook**: Variant projects requiring custom verification checks must implement them in a pluggable hook script located at `scripts/audit-variant.ts`.
- **Integrity Enforcement**: During template reconciliation (`l2-to-variant-pipeline.ts`), any modified core scripts will be automatically detected and will fail the reconciliation.
<!-- COMMON-AGENTS:END -->

---

## §4: Other Workflows

### §4.1 PM Subagent Dispatch Protocol

The PM agent follows a three-level inheritance model: **L0 (workspace root)** → **L1 (common template)** → **L2 (variant templates)**.

> **For PM Agent Architecture**: See [docs/context.md](docs/context.md) for complete governance workflow, L0→L1→L2 extends chain resolution, and variant-specific configuration.

#### Dispatch Decision

```
Request received
  │
  ├─▶ Read-only? (research, analysis, inspect)
  │   └─▶ PARALLEL - dispatch multiple agents in a single message
  │
  └─▶ Write? (create/edit files, run tests)
       └─▶ SERIAL - one agent at a time to prevent file lock conflicts
```

> **Why serial writes?** Concurrent writes to the same files cause merge conflicts and lock contention.
> Always wait for a write agent to complete before dispatching the next.

#### Cost Optimization (3-Tier Strategy)

The PM uses a 3-tier model strategy to optimize cost and quality:

- **High-tier (Design/Plan)**: Used exclusively by the PM/Architect for complex reasoning, architectural design, and writing precise sub-agent prompts.
- **Medium-tier (Review/QA)**: Used by Auditor or Security agents to review code, run tests, and perform quality gates. Acts as an independent supervisor.
- **Low-tier (Coding/Execute)**: Used by Automation Engineer agents for fast typing, simple repetitive coding, or strictly scoped tasks.

**Tier Adjustment Rules:**
- The PM can dynamically downgrade an agent's Tier for simple tasks (Assigned <= Baseline) to save costs.
- The PM can NEVER upgrade a Tier above the baseline.
- If a downgraded task fails, the PM MUST restore the agent's baseline Tier for the retry.

> **Note on 3-Tier Strategy Models:**
> The exact model configurations and prompt arguments (e.g. `thinking_level`) are explicitly managed within the workspace configuration files (`CLAUDE.md` and `GEMINI.md`). Please refer to those files for your specific tool's exact AI model mappings and tier strategies.

The PM agent delegates execution to the Low-tier and delegates review to the Medium-tier before finalizing.

#### Dispatch Rules

1. **Autonomous Agent Handoffs** - Agents can dispatch each other directly via JSON contracts without PM intervention for routine workflows
2. **PM Orchestration Phases** - PM only orchestrates Phases 0 (Team Assembly), 2 (Design Validation), and 5 (Lifecycle Finalization)
3. **QA Gate** - PM executes qa scripts at Phase 6 (bun scripts/qa-gate.ts)
4. **Parallel Agent Dispatch** - all parallel agents must be dispatched in one turn for research/analysis phases
5. **Error handling** - if any parallel agent fails, responsible agent resolves failure before proceeding. Do not skip.
6. **Max QA iterations** - 2 per review cycle before escalating to PM for intervention

#### Subagent Roster

| Agent | File | Tier | Parallelizable | Write Allowed? |
|-------|------|------|:--------------:|:--------------:|
| PM Orchestrator | `agents/pm.md` | High | - | orchestrates only |

<!-- VARIANT-SUBAGENT-ROSTER-START -->
| design | `agents/design.md` | Medium | ⚠️ sequential preferred | project files |
| html-build | `agents/html-build.md` | Medium | ⚠️ sequential preferred | project files |
| image-curator | `agents/image-curator.md` | Medium | ✅ parallel with diagram-specialist | project files |
| diagram-specialist | `agents/diagram-specialist.md` | Medium | ✅ parallel with image-curator | project files |
| measure | `agents/measure.md` | Medium | ⚠️ sequential preferred | project files |
| pdf-export | `agents/pdf-export.md` | Medium | ⚠️ sequential preferred | project files |
| research | `agents/research.md` | Medium | ⚠️ sequential preferred | project files |
| source-verifier | `agents/source-verifier.md` | Medium | ⚠️ sequential preferred | project files |
| storyline | `agents/storyline.md` | Medium | ⚠️ sequential preferred | project files |
| version | `agents/version.md` | Low | ✅ | project files |
| handbook-writer | `agents/handbook-writer.md` | Medium | ⚠️ sequential preferred | project files |
| handbook-reviewer | `agents/handbook-reviewer.md` | Medium | ⚠️ sequential preferred | project files |
<!-- VARIANT-SUBAGENT-ROSTER-END -->

> **Agent frontmatter specification**: All agent files must include YAML frontmatter as defined in [docs/context.md](docs/context.md).

---

### 4.1.5 Phase Summary

| Phase | Name | PM Role | Specialist Agents |
|-------|------|---------|-------------------|
| 0 | Project Initiation | Owner — reads lecture-profile.md, initializes project_state.json | — |
| 1 | Research | Direct handoff (Gate 1 retired) | `research` |
| 1.5 | Source Verification | Gate 1.5 reviewer — checks Trust Score, configured at Stage 0 | `source-verifier` (optional) |
| 2-3 | Storyline | Gate 2 approver — reviews storyline.md and slide_deck.md | `storyline` |
| 4 | Design | Gate 3 reviewer — optional design spec review | `design` |
| 3.5 | Image Curation + Diagram Generation | Observer — reviews image-manifest.json + diagram-manifest.json | `image-curator` ‖ `diagram-specialist` (both optional, run parallel) |
| 5-8 | HTML Build | Gate 4 reviewer — optional HTML preview before measure | `html-build` |
| 9-10 | Layout Measure | Observer — reviews pdf_layout_spec.md | `measure` |
| 11 | PDF Export | Gate 5 approver — reviews sample PDF before full PDF | `pdf-export` |

> Gates 2, 5 are **mandatory** — PM must obtain explicit user approval before advancing.
> Gates 1.5, 3, 4 are **optional** — PM may auto-advance or prompt user (Gate 1 is retired).

### §4.2 Co-deck 11-Stage Pipeline

```
[0] Config (mandatory) → [1] Research → [1.5] Source Verifier (if source_verification: true) → [2-3] Content → [4] Design → [5-8] Build → [9-10] Measure → [11] Export
                              ↑
                         [Version] — called before every file edit
```

**Mandatory approval gates**: Gate 2 (content), Gate 5 (sample PDF).
*(Gate 1 is retired. Gate 1.5, Gate 3, and Gate 4 are optional / non-blocking review-then-proceed gates.)*

#### Gate Protocol

On reaching a gate, PM outputs a structured summary and waits for explicit user approval (for mandatory gates) or proceeds after review:

- **Gate 1.5 (Optional)** — source-verification.md ready: Output Trust Score and proceed (halt only if Trust Score < 70% and source_verification is enabled).
- **Gate 2 (Mandatory)** — storyline.md + slide_deck.md ready: "⚠️ Approving starts design and HTML. Approve?"
- **Gate 3 (Optional)** — design_spec.md ready: Output theme/spec summary and proceed.
- **Gate 4 (Optional)** — HTML draft built: Output built file details and proceed.
- **Gate 5 (Mandatory)** — sample_5slides.pdf ready: "Check layout and fonts. Generate full PDF? Approve?"

#### Project State

PM reads and writes `presentations/<lecture>/project_state.json`. Every step has `status` (pending / in_progress / completed) and `approved` (bool). Always update immediately after each step.

#### Rework Rules

When the user requests an edit:
1. Report downstream impact (which stages need re-run)
2. Call Version Agent before any file changes
3. Dispatch the appropriate agent with minimum re-execution scope
4. Reset downstream steps to "pending" in project_state.json
5. Skip Measure (Stage 9-10) if layout structure is unchanged

#### Stage 0 — New Project Start (MANDATORY, never skip)

1. Copy the master `docs/lecture-profile.md` to `presentations/<name>/lecture-profile.md`.
2. Prompt the user to fill in lecture-specific details (title, audience, level, keywords) in the local profile.
3. **Ask the user to explicitly confirm all settings** (do NOT proceed to Stage 1 until answered):
   - **Rendering theme** (`presentation.theme`) — HTML structure; read available themes from `docs/html-themes/THEMES.md` registry
   - **Visual style** (`presentation.style`) — CSS variable set; read available styles from `docs/html-themes/THEMES.md` registry; check the compatibility matrix before accepting
   - **Source Verification** (`source_verification`: default is `true` — ask user to confirm or disable)
   - **Divider mode** (`dividers.mode`: `auto` (recommended) | `manual` | `none`)
   - **Background image** (`background_image.enabled`: `false` (default) | `true`) — if enabled, ask scope (`all` | `divider-cover` | `individual`), source (`download` | `svg`), and overlay preferences; writes to `background_image` section in `lecture-profile.md`
4. **Check `layout_overrides`**: Read the local `lecture-profile.md` — if `layout_overrides` is present and any value differs from the theme's `theme.json` defaults, warn the user before proceeding:
   > ⚠️ This project has layout overrides that differ from the global `<theme>` theme defaults:
   > - `<key>`: `<override_value>` (default: `<theme_default>`)
   > These will apply to HTML rendering and PDF generation. Continue?
5. Save the confirmed values to the local `lecture-profile.md`, then initialize `project_state.json` and `memory/keywords.md`.
6. Dispatch the Research Agent to start Stage 1 (loading the local profile). To prevent double-hop permission prompts and permission errors, configure the Research Agent with write permissions (`enable_write_tools: true` or invoke as a `self` subagent) so it can write research results directly.

#### T-Stage Pipeline (Theme/Style Authoring)

When user requests **"create a new theme"** or **"create a new style"**, enter the T-Stage pipeline instead of the 11-Stage pipeline:

**Style Workflow** (lightweight, 3 steps):
1. PM collects style name + visual characteristics from user
2. PM dispatches Design to author `styles/<name>/style.css` (CSS variable overrides only)
3. PM provides preview link: `docs/html-themes/preview/preview.html?theme=pitch-enhanced&style=<name>` → user approval → register in THEMES.md

**Theme Workflow** (T-Stage, 5 steps):
```
T-0: PM — collect theme name + rendering paradigm from user
T-1: html-build — author template.html (renderSlide, TOC/nav structure)
T-2: design — author theme.json (content_rules, compatible_styles, recommended_structure)
T-3: storyline — review content_rules + author recommended_structure
T-4: PM — provide preview link → user approval → THEMES.md registration
```

For complete T-Stage spec, see `skills/theme-authoring/SKILL.md`.

---

### §4.3 Role Boundary Matrix

Use this to resolve ambiguity when multiple agents could handle a request.

| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Orchestrate multi-step task across agents | `pm` | any execution agent |

<!-- VARIANT-ROLE-BOUNDARY-START -->
| Create or update design_spec.md (colors, fonts, layout) | `design` | `pm` |
| Generate or update lecture_vN.html from slide_deck.md | `html-build` | `pm` |
| Search and download images (Pixabay/Unsplash/Pexels) for slides | `image-curator` | `pm` |
| Generate SVG concept diagrams or data charts from visual_spec | `diagram-specialist` | `pm` |
| Run Playwright measurement or download TTF fonts | `measure` | `pm` |
| Generate sample PDF or full PDF output | `pdf-export` | `pm` |
| Search web and write research_notes.md | `research` | `pm` |
| Validate URLs and cross-check research sources | `source-verifier` | `pm` |
| Write or revise storyline.md or slide_deck.md | `storyline` | `pm` |
| Snapshot any lecture file before editing | `version` | `pm` |
<!-- VARIANT-ROLE-BOUNDARY-END -->

---

## §5: Execution Plan Templates

### §5.1 Standard Execution Plan Template

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | [task description] | [specialist] | High/Medium/Low | [model] |
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | [model] |

**Execution Order**: [Parallel | Sequential]

**Key points**:
- Tier column is MANDATORY (High/Medium/Low)
- End every plan with the `/sync` row — it covers lifecycle update, audit, commit, push, and PR
- State parallel vs sequential order below the table
- "pm (direct)" is FORBIDDEN - PM never executes directly

### §5.2 Platform Parity Considerations

When modifying files that affect both CLAUDE.md and GEMINI.md:

| # | Task | Agent | Tier | Model | Platform |
|---|------|-------|------|---------|----------|
| 1 | [task] | [specialist] | [tier] | [model] | Both |
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | [model] | Both |

**Platform Column**: `Claude` / `Antigravity` / `Both` / `L0-only`

**Note**: See execution plan boilerplate in CLAUDE.md §5, GEMINI.md §5, and agents/pm.md for the Platform column definition.

### §5.3 Example Execution Plans

#### Example 1: Multi-Agent Platform Parity Update

> **Note**: The `Model` column below shows the Claude Code short alias (`sonnet`/`opus`/`haiku`/`fable`) actually passed to the `Agent()` tool's `model` parameter — not the registry ID (e.g. `claude-sonnet-4-6`). See [CLAUDE.md §6](CLAUDE.md#6-native-sub-agents-agent-tool) for the registry-ID → alias translation table. On Gemini/Antigravity, use the literal model ID instead (see GEMINI.md's equivalent example).

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | Update agents/pm.md | `[docs specialist]` | Medium | sonnet |
| 2 | Update scripts/audit.ts | `[implementation specialist]` | Low | haiku |
| 3 | Update CLAUDE.md §5 | `[docs specialist]` | Medium | sonnet |
| 4 | Update GEMINI.md §5 | `[docs specialist]` | Medium | sonnet |
| 5 | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | sonnet |

**Execution Order**: Sequential (platform parity requires CLAUDE.md and GEMINI.md updates together)

#### Example 2: Single Specialist Task

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | Update project README introduction | `[docs specialist]` | Medium | sonnet |
| 2 | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | sonnet |

**Execution Order**: Sequential

---

## §6: Skills

> **📌 VERSION_MANIFEST is the Single Source of Truth (SSOT)**
>
> All skill versions, status, and lifecycle metadata are maintained in [`docs/VERSION_MANIFEST.md`](docs/VERSION_MANIFEST.md).
> The table below provides skill names and locations only. For current versions, status, and detailed metadata, always reference VERSION_MANIFEST.
>
> **Skill structure specification**: See [docs/context.md](docs/context.md) for frontmatter format and session skill registration.

> **`owner` field definition**: The `owner` field in `SKILL.md` frontmatter identifies the **maintainer responsibility** for that skill — the agent or role accountable for keeping the skill current. It does NOT require that agent to exist in the current project, and does NOT mean that agent is the only one who can invoke the skill.

### Skill Resolution Priority

When a user request matches a skill trigger, apply this priority order — **enforced every session, regardless of platform**:

| Priority | Source | Location | Purpose |
|----------|--------|----------|---------|
| **1 (highest)** | Workspace-level skills | `skills/<name>/SKILL.md` in the workspace root | Core workspace functionality (scaffolding, validation, security, audit) |
| **2** | Platform config skills | `.claude/skills/` or `.gemini/skills/` in the project root | Platform-specific hooks, commands, and lifecycle management |
| **3 (lowest)** | Global plugin skills | e.g., `superpowers/brainstorming`, `superpowers/writing-plans` | General-purpose development workflows |

**Location Rules**:
- **Single location requirement**: Workspace-level skills should exist **only** in `skills/` folder (priority 1). Do not duplicate these in `.claude/skills/` or `.gemini/skills/`.
- **Platform-specific skills**: `.claude/skills/` and `.gemini/skills/` are reserved for platform-specific hooks, commands, and lifecycle management tools that differ between Claude Code and Gemini CLI.
- **No cross-duplication**: Avoid duplicating the same skill across multiple locations. Choose the single most appropriate location based on the skill's purpose.

**Resolution Rule**: If a higher-priority skill's `metadata.triggers` matches the user request, use it — do **not** fall through to lower-priority skills with overlapping intent.

**Canonical conflict example — meeting vs. brainstorming**:

| User says | Correct skill | Priority |
|-----------|--------------|----------|
| "meeting", "facilitate", "agent discussion" | `skills/meeting-facilitation` | 1 |
| "brainstorm", "design before coding", "explore options" | `superpowers/brainstorming` | 3 |

When ambiguous, prefer the higher-priority (workspace-level) skill and confirm intent with the user.
Explicit invocation: `/meeting "topic" [--agents a,b] [--rounds N] [--dialogue]`

---


## §7: Universal Baseline Behaviors

All agents, regardless of their role, must adhere to the following:

- **Security Boundaries**: Never expose or log secrets (API keys, tokens). Do not modify CI/CD pipelines without explicit permission.
- **Communication Style**: Keep explanations concise and use markdown formatting. Always explain "why", not just "what".
- **Conflicting Instructions**: If a user request violates project rules (e.g., bypassing tests), warn the user and request explicit confirmation before proceeding.
- **Coding Standards**: Follow SOLID principles. Write unit tests when creating functional code. No speculative abstractions.
- **Language**: All code, config, commit messages, and branch names - **English only**.
- **UTF-8 Enforcement**: Always use UTF-8 encoding; prevent CP949 or other localized encoding corruptions.
- **File Organization**: Never create `.md` files at the project root unless explicitly creating a standard root file (README.md, CHANGELOG.md, AGENTS.md, SECURITY.md). Place analysis and reports in `docs/`, session logs and meeting transcripts in `memory/`. Create all temporary code and scratch scripts in `tests/`.
- **Search Tool Prioritization**: Prioritize MCP semantic search tools for AST-aware insights over basic file search. Use standard grep as a fallback if MCP tools are unavailable.
- **Source Attribution**: When presenting research findings, external data, or factual claims, always cite the source using `[Source: URL/document]` inline or a `## References` section. If a source cannot be verified, explicitly mark it as `⚠️ Unverified` and recommend manual verification. Never present unverified information as established fact.
- **Computational Integrity**: Never perform high-precision or safety-critical numerical calculations directly. For aerospace, aviation, precision control, or regulated financial computations, delegate to a validated external tool (Fortran, Python+NumPy/SciPy, Julia, etc.) via the `stack-setup` agent. Label any AI-generated numerical estimate explicitly as **approximate**.

---

## §8: Lifecycle Management

### Phase 5 Lifecycle Finalization

At **Phase 5 (Lifecycle Finalization)**, PM **must** execute finalization when any of the following occurred in the session:

| Trigger | Dispatch lifecycle-manager? |
|---------|---------------------------|
| Agent added, modified, or deprecated | ✅ Yes |
| Skill added, modified, or deprecated | ✅ Yes |
| Script status changed in SCRIPTS.md | ✅ Yes |
| Variant status changed (draft→beta, beta→stable, etc.) | ✅ Yes |
| Governance tool updated (audit.ts, validate-templates.ts, etc.) | ✅ Yes |
| `.claude/commands/*.md` or `.gemini/commands/*.md` added or removed | ✅ Yes |
| `.claude/skills/*/SKILL.md` or `.gemini/skills/*/SKILL.md` added or modified | ✅ Yes |
| `templates/common/.claude/` or `templates/common/.gemini/` structure changed | ✅ Yes |
| `common-contract.json` or `docs/templates/*.json` governance files modified | ✅ Yes |
| README/documentation-only changes | ❌ No |
| Memory log entries only | ❌ No |

PM will produce either a **"no drift" confirmation** or a **drift report + governance document updates**.

PM does NOT execute finalization updates for: pure documentation changes (body text only), README updates, memory log entries, or changes that do not affect lifecycle-tracked artifacts.

> **For Agent Lifecycle procedures**: See [docs/context.md](docs/context.md) for detailed lifecycle procedures.

---


## §9: Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Use the `agent-lifecycle-manager` skill to guide the process.
2. Add a row to the Agent Roster table above.
3. Add a row to the Subagent Roster dispatch table (with Parallelizable / Write Allowed columns).
4. Ensure the agent file follows the frontmatter specification in [docs/context.md](docs/context.md).
5. If the agent uses a skill, add a row to the Skills table above.

When a new skill is created in `skills/` or `.claude/skills/`:
1. Use the `skill-lifecycle-manager` skill to guide the process.
2. Add a row to the Skills table above.
3. Ensure the skill follows the frontmatter specification in [docs/context.md](docs/context.md).

> **For the workspace root**: AGENTS.md is the SSOT. No separate `docs/context.md` sync required.
> **For individual projects**: Keep AGENTS.md in sync with `docs/context.md ## Agents` per [docs/context.md](docs/context.md).

---

## §10: Periodic Skill Review Schedule

**Frequency**: Quarterly (every 3 months)  
**Owner**: pm  
**Tool**: `bun scripts/skill-dependency-analysis.ts --report`

### Review Cadence

| Quarter | Target Month | Scope |
|---------|-------------|-------|
| Q1 | March | All active skills — full health report |
| Q2 | June | All active skills — full health report |
| Q3 | September | All active skills — full health report |
| Q4 | December | All active skills — full health report + deprecation sweep |

### Review Steps

1. **Generate health report**
   ```
   bun scripts/skill-dependency-analysis.ts --report
   bun scripts/validate-skills.ts
   ```

2. **Triage findings** by severity:
   - 🔴 Broken dependencies or circular references → fix before quarter ends
   - 🟡 Deprecated dependency usage → fix within 2 weeks
   - 🟢 Wording or example improvements → batch in next release cycle

3. **Apply modifications** using the checklist at [docs/lifecycle/skills/skill-modification-checklist.md](docs/lifecycle/skills/skill-modification-checklist.md)

4. **Update governance records** in `docs/lifecycle/skills/<name>.md` for every skill modified

5. **Deprecation sweep** (Q4 only): review skills with `last_updated` older than 12 months — evaluate whether they remain relevant or should be deprecated

6. **Log results** in the quarterly memory log: `memory/YYYY-MM-DD.md` with `## Skill Review Q[N] YYYY` heading

### Trigger Conditions (Outside Quarterly Cadence)

A skill health check should also be run outside the quarterly schedule when:
- A tool, agent, or script referenced by any skill is renamed or removed
- A new skill is added that may introduce dependency cycles
- CI reports skill validation failures on any branch

---

## Version History

- **v2.0.0 (2026-06-09)**: Restructured as SSOT - Integrated PM Gateway workflow (§3), execution plan templates (§5), and renumbered existing sections. Consolidated duplicate content from pm.md, CLAUDE.md §5, GEMINI.md §5 into single source of truth.
- **v1.x**: Previous versions maintained agent roster and individual definitions without PM Gateway integration
