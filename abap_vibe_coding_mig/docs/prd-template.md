# PRD / Acceptance Criteria Template

> **Usage**: Fill this template during the Business Analysis phase (§1 of the task-template).
> One PRD per task. Save completed PRDs alongside the task file in `scratch/tasks/`.
> All content must be written in **English**.

---

## Product Requirements Document (PRD)

**Task ID**: `task-YYYY-MM-DD-NNN`
**Date**: YYYY-MM-DD
**Module**: SD / LE / PP / MM / FI / CO
**Analyst**: <!-- role name -->
**Status**: Draft / Under Review / Approved

---

## 1. Problem Statement

> What is the business problem or user need being addressed?
> Be concrete: who is affected, what goes wrong, how often.

<!-- Example:
Sales order processors cannot filter open deliveries by material group in VL04.
This forces a manual export to Excel weekly, taking 2+ hours per user. -->

---

## 2. AS-IS State

> Describe the current system behavior. Include query results or table screenshots.

### Data Evidence

```sql
-- Paste the RunQuery result that demonstrates the current state
SELECT ...
FROM   ...
WHERE  ...
```

| Metric | Current Value | Source Table |
|--------|:------------:|-------------|
| <!-- e.g. Open deliveries without group --> | <!-- n --> | LIKP / LIPS |

### Process Description

<!-- Step-by-step: what does the user do today? What tool/transaction do they use? -->

---

## 3. GAP Analysis

> What is missing, broken, or inefficient?

| # | Gap Description | Business Impact | Priority |
|---|----------------|:---------------:|:--------:|
| G1 | <!-- describe gap --> | High / Medium / Low | P1 / P2 / P3 |
| G2 | | | |

---

## 4. TO-BE Requirements

> Describe the desired system behavior in business terms. Avoid technical implementation details here.

### Functional Requirements

| # | Requirement | Must / Should / Could |
|---|-------------|:--------------------:|
| FR-01 | <!-- e.g. System displays material group column in VL04 --> | Must |
| FR-02 | | |
| FR-03 | | |

### Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NFR-01 | Response time for report | < 3 seconds |
| NFR-02 | Data correctness | 100% match with source tables |

---

## 5. Acceptance Criteria

> Each AC maps to one or more unit test methods. Must be measurable and binary (Pass/Fail).

- [ ] **AC-01**: <!-- Given X, when Y, then Z -->
- [ ] **AC-02**: <!-- Given X, when Y, then Z -->
- [ ] **AC-03**: <!-- Given X, when Y, then Z -->

**Definition of Done**: All ACs checked, 0 Priority-1 ATC findings, PM approval obtained.

---

## 6. Out of Scope

> Explicitly list what this task does NOT cover, to prevent scope creep.

- <!-- e.g. Changes to pricing logic -->
- <!-- e.g. Integration with non-SAP systems -->

---

## 7. Dependencies & Risks

| Dependency | Owner | Impact if Missing |
|------------|-------|-------------------|
| <!-- e.g. Table ZSD_CUSTOM exists --> | DBA | Blocker |
| <!-- e.g. Transport to QA approved --> | DevOps | Delay |

---

## 8. Handoff Notes

**To Architect**:
- Objects likely affected: <!-- list -->
- Key tables: <!-- list -->
- Risk level estimate: Low / Medium / High

**To DBA**:
- Tables requiring structure review: <!-- list -->
- New custom fields needed: <!-- list or "None" -->

---

*PRD Template version: 1.0 — 2026-05-19*
