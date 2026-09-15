---
schemaVersion: 1.0.0
spec-id: scaffold-delivery-validation
---

# Scaffold Delivery Validation — 2026-09-16

## 1. Overview

Lands Wave 2 of the 2026-09-15 template-fleet review remediations — four
scaffolder-validation tickets in one batch (T-20260915-002, T-20260915-003,
T-20260915-010, T-20260915-011), all in the new-project /
create-l3-scaffold / validate-templates subsystem. Each closes a "scaffold
delivery went wrong and no gate noticed" gap found by the scoped review
(`docs/reports/2026-09-15-project-review-template-fleet.md`, findings C3,
H13, H12, M11).

## 2. Problem

1. **C3 — silent marker no-op class (T-20260915-002)**.
   `scripts/create-l3-scaffold.ts` graft injection searched
   `templates/common/AGENTS.md` for the marker
   `WORKSPACE-MANAGED: graft repo context graph` while the file carried
   `graft:start/end` — `indexOf` missed, no warning, block silently never
   appended. The re-wrap fix landed in v1.14.0; no standing validator
   prevents the same class for any marker the scaffolders search for.
   Marker strings live as inline literals at each extraction site, so a
   source-template edit and a code edit can drift apart with nothing
   comparing the two.
2. **H13 — delivery-tree parity gap (T-20260915-003)**.
   `create-l3-scaffold.ts` excludes top-level `docs/` (beyond `docs/_common/`
   + `docs/context.md`) and all of `.agents/` via
   `COMMON_OVERLAY_EXCLUDE`, while `new-project.ts` delivers both. Every new
   `templates/common/docs/` file silently widens the gap between the two
   scaffold paths' deliveries; no test notices.
3. **H12 — non-canonical extends-stub body discarded silently (T-20260915-010)**.
   `new-project.ts` §2.3b resolves variant pm.md extends-stubs by attaching
   the L1 body; any prose-only stub body is dropped as stub metadata. A
   variant author who writes real content while keeping `extends:` loses it
   silently. T-20260912-004 already made prose-only bodies RESOLVE as stubs
   (Test 25); nothing checks the dropped body is actually stub prose.
4. **M11 — provenance version parsed from the wrong file with a silent
   fallback (T-20260915-011)**. `create-l3-scaffold.ts`
   `readCommonVersion()` parses `inherits_common` out of
   `templates/common/scripts/SCRIPTS.md` with a silent `1.0.0` fallback;
   the SSOT for the template version is `templates/VERSION`. A second
   silent fallback (`"unknown"`) exists in the Step 6.6
   `.claude/template-version.txt` read of `templates/VERSION` itself.

## 3. Requirements and acceptance criteria

### 3.1 Scaffold marker references must exist in source templates (T-002)

- **R1**: A single shared constants module
  (`scripts/helpers/scaffold-markers.ts`, L0+L1) exports every scaffold
  marker string the scaffolders reference: the `COMMON-AGENTS:START/END`
  comment markers, the WORKSPACE-MANAGED open/close markers (including the
  graft-specific opener `<!-- WORKSPACE-MANAGED: graft repo context graph -->`),
  and the six `VARIANT-*-START` marker names the L3 scaffold emits into the
  generated `AGENTS.md` (incl. `VARIANT-ROLE-BOUNDARY`).
- **R2**: The (marker → source file) mapping lives in the same module as one
  declarative object — `{ marker, sources: [...] }` entries — so adding a
  marker forces updating the mapping.
- **R3**: `create-l3-scaffold.ts` imports the constants (no behavior change)
  and prints a loud warning naming the marker and source file when an
  extraction site finds no marker (C3's exact "no warning" failure shape —
  visibility only, scaffold continues).
- **R4**: `validate-templates.ts` gains a `scaffold-marker-source` check:
  for every declared (marker, source) pair, the source file must exist and
  contain the marker. Missing file or missing marker = Error, variant
  `common`.
- **A1**: With current repo data the check reports 0 errors (all declared
  markers verified present in their sources, including the graft block in
  `templates/common/AGENTS.md` and `COMMON-AGENTS:START/END`).
- **A2**: Removing (or renaming) a declared marker from a source template
  produces a `scaffold-marker-source` FAIL naming the marker and file.

### 3.2 Delivery-tree parity between the two scaffold paths (T-003)

- **R5**: create-l3-scaffold's delivery-exclusion list is ONE exported
  shared constant (`L3_COMMON_OVERLAY_EXCLUDE`) in the shared module;
  `create-l3-scaffold.ts` imports it (no behavior change).
- **R6**: new-project's delivery-skip data (copy-skip entries,
  workspace-only files, L1-only agents/dirs, cleanup files, legacy L0
  skills) is exported from the same module and imported back by
  `new-project.ts` (single source, no behavior change) so a faithful static
  derivation of both delivery trees exists.
- **R7**: Pure derivation functions `deriveNewProjectDelivery(commonDir,
  platform)` and `deriveL3ScaffoldDelivery(commonDir)` model each path's
  delivered file set from `templates/common/` (incl. the `docs/_common/ →
  docs/` flatten, L0-only script filtering via layer-filter, `l2_propagate:
  false` skill/script filtering, memory clear, platform profile removals,
  and the L3 dedicated-step deliveries that collide with common relpaths).
- **R8**: The reviewed gap between the two deliveries is ONE declarative
  constant (`REVIEWED_DELIVERY_EXCLUSIONS`): exact relpath entries plus
  directory-prefix entries (trailing `/`), each with a review reason.
  `diffDeliveryTrees(newProjectSet, l3Set)` computes newProject \ l3.
- **R9**: A fast standalone harness `scripts/test-scaffold-delivery-parity.ts`
  (scripts suite, no scaffolding, < 5 s) asserts the computed gap equals the
  reviewed constant exactly: every gap file is covered by a rule (nothing
  more), every exact rule is a real gap file, and every prefix rule covers
  at least one gap file (no stale exemptions).
- **R10**: Derivation faithfulness is pinned end-to-end by the two existing
  E2E harnesses with zero extra scaffolds: `test-new-project.ts` asserts its
  real scaffolded tree (restricted to the derived universe, minus
  post-delivery artifacts: `bun.lock`, `node_modules/`, `.git/`, `graft/`)
  equals the derived new-project set; `test-l3-to-variant-promotion.ts`
  asserts the same for its real L3 fixture against the derived L3 set.
- **A3**: The parity harness passes with the reviewed constant pinning
  today's gap: the `.agents/` tree, `agents/i18n-specialist.md`, the
  top-level `docs/` files beyond `_common`/`context.md` (README/README_ko
  templates, country-profiles, design-foundation, design-tokens template,
  phase-definitions, procedure-schema-spec, screen-patterns template,
  skill-graph + overrides, workspace-schema), `docs/lifecycle/skills/`,
  and `docs/specs/`. No fix to delivery logic is required — every gap is
  the documented dedicated-step intent (see §5).
- **A4**: Adding any file under `templates/common/docs/` (or any other
  not-yet-reviewed gap location) makes the parity harness fail until the
  gap is either fixed in delivery logic or consciously added to
  `REVIEWED_DELIVERY_EXCLUSIONS` with a reason.

### 3.3 Non-canonical extends-stub body guard (T-010)

- **R11**: The canonical PM stub prose ("This `<variant>` PM override
  inherits the common PM body and supplies only variant-specific
  governance, roster, and dispatch deltas.") lives once, in the shared
  module (`canonicalPmStubBody(slug)` + `isCanonicalPmStubBody(body, slug)`
  comparator — canonical means empty or exactly the canonical sentence,
  whitespace-trimmed).
- **R12** (arm a): `new-project.ts` §2.3b prints a loud warning naming the
  variant and file when a resolved extends-stub body is NOT canonical
  (content would be discarded) before continuing. Scaffold behavior is
  unchanged — visibility only.
- **R13** (arm b): `validate-templates.ts` gains a `pm-extends-stub-body`
  check: every `templates/co-*/agents/pm.md` that declares `extends:` must
  carry the canonical stub body (empty or the canonical sentence);
  non-canonical body = Error naming the variant. Remediation: inline the
  real content without `extends:`, or restore the canonical stub.
- **A5**: With current repo data the check reports 0 errors (8 empty-body
  stubs + 5 canonical prose stubs across the 13 variants).
- **A6**: A variant pm.md with `extends:` and a non-canonical body produces
  a `pm-extends-stub-body` FAIL; the same file produces the new WARN at
  scaffold time.

### 3.4 Provenance version from templates/VERSION (T-011)

- **R14**: `readCommonVersion()` (SCRIPTS.md parsing, silent `1.0.0`
  fallback) is removed. The new `scripts/helpers/template-version.ts`
  (L0) exports `parseTemplateVersion(content)` (pure, throws on
  unparseable content) and `readTemplateVersion(rootDir)` (throws with a
  clear message when `templates/VERSION` is missing or unparseable).
- **R15**: `create-l3-scaffold.ts` fails LOUD (exit non-zero, via its
  existing `fail()` → rollback hook) when the version cannot be read; no
  silent fallback remains in the script (the Step 6.6 `"unknown"` fallback
  is removed too). Provenance output formats are unchanged: `_ORIGIN.md`,
  `_COMMON_VERSION.md`, `docs/VERSION_MANIFEST.md` stub, and
  `.claude/template-version.txt` (`version=<x.y.z>` — consumed by
  upgrade-project's version-sync).
- **R16**: `new-project.ts`'s own `--version <tag> || templates/VERSION ||
  "unknown"` precedence is out of scope (M11 names create-l3-scaffold's
  SCRIPTS.md path; new-project has no SCRIPTS.md parsing and prefers the
  explicit `--version` flag).
- **A7**: With `templates/VERSION` present, scaffolding records `0.6.0`
  everywhere it did before (same formats). Battery runs confirm no test
  regressed.

## 4. Check homes and rationale

- **Marker/stub checks live in `scripts/validate-templates.ts`** — the
  standard battery run by dev-sync and CI on every change, already home to
  the C-CM contract checks and PM-02 marker-zone parity. New checks:
  `scaffold-marker-source` (root-scope, variant key `common`) and
  `pm-extends-stub-body` (per-variant), both invoked from `main()`.
- **Shared constants + derivations live in
  `scripts/helpers/scaffold-markers.ts`** (L0+L1 — validate-templates'
  L1 mirror imports it, so it must propagate). Both scaffold scripts
  import their constants back; the parity harness and unit tests import
  the derivations. The scaffold scripts themselves are NOT import-safe
  (they run `main()` unconditionally), which is why the constants cannot
  live in them despite `COMMON_OVERLAY_EXCLUDE` originating there.
- **VERSION parsing lives in `scripts/helpers/template-version.ts`** (L0;
  only create-l3-scaffold consumes it) so unit tests can exercise the
  parser without executing the scaffold script.
- **The parity harness is `scripts/test-scaffold-delivery-parity.ts`**
  (scripts suite naming: `test-*.ts`), static derivation only — a full
  double-scaffold would add minutes to the 120 s-capped suite for no extra
  coverage, because R10 pins both derivations against real scaffolds
  inside the existing harnesses.

## 5. Reviewed delivery-gap inventory (data the parity test pins)

Derived from the current `templates/common/` tree (new-project delivery \
create-l3-scaffold delivery):

- `.agents/` (prefix) — L0-only platform skill mirror; re-synced by
  `scripts/sync-skills.ts` after Phase B (COMMON_OVERLAY_EXCLUDE comment).
- `agents/i18n-specialist.md` — `agents/` is stub-generated for L3 drafts
  (dedicated step); fleet agents reach real projects via the common copy at
  `new-project` instantiation.
- `docs/README.template.md`, `docs/README_ko.template.md` — consumed by the
  L3 README renderer, not delivered.
- `docs/country-profiles.md`, `docs/design-foundation.md`,
  `docs/design-tokens.template.css`, `docs/phase-definitions.md`,
  `docs/procedure-schema-spec.md`, `docs/screen-patterns.template.md`,
  `docs/workspace-schema.json` — top-level docs beyond `_common` (H13).
- `docs/skill-graph.json`, `docs/skill-graph.overrides.json` — regenerated
  on first /sync (dev-sync step 4.65); a stale common copy would be
  overwritten at first generation.
- `docs/lifecycle/skills/i18n-audit.md` — L3 writes its own
  `docs/lifecycle/agents/pm.md` governance record (same relpath as common's,
  so that one is delivered), but the rest of `docs/lifecycle/` is not copied.
- `docs/specs/registry.json` — the L3 draft's registry seeds come from
  `scripts/spec-register.ts` at first spec activity, not from a copied tree.

No gap outside the documented dedicated-step intent surfaced, so no
delivery-logic fix is required (A3).

## 6. Version bumps (minor — new functionality)

| Script | Version | Surfaces |
|--------|---------|----------|
| `scripts/create-l3-scaffold.ts` | 1.14.0 → 1.15.0 | `@version` + header changelog; L0 SCRIPTS.md row |
| `scripts/new-project.ts` | 1.17.0 → 1.18.0 | `@version` + header changelog; L0 SCRIPTS.md row |
| `scripts/validate-templates.ts` | 1.29.0 → 1.30.0 | `@version` + header changelog; L0 + L1 SCRIPTS.md rows |
| `scripts/test-new-project.ts` | 1.1.1 → 1.2.0 | `@version` + header changelog; L0 SCRIPTS.md row |
| `scripts/test-l3-to-variant-promotion.ts` | 1.2.1 → 1.3.0 | `@version` + header changelog; L0 SCRIPTS.md row |
| `scripts/helpers/scaffold-markers.ts` | new 1.0.0 | L0 + L1 SCRIPTS.md rows (L0+L1 delivery) |
| `scripts/helpers/template-version.ts` | new 1.0.0 | L0 SCRIPTS.md row |
| `scripts/test-scaffold-delivery-parity.ts` | new 1.0.0 | L0 SCRIPTS.md row |

`docs/VERSION_MANIFEST.md` is regenerated (script count changes with the
three new files). L0→L1 propagation runs via the orchestrator's `/sync`
(dev-sync step 4.5) — no hand-copying of L0 scripts into
`templates/common/scripts/`.

## 7. Test plan

- `tests/unit/scaffold-delivery-parity.test.ts` (new): pure helpers only —
  marker mapping resolution (every declared source exists and contains its
  marker, every exported marker constant is covered by the mapping), the
  exclusion-rule matcher (exact vs prefix, stale-rule detection),
  `diffDeliveryTrees` set semantics, `isCanonicalPmStubBody` (canonical
  prose for slug, empty body, whitespace tolerance, non-canonical prose,
  wrong-slug prose), `parseTemplateVersion` (valid, empty, non-semver,
  trailing newline, junk) and `readTemplateVersion` failure messages on a
  temp dir. Modeled on `tests/unit/registry-version-parity.test.ts`.
- Real-tree acceptance: battery items below (unit suite,
  validate-templates 0 errors, typecheck 0 new errors, audit PASS, scripts
  suite incl. the new parity harness, test-new-project, review-baseline
  6/6).

## 8. Accessibility

Backend/CLI-only work (validators, scaffold scripts, a parity harness, and
shared helper modules). No user-facing UI is produced. Exempt from
ADR-0065 WCAG scope; the WCAG 2.1 AA baseline does not apply.

## 9. Preview Verification

Non-UI work — no rendered surface exists to screenshot. Exempt from
ADR-0070 preview verification; verification is via the executed validation
battery (exit codes and gate output quoted in the ticket record).
