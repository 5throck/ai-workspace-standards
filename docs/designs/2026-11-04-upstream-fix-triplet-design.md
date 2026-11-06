# Design: 2026-11-04 upstream-fix triplet batch (U-20261104-001 / U-20261104-003 / U-20261104-002)

**Date**: 2026-11-04 (code landed 2026-11-03/04; this design doc retro-registered 2026-11-06)
**Status**: implemented
**Scope**: `scripts/audit.ts` v2.62.0 + `scripts/helpers/audit-hook-sweep.ts` v1.0.0 (new); `scripts/dev-sync.ts` v1.38.0 + `scripts/helpers/agent-mechanical-date-bump.ts` v1.0.0 (new); `scripts/helpers/security-validator.ts` v1.2.0→v1.2.1; three new unit-test files; L1 mirrors of all three helpers; both SCRIPTS.md registries
**Tickets**: U-20261104-001, U-20261104-003, U-20261104-002
**Landings**: PR #1846 (U-20261104-001, merged 2026-11-03), PR #1847 (U-20261104-003, merged 2026-11-03), PR #1848 (U-20261104-002, merged 2026-11-04)

> Retro-registration note: this document backfills design paperwork for
> already-landed code per the D8 batch adjudication
> (`docs/reports/2026-11-06-d8-batch-adjudication.md` §B3, retro-backfill
> remedy — the adjudication explicitly recommended one batch design for the
> triplet). No code changes ride this registration.

## Context

Three upstream requests from the co-newbiz project, each a defect in
workspace-managed (L0) tooling observed from a variant-project layout, fixed
upstream per the upstream-request policy. All three share one failure
pattern: workspace tooling hard-coded an assumption that it runs from the
L0 workspace root, and the variant-project reality (different cwd, different
file population) turned a working check into recurring noise or a false
block. They are batched here because they were triaged, reproduced and
landed as one wave on 2026-11-03/04.

## U-20261104-001 — audit.ts §28 false-positive WARN in variant layouts (PR #1846)

**Root cause**: audit.ts §28 (standing variant audit-hook regression check)
swept only `templates/co-*` manifests for declared `audit-variant` hooks. In
a variant/project layout §27 correctly resolves and executes the project's
own root `variant.json` hook, but the §28 sweep found zero template hooks and
emitted a permanent false-positive WARN ("nothing to regression-check") on
every run — desensitizing teams to real warnings.

**Fix**:
- The §28 sweep core was extracted VERBATIM into
  `scripts/helpers/audit-hook-sweep.ts` v1.0.0
  (`collectTemplateAuditHooks(templatesDir)`), so manifest parsing and hook
  resolution are unit-testable without running the full audit. Contract:
  non-`co-*` entries and dirs without `variant.json` are ignored; a
  malformed `variant.json` is skipped silently (schema checks elsewhere
  report it) and surfaced only via the `malformed` list; non-`audit-variant`
  `script_manifest.local` entries are ignored.
- §28 now emits a PASS naming the already-covered hook when the sweep finds
  zero template hooks but §27 resolved and executed the root `variant.json`
  hook; the legacy WARN survives only when no hook ran anywhere.
- audit.ts bumped to v2.62.0.

**Tests**: `tests/unit/audit-hook-sweep.test.ts` pins the sweep including the
co-newbiz-shaped zero-hook fixture; `tests/unit/generate-scripts-mirror.test.ts`
live-tree pin 171 → 172 (+1 L1-delivered helper). Comment-only rider:
the `hub-topology-legs.test.ts` co-abap residual pin re-cited to the
re-created ticket (T-20261103-008 no longer resolves).

## U-20261104-003 — dev-sync mechanical frontmatter re-stamp (PR #1847)

**Root cause**: a workspace-sync pass mechanically rewrites variant agent
frontmatter (the 2026-10-28 tier-collapse commit 0b1a406c rewrote the tier
block in 34 agent files) but never advances the files' top-level
`last_updated`, so `agent-lifecycle-audit` emits 34 identical
"last_updated older than the last git commit" warnings on every run —
recurring noise.

**Fix** (ticket option (a): sync bumps `last_updated` when it rewrites
frontmatter):
- New dev-sync **step 4.87** (after the pipeline's writes, before the audit
  gate): for every sync-modified agent `.md` (`agents/`,
  `templates/**/agents/`) whose HEAD-to-worktree diff is confined to the
  frontmatter block, re-stamp the top-level `last_updated` to the run date
  via the shared `bumpFrontmatterLastUpdated` primitive. No key injection
  (files without the key are never injected), idempotent, bumped files
  explicitly staged. Non-blocking: a failure in the step WARNs and does not
  fail the sync.
- New pure helper `scripts/helpers/agent-mechanical-date-bump.ts` v1.0.0
  (`splitFrontmatter` / `isAgentMdPath` / `isMechanicalFrontmatterRewrite` /
  `bumpMechanicalLastUpdated`) — no fs, no git, no clock; the caller supplies
  the date and reads/writes the bytes, keeping every branch unit-testable.
- Negative contracts hold by construction and are unit-pinned: body edits
  are never touched (a real content edit is the author's job to date);
  unchanged files never enter the modified set (no-op syncs stay no-ops);
  new files (no HEAD version) are skipped; files without a top-level
  `last_updated` key are never injected.
- dev-sync bumped to v1.38.0.

**Tests**: `tests/unit/agent-mechanical-date-bump.test.ts` (16 cases)
replays the exact tier-block-to-scalar transform plus the negative
contracts; an end-to-end harness on a scratch git repo proves mechanical
rewrites bump-and-stage while no-op and body-edit runs leave files untouched;
`generate-scripts-mirror.test.ts` pin 171 → 172.

## U-20261104-002 — security-validator workspace-root detection (PR #1848)

**Root cause**: `SecurityValidator` pinned its workspace boundary to
`process.cwd()`, so a variant-project tool run (cwd = the project root)
classified the DOCUMENTED cross-tier extends contract
(`extends: ../../../agents/pm.md` — the 3-tier upgrade contract declared in
`agents/pm.md` and `agents/docs-writer.md`) as a path-traversal escape and
failed closed with exit 1 "Path traversal attempt detected". Reproduced:
`bun scripts/helpers/extends-validator.ts agents/pm.md` from a variant
project root exited 1.

**Fix**:
- New `detectWorkspaceRoot()`: walks upward from cwd for an L0-only
  workspace marker (`CONSTITUTION.md` or `templates/common` — both verified
  absent from every delivered `Projects/co-*` checkout). **Fail-closed
  fallback**: no marker found up to the filesystem root = boundary stays at
  cwd — never wider than the evidence. Constructor precedence unchanged: an
  explicit `options.workspace_root` always wins over detection.
- v1.2.0 (2026-11-04): boundary comparisons are symlink-canonicalized
  (macOS serves `/var` and `/tmp` as symlinks into `/private/var`; comparing
  a lexically-resolved extends target against a chdir-derived realpath root
  false-positives a boundary escape from the spelling difference alone).
- v1.2.1 (same ticket, follow-up commit 9ad6fe1ea in PR #1848): the boundary
  check became separator-aware so a SIBLING directory sharing the root's
  name prefix (`/ws` vs `/ws-evil`) can no longer pass a bare `startsWith`
  boundary comparison.
- Genuine traversal escaping the detected root still fails closed
  (negative-control pinned).

**Tests**: `tests/unit/security-validator-workspace-root.test.ts` (7 cases):
negative-control traversal escaping the DETECTED root fails; sibling-prefix
directory fails; a legitimate 3-tier relative extends validates; explicit
`workspace_root` override precedence; marker walk + fail-closed fallback.
E2E in the live co-newbiz project: `extends-validator` on `agents/pm.md` and
`agents/docs-writer.md` now exit 0 while `../../../../etc/passwd` from the
same cwd is still rejected. `validate-templates.ts` 0 errors; the
extends-validator self-test output stayed byte-identical.

## Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None (workspace tooling; validator is platform-neutral bun) | N/A |
| Antigravity (GEMINI.md) | None (workspace tooling; validator is platform-neutral bun) | N/A |
| templates/common | Propagation required — all three helpers mirrored to `templates/common/scripts/helpers/`; L1-delivered-helper live-tree pins maintained | `templates/common/scripts/helpers/audit-hook-sweep.ts`, `agent-mechanical-date-bump.ts`, `security-validator.ts` |

Windows note: the separator-aware boundary check (v1.2.1) and the §28
separator normalization exist because `path.join` emits the OS separator
(backslash on Windows) while JSON-declared paths use forward slashes.

## Tickets / evidence

- U-20261104-001 → PR #1846 (merged 2026-11-03) — audit.ts §28 sweep core
  extraction + false-positive WARN fix
- U-20261104-003 → PR #1847 (merged 2026-11-03) — dev-sync v1.38.0 step 4.87
  + shared helper v1.0.0 (16 unit cases)
- U-20261104-002 → PR #1848 (merged 2026-11-04) — fail-closed workspace-root
  detection (upward L0-marker walk + symlink canonicalization, v1.2.0/v1.2.1)
- Adjudication: `docs/reports/2026-11-06-d8-batch-adjudication.md` §B3 rows
  3-5 (one batch design recommended for the triplet)
