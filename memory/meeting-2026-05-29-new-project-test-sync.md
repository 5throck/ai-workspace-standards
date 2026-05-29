# Meeting Transcript
**Date**: 2026-05-29
**Topic**: Auto-sync new-project test cases via pre-commit hook
**Participants**: pm, architect, auditor, automation-engineer
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Problem Statement

When new-project.sh or new-project.ps1 changes (new step added), test-new-project.ts should automatically reflect the new test case. Pre-commit hook was proposed as the enforcement mechanism.

---

## Transcript

### Round 1 — Feasibility Analysis

**Architect**: (Round 1)

Three interpretations of "auto-reflect":
1. Auto-generation: Parse script and write test code automatically → NOT feasible. Generated tests would be formal but not semantically meaningful (what to verify requires judgment).
2. Change coupling enforcement: If script staged but test not staged → warn or block → FEASIBLE.
3. Structural consistency check: Compare step count in scripts vs test count in test file → FEASIBLE but high false-positive rate.

**Auditor**: (Round 1)

Auto-generation is dangerous: AI-generated tests that only check file existence without content verification create false safety. Coupling enforcement (interpretation 2) is most effective — forces developer to open the test file when scripts change. Structural consistency check (interpretation 3) causes developer fatigue from false positives.

**Automation-engineer**: (Round 1)

Implementation: detect staged new-project.sh or .ps1 in pre-commit; if test-new-project.ts not also staged, warn or block.

Fail vs Warn tradeoff:
- Fail: 100% prevention but blocks non-behavioral changes (comment edits)
- Warn: Preserves flow but may be ignored (wolf cry effect)
- Middle ground: Heuristic — if new `# ── N.` step comment or `function` added, Fail; otherwise Warn.

---

### Round 2 — Implementation Design

**Architect**: (Round 2)

Two structural additions needed beyond pre-commit:

1. `# TEST: Test N` comments in each step of new-project.sh and .ps1 — maps each step to its test number explicitly.
2. SCRIPTS.md tracks test count for test-new-project.ts.

Pre-commit can then check: "count of TEST: in sh == count of Test N in ts" — precise, no false positives.

**Auditor**: (Round 2)

Validation criteria:
- sh TEST: count ≤ ts Test count → pass
- sh has `# ── N.` steps without TEST: → warn (unlinked step)
- sh TEST: references a number not in ts → fail
- sh and ps1 TEST: numbers must match — cross-platform parity check

**Automation-engineer**: (Round 2)

Implementation: create `scripts/verify-new-project-tests.ts` (Tier 2) instead of inline bash logic. Pre-commit calls it when new-project.sh/.ps1/test-new-project.ts are staged.

Script logic:
1. Extract `# TEST: Test N` from new-project.sh (and .ps1)
2. Extract `// ── Test N:` headers from test-new-project.ts
3. Verify all TEST: numbers exist in ts
4. Verify sh and ps1 TEST: numbers match
5. Error on mismatch, warn on unlinked steps

---

## Decisions

| Decision | Rationale |
|----------|-----------|
| No auto-generation | Generated tests create false safety without semantic verification |
| TEST: comment mapping | Explicit, precise, no false positives from structural heuristics |
| Tier 2 verify script | Consistent with workspace architecture; reusable and testable |
| Pre-commit conditional | Only runs when new-project files staged — no overhead on unrelated commits |

## Action Items

| # | Owner | Deliverable | Tier | Model |
|---|-------|-------------|------|-------|
| V-01 | automation-engineer | Add `# TEST: Test N` comments to each step in new-project.sh and new-project.ps1 | Low | haiku |
| V-02 | automation-engineer | Add `[maps to: step X.X]` markers to each test in test-new-project.ts | Low | haiku |
| V-03 | automation-engineer | Write `scripts/verify-new-project-tests.ts` (TEST: vs Test N parity validation) | Medium | sonnet |
| V-04 | automation-engineer | Add verify-new-project-tests.ts call to .githooks/pre-commit | Low | haiku |
| V-05 | auditor | After V-01~V-04: run audit + trigger pre-commit test | Medium | sonnet |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | Every `# ── N.` step in new-project.sh has a `# TEST: Test N` comment | grep check |
| AC-02 | sh and ps1 TEST: numbers are identical | diff output |
| AC-03 | verify-new-project-tests.ts passes with current 19 tests | Script output |
| AC-04 | Pre-commit fires verify-new-project-tests.ts when new-project files staged | Manual test |
| AC-05 | Adding a new step to sh without test causes pre-commit to warn | Manual test |
