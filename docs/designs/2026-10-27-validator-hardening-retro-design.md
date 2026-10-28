# Validator-Hardening Retroactive Design Record - 2026-10-27 Landings (T-20261027-002, T-20261027-010)

- **Spec ID**: `2026-10-27-validator-hardening-retro-design`
- **Date**: 2026-10-27 (work date); recorded 2026-10-28
- **Author**: automation-engineer (docs-writer conventions for the document content), Design Gate Row 0 retro-backfill per DEC-20261028-04
- **Status**: implemented (retrospective record - the changes landed 2026-10-27 via commits `154411353` (PR #1635) and `15b7a83d3` (PR #1653); this doc records the design rationale after the fact and adds no new requirements)
- **Tickets**: T-20261027-002, T-20261027-010, with upstream companions U-20261026-006, U-20261026-007, U-20261026-008 (landing A) and U-20261027-005, U-20261027-006, U-20261027-007 (landing B)
- **Tier**: L0 workspace root scripts + `templates/common/` mirrors + `templates/co-design/playground/`

## 0. Why this doc exists

The 2026-10-28 daily review (finding F-1) flagged a set of 2026-10-27 window
commits as template/code landings without design paperwork. For the two
validator-hardening commits named above, the PM adjudicated RETRO-BACKFILL
(DEC-20261028-04): under ADR-0074 the universal Design Gate applies regardless
of landing date, so the design rationale is recorded here after the fact,
explicitly marked as retrospective. Everything in this doc is derived from the
merged diffs - it describes what the code DOES, not what it should have done.
Batch format follows the ticket-runner-mechanical-batch precedent.

The two commits share one theme (validator hardening: gates that were silent,
missing, or mis-aimed) and one miss mechanism (landed through the nightly
mechanical batch path before any windowed coverage check existed) - hence one
doc, two landings.

## 1. Landing A - project-context gate fixes (commit `154411353`, T-20261027-002)

### 1.1 Problem

Four project-context defects, all found in the 2026-10-27 project-review
slots D/C and the co-design upstream channel: contract mirror paths that did
not resolve, a design-lint gate that silently skipped, a readme-sync gate that
was a guaranteed no-op outside the workspace root, and a playground compiler
path that resolved to nothing in a scaffolded project.

### 1.2 C-CM-06: contract source-path existence (T-20261027-002)

`docs/templates/common-contract.json` declared 154 `*_source` paths across
`common_commands` and `common_platform_skills`; 13 of them pointed at files
that do not exist - `gemini_source` entries declared
`.gemini/commands/<name>.md` while the actual L1 mirrors are `.toml`, and
`.agents/commands/*` paths exist only at the workspace root while
`templates/common/.agents` has no `commands/` directory - yet the entries
carried `propagated_to_common: true`. C-CM-03b resolved the SKILLS paths by
convention and Check H proved copies exist, but nothing verified the declared
PATH strings themselves, so the drift was invisible to every gate.

**Implemented** (validate-templates.ts v1.62.0 + contract v1.10.0):

- New ERROR check C-CM-06: for every `source` / `*_source` value in
  `common_commands` and `common_platform_skills` that starts with `.`, the
  path must resolve under `templates/common/`; a miss fails with the repair
  hint (point at the real mirror path, or replace with an exclusion prose
  record citing the governing ruling). A value not starting with `.` is an
  exclusion prose record (gateguard precedent) and skips the check. A
  `declaredPathCount` pass line reports how many paths were verified.
- The 13 stale declarations were repaired in the same landing: 7
  `gemini_source` entries corrected to the rendered `.toml` mirrors, and 6
  `agents_source` entries replaced with exclusion prose citing the L0-resident
  ruling T-20260925-003 (propagation-engine-batch design D8: `.agents/commands`
  has no L1 mirror). Post-fix: 114/114 declared paths resolve.

### 1.3 Design-lint scan-root fallback (U-20261026-006)

The L1-delivered `docs/workspace-schema.json` configures
`designLint.scanRoots` as `["templates/co-design/playground/src"]` - a
workspace-root path that never exists in an instantiated project - so
`audit.ts`'s `checkDesignLint` filtered to zero roots and silently emitted
`Skip("Design-lint gate: no configured scan roots present")`. The token SSOT
gate never ran in projects.

**Implemented** (new helper `scripts/helpers/design-lint-roots.ts` v1.0.0 +
audit.ts v2.56.0):

- Pure helper `resolveDesignLintRoots(configuredScanRoots, exists)` returning
  a discriminated union: `{ status: 'scan', roots, source: 'configured' |
  'conventional-fallback' }` or `{ status: 'skip', message }`. Existing
  configured roots win; otherwise the conventional roots that exist
  (`./playground/src`, `./src` - the same default `design-lint.ts`
  `uiSourceRoots` uses) are scanned; otherwise the caller skips, with a
  message naming BOTH the configured roots and the conventional candidates.
  `exists` is injected so unit tests drive temp fixtures.
- The audit gate consumes the helper and annotates its Pass/Fail/Skip output
  with `(conventional fallback - configured scan roots absent)` when the
  fallback fires - the run is visible, never silent. Ticket option (b) was
  chosen over rewriting the delivered schema because the fallback repairs
  already-instantiated projects (a schema-only change reaches only new
  scaffolds/upgrades) and makes the two consumers of the same schema agree on
  roots.
- Pinned by `tests/unit/design-lint-roots.test.ts` (fixture-driven, both
  sources and the explicit-skip path).

### 1.4 User-guide hash-audit seeding (U-20261026-007)

`verify-readme-sync.ts` built its `variantDirs` from a repo-root `templates/`
directory only, so in an instantiated project (no `templates/`) the
`docs/user-guide.md` vs `docs/user-guide_ko.md` `translated_from_hash` audit
iterated an empty list - a guaranteed no-op, including `--update-hashes`.

**Implemented** (verify-readme-sync.ts v1.5.0): when `templates/` is absent,
the audit and `--update-hashes` seed the project-local pair via cwd `.`,
mirroring how `REQUIRED_DIRS` already includes `.` for the README leg. The
existing pre-commit invocation exercises it unchanged; a diverged project pair
now FAILs exit 1 instead of silently passing.

### 1.5 Playground token-compile path (U-20261026-008)

`templates/co-design/playground/package.json` ran the compiler at
`../../scripts/compile-tokens.ts`, which resolves to nothing in a scaffolded
project (the delivered compiler sits at `<project>/scripts/compile-tokens.ts`,
one level up from `playground/`).

**Implemented**: the `tokens` script's primary path is
`../scripts/compile-tokens.ts` (the project's own delivered compiler); the
workspace-root depth (`../../../scripts/`) remains only as the documented
fallback for running the playground inside the template repository itself.
The playground README's pipeline diagram and "Where it runs" section were
corrected to match.

## 2. Landing B - validator hardening wave (commit `15b7a83d3`, T-20261027-010)

### 2.1 Problem

Four validator defects: a pre-commit content gate that had never blocked
anything, a documented design rule with no machine enforcement, compiler
banners that disagreed with each other and an input-precedence order that let
the template copy beat a project's own tokens, and three holes in the
language-policy perimeter.

### 2.2 Pre-commit check 6c dead gate (T-20261027-010)

Check 6c (Check A version blocking: `@version` in `scripts/*.ts` must match
`SCRIPTS.md`) parsed `parsed.results` from
`bun scripts/lifecycle-sync-audit.ts --json`, but the `AuditResult` wire shape
is `{passed, errors, warnings, registry}` - a `results` key never existed, so
`checkAErrors` was always empty and the gate never blocked anything (silent
dead gate). Discovered during T-20261027-009, whose new
`scripts/helpers/pre-commit-script-gate.ts` read the real `errors` field
correctly.

**Implemented** (helpers/pre-commit-script-gate.ts v1.1.0 + hooks/pre-commit.ts
v1.11.0):

- New exported `parseCheckAErrorsDetailed(jsonRaw): CheckAIssue[]` - the Check
  A extraction that reads `AuditResult.errors`, filters `level === 'error'`
  rows whose message includes `Check A:`, and PRESERVES the `fixData` payload
  (`{scriptName, fileVersion, registryVersion}`) so 6c keeps its actionable
  `-> Fix:` output. The existing `parseCheckAErrors` now delegates to the
  detailed variant, so the two call sites share one extraction and cannot
  drift.
- Check 6c rewires to the shared extractor; version mismatches now block the
  commit. Regression-tested: a phantom `results` key (the old dead shape) and
  real mismatch rows MUST fail the hook (`tests/unit/pre-commit-script-gate.test.ts`
  extension).

### 2.3 DESIGN-R2 theme invariance enforcement (U-20261027-005)

The documented rule (design-tokens.template.css and the variant design docs):
theme presets in `tokens.json` may override ONLY color and shadow tokens;
typography / spacing / borderRadius / target-size are theme-invariant. Nothing
enforced it - the compiler accepted any theme tree, and design-lint treated
`themes` as a reserved key it never walked.

**Implemented** (new helper `scripts/helpers/theme-token-policy.ts` v1.0.0 +
compile-tokens.ts v1.3.0 + design-lint.ts v2.3.0):

- The helper owns the single key classification shared by both enforcement
  points so they cannot drift: `THEME_OVERRIDABLE_GROUPS = {color, shadow}` and
  `isThemeOverridableGroup(key)`, which normalizes camelCase / PascalCase /
  snake_case keys to kebab-case before set membership (so `borderRadius`
  spellings cannot slip past).
- Compiler: `extractThemes` returns `violations[]`; every top-level key of a
  theme preset outside the allowlist (a bare leaf directly under the preset
  counts equally) is a HARD compile error naming the preset and the offending
  key path, exiting 1 BEFORE any output is written - the SSOT must not compile
  rule violations.
- Lint: new `themes` sub-check in `CHECK_ORDER` (CLI `--check` vocabulary
  extended); `themes` removed from `TOKEN_SKIPPED_KEYS` so the walker no longer
  treats the branch as invisible; violations are fail-level findings naming
  preset + key path; no theme presets declared -> SKIP per the project opt-in
  convention. Pinned by `tests/unit/design-lint-themes.test.ts` and the
  compiler tests.

### 2.4 Compiler provenance and input precedence (U-20261027-006)

compile-tokens.ts carried three disagreeing version banners (the `@version`
header said v1.2.0, the help banner v1.1.0, the generated TS banner v1.1.0),
so generated artifacts carried mismatched provenance. Its default input
resolution preferred `templates/co-design/tokens.json` over a project's own
`./tokens.json` - in an instantiated project the template copy silently beat
the project SSOT (the same precedence class as the reversion incidents,
upstream U-20261026-005).

**Implemented** (compile-tokens.ts v1.3.0): a single `VERSION` constant feeds
the help header and both generated-file banners (test pins the agreement);
default input precedence inverts - `./tokens.json` wins and the template copy
is only the workspace-repo fallback. The header also documents the canonical
regeneration command for the committed template artifacts (generated outputs
are gitignored build products elsewhere).

### 2.5 Language-policy perimeter (U-20261027-007)

Three holes in validate-md-language.ts: the `/^Hermes\.md$/` official pattern
was case-sensitive and never matched the actual root file `HERMES.md` (dead
protection since the pattern landed); the EN originals of the bilingual twins
(`README.md`, `docs/README.md`, `docs/user-guide.md`) were outside the official
perimeter, so stray Korean in an English original went unscanned; and the KO
twins' `lang: ko` declarations were convention-only - the suffix-locale gate
never checked them, and root `README_ko.md` in fact carried no declaration.

**Implemented** (validate-md-language.ts v1.16.0):

- Hermes pattern made case-insensitive (`/i`).
- The three EN originals join `officialPatterns` - stray Korean there FAILS
  with the same detector the KO side uses (the language-link line survives via
  the link stripper; `docs/user-guide.md` patterns are dormant where the path
  does not exist).
- The three KO twins join so the suffix-locale DECLARATION gate covers them;
  the gate logic is extracted to the exported pure
  `evaluateSuffixLocaleGate(filePath, content)` for regression coverage. Root
  `README_ko.md` was stamped `lang: ko` + `lang_reason: source-material`
  (templates/*/README_ko.md precedent) rather than weakening the gate.
- An `import.meta.main` guard was added - the module-level scan previously ran
  unguarded and `process.exit`-ed importers. Pinned by
  `tests/unit/validate-md-language-perimeter.test.ts` (18 regression cases;
  validator run over 2229 files exit 0).

## 3. Tickets covered

| Ticket | Role in this record | Landed in |
|---|---|---|
| T-20261027-002 | Manual ticket: contract mirror paths + new C-CM-06 validator check | `154411353` (PR #1635) |
| U-20261026-006 | Upstream request (co-design): design-lint scan-root fallback | `154411353` (PR #1635) |
| U-20261026-007 | Upstream request (co-design): readme-sync user-guide seeding | `154411353` (PR #1635) |
| U-20261026-008 | Upstream request (co-design): playground token-compile path | `154411353` (PR #1635) |
| T-20261027-010 | Manual ticket: pre-commit 6c dead gate rewiring | `15b7a83d3` (PR #1653) |
| U-20261027-005 | Upstream request (co-design): DESIGN-R2 theme-invariance enforcement | `15b7a83d3` (PR #1653) |
| U-20261027-006 | Upstream request (co-design): compiler provenance + input precedence | `15b7a83d3` (PR #1653) |
| U-20261027-007 | Upstream request (co-design): language-policy perimeter | `15b7a83d3` (PR #1653) |

## 4. Validation

At landing (2026-10-27): PR #1635 merged with the contract path audit at
114/114; PR #1653 merged with CI green. Each upstream request was verified
independently of the requester's diff before its result was recorded (ticket
`result` fields). New unit tests pin the helper contracts:
`design-lint-roots.test.ts`, `compile-tokens.test.ts`,
`design-lint-themes.test.ts`, the `pre-commit-script-gate.test.ts` extension,
and `validate-md-language-perimeter.test.ts`.

This retro registration adds Design Gate paperwork only - no code changes, no
mirror changes, no re-landing.

## 5. Lessons

- **Why the specs were missed**: both landings moved through the nightly
  mechanical ticket-runner batch path, where small, well-scoped validator
  fixes were implemented and landed directly from ticket prose. At that time
  nothing mechanically compared window commits against
  `docs/specs/registry.json`, so a missing spec was invisible to every gate -
  the omission surfaced only when the 2026-10-28 daily review reconciled the
  window by hand (finding F-1).
- **Prevention of record**: `scripts/design-gate-coverage.ts` (D8 of the
  instruction-ownership-backport-hardening design, T-20261028-001) - the
  windowed registry-join check that extracts ticket ids from commit subjects,
  bodies, PR bodies, and changed ticket files, joins them against registered
  specs, and reports the uncovered set for human E1-E5 adjudication. Run per
  review window, it makes a spec-less landing of template/code surfaces
  visible at the next review instead of never.
- **Honest framing**: this doc was written after the fact and records the
  design rationale of already-implemented code. Where the code embodies a
  choice (e.g. the audit fallback option (b), exclusion prose over path
  deletion, declaration stamping over gate weakening), this record states the
  choice as implemented; it does not invent requirements that were never
  built.

## 6. Decisions

- **One doc for both landings** - batch retro per the
  ticket-runner-mechanical-batch precedent; the commits share the
  validator-hardening theme and the same miss mechanism.
- **Retro-backfill, not accepted-legacy** - per DEC-20261028-04; substantive
  template/code landings carry specs regardless of landing date.
- **Scope boundary** - the other template-touching commits in the same window
  that remain uncovered are NOT adjudicated or named here; naming them in a
  registered spec would create false coverage joins. They keep their own
  review disposition.

## 7. Rollback

This record is paperwork: the design doc, its registry entry, and the DEC.
Single-revert; no code, tests, or templates are touched by the registration.
