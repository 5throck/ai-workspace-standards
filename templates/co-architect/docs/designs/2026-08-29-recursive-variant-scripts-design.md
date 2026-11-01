# Design: Recursive `scripts/co-architect/` Tree for Project-Unique Scripts

- **Date**: 2026-08-29
- **Status**: Implemented
- **Related**: docs/designs/2026-08-29-co-architect-identity-separation-design.md, ADR-0036 (Python exception)

## Problem

co-architect's 19 project-unique CAD-pipeline entry-point scripts (`*.py`, per
the ADR-0036 Python exception) plus the `run-benchmark.ts` orchestrator sat
flat in `scripts/` root, mixed with the ~55 canonical L1/common copies. Per the
user's direction, the project's unique scripts must live in a **recursive**
structure under the variant namespace.

## Decision

New tree (recursive):

```
scripts/co-architect/
├── run-benchmark.ts              (REPO_ROOT corrected to parents[2])
└── cad/
    ├── pipeline/                 (6 entry points)
    ├── diagnostics/              (7: diag_*.py, test_live_cad.py)
    ├── drawing/                  (2)
    ├── compliance/               (check_zoning.py)
    ├── registry/                 (search_registry.py)
    ├── benchmark/                (benchmark_elevation.py)
    └── calibration/              (calibrate_reasoning_weights.py — registry row newly added)
```

- **sys.path bootstraps normalized**: cwd-relative (`sys.path.insert(0, "src")`)
  and depth-1 `parent.parent` forms replaced with a root computed from the
  script's own location at the new depth (`ROOTDIR` / `parents[4]`), so the
  scripts run correctly from any CWD. `src/` untouched (out of scope).
- **Registry updated**: SCRIPTS.md CAD table rows now carry
  `co-architect/cad/<group>/` paths; `run-benchmark.ts` row →
  `co-architect/run-benchmark.ts`; the previously unregistered
  `calibrate_reasoning_weights.py` gained a row.
- **Living docs updated**: `skills/generate-room-elevation/SKILL.md` (+3
  platform mirrors), `docs/reference/cad-intelligence-status.md`. Historical
  records (ADR/designs/plans/memory) intentionally unchanged.
- Governance tools unaffected: `verify-scripts` 1.4.2 already walks recursive
  trees; the moved `.py` files sit under the ADR-0036 exception prose table,
  outside the machine-parsed Registry.

## Verification

- `.venv/Scripts/python.exe -m py_compile` over all 19 moved scripts: OK.
- `bun scripts/verify-scripts.ts --verify` (76 scripts) and `bun scripts/audit.ts`: pass.
- Residual old-path references: none outside historical docs.

## Trade-offs

- One-time breakage risk for muscle-memory commands (`python scripts/check_zoning.py`
  → `python scripts/co-architect/cad/compliance/check_zoning.py`); the registry
  table is the canonical lookup.
- `upgrade-project` variant-scripts pass is inert in common-only mode, so the
  project owns this tree outright — upgrades will never overwrite it.

## Addendum (2026-08-29, same day)

- `scripts/audit-security.ts` also moved → `scripts/co-architect/security/audit-security.ts`
  (it is project-local: no L0/L1 counterpart exists; the registry row's legacy
  `L0+L1` layer label was corrected to `L2-only`; the `audit:security` npm script
  in `scripts/package.json` was re-pointed).
- Kept at `scripts/` root by convention, matching the co-safety template precedent:
  `audit-variant.ts` (pinned path — `audit.ts` invokes `scripts/audit-variant.ts`
  as the pluggable variant audit hook), `check-pm-approval.ts` (deprecated,
  removal 2026-11-30), and the `setup.sh/.ps1/.bat` cross-platform entry trio.

## Addendum 2 (2026-08-29): L1 core-script drift reconciliation

Auditing `scripts/*.ts` against `templates/common/scripts` found **11 core
scripts locally forked with equal or stale version numbers** (so upgrades never
reconciled them — equal version → "OK" branch): agent-create, agent-delete,
agent-verify, dispatch-parallel, dispatch, gen-pr-body (project 1.3.0 was a
stale pre-refactor fork mis-numbered above L1's 1.2.0), setup-github-branch-
protection, sync-md (local CWD guard dropped in favor of L1's newer
idempotency fixes), team-builder, translate-readme, validate-pm-extends.

All 11 restored to the canonical `templates/common/scripts` copies. This
matters for promotion: drifted core scripts trip the L3→variant pipeline's
integrity check (observed on co-newbiz's audit.ts). Root now contains only the
L1 canonical set + the pinned/convention exceptions recorded in the main
design — i.e. exactly the layout a new project receives from
templates/common + the co-architect overlay.

## Addendum 3 (2026-08-29): root cleanup — the 7 non-L1 files resolved

User directive: every `scripts/` root file that is not part of the L1 common
set must either live under `scripts/co-architect/` or not exist at all.
Disposition of the 7 L1-absent root files:

| File | Disposition |
|------|-------------|
| `check-pm-approval.ts` | MOVED → `scripts/co-architect/` (deprecated, removal 2026-11-30) |
| `setup.sh/.ps1/.bat` | MOVED → `scripts/co-architect/setup/` (entry-point trio; run from project root as before) |
| `upgrade-project.ts` | DELETED — L0-only tool, leaked copy (upgrades run from the workspace root) |
| `test-platform-parity.ts` | DELETED — L0-only tool, leaked stale copy |
| `audit-variant.ts` | KEPT at root — pinned hook path (`audit.ts` invokes `scripts/audit-variant.ts`); co-safety precedent |

Registry rows updated accordingly (moved rows re-pathed to
`co-architect/…`, deleted rows removed, stale layer labels corrected to
`L2-only`).
