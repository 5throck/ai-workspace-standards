# Ticket Batch: dev-sync Staging and Message, upgrade-project Disposition, Variant Drift Guard — Design (Row 0)

- **Spec ID**: `2026-11-16-ticket-batch-dev-sync-upgrade-drift-design`
- **Date**: 2026-11-16
- **Status**: proposed. Owner decisions O-1..O-3 in §7 are open. Defaults are stated and are used if the owner does not object.
- **Author**: architect (PM-dispatched, Design Gate Row 0, ADR-0074, design only)
- **Input tickets**: T-20261114-007, T-20261114-006, T-20261114-005, T-20261114-012 (`bun scripts/ticket.ts show <id>`).
- **Scope**: design only. This document changes no script, template, hook, or skill file. All file:line references were measured on branch `pr/20261116-074445-chore-templates-workspace-sync-66-files` @ `319f0bbb1` (content equal to `origin/main` @ `8f54e74fb` for every file cited). Ticket line numbers were taken on older commits; §6 lists the drift.
- **Related**: [`2026-09-12-dev-sync-scoped-staging-design.md`](2026-09-12-dev-sync-scoped-staging-design.md), [`2026-10-28-dev-sync-staged-count-design.md`](2026-10-28-dev-sync-staged-count-design.md) (T-20261028-012), [`2026-10-27-sync-overwrite-policy-design.md`](2026-10-27-sync-overwrite-policy-design.md) §6 (T-20261027-004), [`2026-10-28-l0-only-governance-doc-cleanup-design.md`](2026-10-28-l0-only-governance-doc-cleanup-design.md) (line 220), T-20261001-015, U-20261107-003, T-20261024-001, T-20261110-012.

## 0. Summary

Four tickets, three PRs. Two tickets touch `scripts/dev-sync.ts` and ship together.

| PR | Tickets | Main file | Change in one line |
|----|---------|-----------|--------------------|
| PR-1 | T-20261114-007, T-20261114-006 | `scripts/dev-sync.ts` | Fail before any pipeline write when nothing was staged but tracked edits exist. Keep the commit body instead of flattening it. |
| PR-2 | T-20261114-005 | `scripts/upgrade-project.ts`, `scripts/lib/upgrade-policy.ts` | Repeatable `--disposition`, `{a,b}` and comma lists in grants, and an explicit refusal instead of a silent un-adopt. Also fix the porcelain parser bug found during review. |
| PR-3 | T-20261114-012 | `scripts/validate-templates.ts`, new `docs/templates/variant-shadow-allowlist.json` | New WARN-only check `variant-common-shadow` with an allowlist. |

The PRs run in sequence (§8). Each PR is root-only. The `templates/common/scripts/` mirrors of `dev-sync.ts`, `helpers/commit-message.ts`, `lib/upgrade-policy.ts`, and `validate-templates.ts` are refreshed by the `/sync` publish step as pipeline output. Nobody edits them by hand. `upgrade-project.ts` has no L1 mirror.

---

## 1. Work item A — T-20261114-007: scoped staging can ship a PR without the intended edits

### 1.1 Root cause (verified)

- **Classification** — `scripts/dev-sync.ts:2241-2283`. Step 6.5 reads S1 (`git status --porcelain -z -uall`, :2248) and `taskStaged` (`git diff --cached`, :2256-2263). It computes `pipelineOutputs` (S1∖S0 plus the content-changed S0∩S1 overlap, :2278-2281), `committable = taskStaged ∪ pipelineOutputs` (:2282), and `residual` (:2283).
- **Warn-only branch** — `:2285-2301`. Residual paths are printed in yellow and left out of the commit. No branch exits when the operator staged nothing.
- **Message hides the failure** — step 6.9 (`:2378-2437`) re-derives the subject from the final staged set through `composeCommitMessage` (`scripts/helpers/commit-message.ts:134`). A weak caller message becomes a plausible `chore: workspace sync (N files)`. The commit, push, and PR then proceed (`:2483`, PR at `:2699`).

**Ticket claim corrected.** The ticket proposes the guard "if taskStaged is empty". That variable cannot carry the guard. `taskStaged` is read at step 6.5, after pipeline steps that call `git add` themselves:

- `dev-sync.ts:927` — the CHANGELOG normalizer runs `git add CHANGELOG.md`.
- `dev-sync.ts:1909` — step 4.87 runs `git add -- <agent file>` after a `last_updated` bump.

So `taskStaged` can be non-empty even when the operator staged nothing. The true operator-staged set is the index at pipeline start. Step 1 already reads it (`:629-634`, before S0 at `:707-724` and before any pipeline write).

**Why the guard must run at S0, not at step 6.5.** If the guard exited at step 6.5, the aborted run would leave its pipeline writes in the tree (memory session entry, CHANGELOG, VERSION_MANIFEST). On the re-run, the memory append is skipped by its idempotency check (`:794-801`). The file is then dirty at S0 and byte-identical at S1, so step 6.5 classifies it as residual and silently drops it. That is the failure this ticket wants to remove. A guard at S0 exits before any write, so a re-run starts from the same tree.

**Related symptom (co-security PR #112).** The `CLAUDE.md` omission does not need an empty index. If the operator staged the other 15 files but not `CLAUDE.md`, the index was non-empty and this guard does not fire. §1.2 item 4 covers that case with better visibility. It does not add a hard gate, because excluding unstaged files on purpose is the scoped-staging contract (T-20261001-015).

### 1.2 Proposed change

1. **Empty-index guard at S0.** Put it right after the S0 snapshot (`:707-724`).
   - Inputs: `agentStagedAtStart` (the step-1 read at `:629-634`, kept in a new variable), and the S0 porcelain entries with their XY status.
   - Fire when all of these are true:
     - `agentStagedAtStart` is empty.
     - S0 holds at least one **tracked** path with worktree status `M`, `D`, or `R` (porcelain X/Y). Untracked `??` entries do not count.
     - `scopedStaging` is true. In sweep mode (`--warn-staging`, `SYNC_SCOPED_STAGING=0`) everything is swept in, so the failure cannot happen.
     - `--conclude-merge` is absent. That flow has its own semantics and the no-op exit already exempts it (`:606`).
     - `--allow-generated-only` is absent.
   - Action: print the tracked paths and three ways forward, then exit 1. The ways forward are `git add <paths>`, `--stage <path|glob>`, and `--allow-generated-only`. No file is written before this point.
2. **New repeatable flag `--stage <path|glob>`** (also `--stage=<value>`). It is parsed in the arg loop (`:559-579`) so that it never reaches `msgArgs`. Before step 1 reads the index, dev-sync runs `git add -- <pathspecs>`. The paths then count as operator-staged in step 1, S0, and step 6.5. A pathspec that matches nothing exits 1 with the path name, the same way the ghost-path rule works at `:2345-2352`.
3. **New flag `--allow-generated-only`.** It is the explicit override for an intended generated-only run that has tracked leftovers in the tree. dev-sync logs it once at S0 and once in the run summary.
4. **Make tracked residual visible (no gate).** In the step-6.5 report (`:2285-2301`), print tracked residual (`M`/`D`/`R`) under its own header, separate from untracked scratch. After the PR URL, print the tracked list again in one line so it does not scroll away. Untracked residual stays a plain WARN (ticket item 3).
5. **Documentation.** Update `skills/sync/SKILL.md` step 0 (line 42) and the step-6 table row (line 107):
   - add the guard, `--stage`, and `--allow-generated-only`;
   - list which invocation classes may run with an empty index: a generated-only publish run on a clean tree, and `--conclude-merge`;
   - state that the upgrade landing already runs `git add -A` (`upgrade-project.ts:9105-9111`), so its index is non-empty.
6. **Out of scope.** Ticket item 5 (the COMMON-CLAUDE merge never moving `Last Updated` backwards) is an upgrade engine change in managed-block merge code. Raise it as its own ticket.

**Caller audit.** No script in `scripts/` runs `dev-sync.ts` from code. References exist only in usage text (`generate-scripts-readme.ts:53`, `upgrade-project.ts:9108`). So the "delivery/closeout caller classes" named in the staged-count design are operator workflows. Each one is handled:

| Caller class | Index at start | Tracked dirt at S0 | Guard result |
|---|---|---|---|
| Normal task sync | staged by operator | any | pass |
| Upgrade landing | `git add -A` printed by upgrade-project | staged | pass |
| Generated-only publish run (clean tree) | empty | none | pass |
| `--conclude-merge` closeout | merge state | any | exempt |
| Forgot `git add` (PRs #2009, #2010, #2025) | empty | yes | **exit 1** |
| Generated-only run with a tracked leftover the pipeline would regenerate | empty | yes | exit 1 until `--allow-generated-only` (accepted cost, see R-A1) |

### 1.3 Test plan

Use the house pattern of `tests/unit/dev-sync-scoped-staging-deletion.test.ts`: slice the real block from `dev-sync.ts`, add a small prelude, and run it with `bun` against a scratch repo under `tests/.temp/`.

- **A-T1**: empty index plus one tracked unstaged edit gives exit 1 before any write. The memory file and CHANGELOG stay unchanged, and no commit is made.
- **A-T2**: same tree with `--stage <file>` gives a pass, and `<file>` is in the staged set.
- **A-T3**: same tree with `--allow-generated-only` gives a pass, and the override is logged.
- **A-T4**: empty index with only untracked scratch gives a pass. The WARN still lists the scratch.
- **A-T5**: `--warn-staging` gives a pass, because the guard is not applicable in sweep mode.
- **A-T6**: `--conclude-merge` is exempt.
- **A-T7**: `--stage` with a pathspec that matches nothing gives exit 1 with the path name.
- **A-T8**: the pipeline-stager regression. The operator stages nothing, and the pipeline's own `git add CHANGELOG.md` runs. The guard still uses the start-of-run index.
- **Regression**: `dev-sync-scoped-staging-default.test.ts` (T1-T4), `dev-sync-scoped-staging-deletion.test.ts`, `dev-sync-pipeline-order.test.ts`, and `commit-message.test.ts` stay green.

### 1.4 Risks

- **R-A1** — a generated-only run with a leftover the pipeline would regenerate now needs `--allow-generated-only`. This is the U-20261107-003 overlap class with an empty index, which is rare. The error text names the flag.
- **R-A2** — `--stage` with a broad glob can stage scratch files. The sensitive-file guard (`:2170-2193`) still runs before commit. The step-6.5 report prints the staged set.
- **R-A3** — porcelain XY parsing. The guard must read the worktree column (Y) and the rename source. Reuse `scripts/lib/git-status.ts` (`parseStatusPorcelain`, :36), extended or wrapped to return XY codes. Do not hand-parse.

---

## 2. Work item B — T-20261114-006: the commit message is flattened to one line

### 2.1 Root cause (verified)

- `dev-sync.ts:580-585` joins every positional arg with a space, then collapses `[\r\n\t]+` and all whitespace runs. Any body or trailer becomes part of the subject.
- `dev-sync.ts:2483` commits with a single `git commit -m ${msg}`.
- The same `msg` feeds the language gate (`:646`), the memory session-summary header and its idempotency regex (`:794-801`), the branch slug (`:2065`), step 6.9 (`originalMsg` at `:628`), and the PR title (`:2699`).

**Ticket claim refined.** The ticket says `.githooks/commit-msg` "already splits head/tail, so multi-paragraph messages are supported downstream". The hook reads the subject with `head -1` correctly. The body read (`tail -n +2 | sed -e '1,/^$/d'`) drops the **first** body paragraph of a standard `subject⏎⏎body` message, because the `1,/^$/` range ends at the next blank line, not at line 1. A probe on `feat: subj⏎⏎para one⏎⏎para two` yields only `para two`. The impact is small: the body feeds only the hook's memory auto-log (decisions and issues), and under dev-sync that block is skipped because dev-sync already wrote the entry (`grep -qxF` on the subject). The commit object itself keeps the full body. The hook fix is out of scope for this PR because `.githooks/` changes get extra review (§3.12). Record it as a follow-up ticket.

### 2.2 Proposed change

Owner position (from the dispatch): no repo-wide trailer rule. This design only preserves the body. It adds no `--trailer` flag and no `SYNC_COMMIT_TRAILERS`.

1. **Pure splitter** in `scripts/helpers/commit-message.ts`: `splitCommitMessage(raw: string): { subject: string; body: string }`.
   - Normalize CRLF and lone CR to LF.
   - `subject` = the first line, with whitespace collapsed and trimmed. This keeps today's guarantee that it is safe for `gh --title`. An empty subject falls back to `chore: update`, as today.
   - `body` = the text after the first line, with leading blank lines and trailing whitespace removed. Inner lines and blank lines stay verbatim.
   - Args are still joined with a single space, as today, so unquoted words keep working. A body exists only when an argument contains a newline.
2. **dev-sync wiring.**
   - `msg` keeps its current meaning, which is the subject. The memory header, slug, step-6.9 regexes, and PR title therefore do not change.
   - A new `msgBody` holds the body.
   - The language gate checks `subject + "\n" + body`.
   - The weak-message check and `composeCommitMessage` work on the subject only. A derived subject keeps the caller's body.
   - The commit runs `git commit -m ${msg}` when the body is empty, and `git commit -m ${msg} -m ${msgBody}` otherwise. `-m` uses git's `whitespace` cleanup mode, so `#` lines in the body survive.
   - The flag-leak hard-fail (`:591`) still checks the subject.
3. **Trailer-shaped token in the subject.** The observed defect is a trailer passed as a separate argument, which is joined onto the subject. Body preservation alone does not fix that case. Proposed default (owner decision O-1): if the subject matches `/\s(Co-Authored-By|Signed-off-by):\s/i`, exit 1. Print the copy-safe form with an embedded newline (`$'feat: x\n\nCo-Authored-By: …'`). This copies the T-20261024-001 precedent (`:587-597`). It does not adopt a trailer convention. It only prevents a malformed subject.

### 2.3 Test plan

- Unit (`tests/unit/commit-message.test.ts`):
  - subject only;
  - subject plus body;
  - subject plus a blank line plus a trailer paragraph;
  - CRLF input;
  - leading blank lines in the body;
  - a tab inside the subject (collapsed);
  - empty input falls back to `chore: update`;
  - weak subject plus body: the derived subject keeps the body.
- Block-slice test on the commit step, in a scratch repo:
  - `%s` equals the subject;
  - `%b` equals the body;
  - `git log --format=%(trailers)` shows a trailer that was passed in the body;
  - the PR-title variable equals the subject.
- Gate test: a body with non-English text fails the language gate.
- O-1 test: `dev-sync "feat: x" "Co-Authored-By: A <a@b>"` exits 1 with the hint.

### 2.4 Risks

- **R-B1** — callers that relied on newline flattening. A multi-line message that used to give a long subject now gives a short subject plus a body. This is the intended change. The changelog entry states it.
- **R-B2** — O-1 may reject agent sessions that append a trailer as a separate argument. The error is explicit and gives the fix. If the owner prefers WARN-and-move, §7 lists that alternative.

---

## 3. Work item C — T-20261114-005: `--disposition` limits block a partial adopt

### 3.1 Root cause (verified)

- **(a) Last flag wins.** `applyDispositionArg` (`scripts/upgrade-project.ts:1612-1631`) assigns the single module-level binding `disposition` (`:1480`) on each call from `:1506` and `:1510`. A second `--disposition` overwrites the first. `--tombstone` already collects repeats into `tombstoneGrants` (`:1579-1586`, `:1665`).
- **(b) No alternation.** `globToRegExp` (`scripts/lib/upgrade-policy.ts:2018-2028`) escapes `{`, `}`, and `|` (the `.replace(/[.+^${}()|[\]\\]/g, …)` at :2020). So `{a,b}` matches only the literal text. A comma list has no meaning at all.
- **(c) A sequential grant un-adopts the previous run.** Two mechanisms combine:
  1. Apply mode always runs `git stash push -u` (`:2347-2351`). So a second run stashes the first run's uncommitted adoption, and the file is classified against its committed bytes again.
  2. The prior delivery manifest is read at `:2944`, **after** the stash. A previous run's uncommitted `.claude/last-upgrade-delivery.json`, which holds the new baseline, is stashed away before it can be read.

  Each run also leaves one stash entry.

**Additional defect found (not in the ticket).** The `preUpgradeDirty` parser (`:2299-2308`) runs `line.trim()` before `entry.slice(3)`. For a worktree-only entry (porcelain ` M path` or ` D path`), `trim()` removes the leading space. `slice(3)` then cuts the first character of the path. Probe results: ` M AGENTS.md` gives `GENTS.md`, and ` D gone.md` gives `one.md`. Staged (`M  path`) and untracked (`?? path`) entries parse correctly. As a result, `isLocallyModified()` (`:2925-2928`) returns false for the most common local edit, an unstaged modification. That breaks the H1 contract described at `:2294-2298` and makes item (c) worse. Paths with spaces or quotes are also fragile under the non-`-z` format.

### 3.2 Proposed change

1. **(a) Repeatable grants.**
   - Replace the single binding with `dispositionGrants: string[]`.
   - A bare `adopt-template` sets an "all" grant, unchanged.
   - Build one `DispositionFlag` after parsing: `{ mode: "adopt-template", matches: (rel) => compiled.some(re => re.test(rel)), grants }`. This is OR semantics. The `DispositionFlag` type (`upgrade-policy.ts:1755`) gains an optional `grants?: string[]` field, so existing callers and tests still compile.
   - Every ADOPT decision detail names the grant that matched. The acceptance check "both grants in the decision rows" is then visible in the manifest.
2. **(b) Alternation and comma lists in `globToRegExp`.**
   - Split a top-level comma list (`a,b`) into separate globs first.
   - Inside one glob, expand `{x,y}` into a non-capturing group `(?:x|y)`. Brace groups do not nest. A nested or unbalanced brace exits 1 with the value.
   - Keep the `**`, `*`, and `?` semantics and the zero-segment rule unchanged.
   - Keep `|` escaped, since it is not glob syntax.
   - Put the expansion in a new exported pure function `expandGrantGlobs(value): string[]`. `globToRegExp` then handles one brace-expanded glob.
3. **(c) Refuse instead of un-adopting** (owner decision O-3, default Option R).
   - In apply mode, before the stash: if `preUpgradeDirty` contains `.claude/last-upgrade-delivery.json` (modified or untracked), the tree holds an uncommitted previous delivery.
   - Then exit 1 with three ways forward:
     - commit the previous delivery;
     - run `--rollback` to discard it and restore the pre-upgrade stash, then re-run **once** with every grant (now possible through (a) and (b));
     - stash it manually.
   - At the end of a conflicted apply run (exit 1), print the stash name (`pre-upgrade-snapshot-<date>`) and the `--rollback` hint.
   - Dry-run is unaffected, because it does not stash (verified by the ticket and by code: the stash is inside `if (!dryRun)` at `:2310`).
4. **Parser fix.** Replace the hand parser at `:2300-2307` with `git status --porcelain=v1 -z -uall` plus `parseStatusPorcelain` from `scripts/lib/git-status.ts:36`. dev-sync already uses that helper at `:718`.
5. **Usage text** (`:1226` and the disposition help) documents repeats, `{a,b}`, comma lists, and the refusal.

### 3.3 Test plan

- Unit (`tests/unit/upgrade-policy-decisions.test.ts`):
  - `expandGrantGlobs('{A,B}')` and `expandGrantGlobs('A,B')` both give `[A, B]`;
  - `globToRegExp('agents/{pm,qa}.md')` matches both files and not `agents/x.md`;
  - an unbalanced brace throws;
  - the existing `**`/`*`/`?` cases (:163-167) stay unchanged.
- Unit for the parser: a ` M AGENTS.md` / `M  x` / `?? y` / ` D z` / rename / quoted-space fixture gives the exact paths.
- Fixture E2E (two-file conflict, scratch clone in `tests/.temp/`):
  - `--disposition adopt-template=A --disposition adopt-template=B` adopts exactly A and B. Both grants appear in the decision rows. `docs/workspace-schema.json` is untouched.
  - `adopt-template={A,B}` and `adopt-template=A,B` give the same result.
  - A sequential second apply run on the dirty tree exits 1 with the refusal message. The stash count does not grow. No file goes back to its committed bytes.
  - A conflicted run prints the stash name.
- Regression: `upgrade-policy.test.ts`, `upgrade-policy-decisions.test.ts`, and the `upgrade-project-*.test.ts` suite stay green.

### 3.4 Risks

- **R-C1** — the refusal changes a flow some operators use today (re-running on a dirty tree). That flow produces wrong results today, so an explicit stop is safer. The message gives a one-command way forward.
- **R-C2** — comma splitting breaks a grant path that contains a literal comma. The template tree has no such path today; this should be checked in PR-2. A literal comma is still possible as `\,`.
- **R-C3** — the parser fix changes `isLocallyModified()` results. Unstaged edits will now correctly read as local. Some dry-run verdicts that wrongly said UPDATE will now say CONFLICT. This is the H1 intent, but it is visible behavior. The changelog states it.

---

## 4. Work item D — T-20261114-012: drift guard for variant files that shadow common

### 4.1 Root cause and evidence (verified)

`new-project` and `upgrade-project` let a variant file replace the common file at the same relative path. No check compares a shadow against its common source. The only related checks are narrow:

- `validate-variant-claims.ts` check j covers AGENTS.md boilerplate.
- `validate-templates.ts` `variant-mirror-parity` (`:3609`) checks which skills are mirrored, not their bytes.
- `platform-mirror-freshness` (`:3579`) checks only the L1 mirrors against the L0 SSOT.

**Re-measurement on 319f0bbb1.** A byte comparison of the 1013 tracked files under `templates/common/` against each `templates/co-*` gives these results.

- **Per-variant counts match the ticket exactly:** co-abap 19, co-architect 17, co-consult 29, co-deck 29, co-design 58, co-develop 27, co-export 12, co-game 27, co-hr 27, co-learning 13, co-news 12, co-price 31, co-safety 63, co-security 27, co-work 36.
- **Totals:** 427 shadow instances across 146 distinct paths.
- **Present in all 15 variants:** the 10 paths the ticket lists. `agents/i18n-specialist.md` and `docs/phase-definitions.md` appear in 14 each. The citation for `phase-definitions` (design 2026-10-28, line 220, "14/16 projects") is correct.
- **co-learning `docs/governance/agents/workflows.md`:** the whole delta is a 29-line insertion after common line 123, inside the `VARIANT-ROLE-BOUNDARY` zone (common lines 120-124). This is correct.
- **Platform-skill copies drifted in 8 variants.** The difference is the frontmatter `last_reviewed` line only (common `2026-11-08`, variant `2026-05-31`). This is stale lag, not intended content.
- **Ticket list is incomplete, but not wrong.** Other shadows exist that the ticket does not list: `.codex/hooks.json`, `.claude/commands/{memlog,sync}.md`, and `.codex/prompts/{memlog,sync}.md` (2 variants each). Single-variant shadows include co-design's 5 design skills × 6 copies, co-safety's 7 skills × 6 copies, co-work `bun.lock` and `i18n-layout`, co-architect `docs/workspace-schema.json`, and co-abap `.github/workflows/ci.yml`.

**Expected result with the initial allowlist (§4.2).** 178 declared variant-owned instances and 1 tracked instance are silent. 248 undeclared instances (133 distinct paths) are reported, in 12 variants. co-export, co-learning, and co-news have zero undeclared. 95 of the 248 are frontmatter-only deltas.

### 4.2 Proposed change

1. **New check `variant-common-shadow`** in `scripts/validate-templates.ts`. It emits only through `warn()` (`:990`) and never calls `fail()`. The exit code does not change. It runs only when `templates/common/` exists. L3 projects skip it, as with the existing L3-skip pattern.
2. **Shadow set.** For each `templates/co-*` and each file under `templates/common/`: the path exists in both trees and the bytes differ after LF normalization. LF normalization prevents false shadows from `core.autocrlf` checkouts on Windows.
3. **Allowlist** at `docs/templates/variant-shadow-allowlist.json`. This is root-only, because the `docs` propagation domain is disabled (ADR-0069). It sits next to `known-issues.json` and `variant-contract.json`. Schema v1:
   ```json
   { "version": 1,
     "entries": [
       { "path": "README.md", "variants": "*", "class": "variant-owned", "reason": "per-variant identity" },
       { "path": "docs/governance/agents/workflows.md", "variants": ["co-learning"], "class": "tracked",
         "commonSha256": "<sha256 of LF-normalized common file at acknowledgement>",
         "reason": "Stream Boundaries insertion in the VARIANT-ROLE-BOUNDARY zone (PR #2032)" } ] }
   ```
   - `variant-owned` means permanent intended divergence. It produces no output and is counted in the pass line.
   - `tracked` means an intended divergence that must follow common. When the current common hash differs from `commonSha256`, the check WARNs `shadow-common-moved`. Fix text: merge the common change into the variant copy, then update `commonSha256`.
   - **Initial entries.** `variant-owned`, `"*"`: the 10 all-15 paths, `agents/i18n-specialist.md`, and `docs/phase-definitions.md`. `tracked`: co-learning `workflows.md`, with the hash taken at PR time (current prefix `904db8ef08542d56`).
4. **Reporting** (the noise budget is one WARN line per variant per class):
   - `shadow-undeclared`: one WARN per variant with its count and up to 5 sample paths. A skill's 6 copies (`skills/<n>/SKILL.md` plus the 5 platform mirrors) collapse into one item, `skill <n> (6 copies)`.
   - The sub-label `frontmatter-only` appears when the bodies are equal after the YAML frontmatter is removed. Fix text: re-sync from common.
   - `shadow-common-moved`: one WARN per tracked entry.
   - `shadow-allowlist-stale`: a declared entry whose path is no longer a shadow (identical or absent in that variant). This keeps the allowlist from rotting.
   - `--json` lists every instance.
5. **Out of scope** (follow-up tickets):
   - Converting co-learning's `workflows.md` into a zone override of common. No template-level zone-override delivery exists today (the `VARIANT-*` markers are checked by `audit.ts:2927-2932` and filled by `l3-to-variant-pipeline.ts`, not merged at scaffold time). That needs its own design.
   - Healing the 95 frontmatter-only shadows and the other undeclared shadows. That is a templates change and needs its own PR (CLAUDE.md §9).
   - Promoting the check to FAIL.

### 4.3 Trade-offs

| Option | Pro | Con | Decision |
|---|---|---|---|
| (a) Hash stamped in each variant file (front matter or trailing comment) | The acknowledgement sits next to the content | JSON/lock files cannot carry comments. Needs edits in 15 template trees, so a templates PR. Hash churn on every acknowledgement. | Rejected |
| (b) `shadowedCommonFiles` in each `variant.json` | Per-variant ownership | 15 template edits (templates PR, CLAUDE.md §9). Repeats the 12 all-variant entries 15 times. | Rejected |
| (c) One root allowlist with `variants: "*" \| [...]` | A single review surface. Root-only PR. Wildcard entries for per-variant identity files. | The allowlist is far from the variant | **Chosen** |
| Per-instance WARN lines | Complete | About 248 lines of noise on every run | Rejected; aggregate per variant, full list in `--json` |

### 4.4 Test plan

- Unit, with pure helpers exported like the existing `collectMirrorFreshnessDrift` pattern:
  - `computeShadowSet` on a fixture tree with identical, differing, CRLF-only, and absent files;
  - `classifyShadow` for variant-owned, tracked (hash equal), tracked (hash moved), undeclared, and frontmatter-only;
  - stale-allowlist detection;
  - skill-copy collapsing.
- Seeded fixture: edit a common file that a `tracked` entry covers and leave the variant alone. Expect `shadow-common-moved`.
- Live-tree assertion (acceptance): on main the check reports 248 undeclared instances in 12 variants, 0 `shadow-common-moved`, and 0 stale entries. The exit code equals the pre-change exit code.
- Regression: all `validate-templates-*.test.ts` stay green, and `validate-templates-l3-skip.test.ts` confirms the check is skipped in L3.

### 4.5 Risks

- **R-D1** — WARN fatigue. Twelve variant lines stay until the heal PRs land. Aggregation keeps it to one line per variant.
- **R-D2** — allowlist rot. `shadow-allowlist-stale` covers it.
- **R-D3** — the hash must be computed over LF-normalized bytes, or Windows checkouts produce false `shadow-common-moved`.

---

## 5. Platform impact (all PRs)

| Platform | Impact | Files affected |
|---|---|---|
| Claude Code | `/sync` behavior changes (PR-1): new guard, `--stage`, `--allow-generated-only`, body kept. Command text in `.claude/commands/sync.md` does not change, because it delegates to the skill. | `scripts/dev-sync.ts`, `skills/sync/SKILL.md` |
| Antigravity (GEMINI.md) | Same `/sync` script and the same `skills/sync/SKILL.md` through the platform mirrors. No GEMINI.md text change: it does not restate dev-sync flags. | The mirrors refresh through `/sync` |
| Codex, Hermes, other surfaces | Same as Antigravity. The `.codex`, `.agents`, and `.hermes` skill mirrors refresh through `/sync`. | Mirrors only |
| templates/common | Pipeline-propagated mirrors only: `scripts/dev-sync.ts`, `scripts/helpers/commit-message.ts` (PR-1), `scripts/lib/upgrade-policy.ts` (PR-2), `scripts/validate-templates.ts` (PR-3), and the sync skill mirrors. No hand edits. | As listed |

Cross-platform: every new git call uses argv arrays (Bun `$` or `spawnSync`), not shell strings. The guard and the parser use `-z` porcelain. LF normalization in PR-3 handles Windows `autocrlf`. No `> nul` redirection is used.

**Accessibility statement**: backend and tooling changes only (CLI scripts, a JSON allowlist, and unit tests). No UI, rendered page, or style change. Exempt from ADR-0065 by this explicit statement.

**Preview Verification statement**: non-UI change. Nothing to preview in a browser. Exempt. Verification is by unit tests and fixture runs (§1.3, §2.3, §3.3, §4.4).

## 6. Ticket claims checked

| Ticket | Claim | Finding |
|---|---|---|
| T-007 | The guard keys on `taskStaged` being empty | **Incorrect as stated.** Step 6.5 `taskStaged` includes pipeline-made `git add` (`:927`, `:1909`). The guard must use the start-of-run index and must run at S0 (§1.1). |
| T-007 | Fixing it closes the co-security #112 `CLAUDE.md` omission | **Only partly.** That commit had 15 staged files, so the index was non-empty and an empty-index guard does not fire. This design improves visibility for that case (§1.2 item 4). |
| T-007 | Line refs (closeout comments) `:2246-2250`, `:2400-2406` | Drifted. The comments are now at `:619-627` and `:2378-2384`. Classification `:2241-2283` and the WARN at `:2285-2301` match. |
| T-006 | `.githooks/commit-msg` already supports multi-paragraph bodies downstream | **Partly incorrect.** The body read drops the first body paragraph (`sed '1,/^$/d'` after `tail -n +2`). The impact is limited to the hook's memory auto-log (§2.1). |
| T-006 | Line refs `:578-585`, `:2483` | Correct (`:580-585`, `:2483`). |
| T-005 | `applyDispositionArg` at `:1583` | Drifted. The definition is at `:1612`, the calls at `:1506`/`:1510`, and `:1583` is tombstone parsing. The behavior claim (last flag wins) is correct. |
| T-005 | `globToRegExp` at `upgrade-policy.ts:2007`; stash at `:2318-2321` | Drifted. Now `:2018` and `:2347-2351`. The behavior claims are correct. |
| T-005 | (c) is caused by the stash | Correct but incomplete. The prior manifest is also read after the stash (`:2944`). A separate parser bug (`:2300-2307`) mis-records unstaged paths (§3.1). |
| T-012 | Shadow counts, the 10 all-15 paths, the phase-definitions citation, the co-learning zone-only delta | All verified exactly on 319f0bbb1. |
| T-012 | The listed "other shadowed sets" | Incomplete (for example `.codex/hooks.json`, command and prompt shadows), but not wrong. The 8-variant platform-skill drift is frontmatter-only. |

## 7. Owner decisions (open; defaults apply unless the owner objects)

- **O-1 (PR-1)**: a trailer-shaped token in the subject. **Default: exit 1** with a copy-safe hint. Alternative: WARN and move the token into the body.
- **O-2 (PR-1)**: flag names `--stage` and `--allow-generated-only`. **Default: as named** in the ticket.
- **O-3 (PR-2)**: a dirty previous delivery on an apply run. **Default: Option R, refuse** with `--rollback` and one-run-with-all-grants guidance. Alternative S: read the manifest before the stash and exclude the previous delivery's paths from the stash. S is more complex, and a mixed tree is harder to roll back.
- **Not taken (per dispatch)**: no repo-wide Co-Authored-By trailer convention. Only body preservation is in scope.

## 8. PR split and sequence

Three root PRs, merged one after another. The one-open-root-PR rule applies (CLAUDE.md "Sequential Branch Dependency Rule"; CONSTITUTION §3.3).

1. **PR-1 (dev-sync, T-007 + T-006)**: `scripts/dev-sync.ts` @version 1.48.0 → 1.49.0, `scripts/helpers/commit-message.ts` (minor bump), `skills/sync/SKILL.md` (version bump plus text), and the tests. It goes first so that PR-2 and PR-3 are landed by the guarded `/sync`. Run `bun run test:unit` before `/sync`, because script and skill versions change.
2. **PR-2 (upgrade-project, T-005)**: `scripts/upgrade-project.ts` @version 1.108.0 → 1.109.0, `scripts/lib/upgrade-policy.ts` (minor bump), and the tests. Opened after PR-1 merges.
3. **PR-3 (drift guard, T-012)**: `scripts/validate-templates.ts` @version 1.82.0 → 1.83.0, the new `docs/templates/variant-shadow-allowlist.json`, and the tests. Opened after PR-2 merges.

Each PR changes three to five root files plus tests. No PR hand-edits more than three template files; mirrors are pipeline output. Each PR updates the matching lifecycle and SCRIPTS records through the normal `/sync` lifecycle step.

Follow-up tickets to file: the COMMON-CLAUDE `Last Updated` monotonic merge (T-007 item 5), the `.githooks/commit-msg` first-paragraph drop, the variant shadow heal PRs (templates), and the co-learning zone-override design.

## 9. Acceptance criteria

PR-1:
- [ ] An empty index plus a tracked unstaged edit makes dev-sync exit 1 before any file write, commit, or push.
- [ ] The same tree with `--stage <file>` commits `<file>`.
- [ ] `--allow-generated-only`, `--warn-staging`, and `--conclude-merge` skip the guard.
- [ ] Untracked-only residual stays a WARN.
- [ ] Tracked residual is listed separately and repeated after the PR URL.
- [ ] A message with a body gives `%s` = subject and `%b` = body. The PR title equals the subject.
- [ ] The language gate checks the body.
- [ ] The existing scoped-staging, pipeline-order, and commit-message tests stay green.

PR-2:
- [ ] Two `--disposition adopt-template=` flags adopt exactly those two files. Both grants appear in the decision rows.
- [ ] `{A,B}` and `A,B` give the same result. `docs/workspace-schema.json` is untouched.
- [ ] A second apply run on a tree with an uncommitted previous delivery refuses with guidance. No stash is added and no file is un-adopted.
- [ ] ` M path` entries are recorded with the full path.
- [ ] The existing single-glob tests stay unchanged and green.

PR-3:
- [ ] `variant-common-shadow` reports exactly the measured undeclared set on main (248 instances, 12 variants). It reports no `shadow-common-moved` and no stale entries.
- [ ] A seeded common edit under a `tracked` entry is flagged.
- [ ] The validator exit code does not change.
- [ ] The check is skipped in L3.
