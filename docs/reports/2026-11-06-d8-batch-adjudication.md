# D8 Batch Adjudication — 2026-11-06 (T-20261106-006 item 3)

- **Surface**: `scripts/design-gate-coverage.ts` v1.1.0 (report-only, design D8 of
  `docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md`)
- **Window**: 2026-11-03T08:12:21+0900 → 2026-11-06T01:32:00+0900 (the 2026-11-06
  FULL review window; original finding: 81 rows on v1.0.0 —
  `docs/reports/2026-11-06-project-review-daily.md`, "D8 adjudication" section)
- **Executor**: auditor (specialist dispatch, T-20261106-006 item 3)
- **Remedy set** (per the D8 design): spec coverage by name / E1–E5 exemption
  (AGENTS.md §5.1.1) / residual with recommended spec registration. Nothing
  auto-closes; exemptions are recorded, not granted silently.

## Headline

The v1.1.0 spec-citation join (PR #1862, T-20261106-006 item 4) absorbed the
majority of the original 81 rows before adjudication: template-touching commits
whose subjects close out registered work by spec name now resolve at the commit
level, and the specs registered since the review
(`2026-11-05-merge-integrity-design`, `2026-11-06-co-deck-html-pipeline-remediation-design`,
`2026-11-01-hub-consolidation-design` addendum, `2026-11-04-coabap-variant-identity-disposition-design`)
covered most previously-naked tickets. Residual going into this adjudication:
**26 rows = 13 unattributed template-touching commits + 13 uncovered tickets.**

| Disposition | Rows |
|---|---|
| Spec-cited (design doc names the commit's deliverable or the ticket) | 7 |
| E-class (E1 ×4, E3 ×1, E5 ×9) | 14 |
| **Residual (no covering spec, no valid E-class — spec registration recommended)** | **5** |

## Group A — 13 unattributed template-touching commits

### A1. Sync-pipeline mechanical commits — E5 (sync-only), 9 rows

All are `/sync` execution commits: dev-sync-propagated mirrors of content
authored and adjudicated in their own sessions (workspace sync churn, the
hub-spoke/hardening-day class from the original finding). No design content of
their own.

| Commit | Date | Subject |
|---|---|---|
| a8e50bbc | 11-03 | chore(templates): workspace sync (41 files) |
| fb2940ab | 11-03 | chore(templates): workspace sync (9 files) |
| 29d2f4e8 | 11-03 | docs(docs): workspace sync (3 files) |
| 977b2aad | 11-04 | chore(templates): workspace sync (32 files) |
| 90cd332a | 11-04 | docs(docs): workspace sync (5 files) |
| 2e83f728 | 11-04 | chore(templates): workspace sync (17 files) |
| 0d9ecdd7 | 11-04 | chore(templates): workspace sync (23 files) |
| 5e3aff9e | 11-04 | chore(templates): workspace sync (23 files) |
| e3ca0f06 | 11-06 | chore(templates): workspace sync (10 files) |

### A2. Spec-cited closeouts, 4 rows

Each commit is the closeout/hardening of a registered design's own deliverable;
all predate the v1.1.0 subject-citation join, which is why they needed manual
mapping.

| Commit | Date | Subject | Covering spec (by name) | Basis |
|---|---|---|---|---|
| 599eb0df | 11-05 | feat: co-work deliverables convention — L0 scaffold branch + L2 template restructure | `2026-11-05-cowork-deliverables-structure-design` | The commit IS the design's landing (it creates `docs/specs/entries/2026-11-05-cowork-deliverables-structure-design.json` itself) |
| 58c33ca3 | 11-05 | fix(governance): windows-sep hardening for delete-guard + rmdir-if-empty (PR #1855 CI) | `2026-11-04-project-loss-hardening-design` | Platform-compat hardening of the design's §5.1 delete-guard.ts deliverable (its v1.0.0 hook) during that PR's CI |
| f1e3b17e | 11-04 | feat(hub-spoke): final absorption wave — co-architect design agents v1.1.1 from co-design canonical | `2026-11-01-hub-consolidation-design` | Execution of the design's §7.4 amnesty-and-absorb procedure (absorption waves are its defined mechanism) |
| ac929533 | 11-04 | fix(hooks): pre-push changed-path skips deleted test files | `2026-09-16-pre-push-deletion-skip-design` | Restores the design's contract that deletion pushes are not blocked by the gate battery (diff comment: "block every deletion push (observed 2026-11-04, PR #1848)") |

## Group B — 13 uncovered ticket rows

### B1. Spec-covered after honest join repair, 3 rows

| Ticket | Covering spec (by name) | Action taken in this PR |
|---|---|---|
| T-20261103-009 | `2026-11-04-project-loss-hardening-design` | The design already named this ticket three times as the abbreviated "T-20261103-008/-009" — a form the join regex cannot resolve. Spelled the ids out in full (3 occurrences). Coverage existed; the join was blind. |
| T-20261103-005 | `2026-10-31-learning-extraction-design` | Added design §9 addendum: it is a subsequent instance of the same learning-extraction program (docs-only scheduled-jobs pattern v1.1, same deferral semantics, PR #1844). |
| T-20261103-006 | `2026-10-31-learning-extraction-design` | Same §9 addendum: procedure-level security-scan auth-surface step (skill-doc only, no code promotion, PR #1845). |

### B2. E-class, 5 rows

| Ticket | Class | Basis |
|---|---|---|
| U-20261105-001 | E1 (records-only) | Pure upstream-request intake from co-deck (estimate-layout slide-type detection), status `waiting`, no root code landed by it; porting routed to a future adjudicated-port session. Its store file is the record. |
| U-20261105-002 | E1 (records-only) | Same — gen-slides-pdf render-path defect intake, `waiting`, no root code. |
| U-20261105-003 | E1 (records-only) | Same — layout_overrides parser asymmetry intake, `waiting`, no root code. |
| U-20261105-005 | E1 (records-only) | Same — Pretendard /W table + white-bubble geometry intake, `waiting`, no root code. (Sibling tickets U-20261105-004/-006/-007 are already spec-covered by `2026-11-06-co-deck-html-pipeline-remediation-design`.) |
| T-20261101-004 | E3 (hotfix/trivial) | Skill-doc repair: single stale 02:30 runner reference in `skill-graph-analytics/SKILL.md` replaced with a roster naming (v1.3.0, PR #1822). Trivial single-reference correction; the cadence decision it records is procedural, not code. |

### B3. Residual — 5 rows (no forced exemption; spec registration recommended)

These landed substantive root-code changes with no registered design doc naming
them. Listed for retro spec registration (D8 design's "retro backfill" remedy);
they remain visible until a registered design names their ids.

| Ticket | What landed | Recommended spec registration (one line) |
|---|---|---|
| T-20261103-004 | Records-hygiene batch incl. real code: `scripts/lib/git-aware-scan.ts` reconstruction (git-aware fleet-projection filtering) + records batch, PR #1842 | Register a short design doc for the git-aware-scan helper (git ls-files/check-ignore discovery filter for `skill-graph-fleet-report.ts`) and name T-20261103-004. |
| T-20261103-007 | Security policy change: bounded test-fixture allowlist rule for gitleaks (`.github/gitleaks-full.toml` +18), PR #1840 — governed by DEC-20261103-03 (139-line decision record, not a registered spec) | Promote DEC-20261103-03 to a registered spec entry (design doc = the DEC, or a thin design stub referencing it) naming T-20261103-007. |
| U-20261104-001 | Code: `audit.ts` §28 sweep core extracted to `helpers/audit-hook-sweep.ts` v1.0.0 (false-positive variant-hook WARN fix), PR #1846 | One retro batch design for the 2026-11-04 upstream-fix triplet naming U-20261104-001/-002/-003 (see next two rows). |
| U-20261104-002 | Code: `security-validator` v1.2.1 — fail-closed workspace-root detection (upward L0-marker walk, symlink-canonicalized boundary), PR #1848 | Same retro batch design as U-20261104-001. |
| U-20261104-003 | Code: dev-sync v1.38.0 step 4.87 — mechanical frontmatter `last_updated` re-stamp for sync-modified agent files (shared helper v1.0.0, 16 unit cases), PR #1847 | Same retro batch design as U-20261104-001. |

## Method notes

- Adjudicated against current main behavior (v1.1.0 join active): spec-cited
  commit rows leave `unattributedCommits` automatically; the 13 remaining
  commit rows cite neither a ticket id nor a registered spec name.
- No coverage was fabricated: every spec citation above points at a
  pre-existing registered design whose text genuinely governs the commit/ticket;
  the two design-doc edits in this PR only make already-true coverage visible
  to the join (full-id spelling; program addendum for two in-scope extraction
  instances).
- Follow-up (out of scope here): the B3 residuals should be closed by a retro
  spec-registration batch (ticket to be filed by PM if adopted).

## Verification

- `bun scripts/design-gate-coverage.ts --since "2026-11-03T08:12:21+0900" --until "2026-11-06T01:32:00+0900"`
  after this PR's design-doc edits: uncovered drops 26 → **23** (13 commit rows
  + 10 ticket rows) — the three B1 tickets (T-20261103-005/-006/-009) now resolve
  as covered-by-spec. Of the 23, all but the 5 B3 residuals are adjudicated in
  this record (9 × E5 commits, 4 × E1 tickets, 1 × E3 ticket, 4 spec-cited
  commits); the checker is report-only with no adjudication input, so the
  E-classes live here per the D8 design's human-adjudication semantics — the
  true open set is the 5 B3 residuals pending retro spec registration.
- `bun scripts/audit.ts` green at landing.
