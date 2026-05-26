# Task Handoff Template

> **Usage**: Copy this file at the start of each task.
> Each agent fills in their section, then passes to the next role.
> The PM archives the completed file to memory after commit.

---

## 0. Request

**Received by (PM)**: <!-- date and time -->
**User Request**:
> <!-- paste original user request verbatim -->

**Classification**: `Feature` / `Bug` / `Refactor` / `Infra` / `Research`
**Component**: <!-- domain/module -->
**Affected Areas**: <!-- components, modules, or systems -->

**Agents Selected**:
- Business: <!-- Analyst roles if needed -->
- Technical: <!-- Architect, Developer, QA, DBA, DevOps -->

---

## 0-A. PM Parallel Dispatch (Phase 1 — Read-Only)

> PM dispatches all read-only subagents **in a single message** (parallel).
> Wait for all results before proceeding to §1 Business Analysis.

```
Agent 1 — codebase-investigator
  Task: Scan existing codebase for related code
  Input: keywords=["<keyword1>", "<keyword2>"]
  Expected output: matching files + code snippets

Agent 2 — data-analyst
  Task: Query data sources for AS-IS state
  Input: context=<domain>, queries=["<query1>", "<query2>"]
  Expected output: PRD draft with AS-IS findings and AC candidates

Agent 3 — schema-inspector
  Task: Inspect data structures and dependencies
  Input: tables=["<TABLE1>", "<TABLE2>"], models=["<MODEL1>"]
  Expected output: field lists, key fields, dependency tree
```

**Merge rule**: Collect all outputs → PM synthesizes into §1 and §2.
**Abort condition**: If any subagent returns an error, PM resolves before proceeding.

---

## 1. Business Analysis

**Agent**: <!-- e.g. Business Analyst -->
**Context file loaded**: `agents/<domain>-analyst.md`

### AS-IS

<!-- Describe the current state. Include query/results. -->

```sql
-- query or command used
```

| Field | Value |
|-------|-------|
| <!-- key finding --> | <!-- result --> |

### GAP

<!-- What is wrong or missing? -->

### TO-BE Requirements

<!-- Describe the desired state in business terms. -->

### Acceptance Criteria

- [ ] **AC-01**: <!-- measurable condition -->
- [ ] **AC-02**: <!-- measurable condition -->
- [ ] **AC-03**: <!-- measurable condition -->

**Handoff to Architect**: <!-- summary of components affected -->
**Handoff to DBA**: <!-- data structures needing review -->

---

## 1-A. Governance Approval

**Agent**: PM (with Architect input)
**Tools**: `AnalyzeDependencies`, `ImpactAnalysis`

### Impact Summary

| Affected Component | Type | Callers | Risk |
|--------------------|------|:-------:|------|
| <!-- name --> | Service/Model/View | <!-- n --> | Low / Medium / High |

### Risk Assessment

- **Scope**: <!-- number of components affected -->
- **Downtime required**: Yes / No
- **Migration needed**: Yes / No
- **Rollback plan**: <!-- describe or "N/A" -->

### Rollback Plan

> Required for high-risk changes. Complete BEFORE starting implementation.

| Component | State | Rollback Method |
|-----------|:-----:|-----------------|
| <!-- name --> | Active / Inactive | Revert commit / Manual review |

### Approval

- [ ] **PM approved** — impact is understood and acceptable
- [ ] **Stakeholder notified** (if High risk)

> ⚠️ Do **not** proceed to §2 Technical Design until all boxes above are checked.

---

## 2. Technical Design

**Agent**: Architect
**Tools used**: `AnalyzeDependencies`, `GrepCode`

### Impact Analysis

```
-- Analysis result
```

| Component | Type | Change Required | Risk |
|-----------|------|-----------------|------|
| <!-- name --> | Service/Model/View | Create / Modify / None | Low/Medium/High |

### Implementation Approach

- [ ] Edit code (surgical, <50 lines)
- [ ] Rewrite component
- [ ] Create new module

### Execution Plan

**Pattern A — Small edit (single component, <50 lines)**
```
[parallel — dispatch as subagents in one message]
  Agent(investigator): Search code(pattern)
  Agent(inspector): Read files  ← confirm current state

[serial — PM executes directly]
  Lint check
  Edit code
  Run tests
  Commit
```

**Pattern B — New component or full rewrite**
```
[parallel — dispatch as subagents in one message]
  Agent(investigator): Search for naming conflicts
  Agent(analyst): Validate assumptions

[serial — PM executes directly]
  Create files
  Lint check
  Run tests
  Commit
```

**Pattern C — Multi-component refactor**
```
[parallel — dispatch as subagents in one message]
  Agent(investigator): Find all occurrences
  Agent(inspector): Analyze dependencies

[serial per component — never parallelize writes]
  for each component:
    Lint → Edit → Test → Commit
```

**Risk level**: `Low` / `Medium` / `High`
**Reason**: <!-- why this risk level -->

**Handoff to Developer**: <!-- component list and change description -->

---

## 3. Implementation

**Agent**: Developer / DBA

### Changes Made

| File / Component | Type | Tool Used | Status |
|------------------|------|-----------|--------|
| <!-- path --> | Service/Model | Edit / Create | ✅ Done / ❌ Failed |

### Lint / Type Check Results

```
-- Linter output
```

### Test Results

```
-- Test output
```

**Handoff to QA**: <!-- test scenarios based on AC list -->

---

## 4. QA Verification

**Agent**: QA Engineer
**Tools**: Test framework, linter

### 4.1 Test Results

| AC | Test Method | Result |
|----|-------------|--------|
| AC-01 | `test_<!-- method -->` | ✅ Pass / ❌ Fail |
| AC-02 | `test_<!-- method -->` | ✅ Pass / ❌ Fail |

```
-- Test output (paste raw)
```

### 4.2 Code Quality Results

```
-- Linter / Static analysis output
```

| Severity | Count | Action |
|----------|-------|--------|
| Error | <!-- n → must be 0 --> | Fix before merge |
| Warning | <!-- n --> | PM disposition: Fix / Suppress / Defer |
| Info | <!-- n --> | Log only |

**Quality Gate**: [ ] Error count = 0 ✅

### 4.3 Issues Found

| # | Symptom | Root Cause | Resolution |
|---|---------|------------|------------|
| 1 | <!-- --> | <!-- --> | <!-- --> |

---

## 5. Finalization (PM)

### Memory Log Entry

Append to `memory/YYYY-MM-DD.md`:

```markdown
## <Component Name> (<Type>)
- **Location**: <file/path>
- **Purpose**: <one-line summary>
- **Decisions**: <key technical decisions>
- **Issues**: <symptom → root cause → resolution>
```

### Git Commit

```bash
git add -A
git commit -m "<type>: <summary>"
```

**Commit type**: `feat` / `fix` / `refactor` / `docs` / `chore`

### Final Report to User

- Components changed: <!-- list -->
- AC status: <!-- X/Y passed -->
- Notes: <!-- anything the user should know -->

---
*Template version: 1.0 — 2026-05-25*
