# Engagement Kickoff Artifact Pack — Issue Tree + Hypothesis Log

> **Purpose**: The two standard artifacts every co-consult engagement produces at kickoff, BEFORE fieldwork begins: a structured **issue tree** decomposing the client's problem, and a **hypothesis log** recording the falsifiable conjectures the engagement will test. Together they make the engagement's logic inspectable — what you believe, why, and how you would know you are wrong.
>
> **Consumed by**: `strategy-analyst` (drafts both at Phase 1 kickoff, audits via the `mece-logic-auditor` skill), `pm` (approves before fieldwork — Phase 2 gate), `insight-synthesis` / `consulting-report-writing` skills (consume the closed log at Phase 3 content creation).

---

## 1. Issue Tree Template

Copy this skeleton into `deliverables/<engagement>/01-issue-tree.md`.

```markdown
# Issue Tree — <Client / Engagement>

**Root question**: <The single question whose answer is the engagement's deliverable.
One sentence, answerable, no conjunctions — split "and" into two trees.>

## Level 1 branches

### B1. <Branch — a dimension of the answer, noun phrase>
- Sub-question: <A yes/no or measurable question this branch resolves>
- Data required: <what evidence would answer it>
- Owner: <workstream / agent>

### B2. ...
```

### Drafting rules

1. **Branches are dimensions, not topics.** Each level-1 branch must be a candidate PART of the answer; if removing a branch leaves the root question answerable, the branch is decoration.
2. **End every branch in a verifiable question.** The tree's leaves must be questions evidence can settle — never "explore X" (unverifiable) but "did X happen / how large is X".
3. **One decomposition logic per level.** Mixing logics at the same level (e.g. by-segment and by-cause branches side by side) breaks MECE; pick a logic, apply it, change logics only between levels.
4. **Three to five branches per node.** Fewer means the level is unnecessary; more means a missing intermediate level.
5. **Audit before fieldwork**: run `mece-logic-auditor` on the completed tree; the kickoff gate is a tree with no overlap/gap findings at blocker severity. Record the audit score in the tree header.

## 2. Hypothesis Log Template

Copy this skeleton into `deliverables/<engagement>/02-hypothesis-log.md`.

```markdown
# Hypothesis Log — <Client / Engagement>

| ID | Hypothesis | Tree branch | Test method | Status | Evidence | Date |
|----|-----------|-------------|-------------|--------|----------|------|
| H1 | | B1 | | open | — | <YYYY-MM-DD> |
```

### Logging rules

1. **Every hypothesis traces to a tree branch** (the "Tree branch" column). A hypothesis with no branch is scope creep — either add the branch or drop the hypothesis.
2. **Falsifiable phrasing.** A hypothesis states a specific relationship or fact that evidence could disprove ("Segment A's churn is driven by pricing, not service quality"), never a tautology ("pricing matters") or a direction-less aspiration ("improve operations").
3. **Status is one of**: `open` → `supported` / `disproved` / `unresolvable` (with the blocking reason). Status changes require the Evidence column to cite a specific source, analysis file, or interview reference.
4. **The log is append-only.** Disproved hypotheses are NEVER deleted — they are the engagement's audit trail and often the most valuable finding at close ("we looked, and the obvious answer is wrong").
5. **One row per hypothesis.** Composite conjectures split into rows so each can fail independently.
6. **Date every status transition**, ISO 8601.

## 3. Kickoff Flow Wiring

| Step | Who | Action |
|------|-----|--------|
| 1 | `strategy-analyst` | Draft issue tree from the engagement brief; branches annotated with data required + owner |
| 2 | `strategy-analyst` (via `mece-logic-auditor` skill) | Audit the tree; blocker findings return to step 1 |
| 3 | `strategy-analyst` | Derive initial hypotheses from tree branches into the log (3-7 to start; the log grows) |
| 4 | `pm` | Approve both artifacts at the Phase 2 gate — design work does not start on an unapproved tree |
| 5 | all Phase 1 analysts | Update the log as evidence lands; `pm` reviews status drift weekly |
| 6 | `strategy-analyst` / `data-analyst` (via `insight-synthesis` skill) | At the Phase 1.5 cross-validation checkpoint, read the log — supported hypotheses become findings; disproved ones become the "what we ruled out" section |
| 7 | `communications-lead` (via `consulting-report-writing` skill) | Report structure mirrors the tree: each section answers one branch |

## 4. Relationship to Existing Skills

- `mece-logic-auditor` — the audit gate for step 2; this pack supplies the artifact the auditor expects
- `insight-synthesis` — consumes the closed log; hypotheses-with-evidence are its raw input
- `consulting-report-writing` — the report's section-per-branch structure assumes this tree
- `stakeholder-alignment` — tree approval is a stakeholder checkpoint, not a back-room artifact

---

*Version 1.0.0 — 2026-08-25. Template pair derived from standard consulting practice (McKinsey-style issue tree + hypothesis-driven problem solving); templates are workspace formulations.*
