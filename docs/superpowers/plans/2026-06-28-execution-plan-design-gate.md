# Execution Plan Design Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce design document creation (Row 0) as a mandatory first step in every execution plan for workspace root (L0) and common template (L1), preventing implementation without design.

**Architecture:** Add a fixed Design Gate Row (Row 0) to execution plan boilerplate templates across AGENTS.md, CLAUDE.md, and GEMINI.md. Define explicit exemption categories for trivial tasks. Add Design Gate section to agents/pm.md for PM workflow integration. Sync L0 changes to L1 templates.

**Tech Stack:** Markdown governance files (AGENTS.md, CLAUDE.md, GEMINI.md, agents/pm.md, templates/common/)

**Design Spec:** `docs/designs/execution-plan-design-gate-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `AGENTS.md` | Canonical execution plan template (§5.1), deliverable-type gate (§3.5) | Modify |
| `CLAUDE.md` | Claude Code execution plan boilerplate (§5) | Modify COMMON section |
| `GEMINI.md` | Gemini execution plan boilerplate (§5) | Modify COMMON section |
| `agents/pm.md` | PM Design Gate section, dispatch protocol update | Modify |
| `templates/common/CLAUDE.md` | L1 common template boilerplate (§5) | Modify COMMON section |
| `templates/common/GEMINI.md` | L1 common template boilerplate (§5) | Modify COMMON section |
| `docs/specs/registry.json` | Spec registry — register new spec | Modify |
| `docs/designs/execution-plan-design-gate-design.md` | This design spec | Already created |

---

### Task 1: Update AGENTS.md §5.1 — Add Design Gate Row to Standard Template

**Files:**
- Modify: `AGENTS.md:389-403` (§5.1 Standard Execution Plan Template)

- [ ] **Step 1: Replace the execution plan template table and key points**

Replace the existing §5.1 content (lines 389-403) with:

```markdown
### 5.1 Standard Execution Plan Template

> **Design Gate (Row 0)**: Workspace root (L0) and common template (L1) only.
> L2 variant projects are exempt — they manage their own design workflow.

| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 0 | Create/update design doc → `docs/designs/<spec-id>-design.md` | architect | High | [model] | NEW |
| 1 | [task description] | [specialist] | High/Medium/Low | [model] | <spec-id> |
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | [model] | |

**Execution Order**: [Parallel | Sequential]

**Key points**:
- **Row 0 (Design Gate) is MANDATORY** for L0/L1 — design document must be created/updated before implementation
- Tier column is MANDATORY (High/Medium/Low)
- `/sync` is always the final step — it covers lifecycle update, full audit, commit, push, and PR creation
- No separate Lifecycle Update or Final QA Audit rows needed — `/sync` handles both
- State parallel vs sequential order below the table
- "pm (direct)" is FORBIDDEN - PM never executes directly
```

- [ ] **Step 2: Verify the edit**

Read `AGENTS.md:385-410` and confirm:
- Row 0 present with architect/High/NEW
- Design Gate note above table
- L0/L1 scope note above table
- Key points include Row 0 mandatory note

---

### Task 2: Add Exemption Categories to AGENTS.md §5

**Files:**
- Modify: `AGENTS.md` (insert after §5.1, before §5.2)

- [ ] **Step 1: Insert §5.1.1 Design Gate Exemptions section**

After the §5.1 Key points (after line ~409), before §5.2, insert:

```markdown

### 5.1.1 Design Gate Exemptions

When a task falls into an exempt category, Row 0 is replaced with an exemption marker:

| Category | ID | Description | Row 0 Format |
|----------|----|-------------|--------------|
| memory-log | E1 | Session log entry in `memory/YYYY-MM-DD.md` | `── EXEMPT: memory-log ──` |
| changelog | E2 | `CHANGELOG.md` update only | `── EXEMPT: changelog ──` |
| hotfix-typo | E3 | Typo fix, single-line change, trivial fix | `── EXEMPT: hotfix-typo ──` |
| pure-readme | E4 | README.md body text only (no structural/design change) | `── EXEMPT: pure-readme ──` |
| sync-only | E5 | `/sync` execution only (lifecycle finalization) | `── EXEMPT: sync-only ──` |

**Rules**:
- Exempt Row 0: Agent/Tier/Model columns left blank (`—`)
- Only E1–E5 categories may be used — PM cannot invent ad-hoc exemptions
- Abuse of exemptions is a governance violation

```

- [ ] **Step 2: Verify the insertion**

Read `AGENTS.md:405-430` and confirm §5.1.1 is properly placed between §5.1 and §5.2.

---

### Task 3: Update AGENTS.md §3.5 — Add Design Gate Note to Deliverable-Type Gate

**Files:**
- Modify: `AGENTS.md:172-185` (§3.5 Phase Determination)

- [ ] **Step 1: Add a Design Gate note after the deliverable-type table**

After line 181 (after the table row `| Project scaffolding | Phase 0 | scaffolding-expert | Low | |`), before the Tier Ceiling Rule, insert:

```markdown
**Design Gate (Row 0)**: All non-exempt deliverable types above require a design document (Row 0 in the execution plan) to be created/updated by architect before implementation begins. See §5.1.1 for exemption categories.

```

- [ ] **Step 2: Verify the edit**

Read `AGENTS.md:172-188` and confirm the Design Gate note appears between the table and Tier Ceiling Rule.

---

### Task 4: Update CLAUDE.md §5 COMMON Boilerplate

**Files:**
- Modify: `CLAUDE.md:196-208` (COMMON-CLAUDE section)

- [ ] **Step 1: Replace the COMMON-CLAUDE boilerplate section**

Replace the content between `<!-- COMMON-CLAUDE:START -->` and `<!-- COMMON-CLAUDE:END -->` with:

```markdown
<!-- COMMON-CLAUDE:START -->
## Execution Plan Boilerplate

For execution plan format, mandatory criteria, and templates, see **[AGENTS.md §3 and §5](AGENTS.md)**.

> **Design Gate (Row 0)**: Workspace root (L0) and common template (L1) only.
> L2 variant projects are exempt — they manage their own design workflow.

Every execution plan MUST start with Row 0 (Design Gate — architect creates/updates design doc) and end with `/sync`. Between Row 0 and `/sync`, list implementation tasks.

| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 0 | Create/update design doc → `docs/designs/<spec-id>-design.md` | architect | High | claude-sonnet-4-6 | NEW |
| 1 | [task description] | [specialist] | High/Medium/Low | [model] | <spec-id> |
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | claude-sonnet-4-6 | |

**Exempt tasks** (E1–E5): Replace Row 0 with `── EXEMPT: <category> ──`. See [AGENTS.md §5.1.1](AGENTS.md#511-design-gate-exemptions).

**Claude Code execution**: Use the native `Agent` tool for specialist dispatch. See §6 (Native Sub-agents) and §7 (Native Plan Mode) in this file.
<!-- COMMON-CLAUDE:END -->
```

- [ ] **Step 2: Verify the edit**

Read `CLAUDE.md:196-215` and confirm:
- COMMON-CLAUDE markers preserved
- Row 0 table present
- Exempt reference to §5.1.1
- L0/L1 scope note
- Spec column in table (6 columns)

---

### Task 5: Update GEMINI.md §5 COMMON Boilerplate

**Files:**
- Modify: `GEMINI.md:182-188` (COMMON-GEMINI section)

- [ ] **Step 1: Replace the COMMON-GEMINI boilerplate section**

Replace the content between `<!-- COMMON-GEMINI:START -->` and `<!-- COMMON-GEMINI:END -->` with:

```markdown
<!-- COMMON-GEMINI:START -->
## Execution Plan Boilerplate

For execution plan format, mandatory criteria, and templates, see **[AGENTS.md §3 and §5](AGENTS.md)**.

> **Design Gate (Row 0)**: Workspace root (L0) and common template (L1) only.
> L2 variant projects are exempt — they manage their own design workflow.

Every execution plan MUST start with Row 0 (Design Gate — architect creates/updates design doc) and end with `/sync`. Between Row 0 and `/sync`, list implementation tasks.

| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 0 | Create/update design doc → `docs/designs/<spec-id>-design.md` | architect | High | [model] | NEW |
| 1 | [task description] | [specialist] | High/Medium/Low | [model] | <spec-id> |
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | [model] | |

**Exempt tasks** (E1–E5): Replace Row 0 with `── EXEMPT: <category> ──`. See [AGENTS.md §5.1.1](AGENTS.md#511-design-gate-exemptions).

**Antigravity execution**: Use `invoke_subagent` for specialist dispatch. See §3 (Subagent Instantiation & Async Orchestration) in this file.
<!-- COMMON-GEMINI:END -->
```

- [ ] **Step 2: Verify the edit**

Read `GEMINI.md:182-205` and confirm:
- COMMON-GEMINI markers preserved
- Row 0 table present (same structure as CLAUDE.md, with [model] placeholder for Gemini)
- Exempt reference to §5.1.1
- Spec column in table (6 columns)

---

### Task 6: Add Design Gate Section to agents/pm.md

**Files:**
- Modify: `agents/pm.md` (insert after Dispatch Protocol section, before Required Tools)

- [ ] **Step 1: Insert Design Gate section**

After line 150 (`> Full dispatch rules and execution plan format: see [AGENTS.md §3](AGENTS.md#§3-pm-gateway-workflow).`), before line 152 (`## Required Tools`), insert:

```markdown

## Design Gate (Row 0)

**Mandatory**: Every execution plan for workspace root (L0) and common template (L1) MUST include Row 0 as the first task — design document creation or update via architect.

### Checklist

1. **Exempt check**: Is this request in an exempt category? (E1–E5)
   - Yes → Row 0: `── EXEMPT: <category> ──`, skip to Row 1+
   - No → continue to step 2
2. **Existing spec check**: Does `docs/specs/registry.json` have a relevant spec?
   - Yes → Row 0: `Update design doc → docs/designs/<spec-id>-design.md` | Spec: `<existing-id>`
   - No → Row 0: `Create design doc → docs/designs/<new-id>-design.md` | Spec: `NEW`
3. **Dispatch Row 0 (architect) FIRST**, before any other dispatch
4. **Obtain user approval** on the design document before proceeding to Row 1+
5. **Only after design approval** → dispatch Row 1+ implementation tasks

### Exempt Categories

| ID | Category | Description |
|----|----------|-------------|
| E1 | memory-log | Session log entry in `memory/YYYY-MM-DD.md` |
| E2 | changelog | `CHANGELOG.md` update only |
| E3 | hotfix-typo | Typo fix, single-line change, trivial fix |
| E4 | pure-readme | README.md body text only (no structural/design change) |
| E5 | sync-only | `/sync` execution only (lifecycle finalization) |

### Enforcement

- PM MUST NOT dispatch Row 1+ before Row 0 is complete and user-approved (except exempt)
- Architect creates/updates design doc — PM dispatches, NOT implements directly
- Design doc MUST be committed before implementation begins
- Only E1–E5 exemptions are valid — PM cannot invent ad-hoc exemptions

```

- [ ] **Step 2: Verify the insertion**

Read `agents/pm.md:148-195` and confirm:
- Design Gate section placed between Dispatch Protocol and Required Tools
- Checklist, exempt table, enforcement rules all present

---

### Task 7: Sync L0 Changes to L1 Templates

**Files:**
- Modify: `templates/common/CLAUDE.md:187-199` (COMMON-CLAUDE section)
- Modify: `templates/common/GEMINI.md:182-188` (COMMON-GEMINI section)

- [ ] **Step 1: Update templates/common/CLAUDE.md COMMON-CLAUDE section**

Replace the content between `<!-- COMMON-CLAUDE:START -->` and `<!-- COMMON-CLAUDE:END -->` in `templates/common/CLAUDE.md` with the same content as Task 4:

```markdown
<!-- COMMON-CLAUDE:START -->
## Execution Plan Boilerplate

For execution plan format, mandatory criteria, and templates, see **[AGENTS.md §3 and §5](AGENTS.md)**.

> **Design Gate (Row 0)**: Workspace root (L0) and common template (L1) only.
> L2 variant projects are exempt — they manage their own design workflow.

Every execution plan MUST start with Row 0 (Design Gate — architect creates/updates design doc) and end with `/sync`. Between Row 0 and `/sync`, list implementation tasks.

| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 0 | Create/update design doc → `docs/designs/<spec-id>-design.md` | architect | High | claude-sonnet-4-6 | NEW |
| 1 | [task description] | [specialist] | High/Medium/Low | [model] | <spec-id> |
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | claude-sonnet-4-6 | |

**Exempt tasks** (E1–E5): Replace Row 0 with `── EXEMPT: <category> ──`. See [AGENTS.md §5.1.1](AGENTS.md#511-design-gate-exemptions).

**Claude Code execution**: Use the native `Agent` tool for specialist dispatch. See §6 (Native Sub-agents) and §7 (Native Plan Mode) in this file.
<!-- COMMON-CLAUDE:END -->
```

- [ ] **Step 2: Update templates/common/GEMINI.md COMMON-GEMINI section**

Replace the content between `<!-- COMMON-GEMINI:START -->` and `<!-- COMMON-GEMINI:END -->` in `templates/common/GEMINI.md` with the same content as Task 5:

```markdown
<!-- COMMON-GEMINI:START -->
## Execution Plan Boilerplate

For execution plan format, mandatory criteria, and templates, see **[AGENTS.md §3 and §5](AGENTS.md)**.

> **Design Gate (Row 0)**: Workspace root (L0) and common template (L1) only.
> L2 variant projects are exempt — they manage their own design workflow.

Every execution plan MUST start with Row 0 (Design Gate — architect creates/updates design doc) and end with `/sync`. Between Row 0 and `/sync`, list implementation tasks.

| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 0 | Create/update design doc → `docs/designs/<spec-id>-design.md` | architect | High | [model] | NEW |
| 1 | [task description] | [specialist] | High/Medium/Low | [model] | <spec-id> |
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | [model] | |

**Exempt tasks** (E1–E5): Replace Row 0 with `── EXEMPT: <category> ──`. See [AGENTS.md §5.1.1](AGENTS.md#511-design-gate-exemptions).

**Antigravity execution**: Use `invoke_subagent` for specialist dispatch. See §3 (Subagent Instantiation & Async Orchestration) in this file.
<!-- COMMON-GEMINI:END -->
```

- [ ] **Step 3: Verify L1 sync**

Read both `templates/common/CLAUDE.md:187-199` and `templates/common/GEMINI.md:182-188` and confirm they match L0 versions exactly.

---

### Task 8: Register Spec in docs/specs/registry.json

**Files:**
- Modify: `docs/specs/registry.json`

- [ ] **Step 1: Add new spec entry to registry**

Add a new entry to the `specs` array:

```json
{
  "id": "2026-06-28-execution-plan-design-gate",
  "title": "execution plan design gate",
  "file": "docs/designs/execution-plan-design-gate-design.md",
  "status": "approved",
  "source": "brainstorming",
  "created": "2026-06-28",
  "last_updated": "2026-06-28"
}
```

The registry should look like:
```json
{
  "version": "1.0.0",
  "specs": [
    {
      "id": "2026-06-24-workflow-integrated-methodology-design",
      "title": "workflow integrated methodology design",
      "file": "docs/designs/workflow-integrated-methodology-design.md",
      "status": "approved",
      "source": "brainstorming",
      "created": "2026-06-24",
      "last_updated": "2026-06-24"
    },
    {
      "id": "2026-06-28-execution-plan-design-gate",
      "title": "execution plan design gate",
      "file": "docs/designs/execution-plan-design-gate-design.md",
      "status": "approved",
      "source": "brainstorming",
      "created": "2026-06-28",
      "last_updated": "2026-06-28"
    }
  ]
}
```

- [ ] **Step 2: Verify the registry**

Read `docs/specs/registry.json` and confirm the new entry is valid JSON.

---

### Task 9: Update Design Doc Status

**Files:**
- Modify: `docs/designs/execution-plan-design-gate-design.md:5`

- [ ] **Step 1: Update status from Draft to Approved**

Change line 5 from:
```
**Status**: Draft
```
to:
```
**Status**: Approved
```

---

## Self-Review

1. **Spec coverage**: All sections of the design spec have corresponding tasks:
   - §1 Boilerplate Row 0 → Tasks 1, 4, 5, 7 ✅
   - §2 Exemption Categories → Tasks 2, 4, 5, 6 ✅
   - §3 PM Workflow → Task 6 ✅
   - §4 Design Doc Template → Already in existing `docs/designs/` (26 files follow this pattern) ✅
   - §5 Applicability Scope → Tasks 1, 4, 5 (L0/L1 note) ✅
   - §6 audit.ts → Explicitly out of scope ✅
   - File Change List → All 8 files covered ✅

2. **Placeholder scan**: No TBD, TODO, or "implement later" found ✅

3. **Type consistency**: All execution plan tables use consistent 6-column format `| # | Task | Agent | Tier | Model | Spec |` ✅
