# co-newbiz Learning Notes — three web-app patterns (T-20261012-003/004/005)

Consolidated record of three single-instance learning tickets. Each pattern is
recorded here as the durable artifact; promotion to template/skill stays gated on
a second adopter (ADR-0080 human-judged). All three originate from co-newbiz
PR #509 and its design docs (2026-10-11).

## 1. View-model extraction (T-20261012-003)

**Pattern**: split a fat page component into a pure, client-safe view-model module —
`lib/<screen>-view.ts` holds stage-status mapping, what/why/cta copy composition,
state-derived rendering decisions (chip kinds, hold dates, document titles); the page
component keeps only rendering; the data-contract layer (`lib/<screen>.ts`) stays
separate from presentation mapping.

**Invariants that make it testable**: no raw enums in copy; `pending` never renders a
generic label; verb-doubling guard; unit tests run without DOM.

**Evidence**: `Projects/co-newbiz` PR #509, `lib/deal-overview-view.ts`,
`tests/unit/deal-overview-view.test.ts`, design 2026-10-11-deal-overview-ui-refinement.

**Promotion gate**: co-newbiz is currently the only `app/` project — a second
web-deliverable project adopting the split triggers template candidacy.

## 2. Opt-in data-scope filter without FKs (T-20261012-004)

**Pattern**: `scope=targets` on a list endpoint excludes group/affiliate companies and
sentinel rows while the DEFAULT response stays byte-identical (opt-in, not a behavior
change). Match-rule discipline: identifier (DART code) equality first; trimmed exact
name match only when no identifier exists. UI closes the loop with a back-link from
the filtered screen to the row manager.

**Test discipline**: branch-complete real-sqlite integration test including the
negatives (same name + different code kept; soft-deleted member kept).

**Evidence**: PR #509, `app/web-next/app/api/companies/route.ts`,
`tests/unit/companies-list-scope.test.ts`, design
2026-10-11-companies-list-exclude-group-affiliates.

**Promotion gate**: schema is co-newbiz-specific; the transferable part is the
match-rule + byte-identical-default + negative-test discipline.

## 3. Percentage-colgroup two-step refactoring (T-20261012-005)

**Pattern**: fix single-column absorption under `table-layout: fixed` in two steps —
(1) screen-local constants (`X_COL_PCT as const`) rendered as a percentage `<colgroup>`;
(2) generalize same-day into a shared `ColGroup` helper with a dev-only
widths-sum-to-100 guard, `.table-fixed-pct` CSS rules, a guard test, and a lint rule —
applied across ~125 table markups in one batch.

**The reusable sequence**: screen-local fix first (proves the rendering semantics),
THEN the shared-helper generalization with a dev invariant — never both at once.

**Evidence**: PR #509,
`components/stages/our-company/constants.ts:56-58`,
design 2026-10-11-table-column-sizing-system-design.

**Promotion gate**: second adopter of the table system triggers component-library
candidacy.
