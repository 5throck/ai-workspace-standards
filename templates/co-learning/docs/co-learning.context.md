# [Project Name] —co-learning Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE —all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md              —immutable project identity (architecture, standards)
>   2. docs/co-learning.context.md   —THIS FILE —tech stack, agents, skills, workflow

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | [e.g., TypeScript 5+ / Python 3.11+] |
| **Framework** | [e.g., Next.js / FastAPI / none] |
| **Database** | [e.g., PostgreSQL + Prisma / SQLite / none] |
| **Key Libraries** | [e.g., react-query, zod, httpx] |
| **Package Manager** | [e.g., pnpm / npm / uv] |
| **Testing** | [e.g., Vitest + Playwright / pytest] |

---

## Agents

<!-- context-proximity: agent roles summarized here for AI context window efficiency; authoritative definitions in agents/*.md -->

<!-- Add/remove rows as agents are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

| Agent | File | Role | Status |
|-------|------|------|--------|
| PM (Orchestrator) | `agents/pm.md` | Workflow management, dispatch, quality gates | active |
| Exam Bank Steward | `agents/exam-bank-steward.md` | Question-bank authoring quality, bias remediation, exam operations | active |
| I18N Specialist | `agents/i18n-specialist.md` | Locale documentation — translation zones, language-policy enforcement, Korean plain-language output | active |


> Lifecycle management: `bun scripts/agent-lifecycle-audit.ts`
> After any agent change, update AGENTS.md and this table.

---

## Skills

<!-- Add/remove rows as skills are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

<!-- DYNAMIC_SKILLS_START -->
<!-- DYNAMIC_SKILLS_END -->

> Lifecycle management: `bun scripts/skill-lifecycle-audit.ts`

> **Lifecycle procedures**: See `templates/common/docs/context.md § Lifecycle Management`

---

## Environment Setup

- Copy `.env.sample` —`.env` and fill in all required values.
- **Node.js**: `bun install`
- **Python**: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
- Required env keys (see `.env.sample`): *(fill in after project creation)*

---

## Development Workflow

```
Edit code
  —
/sync "feat: description"
  —
  1. audit.ts —abort on failure
  2. memory/YYYY-MM-DD.md —session log (4-section format)
  3. MEMORY.md index update
  4. git add -A —commit
  5. pr/<date>-<slug> branch created (if on main)
  6. git push + gh pr create
```

### Agent Dispatch Order (co-learning standard)

```
PM —Exam Bank Steward (bank authoring / bias remediation / exam operations)
   —I18N Specialist (on demand, locale deliverables)
```

### Workflow Phases

Canonical 7-phase model (see `docs/phase-definitions.md`):

| Phase | Name | What Happens |
|-------|------|--------------|
| 0 | Team Assembly & Scope Confirmation | PM assembles the team and confirms the engagement scope (assessment deliverable, cohort, authorization) |
| 1 | Analysis | PM + `exam-bank-steward` analyze bank/exam requirements and acceptance criteria into an actionable brief |
| 2 | Review & Approval | Bank/exam plan (item blueprint, remediation plan, window plan) reviewed; explicit user approval required before execution |
| 3 | Localization (optional) | `i18n-specialist` engaged when locale deliverables are in scope |
| 4 | Authoring & QA Gate | Exam Bank Steward authors/reviews items, runs bias checks, operates exams — loop up to 3× on failures |
| 5 | Content Review & Lifecycle Finalization | Human review of every ledger entry; PM logs decisions and updates governance records |
| 6 | Quality Assurance & Finalization | PM runs the audit and `/sync`; opens PR |

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Coding Guidelines

### Core Rules

1. **Think before coding** —state assumptions; if uncertain, ask.
2. **Simplicity first** —minimum code that solves the problem.
3. **Surgical changes** —touch only what is necessary.
4. **No hardcoded secrets** —always use env vars / `.env.sample`.
5. **PR required** —all changes via `/sync`; never direct push to main.

### Plan Mode

Enter plan mode when: new feature, significant refactor, or change touches more than 2 files.

### Subagent Pattern

Each bank/exam task follows the Phase 4 execution loop:
1. **exam-bank-steward** authors/reviews items and operates exams
2. **exam-bank-steward** verifies bias metrics and acceptance criteria
3. **audit script** validates compliance
Maximum 3 iterations before escalating to user.

### Hybrid Scripting
All scripts are TypeScript (`.ts`) executed via Bun — no `.sh`/`.ps1` counterparts (ADR-0036).

### Package Policy

Prefer OSI-approved licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC.
Avoid: GPL-3.0, AGPL-3.0, SSPL, BSL unless explicitly justified.

<!-- END VARIANT-INJECT -->

---

## Computational Integrity

All numeric outputs in deliverables (aggregations, statistics, percentages, metrics) must be computed by executed code (bun/TypeScript scripts) — never by the AI performing arithmetic directly. High-precision or safety-critical domains (Class A: aerospace, precision control, regulated finance) require validated external tools. See `docs/context.md` § Computational Integrity Standards for the full policy; label AI estimates **approximate**.

---


## File Organization Policy

### Recommended Folder Structure (co-learning)
| Folder | Purpose |
|--------|---------|
| `docs/adr/` | Architecture Decision Records |
| `docs/specs/` | Technical specifications |
| `docs/api/` | API documentation |
| `memory/` | Session logs, meeting transcripts, QA reports |
| `deliverables/` | Assessment deliverables (service code, question bank assets, bias tooling) |

---

## Per-Role Deliverable Artifacts

Every specialist dispatch leaves one durable artifact on disk - never chat output only (MetaGPT-style PRD/design/task hand-off chain). The same contract is stated in each agent file's `## Output Format → Required Deliverable Artifact` section.

| Role | Required artifact | Path convention | Consumed by |
|------|-------------------|-----------------|-------------|
| PM | Execution plan table + session log | `memory/YYYY-MM-DD.md` (workspace-governed, see AGENTS.md §5) | All specialists |
| exam-bank-steward | Bank items + bias-check evidence, remediation ledger entries, exam-window checklist, statistics interpretation | `deliverables/<assessment>/`, `tests/`, `memory/qa/<YYYY-MM-DD>-<slug>.md` | PM |
| i18n-specialist | Locale documentation / translation zones | `docs/` locale deliverables | PM |


---

## Domain Rules

<!-- co-learning variant specific rules —edit after project creation -->
1. Every new or edited bank item must pass the answer-length bias check before entry.
2. AI-drafted rewrites touch distractors only; no auto-publish — the remediation ledger requires a named human reviewer. **[LEARN-R1]**
3. Once the first real exam attempt is recorded, published items are frozen without a formal comparability review. **[LEARN-R2]**
4. Every specialist dispatch must leave its Required Deliverable Artifact on disk - chat output alone does not complete a hand-off (see Per-Role Deliverable Artifacts). **[LEARN-R3]**

---

<!-- COMMON-CONTEXT:START -->
### Instruction Standard (LLM Interaction Standard, ADR-0098)

Human-to-LLM instructions and LLM-to-human answers follow the project-local standard `docs/standards/llm-interaction-standard.md` (ADR-0098, extending ADR-0079) — "Precision In, Intuition Out".

- **Input (§2)**: one primary action per instruction; explicit verbs; defined terms; structural rules in §2.8 — one instruction per sentence (≤ 20 words procedural / ≤ 25 descriptive), active voice with imperative steps, present tense, no idioms, positive phrasing preferred, minimal pronouns. Applies to requirement statements, task briefs, execution-plan task descriptions, agent dispatch prompts, design-doc requirement sections, API endpoint documentation, and how-to steps.
- **Output (§4–§9)**: conclusion and intuition before implementation detail; mental models before mechanics; facts, inferences, assumptions, and unknowns kept separate.
- **Enforcement**: advisory — PM conforms task briefs at triage; architect checks requirement sections at Design Gate review. Decisions: ADR-0079 and ADR-0098 (workspace root `docs/adr/`).

### PM Team-Management Authority (ADR-0080)

PM owns the composition of this project's agent team and rules on skill changes.

- **Hiring/firing (top-down, PM-decided)**: PM judges timing and target from workflow signals — recurring unmatched work types, role overload, absorbed roles, the periodic roster review — without a blocking user approval. Every decision emits a gate-moment decision record (ADR-0061) before dispatch. Default exit is `status: deprecated`; hard delete requires an explicit user request. Procedure: `agent-lifecycle-manager` skill.
- **Skill requests (bottom-up, agent-initiated, PM-approved)**: agents file structured request blocks (`create|attach|remove` + evidence) in their task reports and memory logs; PM triages and only approved requests are executed — agents never create, attach, or remove skills unilaterally. Procedure: `skill-lifecycle-manager` skill.
- **Enforcement**: governance, not code — decision records capture the judgment trail, and the change audits catch structural drift. Full decision: ADR-0080 in the workspace root `docs/adr/`.
<!-- COMMON-CONTEXT:END -->

<!-- COMMON-CONTEXT:START -->
This project follows the coding standards in the key-rules list below.

Key rules:
- All operational scripts must be TypeScript (`.ts`) — run via `bun scripts/<name>.ts` (ADR-0036; no `.sh`/`.ps1` pairs)
- Git hook scripts in `.githooks/` remain Unix shell (`.sh`) for git compatibility
- All text files saved as **UTF-8 (without BOM)**
- Commit messages and PR artifacts in **English only**
<!-- COMMON-CONTEXT:END -->

---

*co-learning.context.md version: 1.0 — derived from the co-learning canonical template structure (2026-10-06)*
