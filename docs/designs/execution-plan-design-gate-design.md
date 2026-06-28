# Design: Execution Plan Design Gate

**Date**: 2026-06-28
**Status**: Approved
**Spec ID**: 2026-06-28-execution-plan-design-gate
**Variant**: N/A (workspace-wide)
**Scope**: AGENTS.md §5, CLAUDE.md §5, GEMINI.md §5, agents/pm.md, templates/common/

---

## Problem

Implementation often proceeds without a design document, causing features to be built that were never reflected in the design specs. This creates drift between what was designed and what was implemented.

**Root cause**: The execution plan boilerplate does not enforce design document creation as a prerequisite step. While `CONSTITUTION.md §9.7` established the Design Gate and `AGENTS.md §5.1` added a `Spec` column, neither is enforced — the Spec column is "non-blocking" and CLAUDE.md/GEMINI.md boilerplates still lack the Design Gate Row.

---

## Decision

Add a **mandatory Design Gate Row (Row 0)** to the execution plan boilerplate. This row is always the first task in every execution plan, forcing the PM to dispatch the architect for design document creation/update before any implementation begins.

**Approach**: Boilerplate Row 0 enforcement (Approach A) — embed the gate directly into the execution plan template rather than adding runtime checks or new phase numbers.

**Scope**: Workspace root (L0) and common template (L1) only. L2 variant projects are exempt.

**Blocking level**: Hard blocking — execution plans without Row 0 (or an explicit exemption) are invalid.

---

## Design

### 1. Execution Plan Boilerplate — Design Gate Row

The execution plan table template gains a **fixed Row 0**:

```
| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 0 | Create/update design doc → `docs/designs/<spec-id>-design.md` | architect | High | [model] | NEW |
| 1 | [task description] | [specialist] | High/Medium/Low | [model] | <spec-id> |
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | [model] | |
```

**PM Rules**:
1. Every execution plan starts at Row 0 — design document creation/update is always the first task
2. **Existing spec**: Row 0 Task = `Update design doc → docs/designs/<spec-id>-design.md`, Spec = existing spec-id
3. **New spec**: Row 0 Spec = `NEW`; architect assigns spec-id upon completion
4. Row 0 MUST be dispatched (architect) and approved by user before Row 1+ can begin

### 2. Exemption Categories

When a task falls into an exempt category, Row 0 is replaced with an exemption marker:

| # | Category | Description | Row 0 Format |
|---|----------|-------------|--------------|
| E1 | memory-log | Session log entry in `memory/YYYY-MM-DD.md` | `── EXEMPT: memory-log ──` |
| E2 | changelog | `CHANGELOG.md` update only | `── EXEMPT: changelog ──` |
| E3 | hotfix-typo | Typo fix, single-line change, trivial fix | `── EXEMPT: hotfix-typo ──` |
| E4 | pure-readme | README.md body text only (no structural/design change) | `── EXEMPT: pure-readme ──` |
| E5 | sync-only | `/sync` execution only (lifecycle finalization) | `── EXEMPT: sync-only ──` |

**PM Rules for Exemptions**:
- Exempt Row 0 uses `── EXEMPT: <category> ──` with Agent/Tier/Model columns left blank (or `—`)
- Only the defined E1–E5 categories may be used — PM cannot invent ad-hoc exemptions
- Abuse of exemptions is a governance violation

### 3. PM Workflow with Design Gate

```
User Request
  │
  ├─▶ Deliverable Type Gate (AGENTS.md §3.5)
  │   ├─ Exempt category? ──▶ Row 0: EXEMPT marker, continue to Row 1+
  │   └─ Non-exempt? ──▶ continue below
  │
  ├─▶ Existing Spec Check
  │   ├─ docs/specs/registry.json has relevant spec?
  │   │   └─▶ Row 0: "Update design doc" | Spec: <existing-id>
  │   └─ No relevant spec?
  │       └─▶ Row 0: "Create design doc" | Spec: NEW
  │
  ├─▶ Dispatch Row 0 (architect) FIRST
  │   ├─→ architect creates/updates design doc
  │   ├─→ docs/specs/registry.json updated (if new spec)
  │   └─→ PM presents design doc for user review
  │
  ├─▶ User Approval Gate
  │   ├─→ Approved? ──▶ dispatch Row 1+ implementation
  │   └─→ Changes requested? ──→ architect revises, re-review
  │
  └─▶ Implementation (Row 1+)
      └─▶ Row N: /sync
```

### 4. Design Doc Template

Design documents follow a standardized format:

```markdown
# Design: <Title>

**Date**: YYYY-MM-DD
**Status**: Draft | In Review | Approved | Implemented
**Spec ID**: <spec-id>
**Variant**: workspace | <variant-name> | N/A (workspace-wide)
**Scope**: <affected files/components>

## Problem
<What problem does this solve?>

## Decision
<What was decided and why?>

## Design
<Detailed technical design>

## Impact
<What files/docs change? Linked spec IDs?>

## Implementation Notes
<Filled during/after implementation>
```

**Lifecycle**: `Draft → In Review → Approved → Implemented`

### 5. Applicability Scope

| Layer | Applicable? | Notes |
|-------|:-----------:|-------|
| Workspace root (L0) | ✅ Yes | Full Design Gate enforcement |
| Common template (L1) | ✅ Yes | Full Design Gate enforcement |
| L2 variant templates | ❌ No | Independent projects manage their own workflow |

The COMMON boilerplate markers in CLAUDE.md and GEMINI.md naturally limit propagation — L2 variants that don't inherit COMMON markers won't receive Row 0.

---

## Impact

### Files Changed

| File | Type | Change |
|------|------|--------|
| `AGENTS.md §5.1` | Modified | Add Row 0 (Design Gate) to execution plan template; add exemption categories |
| `AGENTS.md §3.5` | Modified | Add "Design doc required" note to Deliverable-Type Gate |
| `CLAUDE.md §5` COMMON section | Modified | Update boilerplate with Row 0, exemption note, applicability scope |
| `GEMINI.md §5` COMMON section | Modified | Same as CLAUDE.md |
| `agents/pm.md` | Modified | Add Design Gate section; update Dispatch Protocol |
| `templates/common/CLAUDE.md §5` COMMON section | Modified | Sync with L0 CLAUDE.md |
| `templates/common/GEMINI.md §5` COMMON section | Modified | Sync with L0 GEMINI.md |
| `docs/specs/registry.json` | Modified | Register this spec |

### Relationship to Existing Infrastructure

- **Leverages**: `CONSTITUTION.md §9.7` Design Gate, `docs/specs/registry.json`, `AGENTS.md §5.1` Spec column
- **Upgrades**: Non-blocking Design Gate → Hard-blocking Design Gate (Row 0)
- **Does NOT change**: `audit.ts`, `dev-sync.ts`, `scripts/spec-register.ts` — these remain as-is for this sprint

---

## Out of Scope

- `audit.ts --spec-check` enhancement for Row 0 compliance validation (future sprint)
- `scripts/spec-register.ts` automation within the Row 0 flow (PM/architect handle registration manually)
- L2 variant template enforcement (variants are independent projects)
- Retroactive registration of existing 26 design docs in `docs/designs/`
