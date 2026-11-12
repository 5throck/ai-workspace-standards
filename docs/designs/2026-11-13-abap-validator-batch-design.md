---
schemaVersion: 1.0.0
spec-id: abap-validator-batch
---

# ABAP Validator Batch Design (U-20261112-013 / -014 / -015 / -019)

## 1. Overview and Objectives

Four design-class upstream requests from Projects/co-abap (suspected layer L1/L2) ask for
validator checks that close gaps a real incident chain exposed: dangling hook command
targets, deleted scripts still invoked by CI, MCP proxy-routing invariants that do not
cover every registered surface, and CHANGELOG entries duplicated across layers within one
release section. Each check is implemented minimally inside the existing validator that
already owns the adjacent surface, following its established severity and propagation
conventions. This batch is validator-only — no delivery behavior, no template content
changes beyond the L2 validator that owns the parity invariant.

## 2. U-20261112-013 — Hook-command-target existence (validate-templates.ts v1.80.0)

**Defect class**: a hook `command` in a template platform settings file referencing a
deleted/renamed file (e.g. deleting `.trail/hook.cjs`) passed `audit.ts`, platform parity
and CI — `lifecycle-sync-audit.ts` Check I only detects duplicate/count drift.

**Check** `hook-command-targets` (fail-on-missing, matching the coordinator directive and
the template-tree scope): for `templates/common` and every `templates/co-*` variant, parse
`.claude/settings.json`, `.gemini/settings.json` and `.codex/hooks.json` (skip when
absent), collect every string under a `command` key (structure-agnostic recursive walk —
Claude/Gemini/Codex hook shapes differ), extract script-file targets
(`.ts/.cjs/.mjs/.js`; `${VAR}/` and `$(...)/` prefixes resolved), and require each target
to exist in the variant dir **or** the `templates/common` fallback (hooks are delivered
from both layers).

**Exception**: targets on `TRAIL_RETIRED_SEEDS` (scripts/lib/upgrade-policy.ts) are
skipped — the graft-era seeds are deliberately deleted and their hook references
re-pointed by the hook-dedupe normalize; a retained reference in the 15 variant templates
is a known transitional state, not a template defect. Without the skip the arm would fail
on day one across the whole fleet.

**Rationale for FAIL severity** (the ticket asked for WARN): every non-retired target in
the current tree resolves (verified: 219 targets green), so the gate is green today and
any future dangling target is a genuine ship-blocker.

Pure primitives `collectHookCommands` / `extractHookScriptTargets` are exported and
unit-pinned in `tests/unit/validate-templates-hook-targets.test.ts`.

## 3. U-20261112-014 — CI workflow script references (verify-scripts.ts v1.15.0)

**Defect class** (T-20261108-008 prune recurrence): upgrade deleted
`scripts/validate-abap-platform-parity.ts` while `.github/workflows/ci.yml` still invoked
it; no gate scanned workflow files.

**Check 10** in `verify()` (error-level, mirroring the ghost-entry convention): wherever
`.github/workflows` exists relative to the context root (L0 and projects; L1/L2 template
trees do not carry one), scan `*.yml|*.yaml` for `bun scripts/[A-Za-z0-9/_.-]+\.ts`
references (the regex from the ticket verbatim) and require each referenced file to exist
at the context root. Pure scanner `findDanglingWorkflowScriptRefs` exported and
unit-pinned in `tests/unit/verify-scripts-workflow-refs.test.ts`.

## 4. U-20261112-015 — MCP parity coverage (validate-abap-platform-parity.ts v1.2.0)

**Defect class**: the `mcp-proxy-routing` check's `MCP_CONFIGS` table covers five
surfaces but not `opencode.json` (its `mcp` map) nor the `mcpServers` block inside
`.claude/settings.json` (read only by checkDenyRules' permissions key) — a future direct
`vsp` entry in either surface would pass every gate.

**Change**: `MCP_CONFIGS` gains the two entries with two new optional fields:
- `conditional: true` — the surface is **skipped when the file is absent** (the base
  template does not ship opencode.json; scaffolded trees vary by profile). This is the
  coordinator-flagged trap: a naive table-add would fail because `templates/common`'s
  `.claude/settings.json` carries no `mcpServers` and the co-abap template has no
  opencode.json at all.
- `requireAbap: false` — these surfaces may legitimately carry trail-only server sets
  (observed in Projects/co-abap), so only the invariant is enforced: an `abap` entry, if
  present, must route through `sap-mcp-proxy.ts`, and no server may launch `vsp`
  directly. The existing five universal surfaces stay fail-on-missing + require-abap.

`opencode.json` uses the `mcp` key with an argv-array `command` shape; `serverArgv()`
normalizes both shapes (exported for tests). Unit-pinned in
`tests/unit/validate-abap-parity-mcp-surfaces.test.ts` against synthetic root fixtures.

## 5. U-20261112-019 — Cross-layer CHANGELOG duplicate entries (helpers/changelog-duplicates.ts v1.1.0)

**Defect class**: the duplicate-category lint checks `###` headings only, so the same
wave entry landed twice inside one release section — once under `### Changed` with a PR
ref, once as a bare per-wave bullet without one.

**Change**: third finding kind `cross-layer-duplicate-entry` in `changelogGateFindings`
(consumed verbatim by dev-sync step 3b, blocking): the same entry body under ≥2 distinct
layer positions within one `## [...]` section. Layer positions are the `### ` categories
plus the pre-category bullet zone. Comparison normalization (exported
`normalizeChangelogEntry`): PR refs `(#NNN)` stripped, whitespace collapsed, case-folded
— "identical/near-identical" per the ticket.

**Deliberate narrowing**: duplicates that repeat **within one layer** are NOT findings —
the workspace's own historical released rollup (`## [2026-09-04]`) legitimately repeats a
line inside one category, and a blocking gate over all sections would fail on that
existing content. The duplicate-category class remains owned by the v1.0.0 rule.
Unit-pinned in `tests/unit/changelog-duplicate-gate.test.ts` @1.1.0.

## 6. Propagation and Registry

- L0 scripts (`validate-templates.ts`, `verify-scripts.ts`,
  `helpers/changelog-duplicates.ts`) are propagated to `templates/common/scripts/` via
  `propagate-to-templates.ts --apply` (L0+L1 mirror contract).
- `templates/co-abap/scripts/validate-abap-platform-parity.ts` is L2-scoped (registry
  row `L0+L2`); its version bump pins the CV-02 same-version-content-change rule.
- `scripts/SCRIPTS.md` rows bumped with version-note chains;
  `docs/lifecycle/scripts/validate-templates.md` record appended.
- Unit suite green (4412 tests), `validate-templates.ts` 0 FAILs, `verify-scripts.ts
  --verify` clean.
