---
name: exam-bank-operations
status: active
scope: co-learning
description: >
  Question bank quality and exam operations workflow for assessment deliverables: authoring
  with answer-length bias checks, remediation ledger review, exam window preparation and
  statistics monitoring. Use when: adding/reviewing bank items, running the bias
  remediation workflow, preparing an exam for a cohort, or analyzing exam statistics.
owner: exam-bank-steward
version: "1.1.0"
last_reviewed: "2026-10-06"
prerequisites: Assessment deliverable in deliverables/ with its bias tooling (bias.js) and the admin question-edit surface; remediation drafts + ledger fixtures under tests/
relates_to:
  - skill: documentation-writing
    type: composes_with
metadata:
  type: process
  triggers:
    - question bank
    - exam operations
    - bias review
    - item authoring
---

# Exam Bank Operations

Question-bank quality workflow and exam operations for the assessment
deliverable, owned by the `exam-bank-steward` agent and dispatched via PM.

## Context

The question bank is a quality-controlled content asset: answer-length bias in
distractors leaks the correct answer, so authoring and rewriting both run
through a measurable bias gate, and every AI-drafted rewrite passes a named
human reviewer before it is applied. Once a real exam attempt is recorded,
published items freeze without a formal comparability review.

## When to Use

- Adding or reviewing bank items (authoring quality, bias gate).
- Running the distractor remediation workflow (drafts → review → ledger).
- Preparing an exam for a cohort (windows, activation, review mode).
- Interpreting exam statistics or producing the periodic bank health report.

## Execution Steps

### 1. Authoring a new item

1. Draft: stem, 5 options, exactly one definitively correct answer, explanation,
   dimension (`tech|control|evals|ops|collab`), difficulty (`1|2|3`).
2. Bias check (mandatory):
   ```
   node -e "import('./deliverables/harness-assessment/bias.js').then(m=>console.log(m.lengthBias({options:[...],correct:N})))"
   ```
   - `hard: true` → rewrite before entry (correct is >1.2× the longest distractor).
   - Aim for all five options within ~1.2× word count of each other.
3. Verify the distractors are **definitively false** (no two-correct answers) and
   register-matched with the stem.
4. Balance the correct position across the bank (seed auto-balances; manual items
   should avoid stacking one slot).
5. Add via the admin question-edit form (status `active` or `draft`).

### 2. Bias remediation workflow

Artifacts:
- `tests/bias-remediation-drafts.json` — AI drafts (distractors only)
- `tests/bias-remediation-ledger.json` — review/approval ledger
- `tests/bias-golden.json` — golden baseline of the flagged set
- `tests/bias-metric-test.mjs` — metric unit tests + snapshot check

Loop per batch (target: worst-ratio items first):
1. Generate/refresh drafts into the drafts file.
2. For each item, the **named reviewer** checks every proposed distractor:
   definitively FALSE (no ambiguity), register-matched, length within ~1.2× of correct.
3. Apply via the admin question-edit form; then record in the ledger:
   reviewer name, date, `verifiedFalse: true`, `registerMatch: true`, `appliedAt`.
4. Re-run `node tests/bias-metric-test.mjs` and
   `node deliverables/harness-assessment/scripts/validate.js` — the hard-flag share
   must drop (target ≤30% longest-correct); regenerate `bias-golden.json`
   deliberately after the batch.
5. **Freeze rule**: once the first real (non-mock) exam attempt exists, no further
   rewrites of published items without a formal comparability review.

### 3. Exam operations checklist (per cohort)

1. Confirm the cohort exists (admin → Training tab) and participants are assigned.
2. Create the exam (admin → Exams tab): question count, time limit, attempt limit
   (multi-attempt ⇒ review mode auto `never`), open/close windows with explicit
   timezone, review mode.
3. Activate (`draft → active`) only after the window is confirmed.
4. After submission: read exam stats (submitted, distribution, p-value,
   discrimination); flag items with p > 0.95 or discrimination < 0 for steward review.
5. Close the exam when the window ends.

### 4. Bank health report (periodic)

```
node tests/bias-metric-test.mjs            # metric + golden snapshot
node deliverables/harness-assessment/scripts/validate.js   # warn-only bias shares
```

Report: hard/soft shares, longest-correct rank distribution, per-dimension counts,
thin strata (need more items), ledger progress (reviewed/applied counts).

## Output Format

- Bank items land in the deliverable's question store via the admin form; bias
  evidence and remediation history land in the fixtures under `tests/`
  (drafts, ledger, golden baseline).
- Exam operations leave an admin-side exam record plus a steward note in the
  session memory log (`memory/YYYY-MM-DD.md`) with the statistics interpretation.

## Related Skills

- `documentation-writing` — composes with this skill when bank/report content is
  written for a client-facing audience.
