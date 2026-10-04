# Validator-Hardening Batch — registry parity, record versions, stale stamps, language perimeter, porcelain parsing — Design

- **Date**: 2026-10-05
- **Status**: implemented
- **Spec id**: `2026-10-05-validator-hardening-batch-design`
- **Tickets**: T-20261004-021, T-20261004-020, T-20261004-023, T-20261004-025, T-20261004-019
- **Owner**: automation-engineer scope, implemented by the 03:00 governance-ticket runner
- **Related**: `scripts/verify-skills.ts`, `scripts/skill-lifecycle-audit.ts` (+L1), `scripts/validate-md-language.ts` (+L1), `scripts/resync-audit.ts`, `scripts/agent-lifecycle-audit.ts` (Check 11 precedent), DEC-20260930-01 ruling 2, T-20260909-004

## R1 — Problem

Five validator gaps, each with a live 2026-10-04/05 window case:

1. **021 — registry description blind spot.** verify-skills checked only
   frontmatter↔L0-row versions. The L0 and L1 SKILLS.md rows could drift in
   description (ci-triage: root gained "; merge-time CI healing loop", common
   did not) with nothing noticing.
2. **020 — lifecycle-record footer drift.** A record's footer Metadata Version
   could disagree with its header and the SKILL.md frontmatter (ci-triage
   footer said 0.1.0 against a 0.2.0 bump) — no check read the footer.
3. **023 — content edits without stamps.** Nothing cross-checked a SKILL.md's
   `last_reviewed` against its git content history (graft doctrine block added
   2026-10-04 with `last_reviewed` left at 2026-10-01). The agent side has had
   Check 11 (T-20260909-004) since 2026-09-09; the skill side had nothing.
4. **025 — language-gate perimeter.** The 2026-10-05 docs reorganization
   destinations (docs/reports/, docs/guides/, docs/standards/) were outside
   the official-document perimeter, so undeclared Korean there passed.
5. **019 — porcelain first-row corruption.** `git()` trims WHOLE output, which
   consumed the leading status space of the FIRST `git status --porcelain`
   row (" M p" → "M p"); `porcelainPath`'s `slice(3)` then lost the path's
   first character (the "cripts/co-deck*" group key) and
   `git show HEAD:<truncated>` failed — a tracked-modified file misreported
   as "added-then-modified (no HEAD version)".

## R2 — Decision

1. **021 (verify-skills 1.4.0)**: new `checkRegistryL0L1Parity` — rows for a
   skill present in BOTH SKILLS.md registries must match on version AND
   notes/description. The L0 parse cuts at `### Variant-Exclusive Skills`:
   catalog rows' 7th column is an owner-variant list ("co-price only"), not
   notes, and must never be compared against a same-named L1 common row
   (i18n-audit proved the collision). Intersection-only: workspace-only rows
   have no L1 counterpart by design. The one live divergence found
   (service-design: common row carried a placeholder "—" description) is
   aligned in the same PR.
2. **020 (skill-lifecycle-audit Check MV)**: exported
   `lifecycleRecordVersions` parser (first `## Metadata` block = header, last
   = footer; null on shape drift) and an error-level check: header, footer,
   and SKILL.md frontmatter versions must agree. Unit-tested.
3. **023 (skill-lifecycle-audit Check SD)**: WARN when an active skill's
   `last_reviewed` is older than its last git content commit, reusing
   agent-lifecycle-audit's exported `lastContentCommitDate` (sync-only and
   metadata-only commits skipped per DEC-20260930-01 ruling 2 + v1.7.0;
   archived and self-managed skills exempt — tool-owned SKILL.md content
   moves without review stamps). **Severity deviation from the ticket's
   "fails the lifecycle audit" wording, deliberate**: a probe shows 20 of 41
   root skills are grandfathered-stale; an error-level gate would hard-fail
   every gate run, and mass-stamping `last_reviewed` to today would falsify
   review provenance (a stamp claims a review happened). WARN matches the
   agent-side precedent; tightening after a review sweep is a follow-up.
4. **025 (validate-md-language 1.13.0)**: three perimeter patterns added
   (docs/reports/, docs/guides/, docs/standards/). The declared-Korean
   exception mechanism (`lang`/`lang_reason` frontmatter) already covers the
   two known Korean reports; the gate scans 2059 files and passes clean.
5. **019 (resync-audit 1.4.0)**: `porcelainPath` re-anchors on the
   status-cell shape — well-formed `XY ` rows slice at 3, a
   consumed-leading-space first row (`X `) slices at 2, rename rows still
   return null. Additionally, an empty `git show HEAD:<file>` is
   disambiguated via `git cat-file -e` exit status: a genuine
   added-then-modified keeps its basis; a git-failure read now reports
   "unresolvable → KEEP" instead of a false "no HEAD version". Verdict stays
   conservative KEEP in both branches, per the ticket.

## R3 — Alternatives Rejected

| Alternative | Why rejected |
|---|---|
| 021: compare whole L0 file vs L1 (no section cut) | Collides variant-exclusive catalog rows ("co-price only") with same-named common rows — measured live on i18n-audit during implementation. |
| 021: add a `registry-parity: skip` vocabulary for rows | No current row needs it; speculative vocabulary without a consumer. Revisit if a legitimate fork needs asymmetric descriptions. |
| 023: error-level stale-stamp gate now | 20/41 grandfathered failures and a mass-stamp that would falsify provenance; the ratchet needs a reviewed sweep first (follow-up for the ticket reviewer). |
| 023: reimplement git-commit-date logic locally | `lastContentCommitDate` already encodes the DEC-20260930-01 skip semantics; a copy would drift. |
| 019: stop trimming in `git()` | The trim serves scalar reads (branch, remote); the parser-level fix is the narrow change, and unit tests pin both row shapes. |
| 019: switch porcelain to `-z` parsing | Larger refactor of the exported contract for no additional correctness over the shape-anchored parser. |

## R4 — Verification

- Scratch-repo repro (tracked-modified nested file): pre-fix output showed
  `cripts/co-probe*` + "no HEAD version"; post-fix shows
  `scripts/co-probe*` + LOCAL-WORK. Added-then-modified (never-committed
  file) still classified, now with an accurate basis.
- `bun test tests/unit/resync-audit-corroboration.test.ts` — 15 pass (new
  shifted-first-row + shifted-rename cases); `tests/unit/skill-lifecycle-record-versions.test.ts` — 5 pass.
- `bun scripts/verify-skills.ts` — parity check green post-alignment;
  `bun scripts/skill-lifecycle-audit.ts` — 42 skills, 0 errors (19 SD
  warnings = the measured grandfather set); `bun scripts/validate-md-language.ts`
  — 2059 files, 0 violations.
- Full gates (`audit.ts`, `validate-templates.ts`, `verify-scripts.ts --verify`,
  `bun test`) at PR landing.
