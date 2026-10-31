# Changelog normalizer — gate-carried migration for legacy CHANGELOG structures (T-20261031-003)

- **Status**: Implemented (PR #1768)
- **Registry status**: `implemented` (docs/specs/registry.json) — flipped when PR #1768 landed; the registry flip rides the 2026-10-31 variant-generator-manifest PR (spec header kept equal to registry per the audit gate).
- **Date**: 2026-10-31
- **Owner**: automation-engineer (PM Gateway dispatch, after user approval)
- **Ticket**: T-20261031-003 (`kind: manual`, priority high) — wave-halt summary,
  0.25.0 delivery wave, 2026-10-31 run
- **Tier**: L0+L1 (fix lands at the workspace root; projects receive it through
  version-gated re-delivery)
- **Spec registry id**: `2026-10-31-changelog-normalize-design` (registered: proposed)
- **Precedent**: docs/designs/2026-10-30-language-gate-parent-verbatim-tolerance-design.md
  (the third gate-vs-legacy-content interaction; the tolerance this design builds on),
  docs/designs/2026-10-29-delivery-bookkeeping-engine-design.md §A4 (the gate itself)

## 0. Accessibility exemption statement

This design is backend/pipeline work: a build-pipeline script, a detection
helper, and unit tests. It produces no user-facing UI. The ADR-0065
accessibility sections and the ADR-0070 preview-verification sections are
**exempt** for every artifact in this design.

## 1. Context

dev-sync v1.35.0 shipped the step-3b CHANGELOG structural-duplicate gate
(scripts/dev-sync.ts:619-624; detection in scripts/helpers/changelog-duplicates.ts
v1.0.0, unit-pinned by tests/unit/changelog-duplicate-gate.test.ts). The gate is
blocking and has no migration path for legacy project CHANGELOG structures. On
the 2026-10-31 wave run, 6 of 11 waved projects failed to land on it:
co-game/co-hr/co-learning/co-news (malformed dated `## [Unreleased] YYYY-MM-DD`
heading variants plus duplicate category blocks), co-deck (6 gate hits), and
co-newbiz (3 hits). Seven projects landed green (co-safety canary, co-abap,
co-consult, co-design, co-export, co-develop, co-price); the runner hand-merged
them. The runner contract halts the wave at more than 2 failing projects, so the
wave halted. The 6 failing projects reverted clean to 0.23.0 with green audits.
The 0.24.0/0.25.0 template versions ride the next cycle after this lands.

Every factual claim below was verified in source before this design relies on
it; ticket-body claims are treated as data and were spot-checked (evidence
cited inline).

## 2. Verified evidence

- **The gate** (scripts/dev-sync.ts:619-624, v1.35.0): step 3b runs the
  changelogGateFindings detector (import at :261) and FAILs on any finding.
  scripts/helpers/changelog-duplicates.ts v1.0.0 detects two classes:
  (1) duplicate `### <Category>` headings within one `## [...]` release
  section; (2) more than one `[Unreleased]` logical section, where dated
  variants (`## [Unreleased] 2026-09-01`) match the same `^## [Unreleased]`
  prefix and count as the same logical section. The scan covers ALL release
  sections; text before the first `## ` header is never scanned; the parser is
  CRLF-safe.
- **The language-gate tolerance exists and works** (dispatch asked to verify
  before citing): scripts/lib/language-guard.ts v1.1.0 exports
  `filterParentVerbatimLines` (:53); scripts/hooks/pre-commit.ts v1.12.0 wires
  it into the check-2-B ADDITIONS gate (:198). An added line whose trimmed
  content exists verbatim in HEAD's version of the same file is treated as
  moved/reordered history and does not block. Registered in SCRIPTS.md
  (2026-10-30, T-20261030-006). The co-safety canary landing exercised it live
  (ticket report; tolerance design doc records the same class).
- **The sanctioned Korean legal exception**: files declare `lang: ko` +
  `lang_reason: legal` in frontmatter; scripts/validate-md-language.ts
  (permitted `lang_reason` values, :145) honors the declaration. CHANGELOG
  reorganization must keep those lines byte-identical so the exception
  declaration stays truthful.
- **Core-script constraint**: scripts/dev-sync.ts is a core standardized script
  (AGENTS.md "Core Script Standardization" — identical across templates and
  variants; L2 direct modification forbidden). Its SCRIPTS.md layer is L0+L1
  (delivered copy exists at templates/common/scripts/dev-sync.ts). Any fix
  lands at L0, publishes L0→L1, and reaches projects via version-gated
  re-delivery.

## 3. Decision 1 — vehicle: standalone script invoked by dev-sync, not a dev-sync mode

**Chosen**: a new standalone `scripts/changelog-normalize.ts` (L0+L1, v1.0.0);
dev-sync step 3b invokes it. **Rejected**: a `--changelog-normalize` mode on
dev-sync itself.

Rationale: dev-sync is core-standardized and identical across every template
and variant — changelog-specific normalization logic inside it widens the
surface every layer must carry and re-deliver verbatim. The established
decomposition pattern is pure helper plus thin invocation
(changelog-duplicates.ts precedent: detection already lives outside dev-sync).
A standalone script is independently testable, independently revertible, and
usable by an operator (dry-run) without running the whole pipeline. dev-sync
keeps one import and one call.

## 4. Decision 2 — migration strategy: gate-carried normalization

**Chosen**: gate-carried normalization — when the step-3b detector reports
findings, dev-sync runs the normalizer write-mode on the project CHANGELOG,
re-stages it, and re-runs the detector to assert zero findings before the gate
verdict. Files with zero findings are never touched.

Order of operations (fail-then-heal, not heal-then-check):

1. Run the changelogGateFindings detector on `CHANGELOG.md`.
2. Zero findings → gate proceeds exactly as today (no write, no diff).
3. Findings present → run `bun scripts/changelog-normalize.ts CHANGELOG.md`
   (write mode) → `git add CHANGELOG.md` → re-run the detector.
4. Findings still present after normalization → FAIL (a structure the
   normalizer cannot repair is a hard stop, surfaced with the raw findings).

**Rejected**: grandfathering legacy changelogs (a waiver list the gate skips
until each project opts in). Trade-offs considered: grandfathering avoids
automatic engine writes into a project-owned file, but it permanently weakens
the gate (legacy structures persist until someone remembers to fix them), it
introduces new waiver state that upgrades and resync-audit must carry, and the
wave-blocker recurs on every delivery until all 6 projects perform the same
hand-merge the runner just did by hand. Gate-carried normalization converges
each legacy structure once (the normalizer is idempotent, so the write happens
at most once per structure) and keeps the gate's teeth.

The automatic-write tension is acknowledged and bounded: DEC-20261029-01 made
changelog *scaffolding* opt-in because unconditional engine writes churn every
wave. Normalization is not unconditional — it fires only when the gate would
fail, i.e. only when the project cannot land anyway, and the alternative is the
manual `sed`-pass merge that produced this halt.

## 5. Normalizer semantics

1. **Structure-only edits.** The normalizer edits heading lines and block
   placement only. It never edits entry lines, never translates, never
   deletes content. Frontmatter (including `lang: ko` / `lang_reason: legal`)
   and the pre-first-`## ` preamble are preserved byte-identical.
2. **Idempotent.** `normalize(normalize(x)) == normalize(x)` for every input.
   Golden-tested (§7).
3. **Duplicate-category collapse.** Within one `## [...]` section, repeated
   `### <Category>` blocks merge into the first occurrence's position; entries
   from later duplicate blocks append under the merged heading in their
   original relative order. No entry line changes.
4. **Dated `[Unreleased]` repair.** All `[Unreleased]`-family sections
   (`## [Unreleased]`, `## [Unreleased] YYYY-MM-DD`) merge into ONE canonical
   `## [Unreleased]` at the position of the first, matching the detector's
   declaration that dated variants are the same logical section. Released
   sections are never renamed.
5. **Position preservation.** The first occurrence anchors; content moves up to
   it. Most changed lines therefore pre-exist verbatim in HEAD, which is
   exactly the input the language-gate parent-verbatim tolerance
   (language-guard.ts v1.1.0, verified above) suppresses — moved history does
   not re-enter the add-set. Genuinely new non-English lines are never produced
   by a structure-only edit, so the tolerance plus the frontmatter exception
   (`lang_reason: legal`) cover the whole changed surface.
6. **CRLF-safe**, mirroring the detector (`/\r?\n/` split, original line
   endings preserved).
7. **Modes.** Default (no flag): write mode. `--dry-run`: print the unified
   diff to stdout, write nothing, exit 0 when a repair is possible, exit 1 when
   findings would remain. `--check`: exit 0 when zero findings (read-only;
   usable as an operator smoke check).

## 6. Files to change

| File | Action | Description |
|------|--------|-------------|
| `scripts/changelog-normalize.ts` | create | Standalone normalizer (L0+L1, v1.0.0); pure `normalizeChangelog(text): { text, repaired }` export plus CLI wrapper |
| `scripts/dev-sync.ts` | modify | v1.35.0 → 1.36.0; step 3b gains the fail-then-heal loop (§4); SCRIPTS.md row bumped |
| `tests/unit/changelog-normalize.test.ts` | create | v1.0.0; fixture classes, idempotency, content-preservation, golden pair (§7) |
| `scripts/SCRIPTS.md` | modify | New row for changelog-normalize.ts; dev-sync.ts row bump |

`scripts/helpers/changelog-duplicates.ts` is unchanged — the normalizer
consumes it as the findings source so detector and healer can never disagree
about what a defect is.

## 7. Test plan (`tests/unit/changelog-normalize.test.ts`)

1. **Fixture per observed failure class**: (a) duplicate category blocks within
   one section; (b) multiple `[Unreleased]` sections including dated variants;
   (c) multi-heading legacy structure combining both (the co-deck/co-newbiz
   6-hit/3-hit shape).
2. **Idempotency**: for every fixture, `normalize(normalize(x)) ==
   normalize(x)` (string equality).
3. **Content preservation**: for every fixture, the multiset of entry lines is
   byte-identical before and after; frontmatter and preamble are
   byte-identical; the diff touches heading and blank lines only.
4. **Golden before/after for a real reverted-project shape**: the 6 failed
   projects reverted clean at 0.23.0, so their legacy CHANGELOGs are on disk.
   At implementation time, snapshot one real reverted project's CHANGELOG
   (co-news, the dated-variant + duplicate-category class) into an anonymized
   fixture pair (before/after) and pin both strings.
5. **No-findings no-op**: a clean CHANGELOG passes through byte-identical
   (the §4 zero-write invariant).
6. **Detector-healer agreement**: for every fixture, `changelogGateFindings`
   reports findings before and zero findings after the normalizer — the same
   assertion dev-sync step 3b makes at runtime.

## 8. Validation

`bun test tests/unit/` (new suite plus the existing
changelog-duplicate-gate.test.ts), `bun run test:unit`, `bun scripts/audit.ts`,
`bun scripts/typecheck.ts`. Cascade: L0→L1 publish per the standing path;
delivered projects receive both files via version-gated re-delivery. The next
daily resync wave is the live validation: the 6 reverted projects land through
the normalizer instead of hand-merges.

## 9. Rollback

Single-commit revert. The gate itself stays (proven on 7 landings); reverting
the normalizer wiring restores fail-only step-3b behavior — projects re-block
on legacy structures until a hand-merge, which is today's state. The
standalone script is inert once the dev-sync call is reverted.

## 10. Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None (pipeline scripts; no agent/platform config) | N/A |
| Antigravity (GEMINI.md) | None (pipeline scripts; no agent/platform config) | N/A |
| templates/common | Propagation required | `templates/common/scripts/changelog-normalize.ts` (new), `templates/common/scripts/dev-sync.ts`, `templates/common/scripts/SCRIPTS.md` via L0→L1 publish |

## 11. Open questions

None. Both decisions (vehicle, migration strategy) are made with recorded
alternatives; implementation starts after user approval.
