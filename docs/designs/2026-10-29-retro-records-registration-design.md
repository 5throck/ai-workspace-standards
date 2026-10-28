# Records-Hygiene Retroactive Registration — 2026-10-27/28 Window Rows (T-20261029-002)

- **Spec ID**: `2026-10-29-retro-records-registration-design`
- **Date**: 2026-10-27 / 2026-10-28 (work dates); recorded 2026-10-29
- **Author**: automation-engineer (docs-writer conventions for the document content), Design Gate Row 0 retro-backfill per the DEC-20261028-04 precedent
- **Status**: implemented (retrospective record + one new validator arm; the retro rows landed 2026-10-27/28 and this doc records their rationale after the fact; the new arm lands with this registration via T-20261029-002)
- **Ticket**: T-20261029-002 (records hygiene batch; the ticket's header-fix half landed in commit `d8d55f8a0` and the test-runner backfill half in PR #1712 — this doc covers the remaining arms: the five retro rows and the registry-vs-header consistency check)
- **Tier**: L0 workspace root scripts + `templates/common/` twins (audit.ts + helper)

## 0. Why this doc exists

The Design-Gate coverage check (battery #9, `scripts/design-gate-coverage.ts`,
spec `2026-10-28-instruction-ownership-backport-hardening-design.md` D8) reports
a set of 2026-10-27/28 window rows that resolve to no registered spec: three
ticketed landings whose windows straddle D8's activation, and two ticket-less
direct commits. Per the validator-hardening retro precedent
(`2026-10-27-validator-hardening-retro-design`), the rationale is recorded here
after the fact — everything below is derived from the merged diffs and ticket
records; it describes what the code DOES, not what it should have done.

The five rows share one miss mechanism (landed through the nightly mechanical
batch / direct-fix paths without design paperwork) but not one theme, so each
row gets its own section. The same landing adds one validator arm that closes
the record-hygiene gap that made this batch necessary (§6).

## 1. T-20261028-014 — manifest baselines carry-forward (upgrade-project 1.79.0, PR #1681)

### 1.1 Problem

The manifest-baseline rebuild in `scripts/upgrade-project.ts` (~lines 4703-4720,
writer rebuilds from delivered paths only since T-20261027-004) dropped the
baselines of every path NOT delivered in a run — conflict-skipped,
tombstoned, or disposition-skipped. Evidence: the co-design PR #67 second
dry-run — the canary conflict-skipped `agents/i18n-specialist.md` and its
baseline was dropped, so the next run degraded it to NO_BASELINE WARN-deliver
and would clobber the project's `phases:[4]` frontmatter at WARN (silent
overwrite regression vector; interacts with the tombstone-ownership design D4's
persisted-baseline assumption).

### 1.2 Implemented (upgrade-project 1.79.0, commit `94a390945`, PR #1681, merge `5e477a8fc`)

The baseline writer carries prior baselines forward for every path not
delivered in the current run — mirroring the D1 tombstones carry-forward rule
`(prior ∪ new) − delivered` — and prunes entries whose template path has
departed. 8 new tests in `tests/unit/upgrade-decision-log.test.ts` pin the
canary scenario (skip re-derives CONFLICT, not NO_BASELINE, across runs).

## 2. U-20261026-009 — post-delivery frontmatter re-stamp (upgrade-project 1.74.0, PR #1634)

### 2.1 Problem

Upstream request from co-design (suspected layer L1): template-upgrade and
workspace-sync deliveries mechanically rewrite `agents/*.md` (placeholder
substitution, section retitles, lifecycle-block cleanup) but never advance the
frontmatter `last_updated` date, so `agent-lifecycle-audit.ts` reported
stale-date warnings after every upgrade wave (8 of 9 agent files warned as of
2026-10-26; commits `548ca96` 2026-09-29, `5361921` 2026-10-05, `2a48945`
2026-10-11 touched agent bodies with zero date bumps). Warnings are
level=warning and the audit gates on errors only, so the drift was never
remediated.

### 2.2 Implemented (commit `ec3921e74`, PR #1634, merge `bfa21bf56`)

- `scripts/helpers/upgrade-versions.ts` v1.1.0 adds the pure
  `bumpFrontmatterLastUpdated(text, date)` primitive: re-stamps the TOP-LEVEL
  `last_updated:` frontmatter key only — never injects one where absent,
  idempotent when already equal, and never touches nested keys (the L3
  governance `lifecycle:` block is preserved verbatim, same scope as
  `preserveLifecycleFrontmatter`).
- `scripts/lib/upgrade-policy.ts` v1.23.0 extends `lifecyclelessText()` to also
  strip the top-level `last_updated:` line from SYNC_IF_NEWER drift
  comparisons, so a bump-only date difference does not re-report DRIFT on the
  next upgrade (the same tolerance `agent-lifecycle-audit`'s
  `isMetadataOnlyChange` implements).
- The warning-escalation alternative (stale-date warnings → error level) was
  intentionally not taken (owner's judgment call, recorded in the ticket
  result). Pinned by `tests/unit/upgrade-restamp.test.ts`.

## 3. U-20261027-002 — regenerated pipeline artifacts join the delivered-diff attribution (PR #1634)

### 3.1 Problem

Upstream request from co-consult (suspected layer L1): dev-sync Step 3.9's
auto-E5 upgrade-delivery attribution failed on every upgrade landing whose
`scripts-snapshot.json` content changed. `isDeliveredDiff()`'s
PIPELINE_ARTIFACT_PATHS whitelist (scripts/lib/upgrade-policy.ts) did not
include `scripts-snapshot.json` or `.claude/last-upgrade-pr-body.md` — both are
regenerated by upgrade-project AFTER the delivery manifest is written (post-
upgrade snapshot regen / PR-body compose), so they can never appear in
`manifest.files`; when their content changed, the gate blocked with
"spec-check FAILED" and the operator had to pass `--spec-exempt=E5` manually
(observed on co-consult, co-export, co-game during the 2026-10-27 ADR-0102
tier-delivery wave).

### 3.2 Implemented (same commit `ec3921e74` / PR #1634 as §2)

Both artifact paths join `PIPELINE_ARTIFACT_PATHS` (upgrade-policy 1.23.0), so
their diffs attribute as delivered pipeline artifacts and a purely
template-delivered diff lands without manual exemption. Pinned by
`tests/unit/upgrade-delivered-diff.test.ts`.

**Identification correction of record**: the batch ticket's shorthand described
this row as "pre-commit 6c dead-gate companion" — the actual ticket record
(tickets/governance/U-20261027-002.yaml, filed from co-consult) is the
PIPELINE_ARTIFACT_PATHS fix above. The pre-commit 6c dead gate is
T-20261027-010's own subject and is already covered by the
2026-10-27-validator-hardening-retro-design registration.

## 4. Commit `567f1413` — templates-root discovery for stub resolution (sync-agent-mirrors 1.1.0, PR #1699)

### 4.1 Problem

The platform-agent-mirror generator (spec
`2026-10-28-platform-agent-mirror-design`, design §4.2 R7 stub rule) resolved
an `extends:` stub's body against `<project>/templates/` in in-project runs —
a directory that never exists in a delivered project — and ignored the stub's
own pointer entirely. The co-newbiz canary (the only project with a real
41-mirror tree) surfaced this as a real gap: the design's §4.2 ASSUMPTION
("composer reuse makes stub resolution work") verified FALSE in project
context.

### 4.2 Implemented (commit `567f1413`, PR #1699, merge `aade177e6`)

`scripts/sync-agent-mirrors.ts` v1.1.0 resolves stub bodies POINTER-FIRST —
the stub's own `extends:` value (file-dir-relative, the ADR-0033 convention)
— falling back to the templates-root convention via a validated
`--templates-root` override or bounded ancestor DISCOVERY (`resolveTemplatesRoot`,
exported pure; first ancestor carrying `templates/common/agents`, cap of 8
levels; not-found is a hard error naming every searched ancestor, never a
silent fallback — a stub must never project as a dead mirror). Mirror OUTPUT
bytes are unchanged for the templates-convention case; only where the body is
sourced from changes. The scaffold/adopt wiring (`new-project.ts` 1.38.0,
`adopt-project.ts` 1.5.0) passes the workspace templates/ explicitly; dev-sync
and audit runs rely on discovery for pointer-less stubs. Pinned by the
`tests/unit/sync-agent-mirrors.test.ts` extension.

## 5. Commit `a18d98a8` — Windows per-file test budget for the tombstone engine suites (test-runner 1.6.0, PR #1677)

### 5.1 Problem

PR #1677's CI run 40603661108 on windows-latest: the tombstone engine work
added 17 full `upgrade-project.ts` integration runs to
`tests/unit/upgrade-decision-log.test.ts`; its first 25 tests alone cost
119.7s on windows-latest, so the LAST test was killed by the 120s suite wall
("Test timed out after 120000ms") while every individual test PASSED (macOS
total: 8.4s) — the same every-test-passes-file-killed-at-the-suite-wall shape
that put mcp-upstream-server and upgrade-tree-sync on the override list in
test-runner 1.5.0.

### 5.2 Implemented (commit `a18d98a8`, riding PR #1677, merge `e5b03fe9b`)

`scripts/test-runner.ts` v1.6.0 joins
`upgrade-decision-log.test.ts: { suite: 300000, test: 60000 }` to
FILE_TIME_BUDGETS. Observed win32 per-test max 25.2s → the 60s test ceiling
keeps ≥2x headroom; projected win32 file total ~126s → the 300s suite budget
keeps ~2.4x. The comment records the evidence (not a hang: all 25 printed
passes are finite, the CI log shows no blocking test).

## 6. New validator arm — registry-vs-design-header consistency check (audit.ts 2.59.0)

### 6.1 Problem

spec-register.ts flips the REGISTRY status, but nothing verifies the design
doc's own Status header moved with it. The failure class is exactly what
T-20261029-002's first half found: four design docs still carried draft/
proposed headers while the registry said implemented — invisible to every gate
because no check compared the two surfaces. (The four docs were repaired in
commit `d8d55f8a0`; this arm stops the class from regrowing.)

### 6.2 Implemented

- New pure helper `scripts/helpers/spec-header-consistency.ts` v1.0.0 (L0+L1):
  `parseDocStatus(text)` finds the design doc's Status header line
  (`- **Status**:` house style) and returns the FIRST status-vocabulary word
  occurring in its value (earliest position wins, word-bounded,
  case-insensitive — so "implemented (registry SSOT; retro-marked from draft
  ...)" parses as implemented, not draft); `null` when no parseable header
  line or no vocabulary word in it. Vocabulary = the audit spec-check Check 4
  list (draft, proposed, approved, planned, implemented, superseded, drifted,
  archived).
- audit.ts v2.59.0, spec-check Check 6 (after Check 5b): for every
  docs/specs/registry.json entry whose file exists, the doc's parsed status
  must equal the registry status — mismatch is a FAIL naming the file and both
  statuses; a doc without a parseable Status header line is a WARN (legacy
  trees predate the header convention) and never a FAIL. Pass line reports
  the compared count.
- Pinned by `tests/unit/spec-header-consistency.test.ts` (pure parser +
  mismatch classification; registry side read via the injected-text shape).

### 6.3 Legacy reconciliation (the current mismatches the arm flagged at first run)

The arm's first run over the live tree flagged 24 pre-existing mismatches
(the T-20261029-002 header-fix half had already repaired its 4 named docs).
Each was reconciled in the direction its evidence supports — the doc header
is the evidence-carrying surface, the registry is the SSOT; agreement is the
invariant, and the move follows whichever side is stale:

- **Doc header lagging the registry (15 rows)** — registry `implemented`, doc
  header `proposed`/`approved`/`draft`: the doc headers were retro-marked to
  `implemented` with the house landed-note ("retro-marked per T-20261029-002
  header-registry reconciliation"). Rows: pm-md-operations-guide,
  hermes-agent-platform-support, mcp-governance-server,
  design-foundation-v1.2, design-lint-registries, kr-llm-config-standardization,
  hermes-md-instruction-file, new-project-skill, validator-gap-port,
  upstream-request-mcp, zai-tier-floor-support, fleet-anchor-repair,
  managed-platform-skeleton, project-resync-coverage,
  decision-write-integrity-skill.
- **Registry lagging the doc (9 rows)** — the doc's own header declares an
  evidenced status the registry row never caught up with; the registry moved
  to the doc's declared status via `spec-register.ts --update`:
  accessibility-standard and codex-platform-support (draft → approved, both
  docs declare approved direction), agents-md-size-reduction (proposed →
  approved, user decision 2026-09-26 recorded in the doc),
  model-registry-platform-coverage (planned → approved, user ruling recorded
  in the doc), adopt-project-conversion, migrate-project,
  pre-adoption-github-repo and pre-rebase-hook-scan-fix (draft → implemented;
  adopt-project.ts/migrate-project.ts/.githooks/pre-rebase are live in-tree),
  project-review-remediation (planned → implemented, DEC-20261026-02, landed
  with PR #1609 per the doc header). The three docs now declaring
  approved-but-not-implemented correctly surface Check 2's stale-approved
  WARN — that is the honest state, not a defect.

## 7. Tickets and commits covered

| Row | Role in this record | Landed in |
|---|---|---|
| T-20261028-014 | Manual ticket: manifest baselines carry-forward (upgrade-project 1.79.0) | `94a390945` (PR #1681) |
| U-20261026-009 | Upstream request (co-design): post-delivery re-stamp (upgrade-project 1.74.0) | `ec3921e74` (PR #1634) |
| U-20261027-002 | Upstream request (co-consult): regenerated artifacts attribution (upgrade-policy 1.23.0) | `ec3921e74` (PR #1634) |
| `567f1413` | Direct commit (no ticket): templates-root stub discovery (sync-agent-mirrors 1.1.0) | PR #1699 |
| `a18d98a8` | Direct commit (no ticket): Windows per-file test budget (test-runner 1.6.0) | PR #1677 |
| T-20261029-002 (arm) | Registry-vs-header consistency check (audit.ts 2.59.0) | this registration |

## 8. Validation

At landing (verified from the merged diffs and ticket records): PR #1634 and
PR #1681 merged with CI green; PR #1677's Windows budget cleared the suite
timeout on the next run; PR #1699's parity checks stayed green with mirror
output bytes unchanged for the templates-convention case. Each upstream
request (U-20261026-009, U-20261027-002) was verified independently of the
requester's diff before its result was recorded (ticket `result` fields).
The new validator arm is pinned by `tests/unit/spec-header-consistency.test.ts`;
a full-tree scan at authoring time found 0 mismatches (the T-002 header-fix
half already landed) and 142/154 registered docs without a Status header line
(WARN class, legacy).

Coverage semantics of record: registering this doc flips the three ticketed
rows (T-20261028-014, U-20261026-009, U-20261027-002) to covered in future
coverage windows that cite them. The two ticket-less commits (`567f1413`,
`a18d98a8`) remain "unattributed" findings when a window contains them — the
D8 join matches ticket ids, which those commits do not carry, and no
registration can retroactively attribute them. Their disposition is this
record plus the forward discipline that direct template/code fixes carry a
ticket id (or an explicit E-code) in their commit message.

## 9. Lessons

- **Why the specs were missed**: rows 1-3 landed 2026-10-27/28 through the
  nightly mechanical batch / upgrade-wave paths in the same window D8's
  coverage check was being built (T-20261028-001) — there was no mechanical
  window-vs-registry comparison yet, so the omission surfaced only when
  battery #9 ran over the window. Rows 4-5 are a different miss: direct
  canary-finding / CI-timing fixes committed without any ticket id, which the
  attribution join cannot see by construction.
- **Prevention of record**: battery #9 for the ticketed class (run per review
  window); for the ticket-less class, D8's unattributed-commits list is the
  tripwire, and the repair is procedural — direct template/code fixes cite a
  ticket id. The §6 arm closes the sibling hygiene class where a status flip
  updates the registry but leaves the doc header behind.
- **Honest framing**: §1-§5 record the design rationale of
  already-implemented code; where the code embodies a choice (carry-forward
  rule shape, re-stamp over escalation, whitelist over manifest inclusion,
  discovery over hardwired roots, budget values), this record states the
  choice as implemented and its recorded evidence; it does not invent
  requirements that were never built.

## 10. Decisions

- **One doc for the batch** — retro format per the
  ticket-runner-mechanical-batch and validator-hardening-retro precedents; the
  rows share the miss mechanism even where their themes differ, and the
  coverage join benefits from one registered doc naming all three ticketed
  rows.
- **The new validator arm rides the same registration** — it is T-20261029-002's
  remaining substantive surface, and a batch record that names the hygiene
  class it enforces is the honest single home for it.
- **Scope boundary** — the other uncovered rows in the current window (five
  further ticket ids and the template auto-release commits) are NOT adjudicated
  or named here: the D8 join matches any prose mention of a ticket id in a
  registered design doc, so naming them — even to say "not covered" — would
  create false coverage joins (the exact hazard the validator-hardening retro
  precedent §6 warns about). They keep their own review disposition.

## 11. Rollback

The registration is paperwork (design doc + registry entry) plus one
report-shaped validator arm and its helper. Single revert of the landing
commit removes all of it; no data migration, no mirror-output change, no
engine behavior change.
