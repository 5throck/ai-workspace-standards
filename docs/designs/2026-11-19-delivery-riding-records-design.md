# Delivery-Riding Records and Registry Rows — Design (Row 0)

- **Spec ID**: `2026-11-19-delivery-riding-records-design`
- **Date**: 2026-11-19
- **Status**: implemented (single PR; tickets T-20261119-005 residual + T-20261119-009)
- **Author**: architect + automation-engineer (PM-dispatched, one batch)
- **Input**: T-20261119-009 (engine: three automation gaps from the 2026-11-19 wave adjudications), T-20261119-005 (closed — process-level heal; engine residual split to T-20261119-009). Precondition tickets T-20261119-001..004 (wave blockers) are done; this engine change is their re-run precondition.
- **Related**: `2026-11-12-skill-lifecycle-record-delivery-design.md` (the record generator, SLR gate, WORKSPACE seed claim), ADR-0074 (Universal Design Gate; the `docs/specs` seed), ADR-0033 (variant script blueprint + sub-registries), DEC-20261106-03 (`L0+L2` variant-scoped registry rows), `docs/designs/2026-11-11-upgrade-overwrite-protection-design.md` (skip + ERROR decision semantics reused by R2).
- **Scope**: `scripts/upgrade-project.ts` (delivery enumeration, additive), one new pure helper module `scripts/helpers/delivery-riding.ts`, new verdicts in `scripts/lib/upgrade-policy.ts`, unit tests. L1 mirror lands via the gated propagate generator (dev-sync step 4.5) — no hand edits to `templates/common/scripts/`.

## 1. Problem statement

The upgrade delivery engine delivers content without the records that document it. Three gaps, all observed in the 2026-11-19 waves (15+ hand alignments in one night):

- **G1 — lifecycle records do not ride SKILL.md deliveries.** `skills/<name>/SKILL.md` delivers via `SYNC_IF_NEWER: skills/` (version-gated) while the project record `docs/lifecycle/skills/<name>.md` is a `WORKSPACE` seed: copied once when absent, `SEED_SKIP` forever after (`upgrade-policy.ts` WORKSPACE_DOC_DIRS → `upgrade-project.ts` seed branch). Every later version bump leaves the record behind. The project-side hand-authored records (the DEC-20261112-01 Ruling 2 backfill population, e.g. `Projects/co-consult/docs/lifecycle/skills/accessibility-audit.md` with `- **Version**: 1.1.0`) drift from the delivered frontmatter; the 12 co-consult + 3 co-abap realignments tonight were exactly this class.
- **G2 — variant subdirectory scripts deliver without main-registry rows.** `reconcileScriptRegistry` looks up a delivered script's row in L0 `scripts/SCRIPTS.md` and `templates/common/scripts/SCRIPTS.md` only, keyed by project-relative path. Scripts delivered from `templates/<variant>/scripts/<subdir>/` (co-work `humanize/humanize-adapter.ts`, co-work `deck/ppt-master-adapter.ts`) are registered only in the variant sub-registry `templates/<variant>/scripts/<variant>/SCRIPTS.md` with bare names — the lookup misses, silently returns, and the project's main registry never gets the row. verify-scripts Check 1 then fails the project audit ("Unregistered script"), repaired by hand tonight following the deck precedent row.
- **G3 — project spec registries lack standing fleet-resync spec seeds** (forced E5 on pure sync deliveries). Investigated and **dropped — E5 is acceptable-by-design** (Ruling R3 below).

## 2. Rulings

### R1 — SKILL.md version deliveries carry their lifecycle-record bump in the same pass

After any delivery of `skills/<name>/SKILL.md` (NEW or UPDATE arm, version-gated or hash-based, common or variant pass), the engine reconciles `docs/lifecycle/skills/<name>.md` in the project:

1. **Record absent** → nothing. The TEMPLATE TREE SYNC `WORKSPACE` claim owns seeding (add-if-missing) in the same run; the reconcile never duplicates that channel.
2. **Generated record** (first line = `GENERATED_MARKER`) → the record is machine-owned by its own marker contract ("hand edits are overwritten at the next publish"). Refresh bytes to the template record when one resolves (`resolveTemplate` order: variant, then common) and differs; when no template record resolves, re-derive from the delivered SKILL.md frontmatter with the L0 generator's `deriveRecord` (same module, same owner resolution). Derivation failure (unresolvable owner) → WARN + remediation text, no write, no delivery failure.
3. **Hand-authored record** → surgical metadata alignment only, never a whole-file write: the `- **Version**:` line is rewritten to the delivered frontmatter version (inserted after the `- **Status**:` line, else `- **Skill**:` line, else directly under `## Metadata`, when the field is absent); the `- **Owner**:` line is rewritten when it disagrees with the delivered frontmatter owner (the `alignSkillRegistryRowsWithFrontmatter` precedent, upgrade-project v1.56.0). Nothing else in the record is touched.
4. Dry-run prints the planned action and writes nothing. Every action lands a decision row (R1 verdicts below) under the originating pass.

### R2 — Delivered scripts carry their SCRIPTS.md row in the same pass; unregistered files FAIL loud

`reconcileScriptRegistry` gains two rules, keyed by one governance-scope fact: files under `scripts/<variant>/` are governed by the variant sub-registry that ships alongside them (verify-scripts `walkScripts` skips a `co-*` directory holding its own SCRIPTS.md), so their rows ride inside the delivered sub-registry file itself and per-file reconciliation is out of scope.

For every delivered script **outside** `scripts/<variant>/` (main-registry governed), the row source set becomes, in order:

1. L0 `scripts/SCRIPTS.md` (existing) → version-cell update or verbatim row append.
2. L1 `templates/common/scripts/SCRIPTS.md` (existing fallback).
3. **NEW — variant sub-registry fallback**: `templates/<variant>/scripts/<variant>/SCRIPTS.md`, matched by exact bare basename. Exactly one match → synthesize the 8-column main-registry row (deck-precedent shape): script = project-relative path, source = `L3`, version = the delivered file's `@version` (fallback: the sub-registry row's version), status = `active`, description cell = short provenance line referencing the variant sub-registry, layer = `L3`, pair = `—`. More than one match → ambiguous: ERROR-severity row with the colliding row names, copy skipped (fail-closed, same as the no-match arm).
4. **NEW — fail-loud arm**: no row in any upstream registry → the delivery of that file FAILS (copy skipped, `UNREGISTERED_SCRIPT` ERROR decision row, non-zero exit at completion) with remediation: register the script in L0 / L1 common / the variant sub-registry template-side, then re-run the upgrade. Content never lands unregistered, so a delivery can no longer create the "Unregistered script" audit failure it used to ship.

Fleet-safety survey (origin/main @ `e6dd04ab1`, all 16 variants): every currently version-gated `.ts` delivery outside `scripts/<variant>/` resolves through arms 1–3 (co-deck 21, co-consult 7, co-work 2 sub-registry rows; zero ambiguous); the no-row population is exclusively UNVERSIONED_SKIP files that never deliver. The tripwire is safe to enable fleet-wide today.

### R3 — Spec-registry standing seeds: E5 is acceptable-by-design (sub-item dropped)

The spec-relevance check (`audit.ts --spec-check` Check 1) is **recency-based**: code changes pass only when a registry spec was approved/implemented within 7 days or the diff touches `docs/specs|docs/designs`. A standing fleet-resync seed cannot satisfy it durably — the spec goes stale after 7 days by construction — and auto-touching its `last_updated` on every sync would make the gate vacuous (every code change would always look covered, defeating ADR-0055/ADR-0074). E5 (`sync-only`, execution-plan-templates §5.1.1) is therefore the designed channel for pure sync deliveries: delivered content is not project-authored design work. The seed that must ship already ships: `templates/common/docs/specs/registry.json` rides the `WORKSPACE` add-if-missing claim (ADR-0074), and a missing project registry stays a loud WARN with an activation hint. No engine change; this ruling documents the accepted state.

## 3. Change spec

| File | Action | Description |
|------|--------|-------------|
| `scripts/helpers/delivery-riding.ts` | create | Pure, unit-tested helpers: `isSubRegistryGoverned(rel, variant)`; `variantSubRegistryRowFor(content, basename)` (unique-match semantics); `buildMainRegistryRow({script, version, variant, subRow, provenance})` (8-column deck-precedent shape, registry-append boundary-compatible); `synchronizeRecordMetadata(record, {version, owner})` (surgical Version/Owner rewrite + deterministic insertion point); `recordBumpPlan({recordContent, templateRecord, frontmatter, variant, ownerMap})` returning one of `noop \| refresh-template \| re-derive \| metadata-align` with content and failure reason. |
| `scripts/lib/upgrade-policy.ts` | modify | Three verdicts: `RECORD_BUMP` (INFO), `SCRIPT_ROW_SYNTHESIZED` (INFO), `UNREGISTERED_SCRIPT` (ERROR). All default to `null` pending kind (pendingKindForDecision default arm) — no gate attaches. |
| `scripts/upgrade-project.ts` | modify | (a) `reconcileScriptRegistry(scriptRelPath)`: sub-registry-governed early return; variant sub-registry fallback arm; fail-loud arm (skip copy + ERROR row) replacing the silent `if (!sourceRow) return`. (b) New `reconcileSkillLifecycleRecord(skillName, projSkillFile, tplSkillFile, passLabel)` called after every `copyWholeSkillDir()` in the common and variant skills passes (NEW/UPDATE arms, versioned + hash-based). Version-bump note per @version convention in the header block. |
| `tests/unit/delivery-riding.test.ts` | create | Helper coverage: governed-path classification; unique/ambiguous/absent sub-registry matching; row synthesis shape (8 columns, boundary regex compatibility, deck-precedent fields); metadata alignment (rewrite/insert/no-op, CRLF tolerance); recordBumpPlan arm selection incl. marker refresh, derivation failure, absent record. |
| `tests/unit/upgrade-policy.test.ts` | modify | Verdict contract entries for the three new verdicts (if a pin test enumerates the contract, extend it). |

Version bumps: `upgrade-project.ts` 1.111.0 → 1.112.0 (minor: new in-pass reconcilers + fail-loud arm), `upgrade-policy.ts` 1.47.0 → 1.48.0 (new verdicts), new helper at 1.0.0. L1 mirrors via `propagate-to-templates.ts --apply` (dev-sync step 4.5), never hand-edited.

## 4. Tests

Unit: the new helper suite + verdict contract pins (§3). Manual battery gates: `bun run test:unit`, `bun scripts/verify-scripts.ts --verify`, `bun scripts/audit.ts`, `bun scripts/validate-templates.ts`. Upgrade-engine smoke: a dry-run against a real project (co-work) must show the sub-registry fallback rows as planned actions and no UNREGISTERED_SCRIPT rows.

## 5. Risks

| Risk | Mitigation |
|------|-----------|
| Fail-loud arm blocks a wave on a template defect | Zero-fleet-hit survey (§R2); the ERROR row names the exact registry to fix; the file content class is `scripts/**` only, so blast radius is one variant's delivery. |
| Record metadata rewrite corrupts hand-authored records | Pure string transform, unit-pinned: only the two `- **Version**/- **Owner**` lines change; insertion is position-deterministic; CRLF preserved. |
| Marker-record refresh overwrites deliberate project edits | The marker itself declares hand edits are overwritten at the next publish — the refresh enforces the record's own contract; hand-authored records never take whole-file writes. |
| New verdicts leak into backport gates | pendingKindForDecision default → null (verified in §2 of the code path); contract test pins severities. |

## Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None (engine-side only; no skill/agent/config change) | N/A |
| Antigravity (GEMINI.md) | None — the delivery engine is platform-neutral; no platform surface or mirror changes | N/A |
| templates/common | Propagation required (gated generator only): `scripts/upgrade-project.ts`, `scripts/lib/upgrade-policy.ts`, `scripts/helpers/delivery-riding.ts` L1 mirrors via dev-sync step 4.5 | templates/common/scripts/{upgrade-project.ts, lib/upgrade-policy.ts, helpers/delivery-riding.ts} |

## Acceptance criteria

- [ ] A SKILL.md version delivery in apply mode updates the project record's Version/Owner lines in the same pass (hand-authored), refreshes marker records to template bytes, and lands a `RECORD_BUMP` decision row.
- [ ] A delivered main-registry-governed script registered only in the variant sub-registry gets its synthesized main-registry row in-pass (`SCRIPT_ROW_SYNTHESIZED`), matching the deck-precedent shape.
- [ ] A delivered main-registry-governed script with no upstream row anywhere skips the copy with an `UNREGISTERED_SCRIPT` ERROR row and non-zero exit, printing the remediation.
- [ ] `scripts/<variant>/` deliveries keep today's behavior (no per-file reconcile; the sub-registry file itself rides whole-content).
- [ ] No fleet dry-run regression: zero new ERROR rows across a real project dry-run (co-work).
- [ ] Full battery green; L1 mirrors byte-identical via the gated generator.
