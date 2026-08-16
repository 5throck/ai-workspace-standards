# Design: August 2026 Regression-Coverage Gaps (3 Problems)

**Author**: architect
**Date**: 2026-08-16
**Status**: Proposed (design pass — no implementation in this PR)
**Related**: ADR-0050 (`docs/adr/0050-variant-script-inheritance-and-golden-reference-ssot.md`), `scripts/helpers/security-validator.ts`, `scripts/audit.ts`, `scripts/validate-agents.ts`

## Summary

PM's August audit found three regression-coverage gaps. This doc designs fixes for all three; automation-engineer implements the `audit.ts` checks and the test file in a follow-up PR. No code is written in this pass, except the ADR-0050 status update (§2, justified below), which is a metadata/status edit tied directly to a design decision made here.

---

## 1. No general shell-injection static scan

### Problem

Commit `bd4312f62` (2026-08-11) patched three real shell-injection-adjacent bugs:

- `templates/co-consult/scripts/co-consult/financial-pipeline.ts` — `--company` CLI arg flowed unvalidated into a filename/path later used in file I/O and (transitively) shell-invoked tooling; fixed by whitelisting to `^[a-zA-Z0-9가-힣][a-zA-Z0-9가-힣_\-\s]*[a-zA-Z0-9가-힣]$`.
- `templates/co-consult/scripts/co-consult/md-to-report.ts` — the path-escaping helper only escaped double-quote characters, leaving backslash, dollar-sign, backtick, and newlines unescaped before the path was interpolated into a shell command string (LibreOffice conversion). Fixed by escaping backslash, dollar-sign, backtick, `\n`, `\r` in addition to the double-quote.
- `templates/co-deck/scripts/co-deck/handbook/deploy-handbook.ts` — `--repo`, `--visibility`, `--output` CLI args were interpolated into shell-invoked git/gh commands with no validation at all (visibility/output validation was entirely new; repo-slug check existed but only checked for a `/` character, not full character-safety). Fixed by adding dedicated allowlist-validator functions for each argument.

**Common shape**: an external string (CLI arg) reaches a shell-command-construction site (Bun's `$` tagged template, or a Node process-spawning call, or a path later passed to such) via string interpolation, without a preceding allowlist/regex validation call. This is a source-to-sink pattern, not a single bad token — a naive single-function-name grep would flag nearly every one of the ~80 scripts in the repo (many legitimately spawn subprocesses) and drown real findings in noise.

### Why the existing `security-validator.ts` infra doesn't transplant directly

`scripts/helpers/security-validator.ts`'s `shellCommandPatterns` (used only by `extends-validator.ts` on YAML frontmatter / markdown override content) target *code injected into a documentation field* — code-execution-function calls, template-literal-with-interpolation, PHP/ASP tags. Applied to `.ts` script source, every single legitimate script that spawns a subprocess or uses Bun's shell helper would trip these. They answer "does this markdown field contain any code at all," a different, coarser question than "does this script build a shell command by interpolating unvalidated external input."

**Decision: reuse the module's shape (enum, `SecurityViolationType`, `SecurityViolation` result type, `Fail`/`Warn` reporting convention) but do NOT reuse `shellCommandPatterns` verbatim.** Add a new, narrower pattern set purpose-built for source-scanning, exported from `security-validator.ts` alongside the existing one so both live in one file (single source of truth for "what shell-injection-shaped patterns does this workspace recognize").

### New pattern set (source-scanning, not markdown-scanning)

Target the actual sink shapes seen in the three fixed bugs, at a conceptual level (automation-engineer will finalize exact regex syntax during implementation, informed by a survey pass over the ~80 existing scripts to calibrate false-positive rate before merging):

- **Pattern A — Bun shell-template interpolation without an escaper call**: matches Bun's tagged-template shell-invocation syntax where a `${...}` interpolation does not visibly wrap the interpolated identifier in a call to a function named like `shellEscape*`/`shellQuote*`/`escapeShellArg*`.
- **Pattern B — subprocess spawn via string concatenation or template literal**: matches calls to Node's process-spawning functions where the command argument is built via `+` string concatenation or a template literal with interpolation, as opposed to the argv-array calling form (which is inherently injection-resistant because arguments aren't shell-parsed).

This is intentionally narrower than the existing `shellCommandPatterns` — it looks for the *interpolation-into-a-shell-string* shape, not "any subprocess-spawning call." It will still have false positives (e.g., interpolating an already-validated constant), which is why it's a `Warn`, not a `Fail` (see below).

### New `audit.ts` check

Modeled directly on `checkStaleShellReferences()` (audit.ts:~973-1029): a self-contained `function checkShellInjectionPatterns()` invoked once, scanning `scripts/**/*.ts` and `templates/*/scripts/**/*.ts` (recursive directory walk, matching the existing helper style already used elsewhere in audit.ts — reuse, don't reinvent), skipping `node_modules`, `*.test.ts`, and `*.d.ts`. For each match, call `Warn()` with the file path, line number, matched pattern name, and a remediation hint pointing at validating input before the interpolation site.

### FAIL vs WARN decision

**WARN, not FAIL**, for the initial rollout. Reasoning:
1. The pattern set, however narrowed, cannot distinguish "interpolates unvalidated CLI input" from "interpolates an already-validated or hardcoded value" — that requires dataflow analysis this regex-based checker doesn't do.
2. ~80 scripts workspace-wide; a first pass could easily surface 5-15 matches, some real, most likely false-positive-adjacent (e.g., existing scripts that already validate upstream but don't call a function named with the expected escaper naming convention).
3. A hard FAIL on rollout day would block unrelated PRs workspace-wide until every match is triaged — disproportionate for a first-pass heuristic check.
4. Precedent: `checkStaleShellReferences()` and the L0-leakage check both use `Fail()` because they have zero known false-positive modes (existence checks / exact pattern matches on documentation, not heuristic source analysis). This check's heuristic nature puts it in `Warn()` territory, matching how audit.ts already treats other heuristic/advisory checks.
5. Recommend revisiting FAIL promotion after one full audit cycle once the false-positive rate on the existing ~80 scripts is empirically known (documented as a TODO comment in the check function).

### Files to change (automation-engineer, follow-up PR)

| File | Change |
|---|---|
| `scripts/helpers/security-validator.ts` | Add a new exported pattern-set constant for source-scanning (alongside existing `shellCommandPatterns`); no changes to existing exports/behavior |
| `scripts/audit.ts` | Add `checkShellInjectionPatterns()` function + invocation, modeled on `checkStaleShellReferences()` (~line 973); imports the new pattern set from security-validator.ts |
| `templates/common/scripts/audit.ts` | Same addition, propagated (L0→L1 mirror, per existing convention seen in the validate-agents.ts commits) |
| `docs/adr/` | No new ADR required — this is an audit-check addition consistent with existing patterns, not a new architectural decision |

### Trade-offs considered

- **Alternative: full AST-based taint analysis** (e.g. via a TS-aware AST library). Rejected for this pass — new dependency, much higher implementation cost, disproportionate to a first-pass heuristic gate. Revisit if WARN volume/false-positive rate makes regex untenable.
- **Alternative: reuse the existing markdown-oriented pattern set unmodified.** Rejected — would generate false positives on nearly every script in the repo (see above), defeating the purpose of a targeted check.
- **Alternative: scan only the 3 previously-patched files as a narrow regression guard.** Rejected — too narrow; PM's ask is explicitly a *general* scan across `scripts/**` and `templates/*/scripts/**`, and new scripts are added regularly.

### Acceptance criteria

- `checkShellInjectionPatterns()` exists in both `scripts/audit.ts` and `templates/common/scripts/audit.ts`, reports via `Warn()`.
- Running `bun scripts/audit.ts` against current `main` produces zero `Fail()`s from this check (WARN-only, per decision above) and does not break existing CI gating.
- Manually re-introducing one of the 3 original bug patterns (e.g., reverting the path-escaping helper to its pre-fix single-character-only version) causes the new check to WARN on that file/line.
- `templates/common/scripts/audit.ts` and `scripts/audit.ts` stay byte-identical for this check's code (per L0/L1 propagation convention).

---

## 2. ADR-0050 stuck in "Proposed"; Part 1's audit.ts follow-up never implemented

### Confirmed facts

- Searching `scripts/helpers/plugins/*.ts` for the removed method name returns **zero matches**. Part 2 (delete `VariantPlugin.goldenReference()`) is fully done.
- Searching `scripts/audit.ts` for duplication-related logic finds only 3 unrelated matches (L2 pm.md duplication-prevention line-count checks, an L0-leak "intentional-duplicate" marker) — **no script-duplication-across-variants check exists**. Part 1's own proposed follow-up (ADR-0050 Consequences, Negative/Trade-offs section: a drift-detection check in `audit.ts` was proposed as follow-up work, not included in the ADR's immediate implementation scope) was never built.

### Design: drift-detection check

The ADR's own suggested heuristic: flag a `templates/co-*/scripts/**` file that duplicates a `templates/common/scripts/**` file **by name** and **>50% content similarity**. Refined for a no-new-dependency implementation:

**Algorithm** (Node/Bun built-ins only):
1. Build a map of `basename → full path` for all files under `templates/common/scripts/**/*.ts`.
2. For each file under `templates/co-*/scripts/**/*.ts`, look up by matching basename in the common map.
3. If a common-side match exists, compute similarity via a simple **line-based overlap heuristic**: split both files into non-blank, non-comment-only trimmed lines, treat each as a set, compute `|intersection| / min(|A|,|B|)` (see denominator trade-off below), no external diff library needed.
4. If similarity exceeds 0.50, call `Warn()` with the variant path, the matched common path, the similarity percentage, and a remediation note pointing at ADR-0050 Part 1 (variant-local scripts must not duplicate common/ logic; compose/call common instead).

**Similarity denominator choice**: use `|intersection| / min(|A|,|B|)` rather than plain Jaccard (`/ union`). Rationale: a variant file that is the common file *plus* extra variant-specific logic appended should still register as "near-duplicate of common," which `min()`-based overlap captures better than Jaccard (which would be diluted by the variant's extra lines). This matches the ADR's intent — catching copy-paste-then-extend, the most common real-world drift pattern — better than symmetric similarity.

**FAIL vs WARN**: **WARN**, matching Problem 1's reasoning and the ADR's own framing ("flagged as drift," not "blocked") — line-overlap heuristics have false positives (e.g. two short files that are legitimately similar boilerplate, like two small CLI arg parsers), and this is new-in-this-repo functionality that should observe real-world hit rate for one cycle before considering FAIL.

### Files to change (automation-engineer, follow-up PR)

| File | Change |
|---|---|
| `scripts/audit.ts` | New `checkVariantScriptDrift()` function (basename-match + line-overlap heuristic), invoked once; no new dependencies |
| `templates/common/scripts/audit.ts` | Same addition, propagated |

### Trade-offs considered

- **Alternative: shell out to `git diff --no-index` for a real diff-based similarity score.** More accurate, but spawns a subprocess per file pair — slower and adds a subprocess-invocation pattern to a checker that (per Problem 1) is specifically trying to reduce shell-invocation risk surface in scripts/. Rejected in favor of a pure-JS heuristic.
- **Alternative: token-level (not line-level) similarity.** More robust to reformatting/whitespace-only diffs, but meaningfully more complex to implement correctly (tokenizer, normalization) for marginal gain given TS files are consistently formatted in this repo — deferred as a future refinement if line-based produces too many false negatives.
- **Denominator choice** (`min()` vs `union`): discussed above; documented as a design decision so a future engineer doesn't "fix" it back to symmetric overlap without knowing why.

### Acceptance criteria

- `checkVariantScriptDrift()` exists in both `audit.ts` copies, WARN-only.
- Running against current `main` (post Part-1-era cleanup from commit 20e039d) produces zero warnings for genuinely variant-specific files (e.g. co-deck's theme-rendering scripts, which the ADR explicitly calls out as legitimate non-duplicates).
- A synthetic test fixture (copy a `templates/common/scripts/` file verbatim into a test variant's scripts path) triggers a WARN at >50% overlap.

### Decision: ADR-0050 status

**Flip to `Accepted`.** Justification:
- Part 2 is fully implemented and verified (zero remaining references to the removed method) — nothing "Proposed" about it anymore.
- Part 1 was already true as *policy* (codifying pre-existing commit `20e039d` behavior) at time of writing; its only "not yet done" piece was the follow-up audit check, which is explicitly scoped in the ADR's own Consequences section as deferred, optional follow-up work — not a precondition for the ADR's *decision* being accepted. An ADR records a decision, not the completion of every downstream task; the related ADRs referenced in this ADR's header are presumably also Accepted despite ongoing enforcement refinement.
- This design doc (§2 above) now formally specifies that follow-up, closing the last open loop the ADR flagged. Leaving the ADR in "Proposed" indefinitely because of a self-acknowledged-optional follow-up sets a bad precedent (ADRs should reflect decided-and-acted-upon status, not track implementation-task completion — that's what `docs/designs/` and PR-tracking are for).
- Action taken in this pass: updated frontmatter status and body status line from "Proposed" to "Accepted," and appended an "Implementation" section noting Part 2 is done and Part 1's audit.ts check is now specified in this design doc (implementation pending next PR). See edited ADR file.

---

## 3. `validate-agents.ts` has no regression tests

### Bugs analyzed

**Bug A** (fixed 2026-08-15, later same-day commit): `parseFrontmatter()`/`hasNestedField()` matched the frontmatter delimiter block anchored to *string start only* (no multiline flag). Files with a leading comment line before frontmatter (e.g. co-deck's `@resolved-from` annotation comment on extends-pattern files) had a valid frontmatter block, but not at position 0, so it was invisible to the regex — silently treated as "no frontmatter," producing false-positive "missing lifecycle frontmatter" errors. Fix: add the multiline flag so the delimiter anchor matches at the start of any line, not just the first line of the file.

**Bug B** (fixed 2026-08-15, earlier same-day commit): `validateRuntimeDefinitions()`'s file filter excluded exactly `README.md` by exact-string comparison, but not `README_ko.md` or other underscore-suffixed/prefixed variants, so Korean README files in `agents/` were scanned as if they were agent definition files and flagged for missing lifecycle frontmatter (which READMEs never have). Fix: broadened the filter to a regex excluding any `README(_*).md` variant plus any underscore-prefixed file.

### Test location and runner

This repo's script tests live in `tests/unit/*.test.ts`, run via Bun's built-in test runner (confirmed via `tests/unit/qa-gate-crlf.test.ts` as the reference pattern — imports test primitives from Bun's test module, self-contained fixtures written to a temp dir or inline strings, no separate fixture files needed for small cases).

### New file: `tests/unit/validate-agents.test.ts`

**Test case 1 — leading-comment frontmatter (Bug A regression guard)**

- Fixture: an in-memory string mimicking co-deck's extends-pattern file: a leading comment line (`# @resolved-from: L0/common/agents/pm.md`), followed by a `---`-delimited frontmatter block containing `lifecycle:\n  status: active`, followed by markdown body content.
- Import `parseFrontmatter` (and/or `hasNestedField`) from `scripts/validate-agents.ts` — check current exports; if not exported, note in the design that automation-engineer should add `export` to these two functions (currently module-internal) since tests need to call them directly rather than only through the CLI's full-run side effects.
- Assertion: `hasNestedField(fixture, 'lifecycle.status')` returns `true` (would have returned `false` pre-fix, since the old non-multiline regex wouldn't find the frontmatter block at all).

**Test case 2 — README_ko.md exclusion (Bug B regression guard)**

- Fixture: a temp `agents/` directory (matching whatever temp-dir pattern `qa-gate-crlf.test.ts` uses) containing four files: `README.md` (no frontmatter, legitimate doc file), `README_ko.md` (no frontmatter, legitimate Korean doc file), an underscore-prefixed internal-notes file (no frontmatter, should also be excluded per the fix's underscore-prefix clause), and one real agent file (e.g. `pm.md`) with valid lifecycle frontmatter.
- Invoke the file-filtering logic directly (extract/export the filter predicate, or call `validateRuntimeDefinitions()` against the temp dir if the function accepts a directory parameter — check current signature; if the agents directory is a hardcoded module-level constant rather than a parameter, note automation-engineer should parameterize it for testability, matching however `qa-gate-crlf.test.ts` handles this for its own target function).
- Assertion: the resulting agent-file list (or validation error count) includes `pm.md` but excludes all three doc/internal files — i.e., zero false-positive "missing lifecycle frontmatter" findings for them.

### Files to change (automation-engineer, follow-up PR)

| File | Change |
|---|---|
| `tests/unit/validate-agents.test.ts` | New file, 2 test cases per above |
| `scripts/validate-agents.ts` | Export `parseFrontmatter`, `hasNestedField`, and the file-filter predicate (or a parameterized directory input to `validateRuntimeDefinitions`) if not already exported/testable — minimal refactor for testability, no behavior change |
| `templates/common/scripts/validate-agents.ts` | Mirror the same export/parameterization change (L0→L1 propagation convention) |

### Trade-offs considered

- **Alternative: black-box test by running the CLI as a subprocess against fixture directories.** More faithful to real usage, but slower and matches this repo's existing test style less well (existing tests import functions directly rather than shelling out) — rejected in favor of direct function import, consistent with existing convention.
- **Testing via real repo files** (e.g. asserting against the live `agents/pm.md`) — rejected: fragile (breaks if that file's content changes for unrelated reasons), doesn't isolate the two specific regressions. Fixtures are self-contained and reflect exactly the two bug shapes.

### Acceptance criteria

- Running the new test file passes on current (fixed) `main`.
- Manually reverting either fix (drop the multiline flag, or revert the exclusion filter to exact-string `README.md` comparison) causes the corresponding test to fail — i.e., both tests are proven to actually catch their bug, not just pass trivially.
- No changes to `validate-agents.ts` runtime behavior — only added exports/parameterization for testability.

---

## Platform Impact

| Platform | Impact |
|---|---|
| **Claude Code** | No direct impact — all three checks/tests run via the standard audit and test commands, invoked identically whether triggered by a human, a Claude Code hook (PostToolUse lifecycle check), or `/sync`. No new hook wiring needed; existing audit invocation points (manual, `/sync` pipeline, TaskCompleted QA gate) automatically pick up the two new checks once added. |
| **Antigravity** | Same — Antigravity self-enforces via prompt (no hooks), and would invoke the audit script the same way Claude Code CLI does. No Antigravity-specific change needed; the checks are platform-agnostic TypeScript. |
| **templates/common/** | Direct impact for Problems 1 and 2: `templates/common/scripts/audit.ts` must receive the identical new check code as `scripts/audit.ts` (L0→L1 propagation convention, confirmed by both same-day validate-agents.ts fix commits each touching both copies). Problem 3's test file lives at the workspace root only (`tests/unit/`) — `templates/common/` does not have its own equivalent test tree per current repo structure (tests target L0 scripts directly); the `validate-agents.ts` export/parameterization change should still mirror into `templates/common/scripts/validate-agents.ts` per the same propagation convention, even though the test file itself is L0-only. |
| **N/A entries** | None — all three problems touch `scripts/audit.ts` (workspace root, propagated to `templates/common/`), so every platform that runs the audit pipeline is affected identically. No platform-specific behavior branches needed. |

---

## Cross-cutting notes

- All three new/changed checks are `Warn()`, not `Fail()`, in this initial rollout — consistent reasoning across Problems 1 and 2 (heuristic, no-known-false-positive-rate-yet). This is a deliberate, explicit choice, not an oversight; each section states it separately per the task's requirement to state FAIL/WARN reasoning per-problem.
- None of the three problems require a new ADR — Problem 1 and 2's checks are audit-tooling additions consistent with existing `audit.ts` conventions (not a new architectural pattern); Problem 3 is test coverage only. ADR-0050's status update (Problem 2) is the only governance-record change in this pass.
- No new npm/bun dependencies introduced by any of the three designs (regex-based scanning, line-overlap heuristic, Bun's built-in test runner).
