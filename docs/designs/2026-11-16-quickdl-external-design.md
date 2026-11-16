# QuickDL as a declared co-deck external — offline deck video download engine — design

- **Spec ID**: 2026-11-16-quickdl-external-design
- **Status**: Approved (PM, 2026-11-16, user directive) — implementation in templates/co-deck only
- **Date**: 2026-11-16
- **Builds on (does NOT replace)**: docs/designs/2026-11-07-external-deps-standard-design.md and docs/designs/2026-11-07-external-deps-machinery-design.md; sibling of docs/designs/2026-11-16-humanize-external-design.md (co-work)
- **Tiers**: L0 (no change; machinery already live) · L2 (templates/co-deck seed + adapter + docs) · L3 (delivery by upgrade visits only)

## 1. Problem

`templates/co-deck/scripts/co-deck/download-videos.ts` (v1.0.1) downloads deck videos with the QuickDL CLI but did not declare it: it defaulted to a personal path (`~/git/project/QuickDL`), required a pre-made `.venv`, and staged downloads in a `downloads/` folder inside the QuickDL checkout. No project could reproduce the tool, and the external-deps standard could not admit it because QuickDL was licensed AGPL-3.0, which `EXTERNAL_DEP_LICENSE_POLICY` denies.

On 2026-11-16 a co-deck keynote review also found that deck videos were not playing locally. Two causes: the injector's index-based bindings were stale after slides were inserted, and native zen video slides use a local file only when slidedata carries `videoLocal`.

## 2. Decision

1. **License**: the sole copyright holder relicensed QuickDL to MIT (5throck/QuickDL#45, merged) and tagged `v1.0.0` (commit `228044a34fbe11b9e89a765fa80bcc8f0d299cbb`).
2. **Seed**: new `templates/co-deck/external-deps.json` (schema v2) with one entry:

| Field | Value |
|---|---|
| id | `quickdl` |
| repo | `https://github.com/5throck/QuickDL` |
| pin / commit | `v1.0.0` / `228044a34fbe11b9e89a765fa80bcc8f0d299cbb` |
| install | `git clone --depth 1 --branch {pin} {repo} {dir}` |
| install_dir | `external/quickdl` |
| compatibility_test | `bun scripts/co-deck/download-videos.ts selftest` |
| license / usage / propagation | `MIT` / `as-is` / `never` |
| adapter | `scripts/co-deck/download-videos.ts` |

3. **Adapter** (`download-videos.ts` v1.1.0): resolution order `--quickdl-dir` > `CDK_QUICKDL_DIR` > `<project root>/external/quickdl` > legacy `~/git/project/QuickDL`; python from `<dir>/.venv/bin/python` or `CDK_QUICKDL_PYTHON`; downloads staged in an OS temp dir so the clone is never written to (cross-filesystem move falls back to copy); new `selftest` mode checks `cli.py`, `requirements.txt` and an MIT `LICENSE`.
4. **Python environment**: not created by the manifest `install` (a git command template). The one-time venv setup is documented in the adapter header and `docs/co-deck.context.md` §External Dependencies; the venv lives under the gitignored install_dir and QuickDL's own `.gitignore` excludes `.venv/`.

## 3. Verification

- `bun scripts/external-deps.ts verify --manifest-only --project templates/co-deck`: V1, V2 (MIT allow), V3a, V4 pass. V3 (gitignore coverage) fails at template level by design, as for every co-work entry — `ensureGitignoreCoverage` adds the rule to the project `.gitignore` at install/scaffold time.
- `bun scripts/validate-templates.ts`: external-dep-vendoring and external-dep-license checks pass (3 seed manifests, 4 entries).
- `bun test scripts/co-deck/tests/download-videos.test.ts`: 8 pass (6 existing + 2 selftest pins).
- `selftest` against a fresh `v1.0.0` clone: OK.

## 4. Not in scope

- Automatic venv bootstrap and `videoLocal` emission by html-build (the latter is noted in the context doc; a pipeline fix belongs with U-20261116-007-class tooling work).
- Projects keep their current `download-videos.ts` until the next upgrade visit.
