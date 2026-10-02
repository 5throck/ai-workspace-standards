# Validator Warning Fixes (stale-date self-reference, dangling Fix pointer) - Design

- Date: 2026-10-03 | Author: architect | Status: Proposed. Design Gate row 0 (ADR-0074).
- Scope: L0 `scripts/agent-lifecycle-audit.ts`, `scripts/validate-templates.ts`, their unit tests,
  `SCRIPTS.md` rows. L1 mirrors under `templates/common/scripts/` are script output
  (propagate-to-templates inside `/sync`), never hand-edited (CLAUDE.md §9).
- Delivery: single root PR (L0 change + generated L1 mirror copies).

## 1. Problems

**D1 - Check 11 (stale `last_updated`) is self-referential.** `lastContentCommitDate()`
(`agent-lifecycle-audit.ts` ~L430) returns the date of the newest commit touching a file whose
subject is not sync-only (`SYNC_ONLY_COMMIT_PATTERNS` ~L344, DEC-20260930-01 ruling 2).
`isFrontmatterStale()` (~L335) then warns when `last_updated < that date`. Commit `6b2074be`
(2026-10-02) bumped `last_updated` on 9 `agents/*.md` files to each file's previous change date.
That bump commit is itself a "content commit" dated 2026-10-02, so every freshly bumped value is
immediately older than the file's last commit. Result: 8 permanent WARNs (auditor,
automation-engineer, architect, security-expert, skill-graph-analyst, lifecycle-manager,
docs-writer, scaffolding-expert). `pm.md` escaped only because a real edit landed the same day.
No frontmatter value can ever satisfy the check except "date of the bump commit itself".

**D2 - `checkAgentsMdSizeBudget` Fix text points nowhere.** `validate-templates.ts` L5564 says
"see the config backstop in AGENTS.md §6". AGENTS.md §6 is "Skills" and does not mention
`context_file_max_chars`. The backstop actually lives in:
- `HERMES.md` § "Hermes Platform Mechanics" (L23, "Truncation budget" bullet:
  `hermes config set context_file_max_chars 100000`);
- `CONSTITUTION.md` § "11. Governance Enforcement Layers" (L751, ADR-0088 paragraph naming the
  mandatory `context_file_max_chars` onboarding step).

## 2. Decisions

### 2.1 D1 - metadata-only commits do not count as content changes

Intended semantics: a bump commit must not count as the change it documents.

- Add a pure, exported helper `isMetadataOnlyChange(diffText: string): boolean`:
  - Consider only changed lines: lines starting with `+` or `-`, excluding diff headers
    (`+++`, `---`, `diff --git`, `index`, `@@`).
  - Return `true` iff at least one changed line exists AND every changed line matches
    `/^[+-]last_updated:/`.
  - Empty diff (e.g. mode-only or rename-only) returns `false` (treated as content; fail-open).
- In `lastContentCommitDate()`, change the log format to include the SHA
  (`%H%x09%cs%x09%s`). For each candidate in the existing 200-commit window, in order:
  1. skip if `isSyncOnlyCommitSubject(subject)` (unchanged);
  2. otherwise run `git show <sha> -U0 --format= -- <file>`; skip if
     `isMetadataOnlyChange(stdout)`;
  3. otherwise return the date.
- Fail-open: any git error / non-zero status / missing stdout in step 2 treats the commit as a
  content commit (returns its date). The check may over-warn, never hide real staleness.
- Cost: at most one extra `git show` per skipped-or-first commit per file; typical case is 1-2
  calls. The 200-commit window is unchanged.
- Version: `agent-lifecycle-audit.ts` 1.6.0 -> 1.7.0 (behavior change, minor).
- Record the refinement as an amendment note in DEC-20260930-01 ruling 2 context (optional
  cross-reference; the design doc is the primary record).

### 2.2 D2 - repoint the Fix string only

Replace `see the config backstop in AGENTS.md §6` with
`see the config backstop in HERMES.md "Hermes Platform Mechanics" (context_file_max_chars) and CONSTITUTION.md §11`.
The WARN message line (L5563) is unchanged. Nothing is added to AGENTS.md: design
`2026-09-25-agents-md-size-reduction-design.md` Addendum 3 (user decision 2026-09-26) forbids
further AGENTS.md growth/reduction work; the size budget stays WARN permanently (no FAIL).
Version: `validate-templates.ts` 1.50.4 -> 1.50.5. Documentation only; the hermes CLI is never run.

## 3. Acceptance criteria

1. `bun scripts/agent-lifecycle-audit.ts` reports 0 stale-date WARNs for the 8 files listed in
   §1 WITHOUT any change to their frontmatter.
2. Real staleness still warns: a content commit dated after `last_updated` yields a WARN.
3. A commit changing `last_updated:` plus any other line counts as content.
4. Both D2 pointer targets resolve: `HERMES.md` contains the heading `Hermes Platform Mechanics`
   and the string `context_file_max_chars`; `CONSTITUTION.md` contains
   `### 11. Governance Enforcement Layers` and `context_file_max_chars`.
5. `bun scripts/audit.ts` and `bun test` pass; SCRIPTS.md rows bumped; L1 mirrors regenerated
   by `/sync`, not edited by hand.

## 4. Test plan

- Extend `tests/unit/agent-lifecycle-stale-date.test.ts` (existing git-fixture harness):
  - unit: `isMetadataOnlyChange` - only `last_updated` +/- lines -> true; with an extra body line
    -> false; header-only/empty diff -> false; `+++`/`---` headers ignored.
  - fixture: content commit (d1) then metadata-only bump commit (d2) -> returns d1.
  - fixture: bump commit that also edits body (d2) -> returns d2.
  - fixture: metadata-only commit followed by sync-only commit -> returns the earlier content date.
  - fixture: content commit after `last_updated` -> `isFrontmatterStale` true (regression).
- D2: add a test (new `tests/unit/validate-templates-size-budget-pointer.test.ts` or an existing
  validate-templates unit test) asserting the pointer target strings in AC4 exist in the named
  files and that the Fix string no longer contains `AGENTS.md §6`.
- Manual: run `bun scripts/agent-lifecycle-audit.ts` on the current tree; confirm AC1.

## 5. Risks

- Hiding a real change inside a metadata-only commit is impossible by construction: ANY other
  changed line disqualifies the commit from being metadata-only.
- A `last_updated` value deliberately set to a wrong date in a metadata-only commit is not this
  check's concern (it measures age vs content, not correctness of the chosen date).
- Extra `git show` calls add minor latency; bounded by the existing 200-commit window and only
  executed while walking past skipped commits.
- Shallow clones (CI): unchanged behavior; missing history already yields null/fail-open.

## 6. Rollback

Revert the single PR. Both changes are self-contained (one helper + one call-site change; one
string). Reverting restores the prior 8 WARNs (non-blocking) and the old pointer text; no data,
schema, or frontmatter migration is involved.
