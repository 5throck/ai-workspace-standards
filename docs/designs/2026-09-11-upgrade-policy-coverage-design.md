# Design: Upgrade Policy Coverage — close the scaffold/upgrade fidelity gap

- **Spec ID**: 2026-09-11-upgrade-policy-coverage
- **Date**: 2026-09-11
- **Status**: implemented (PRs #876, #877; formalized as ADR-0073)
- **Owners**: architect (design), automation-engineer (implementation)
- **Affected artifacts**: `scripts/upgrade-project.ts`, new `scripts/lib/upgrade-policy.ts`, new `scripts/check-upgrade-coverage.ts`, `scripts/audit.ts` (coverage gate), `skills/upgrade-project/SKILL.md`, governance registries

## 1. Problem

New-project scaffolding (`scripts/new-project.ts`) delivers the template surface **by construction**: it copies the whole `templates/common` tree, overlays the variant, then prunes known staging areas. Any file added to the template automatically reaches new projects.

Project upgrades (`scripts/upgrade-project.ts`) deliver by **enumeration**: ~12 fixed passes, each with hardcoded file/dir lists. Coverage is maintained reactively — every gap-filler pass (GOVERNANCE FILES, VARIANT ASSET DIRS, PROCEDURES, …) documents in its own header comment the incident that forced it. Files with no claiming pass are silently never delivered to existing projects.

### Verified gap inventory (evidence from 2026-09-11 fleet investigation)

| Gap | Evidence |
|---|---|
| Most of the variant `docs/` tree | Only 5 files version-synced (`VARIANT_DOCS_SYNC`, upgrade-project.ts:876) + `phase-definitions.md` + `security.md` + `<variant>.context.md`. Missing: `user-guide(+_ko)`, `handoff-spec(+_ko)`, `VERSION_MANIFEST.md`, `skill-graph.overrides.json`, domain docs (`wire-format.md`, `corrections-workflow.md`, `component-primitives.md`, …), `countries/KR.md`, all `templates/common/docs` extras (`country-profiles.md`, `design-foundation.md`, `procedure-schema-spec.md`, `workspace-schema.json`, `design-tokens.template.css`, `screen-patterns.template.md`, `README.template.md`) |
| `.claude/settings.json`, `.gemini/settings.json` | Zero mentions in upgrade-project.ts — hook/permission evolution never reaches legacy projects |
| `.github/**` (CODEOWNERS, dependabot.yml, PR template, `workflows/ci.yml`) | Only appearance is the VARIANT ASSET DIRS **skip set** (upgrade-project.ts:1538) |
| Root `.editorconfig`, `.env.sample`, `skills.json` ×3 | No pass claims them |
| `SECURITY.md` | No pass (LICENSE is add-if-missing; SECURITY.md is not on that list) |
| `procedures/_output-types.yaml` | Seeded if absent only, never updated |
| `docs/lifecycle/**` | Template-shipped lifecycle records, no pass |

Root cause: upgrade coverage is a hand-maintained allowlist while the template surface grows continuously. The failure mode "hardcoded list goes stale" cannot be fixed by adding more entries to the list.

## 2. Goals

1. **Invert the default**: a template file is delivered on upgrade *by default*; only explicitly classified files get special treatment (merge/preserve/skip).
2. **Single source of truth** for upgrade classification, shared by the upgrade script and a coverage validator.
3. **Mechanical recurrence guard**: a validator that reports (and can gate) files whose classification is suspicious — real content in scaffold-removed staging zones, or placeholder tokens in delivered files.
4. Zero behavior change for files already covered by existing passes (regression safety).

## 3. Non-goals

> **Status note (2026-09-11)**: the first two non-goals below were subsequently resolved — the VARIANT_DOCS_SYNC fold landed as Phase C (§10 D9, PR #877), and the coverage validator is wired into `audit.ts` as an auto-activating gate (§10 D10). GOVERNANCE FILES and the `docs/_common` overwrite remain dedicated by design. The list is kept as the original scope record.

- Folding existing passes (VARIANT_DOCS_SYNC, docs/_common, GOVERNANCE FILES, …) into the new engine — deferred follow-up; this design only *classifies* them and adds one new pass for the previously-unclaimed remainder.
- Wiring the coverage validator into `audit.ts`/CI — the validator ships standalone; integration is a follow-up.
- Dependency updates for root `package.json`/`bun.lock` — remains the `sync-template-deps.ts` / `update-bun-packages` workflow (PROJECT_STATE classification only records that decision).

## 4. Decisions

### D1 — Deny-list, not manifest

A manifest enumerating upgrade-relevant files recreates the bug (stale enumeration). Instead, `resolveClaim(relPath, variant)` in `scripts/lib/upgrade-policy.ts` classifies **every** project-relative path; the fallback claim is `TEMPLATE TREE SYNC` (deliver by default). Hand maintenance shrinks to the exception table.

### D2 — Policy vocabulary

| Claim (policy) | Delivery pass | Semantics |
|---|---|---|
| `LOCKED` | existing LOCKED pass | always overwrite from template |
| `MERGE_MANAGED` | existing MERGE / DOCS_MERGE passes | managed-block merge |
| `OVERWRITE` | existing DOCS_OVERWRITE / docs\_common pass | plain overwrite |
| `VERSIONED_SYNC` | existing VARIANT_DOCS_SYNC pass | inline-version/hash sync with conflict warning |
| `HASH_SYNC` | existing COMMANDS_SYNC pass | hash sync |
| `ADD_IF_MISSING` | existing GOVERNANCE / PROCEDURES passes | copy only if absent |
| `REGENERATED` | existing regenerate steps | generated in-project (`docs/skill-graph.json`, `.claude/template-version.txt`) |
| `PRESERVE` | none | project-owned after scaffold, never touched |
| `PROJECT_STATE` | none | project runtime/generated state, never touched |
| `TEMPLATE_ONLY` | none | staging zones the scaffold deletes (`docs/_templates`, `_examples`, adr/specs/variants class) — never deliver |
| `JSON_MERGE` | **new TEMPLATE TREE SYNC pass** | recursive JSON merge (D4) |
| `WORKSPACE` | **new TEMPLATE TREE SYNC pass** | add-if-missing seed (project workspaces under `docs/`) |
| `SYNC` (default fallback) | **new TEMPLATE TREE SYNC pass** | add / inline-version-or-hash update / conflict warning on local modification |

### D3 — Effective template tree = scaffold parity

The new pass walks `templates/<variant>/` overlaid on `templates/common/` (variant wins), replicating scaffold facts:

- `VARIANT_OVERLAY_SKIP`: `docs/context.md` never taken from the variant (new-project.ts:535; WS-07).
- L1-only / template-only zones deleted by scaffold (new-project.ts:470, 477, 718): `agents/lifecycle-manager.md`, `agents/_COMMON.md`, `agents/pm.md.backup`, `docs/adr/**`, `docs/specs/**`, `docs/variants/**`, `docs/_templates/**`, `docs/_examples/**`, `docs/_common/**`, `docs/variant.context.template.md`, `scripts/propagation-map.json`, `*.cmd`.
- Workspace-only files: `package.json`, `bun.lock*`, `package-lock.json`, `variant.json`, `scripts-snapshot.json`, `memory/**`, `node_modules`, `.git`, `.gateguard-state`.

### D4 — TEMPLATE TREE SYNC semantics

- **SYNC**: absent → `NEW` + copy; present → inline `*<file> version: X.Y` comparison, else MD5 hash; template newer/changed → overwrite with `⚠️ CONFLICT` warning when `git status` shows local modification (identical to VARIANT_DOCS_SYNC / VARIANT ASSET DIRS conventions; git history + pre-upgrade stash are the recovery path).
- **WORKSPACE** (`docs/{designs,drafts,reports,research,findings,threat-models,lifecycle}/**`): copy only if absent; never overwrite, never prune. Project artifacts there are the point of the directory.
- **JSON_MERGE** (`.claude/settings.json`, `.gemini/settings.json`): recursive merge — objects recurse with template winning scalar/object conflicts, **arrays are unioned with project-only entries preserved** (protects project-added `permissions.allow` entries and hook mutations at the cost of possible visible duplication when the template rewrites a hook), scalars template-wins. Preserved project-only keys are logged.

### D5 — SECURITY.md joins GOVERNANCE_FILES

`SECURITY.md` is template-shipped policy text, forkable like LICENSE (projects may localize contact/disclosure info). `GOVERNANCE_FILES = ['LICENSE', 'SECURITY.md']` — add-if-missing, never overwrite.

### D6 — Coverage validator (`scripts/check-upgrade-coverage.ts`)

Walks the effective tree for one or all variants, resolves claims, and reports the classification matrix (`--json` for machine consumption). `--strict` exits non-zero on:

1. a template file whose claim cannot be resolved (defensive — must not happen with the default fallback),
2. `{{placeholder}}` tokens present in files claimed by any *delivery* policy (`SYNC`, `VERSIONED_SYNC`, `OVERWRITE`, `WORKSPACE`, `ADD_IF_MISSING`, `MERGE_MANAGED`, `LOCKED`, `HASH_SYNC`) — delivering them would resurrect unsubstituted template text into projects. `docs/README.template.md` / `docs/README_ko.template.md` are allowlisted: scaffold ships them verbatim unrendered, so their tokens are intentional and `SYNC` stays idempotent,
3. a `docs/context.md` file inside a variant template (WS-07 contamination — the common file is the SSOT),
4. `JSON_MERGE` targets that fail `JSON.parse` (broken settings shipped to every project).

### D7 — Drift guard between the policy lib and the legacy script

The new pass filters by `claim.pass === TEMPLATE_TREE_SYNC_PASS`, so a legacy pass's hardcoded list drifting from the lib's copy of that list would silently reopen a gap. Unit tests therefore parse the array literals out of `scripts/upgrade-project.ts` source (the script is a top-level executable, not importable) and assert equality with the lib constants (`VARIANT_DOCS_SYNC_FILES`, `GOVERNANCE_FILES`).

### D8 — Placeholder safety

Only three common docs files contain `{{…}}` tokens (`README.template.md`, `README_ko.template.md`, `variant.context.template.md`). The first two ship verbatim unrendered at scaffold (project copy == template copy, substitution never applied), so `SYNC` is idempotent for them; the third is `TEMPLATE_ONLY` (scaffold removes it). The validator's strict check (D6-3) keeps this true.

## 5. Testing

1. **Unit** (`tests/unit/upgrade-policy.test.ts`, bun:test): representative paths per policy — docs gap files → `SYNC`, workspace seeds → `WORKSPACE`, staging → `TEMPLATE_ONLY`, runtime state → `PROJECT_STATE`, settings → `JSON_MERGE`, managed/locked/legacy claims; variant-parameterized `<variant>.context.md`.
2. **Drift guard**: script-literal vs lib equality (D7).
3. **Integration** (`tests/unit/upgrade-tree-sync.test.ts`): temp project (git init + `template-version.txt`, `variant=co-develop`) — dry-run reports `NEW docs/user-guide.md` / `NEW .github/CODEOWNERS` and writes nothing; apply run delivers them; pre-seeded project-owned files (`docs/README.md`, `docs/designs/local-note.md`) untouched; `settings.json` project-only keys survive.
4. **Regression**: existing `tests/co-safety-template-completeness.test.ts` must stay green; live `--dry-run` against a real `Projects/<name>` reviewed and logged to memory.

## 6. Accessibility & Preview Verification

Non-UI exemption: this design touches only CLI/Node tooling and Markdown governance docs — there is no user-facing web/app/document UI. WCAG 2.1 AA targets and rendered-preview verification (ADR-0065/ADR-0070) are therefore **not applicable**; no rendered artifacts are produced.

## 7. Risks / trade-offs

- **SYNC overwrites locally-modified reference docs** (with warning): consistent with every existing sync pass; git + pre-upgrade stash mitigate. A future `--preserve-local` flag can soften this without structural change.
- **Volume**: co-deck `docs/html-themes/**` (~190 files) now hash-syncs — MD5 cost is negligible; dry-run output grows.
- **JSON merge duplication**: template hook rewrites can leave stale project hook entries alongside new ones — visible, safe, manually cleanable; chosen over destructive template-wins because silently dropping project permission grants is worse.
- **Policy drift** between lib and legacy script literals — guarded by D7 tests.

## 8. Rollout

Single PR (sequential; dev-sync touches shared pipeline files): design doc → `upgrade-policy.ts` → `check-upgrade-coverage.ts` → `upgrade-project.ts` v1.21.0 (new pass + GOVERNANCE_FILES extension) → tests → SKILL.md + registry updates → `/sync`.

## 9. References

- ADR: `docs/adr/0073-upgrade-coverage-policy.md` (formalized decision record)
- Investigation session log: `memory/2026-09-11.md` (fleet gap inventory)
- `scripts/new-project.ts` (scaffold parity facts: lines 362, 432, 470, 477, 514–520, 535, 718, 728)
- `scripts/upgrade-project.ts` (pass inventory, header changelog)
- `tests/co-safety-template-completeness.test.ts` (integration test pattern)

## 10. Phase C addendum (2026-09-11, landed after PR #876)

- **D9 — VARIANT_DOCS_SYNC folded** (`upgrade-project.ts` v1.22.0): the last duplicated hardcoded docs list is gone. The 5 files (`docs/context.md`, `engagement-orchestration.md`, `team-configuration-guide.md`, `privacy-design-checklist(+_ko)`) are claimed by the TEMPLATE TREE SYNC pass's default SYNC policy — identical inline-version/hash semantics, conflict warning, and variant-over-common resolution (WS-07 keeps `docs/context.md` sourced from common). Output counts move from "Sync files updated" to "Tree-sync delivered". The drift-guard literal test is replaced by a fold-pinning regression test (re-declaring the list in the script fails).
- **D10 — coverage gate wired into `audit.ts` v2.34.0**: new auto-activating check (same convention as the ADR-0060 skill-graph drift gate) spawns `check-upgrade-coverage.ts --strict` whenever the checker exists. The gate is workspace-side: the checker/upgrade trio is `L0`-only (ADR-0073 Amendment 1), and at project (L2) context the gate self-skips (no `templates/` tree; the checker also self-skips when its own file is absent). Placeholder-in-delivered-file, WS-07 contamination, and JSON_MERGE health are now enforced on every workspace audit instead of manual runs.
- Retained as dedicated passes on purpose: GOVERNANCE FILES (forkable add-if-missing with a "never overwrite" guarantee) and the `docs/_common` overwrite (flattened-source mapping) — their semantics differ enough from the default SYNC branch that folding them would add branching without removing risk. Revisit only if they grow.
