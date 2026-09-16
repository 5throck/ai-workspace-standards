---
schemaVersion: 1.0.0
spec-id: manifest-gate-shallow-tolerance
---

# Manifest Gate Shallow Tolerance — 2026-09-16

## 1. Overview

Lands ticket T-20260916-013: the VERSION_MANIFEST `--check` reconciliation
gate (T-20260915-004) is not deterministic across git checkout depths. In a
shallow CI checkout the gate fails permanently, no matter what is committed.
Two arms: (1) the generator's comparator learns shallow tolerance
(universal fix, workspace side), and (2) the last remaining shallow audit
workflow (co-safety `safety-audit.yml`) gets `fetch-depth: 0` (project side,
mirroring the fleet-resync fix of its `ci.yml`).

## 2. Problem

`generate-version-manifest.ts` derives the Agents table's per-file
"Last Modified" date from `git log -1 --format=%ct <file>`. In a
shallow-checkout CI (actions/checkout default `depth: 1`) git history is
absent, so a fresh in-memory regeneration falls back to checkout-time values
(empty `git log` output → `N/A`) for every file not touched by the HEAD
commit. The committed manifest was generated locally with full history and
carries the true dates — so the committed artifact and CI's regeneration
disagree on every stale row, and `--check` exits 1 permanently: the gate can
never pass, and no commit content can fix it.

Real case: co-safety's Documentation Audit job. Its `ci.yml` was already
fixed with `fetch-depth: 0` during the 2026-09-16 fleet resync (PR #149);
`Projects/co-safety/.github/workflows/safety-audit.yml` still had four bare
`actions/checkout@v4` steps.

## 3. The two arms

### 3.1 Arm 1 — generator shallow tolerance (universal, workspace side)

`scripts/generate-version-manifest.ts` v1.5.0 → v1.6.0:

- **Shallow detection**: `isShallowRepository()` runs
  `git rev-parse --is-shallow-repository` via `spawnSync`. `status === 0 &&
  stdout.trim() === 'true'` means shallow; any other outcome (non-zero exit,
  unexpected output, git missing → spawn throws, caught) is treated as a FULL
  repository, preserving v1.5.0 behavior byte-for-byte.
- **Shallow mode**: `checkManifest()` calls
  `diffManifests(onDisk, regenerated, { ignoreDateColumns: true })` and
  prints one concise info line before the verdict:
  `ℹ️ shallow repository detected — Last Modified columns excluded from
  comparison (run with full history for date verification)`.
- **Full-history mode**: unchanged — `diffManifests(onDisk, regenerated)`
  compares dates exactly as before.
- **Exit semantics unchanged**: 0 on match/self-skip, 1 on drift. The
  `audit.ts` VERSION_MANIFEST gate spawns `--check` and inherits the fix with
  no changes of its own (verified: `scripts/audit.ts` gate block).
- **Existing normalization intact**: the `**Generated**` timestamp line is
  still normalized on both sides in both modes.

### 3.2 Arm 2 — remaining shallow audit workflow (co-safety, project side)

`Projects/co-safety/.github/workflows/safety-audit.yml`: every
`actions/checkout@v4` step (jobs `validate`, `test-suite`, `lint`, `audit`)
gains `with: fetch-depth: 0` plus the same short comment rationale used by
the already-fixed `ci.yml` Documentation Audit job (action pin line kept
untouched). Applied uniformly — several of these jobs run project audit
lints today and the manifest gate is delivered to every common-template
project, so uniformity is simplest and harmless. This is a PROJECT-side
change: it stays uncommitted in the working tree for the orchestrator's
project sync.

**Root workflow survey (verification arm)**: every `actions/checkout` in the
workspace-root `.github/workflows/*.yml` either has `fetch-depth: 0`
(`test.yml` job `test` — the job that runs `bun scripts/audit.ts`;
`edu-sync.yml`; `nightly-tickets.yml`; `weekly-health-check.yml`) or
demonstrably never runs the manifest gate (`test.yml` job
`hook-secret-gates` — gitleaks hook smoke tests in throwaway repos with
`SYNC_ACTIVE=1`, which explicitly skips the dev-sync audit; `fork-watch.yml`
— no checkout step at all, pure `gh api` issue management). No root fixes
needed.

## 4. `ignoreDateColumns` semantics

The date masking is header-derived, never positional:

- `maskDateColumns(content)` walks the lines. A markdown table block is a
  contiguous run of `|`-delimited rows; its FIRST row is the header.
- The header cells are scanned for a cell whose trimmed, case-insensitive
  text is exactly `last modified`; that cell's index becomes the table's
  date-column index. The separator row (`|---|`) and the header itself are
  never masked.
- Every DATA row of that table gets its date cell replaced with the constant
  `<date>`; the row is re-joined in the renderer's own `| a | b |` style.
- Tables without a `Last Modified` header (Skills, Scripts, Commands today)
  are returned untouched — a date-shaped value in a non-date column still
  compares. Adding a date column to another table later requires no
  comparator change.
- Masking runs on BOTH sides (disk and regeneration) inside
  `diffManifests` when `options.ignoreDateColumns` is set, after the
  timestamp normalization. Structural drift (rows added/removed,
  name/version/path/tier/model changes) still differs line-wise and is
  caught; only the git-depth-dependent date cells become non-comparing.
- `diffManifests(onDisk, regenerated, options)` takes an options object
  `{ ignoreDateColumns?: boolean; limit?: number }` (was a positional
  `limit = 20`). Only in-repo callers: `checkManifest()` and the unit tests.

## 5. Version bumps (minor)

| File | Version | Surfaces |
|------|---------|----------|
| `scripts/generate-version-manifest.ts` | 1.5.0 → 1.6.0 | `@version` + header changelog; L0 + L1 (hand-maintained) SCRIPTS.md rows; L1 copy refreshed via `propagate-to-templates --apply` |
| `tests/unit/registry-version-parity.test.ts` | 1.0.0 → 1.1.0 | `@version` header; new shallow-mode suites + options-object call site |

`docs/VERSION_MANIFEST.md` is regenerated (generated artifact — the bumped
script version appears in its Scripts table).

## 6. Test plan

`tests/unit/registry-version-parity.test.ts` extends the T-20260915-004
`--check` helper suites (scratch strings only — no fs, no real manifest):

- `maskDateColumns`: masks only the Last Modified DATA cells (header and
  separator rows untouched, date values absent from output); date-column
  index derived from the header (first-column date table masked; a second
  table without the header keeps even date-shaped values).
- `diffManifests` shallow mode: date-only drift (both rows + different
  Generated timestamps) is ignored under `ignoreDateColumns`; the same pair
  IS reported in full-history mode (mode unchanged); structural drift is
  still caught in shallow mode (removed row → `<missing>` diff; renamed
  agent/path diff); non-date columns of other tables still compare.
- `isShallowRepository`: returns a boolean without throwing (spawn failure
  counts as full).
- Existing suites updated for the options-object signature
  (`{ limit: 5 }`).
- LIVE shallow simulation (manual, mandatory): `git clone --depth 1` of the
  local repo into a temp dir; the committed (stale-generator) clone's
  `--check` fails with date diffs; copying the v1.6.0 generator in, `--check`
  prints the shallow info line and exits 0 despite the differing dates.
  Temp clone removed afterwards.

## 7. Accessibility

Backend/CLI-only work (a comparison-mode change in a generator script, a CI
workflow YAML fix, and unit tests). No user-facing UI is produced. Exempt
from ADR-0065 WCAG scope; the WCAG 2.1 AA baseline does not apply.

## 8. Preview Verification

Non-UI work — no rendered surface exists to screenshot. Exempt from
ADR-0070 preview verification; verification is via the executed validation
battery (unit suite, validate-templates, typecheck delta, audit, `--check`,
scripts suite, lifecycle-sync-audit, review-baseline) plus the live
depth-1-clone shallow simulation.
