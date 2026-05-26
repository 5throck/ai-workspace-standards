# PRD / Acceptance Criteria Template

> **Usage**: Fill this template during the Business Analysis phase.
> One PRD per task. Save completed PRDs alongside the task file.
> All content must be written in **English**.

---

## Product Requirements Document (PRD)

**Task ID**: `task-YYYY-MM-DD-NNN`
**Date**: YYYY-MM-DD
**Module**: <!-- domain/module name -->
**Analyst**: <!-- role name -->
**Status**: Draft / Under Review / Approved

---

## 1. Problem Statement

> What is the business problem or user need being addressed?
> Be concrete: who is affected, what goes wrong, how often.

<!-- Example:
Users cannot filter orders by status in the dashboard.
This forces a manual export to Excel weekly, taking 2+ hours per user. -->

---

## 2. AS-IS State

> Describe the current system behavior. Include query results or screenshots.

### Data Evidence

```sql
-- Paste the query result that demonstrates the current state
SELECT ...
FROM   ...
WHERE  ...
```

| Metric | Current Value | Source |
|--------|:------------:|--------|
| <!-- e.g. Orders without status filter --> | <!-- n --> | orders table |

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
| FR-01 | <!-- e.g. System displays status column in dashboard --> | Must |
| FR-02 | | |
| FR-03 | | |

### Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NFR-01 | Response time for API | < 3 seconds |
| NFR-02 | Data correctness | 100% match with source |

---

## 5. Acceptance Criteria

> Each AC maps to one or more test methods. Must be measurable and binary (Pass/Fail).

- [ ] **AC-01**: <!-- Given X, when Y, then Z -->
- [ ] **AC-02**: <!-- Given X, when Y, then Z -->
- [ ] **AC-03**: <!-- Given X, when Y, then Z -->

**Definition of Done**: All ACs checked, tests passing, code review approved.

---

## 6. Out of Scope

> Explicitly list what this task does NOT cover, to prevent scope creep.

- <!-- e.g. Changes to authentication logic -->
- <!-- e.g. Integration with external systems -->

---

## 7. Dependencies & Risks

| Dependency | Owner | Impact if Missing |
|------------|-------|-------------------|
| <!-- e.g. Table/custom_field exists --> | Backend | Blocker |
| <!-- e.g. API key obtained --> | DevOps | Delay |

---

## 8. Handoff Notes

**To Architect**:
- Components likely affected: <!-- list -->
- Key data structures: <!-- list -->
- Risk level estimate: Low / Medium / High

**To Backend/DBA**:
- Tables requiring structure review: <!-- list -->
- New fields needed: <!-- list or "None" -->

---
*PRD Template version: 1.0 — 2026-05-25*
