# Design: Stub Version Backfill and Registry Row Floor (two upgrade-wave defect fixes)

- **Spec ID**: `2026-11-26-stub-version-backfill-and-registry-row-floor-design`
- **Date**: 2026-11-26
- **Author**: automation-engineer (T-20261126-002 follow-up; dispatched against the
  2026-11-26 wave evidence in `/tmp/wave-1126/`)
- **Tickets**: T-20261126-002 (ticket id cited by the dispatch brief; the two upstream
  defect reports arrived as `tickets/governance/U-20261126-001.yaml` /
  `U-20261126-002.yaml`, filed by the projects through the upstream MCP)
- **Status**: implemented (this change set landed with the design)
- **NEW vs UPDATE**: new spec. Prior art it extends: `backfillStubFrontmatter`
  (lib/upgrade-policy v1.24.0, spec `2026-10-28-stub-frontmatter-backfill-design`)
  fills MISSING stub scalars and deliberately never overwrites an existing `version`;
  `extractScriptVersion` (helpers/upgrade-versions v1.2.0) supplied the version
  parsing that defect 2 shows was reading the wrong line; the registry-row lockstep
  loop (upgrade-project v1.118.0, machinery-batch §4.6) is the consumer that turned
  the mis-parse into fleet-visible damage.

## 0. Conclusion

Two defects were observed in all 7 real upgrade runs of 2026-11-26
(`/tmp/wave-1126/real-<project>.log`):

1. **STUB_VERSION_DIVERGENCE forever** — every project reports the INFO verdict
   `STUB_VERSION_DIVERGENCE` for `agents/pm.md`, and
   `bun scripts/verify-delivered-versions.ts` reports one `[stale] agents/pm.md`
   row per project, on every run, forever. Root cause: a variant agent stub is
   MERGE_MANAGED — the MERGE pass refreshes the managed body but never the
   frontmatter, and the v1.24.0 backfill contract blesses the stub's scaffold-era
   `version` as a permanent pin. Root #2181 bumped the 16 template stub versions
   (1.1.2–1.2.3) without any mechanism to advance the project side.

2. **Registry rows lowered below the file header** — the engine's provenance/lockstep
   normalisation rewrote two `scripts/SCRIPTS.md` rows DOWN in every project:
   `lib/error-handling.ts` 1.4.0 → 1.3.0 and `detect-backport.ts` 1.0.1 → 1.0.0,
   failing the project's lifecycle-sync-audit Check A. Root cause: both scripts
   carry a stray mid-file line-form `// @version` marker (error-handling.ts:298
   `// @version 1.3.0`, detect-backport.ts:82 `// @version 1.0.0`) and
   `extractScriptVersion` gave ANY `// @version` line priority over the header, so
   the v1.118.0 lockstep loop "reconciled" correct rows to the stray numbers. The
   ROOT registry carried the CORRECT numbers (1.4.0 / 1.0.1) — only the delivered
   files were mis-parsed; the stale-source theory (an old L1/L0 registry span) is
   ruled out by `grep` over root, L1 mirror and a delivered project.

Fixes (both narrow, both at the root with byte-identical L1 twins):

- **Defect 1** — new pure helper `backfillStubVersion(projectContent,
  templateContent, deliveryDate)` in `scripts/lib/upgrade-policy.ts` (v1.54.0) plus
  verdict `STUB_VERSION_BACKFILL` (INFO). The MERGE pass (`mergeWorkspaceManaged`,
  pass === "MERGE", rel `agents/*`) calls it after a CLEAN managed-body merge:
  no census-blocked escalation on either channel (`result.escalated` /
  skeleton `escalated` empty), no marker loss (`markerLossBlocks` runs first, as
  today), and the merge left the frontmatter byte-identical (the helper only ever
  writes the version line). The helper advances the top-level `version` only when
  the template counterpart parses strictly NEWER (three-part semver), copies the
  counterpart scalar verbatim (quotes preserved), re-stamps an EXISTING top-level
  `last_updated` to the delivery date, and is byte-identical no-op for resolved
  (non-stub) content, equal pins, project-ahead pins and unparsable values. A
  non-clean merge keeps the pre-change behaviour: the pin stands and the
  `STUB_VERSION_DIVERGENCE` row reports it (message updated to name the new
  contract). Dry run reports the row and writes nothing.

- **Defect 2** — `extractScriptVersion` (helpers/upgrade-versions v1.3.0) now reads
  the FILE HEADER as the source of truth: the first `@version X.Y.Z` inside the
  header comment block (shebang, `//`, JSDoc, `#` comments and Python module
  docstrings), with `import` statements stepped over (some scripts place the JSDoc
  header after imports — dispatch-serial.ts). A `@version` past the first real
  statement is never the script version. New pure export
  `extractScriptVersionFromContent` for tests and text-holding callers. Belt and
  braces: `reconcileScriptRegistry` (and its sub-registry arm) wraps the target
  version in `floorAtProjectScriptVersion` — a registry row is never LOWERED below
  the `@version` of the script file present in the project (lifecycle-sync-audit
  Check A compares row vs project file, so the file wins).

Verified scope: a full-tree diff of old-vs-new parser output over 600 script files
(root `scripts/`, `templates/*/scripts/`) changes exactly 4 — the two intended
headers in root and their L1 twins.

## 1. Sibling analysis (required by the dispatch brief)

- `.claude/agents/`, `.gemini/agents/` and the other platform mirrors hold RESOLVED
  agent bodies (no `extends:`), not stubs — `backfillStubVersion`'s stub-shape guard
  (column-0 `extends:` required) makes them structurally unreachable, and they are
  not MERGE_MANAGED. No sibling fix needed.
- The variant `agents/i18n-specialist.md` stubs deliver through the SYNC pass's
  composed-extends-target arm (D9, T-20261028-013): frontmatter is replaced
  wholesale there, so their versions already advance. Not the same path; untouched.
- `.claude/skills/*` mirrors are a different lane (platform skill mirrors), no
  `@version`-vs-row coupling. Untouched.

## 2. Tests (all under `tests/unit/`)

- `upgrade-policy-decisions.test.ts` — `backfillStubVersion` describe (6 tests):
  older pin advanced with key order / variant / tier / nested lifecycle dates
  preserved; semver order (1.9.0 → 1.10.0) and verbatim unquoted scalar; equal and
  project-ahead no-ops; non-stub and unparsable guards; last_updated never
  injected, CRLF preserved, invalid delivery date ignored; idempotence.
- `upgrade-decision-log.test.ts` (engine, real templates) — the pinned-stub test
  now asserts STUB_VERSION_BACKFILL (version advances 0.9.0 → counterpart, no
  divergence row, out-of-zone body preserved); new `stub-pin-ahead` shape keeps the
  divergence row; new `--dry-run` rider pins the write gate.
- `upgrade-versions.test.ts` — stray mid-file marker never shadows the JSDoc
  header (error-handling/detect-backport shapes); header after imports read
  (dispatch-serial shape); inner JSDoc never wins; Python docstring header read
  (deck/svg_check.py shape).
- `upgrade-script-lane-gaps.test.ts` — delivery regression: both rows stay at
  1.4.0 / 1.0.1 after a delivery (asserted to FAIL with 1.3.0 without the parser
  fix).

## 3. Gates and canary (evidence: docs/reports/2026-11-25-machinery-batch-evidence.md,
section "Follow-up 2026-11-26")

`bun test tests/unit` all green; `bun scripts/typecheck.ts` 0 errors;
`bun scripts/audit.ts` PASS; `bun scripts/validate-templates.ts` PASS;
`bun scripts/lifecycle-sync-audit.ts` PASS (after `generate-scripts-mirror.ts`
regenerated the L1 registry span). Canary on a TEMP COPY
(`/tmp/wave-canary/co-consult`, real `Projects/co-consult` untouched):
`agents/pm.md` 1.0.0 → 1.1.2 with `last_updated` re-stamped, both SCRIPTS.md rows
unchanged at 1.4.0 / 1.0.1, `verify-delivered-versions --project <copy> --template
templates/co-consult` 0 findings, and the project's own
`bun scripts/lifecycle-sync-audit.ts` executed through
`bun scripts/contained-run.ts --project <copy>` exit 0.
