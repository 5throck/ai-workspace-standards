---
lang: ko
lang_reason: source-material
lang_note: >-
  The document body is English; the lang:ko source-material exception covers
  the single verbatim Korean user mandate quoted in the Status line (the
  standing directive authorizing this fix). DEC-20261027-01 precedent.
---

# Merge-aware delivery for docs/workspace-schema.json (co-price / co-architect upgrade unblock)

- **Status**: Implemented (2026-10-31, automation-engineer per PM Gateway dispatch; approved 2026-10-31, PM per user mandate — standing directive "문제가 있는 부분은 수정해주고 반영해줘" covers this fix)
- **Registry status**: `implemented` (docs/specs/registry.json, spec id `2026-10-31-workspace-schema-merge-delivery-design`)
- **Date**: 2026-10-31
- **Owner**: automation-engineer (PM Gateway dispatch; this design doc + DEC-20261031-02 by architect)
- **Tickets**: the 2026-10-31 co-price (0.22.1→0.25.0) and co-architect (0.23.0→0.25.0) upgrade halts; related T-20261028-016 (item 3 flagged the clobber class), U-20261028-014 (partial variant.json designLint override)
- **Tier**: L0+L1 (engine lands at the workspace root; projects receive it through version-gated re-delivery; L3 projects upgrade via visits, never hand-edit)
- **Adjudication record**: docs/decisions/DEC-20261031-02.md (Option A selected over adopt-and-degrade and land-broken)
- **Precedent**: scripts/lib/upgrade-policy.ts `mergeSettingsData` (existing JSON_MERGE deep-merge for platform settings), docs/designs/2026-10-30-language-gate-parent-verbatim-tolerance-design.md (gate-vs-legacy-content interaction class)

## 0. Accessibility exemption statement

This design is engine work: a merge helper, a delivery-policy claim, wiring in the
upgrade engine, and unit tests. It produces no user-facing UI and no preview
artifact. The ADR-0065 accessibility sections and the ADR-0070
preview-verification sections are **exempt** for every artifact in this design.

## 1. Context

`docs/workspace-schema.json` is the fleet SSOT for platform/model registries,
route-audit tripwires, and design-lint gate config. Template 0.25.0 (schema
v1.7.0) adds two top-level blocks — `platform_surfaces` (required by the newly
delivered `scripts/sync-agent-mirrors.ts` mirror-parity guard) and `routeAudit`
— and reshapes `designLint` (playground scanRoot, empty allowlist).

The delivery engine sends this file through the generic SYNC policy, which is
whole-content, conflict-or-overwrite. Two projects halted on it today:

- **co-price** (0.22.1→0.25.0): the project copy carries the committed
  token-debt mitigation in `designLint` (scanRoots `["src"]`, tokenSources
  `["src/app/tokens.css"]`, allowlist 131 entries + `allowlist_reason`; the
  incident-time figure was 89 entries per T-20261028-016). Preserve → the
  delivered `platform_surfaces` never lands and the mirror-parity audit FAILs.
  Adopt → the allowlist and tokenSources are clobbered and the design-lint gate
  FAILs. Verbatim conflict diff: `/tmp/coprice-wss-conflict.diff` (310 lines).
- **co-architect** (0.23.0→0.25.0): same block class; the project copy carries a
  122-entry designLint allowlist against the template's empty one.

The engine's conflict skip is safe (nothing is lost) but it blocks the upgrades
entirely. Both projects stay halted until a merge-aware delivery exists.

## 2. Verified evidence

Every claim below was verified in source before this design relies on it.

- **The claim path** (scripts/lib/upgrade-policy.ts:555-561):
  `docs/workspace-schema.json` has no dedicated claim. `resolveClaim` falls
  through `underDir(rel, 'docs')` to `{ policy: 'SYNC', pass:
  TEMPLATE_TREE_SYNC_PASS }`.
- **The SYNC semantics** (scripts/upgrade-project.ts:4109-4157): hash-gated
  whole-content copy. `evolvedDeliveryGuard` (:2024, wired at :4122-4130)
  records CONFLICT (ERROR) and skips when the project evolved since the last
  delivery AND the template changed. Uncommitted local modifications take a
  CONFLICT (WARN) overwrite. There is no merge path for this file.
- **A JSON merge already exists but has the wrong semantics**
  (scripts/lib/upgrade-policy.ts:633-686, `mergeSettingsData`): template wins
  scalars, arrays are UNIONED, project-only keys preserved. Applied to
  workspace-schema it is wrong twice: array union would append the template's
  playground scanRoot to co-price's `["src"]` (the token lint would scan both),
  and template-wins scalars would clobber project-evolved leaf values.
- **The consumer set reads the schema file directly** — an override-only route
  cannot serve them: scripts/sync-agent-mirrors.ts:98-102 (`REGISTRY_BLOCK =
  'platform_surfaces'`, schema read at :255/:618); scripts/design-lint.ts:314-329
  (`loadDesignLintConfig` reads workspace-schema ONLY — no variant.json
  override, no `tokenSources` in any override shape); scripts/route-audit-scan.ts,
  scripts/sync-model-registry.ts, scripts/validate-model-registry.ts,
  scripts/validate-templates.ts (41 references).
- **The existing override is partial** (scripts/audit.ts:1773-1858,
  U-20261028-014): audit.ts `checkDesignLint` honors a variant.json `designLint`
  block with shape `{enabled (required), scanRoots?, allowlist?}` — whole-block
  replacement, no `tokenSources`. `scripts/design-lint.ts` does NOT honor it.
- **Verified current state** (2026-10-31, on disk):
  templates/common/docs/workspace-schema.json = v1.7.0, top-level keys
  `$schema, version, description, workflow, models, variant_lifecycle, _notes,
  i18n, country_scoped_assets, variant_scoped_skills, rootAllowlist,
  variant_extensions, designLint, routeAudit, platform_surfaces`;
  designLint = `{enabled, scanRoots: ["templates/co-design/playground/src"],
  allowlist: [], description}`. Projects/co-price/docs/workspace-schema.json =
  v1.6.0, designLint carries 6 keys (enabled, scanRoots ["src"], tokenSources
  ["src/app/tokens.css"], allowlist 131 entries, allowlist_reason, description);
  no routeAudit, no platform_surfaces.
  Projects/co-architect/docs/workspace-schema.json = v1.7.0-shaped copy with a
  122-entry allowlist.

## 3. Decision 1 — vehicle: a dedicated SCHEMA_MERGE delivery policy

**Chosen**: a new policy `SCHEMA_MERGE` claimed by exactly
`docs/workspace-schema.json`, implemented as a pure deep-merge helper
`mergeWorkspaceSchemaData(template, project)` in scripts/lib/upgrade-policy.ts
(beside `mergeSettingsData`), wired as a dedicated branch in the
TEMPLATE TREE SYNC pass of scripts/upgrade-project.ts, modeled on the existing
JSON_MERGE branch (:3965-3993).

**Rejected**:

- *Reuse `mergeSettingsJson` as-is*: array-union and template-wins-scalars
  semantics are wrong for this file (§2, third bullet).
- *Complete the variant.json override route (teach design-lint.ts the override,
  extend the shape with tokenSources, add overrides for platform_surfaces and
  routeAudit)*: rejected as the primary fix. It leaves the mirror-parity
  contract unsolved — sync-agent-mirrors.ts reads workspace-schema.json
  directly, so `platform_surfaces` must land in the project copy regardless.
  It multiplies override plumbing across six consumer scripts. And once the
  merge preserves `tokenSources` in the schema, the override-shape extension
  becomes unnecessary (recorded as a NOT-DOING item). The audit.ts override
  stays as-is: a per-project gate-behavior escape hatch on top of the delivered
  schema, not a delivery substitute.

## 4. Decision 2 — the merge algorithm

The merge is **block-aware, three-way over top-level keys, project-wins on
existing leaves**. No baseline-content comparison is needed; the algorithm is a
pure function of (template, project) and therefore idempotent.

For each top-level key `K` in `union(template, project)`:

1. **Template-owned class** — `K` absent from the project copy, plus the
   metadata scalars `$schema`, `version`, `description`: the template value
   lands verbatim. Template-ADDED blocks (`platform_surfaces`, `routeAudit`,
   and every future one) land through this rule.
2. **Project-owned class** — `K` present only in the project copy: preserved
   untouched (a project-experimental block is never pruned by delivery).
3. **Shared class** — `K` present on both sides: recursive leaf merge inside
   the block:
   - a key present in the project copy → the project value wins (motivating
     instance: every `designLint` leaf — scanRoots, tokenSources, allowlist,
     allowlist_reason, description, enabled);
   - a key present only in the template → the template value lands (a template
     addition inside an existing block still reaches evolved projects);
   - a key present only in the project → the project value is preserved;
   - **arrays are atomic**: a project-present array wins wholesale. No union —
     template and project arrays are alternative choices (scanRoots, allowlist),
     not additive sets. This is the deliberate divergence from
     `mergeSettingsData`'s settings semantics.
   - nested objects recurse; scalars compare by value.

**Visibility of withheld template changes (TEMPLATE_DELTA rows)**: for every
shared-class leaf whose final value differs from the template value, the engine
logs one `TEMPLATE_DELTA` row naming the dotted path and both values, at WARN
severity when the template value is a scalar the template reshaped
(`designLint.scanRoots`, `designLint.allowlist` in the co-price case), INFO
otherwise. The upgrade stays green; the decision log owns visibility of what
did not land.

**Escape hatch**: `--disposition adopt-template=docs/workspace-schema.json`
(the existing disposition mechanism) takes the template file wholesale. The
clobber is explicit and lands in the decision log. This covers the
"template reshape should propagate to a project that never customized the
block" case without speculative per-leaf baseline tracking.

**Serialization**: key order follows the project copy; template-added top-level
keys append in template order; 2-space indent; trailing newline (the
`mergeSettingsJson` output convention). Key order is not semantic in JSON; the
per-run hash comparison is against the merged output, so ordering never
re-triggers churn.

**Idempotency**: `merge(merge(T, P), T)` deep-equals `merge(T, P)` — rule 3 is
a pure function of the two trees, rules 1-2 are set-stable. A re-run with an
unchanged template and unchanged project produces byte-identical output and
logs `OK (schema merge — in sync)`.

**Baseline re-record rule**: no new mechanism. The delivery manifest hashes the
bytes on disk after the write (scripts/upgrade-project.ts:5118-5120), so the
post-merge content becomes the new delivered baseline. The next upgrade run
classifies subsequent project edits against the merged baseline.

**Guard changes on this path**: the content-level `evolvedDeliveryGuard`
CONFLICT (ERROR) is bypassed for SCHEMA_MERGE — committed project evolution is
exactly what the merge absorbs. The uncommitted-local-modifications CONFLICT
(WARN) guard stays: the pre-upgrade stash covers rollback, per house semantics.
Malformed JSON on either side hard-SKIPs with an explicit error (no silent
fallback), matching the JSON_MERGE branch's catch.

**Dry-run parity**: both sides are read from disk; nothing is written on the
dry-run path. The dry-run logs the MERGE verdict with the landed, preserved,
and TEMPLATE_DELTA lists — it predicts the merge outcome exactly.

## 5. Validation plan

New unit file `tests/unit/workspace-schema-merge.test.ts` (bun test):

1. **co-price real shape**: project v1.6.0 designLint (fixture carries the
   131-entry allowlist, tokenSources, allowlist_reason) + template v1.7.0 →
   assert `version === "1.7.0"`, `platform_surfaces` and `routeAudit` landed
   deep-equal to the template, `designLint` deep-equals the project block, and
   TEMPLATE_DELTA names `designLint.scanRoots`, `designLint.allowlist`,
   `designLint.description`.
2. **co-architect shape**: 122-entry allowlist preserved; metadata updated.
3. **Template-adds-only**: project copy equal to the prior template → merged
   equals the new template (no TEMPLATE_DELTA, nothing preserved).
4. **Project-adds-only**: a project-only top-level block survives verbatim.
5. **Shared-block template-only key lands**: a template-added key inside a
   block the project already carries reaches the merged output.
6. **Idempotency**: double merge is a fixed point.
7. **Malformed JSON** on either side → explicit error, no output written.
8. **Serialization**: stable key order, 2-space indent, trailing newline;
   merge output is valid JSON.

Engine-level: the SCHEMA_MERGE branch records the MERGE verdict with
landed/preserved/TEMPLATE_DELTA lists; dry-run verdicts match apply (the
decision-log test family covers the logging contract).

Post-delivery gate: `bun scripts/audit.ts` green in each upgraded project —
the design-lint gate reads the merged schema (co-price allowlist preserved →
gate passes) and the sync-agent-mirrors parity guard reads the landed
`platform_surfaces` block (coverage guard passes).

## 6. Rollout

1. **L0 implementation** (automation-engineer): helper + policy union member +
   `isDeliveryPolicy` + explicit claim in `resolveClaim` (before the
   `underDir(rel, 'docs')` fall-through) + upgrade-project.ts SCHEMA_MERGE
   branch + tests. Gates: `bun test`, `bun scripts/audit.ts`,
   `bun scripts/validate-templates.ts`.
2. **Registration**: this spec registered `approved` (done at design time);
   registry flips to `implemented` when the PR lands.
3. **L0→L1 publish** via the `/sync` pipeline: the delivered copies
   templates/common/scripts/lib/upgrade-policy.ts and
   templates/common/scripts/upgrade-project.ts receive the change
   (content-gated, version bump).
4. **Re-run the halted upgrades**: co-price 0.22.1→0.25.0 and co-architect
   0.23.0→0.25.0. Dry-run first (MERGE verdict prediction is read from the
   decision log), then apply. Post-delivery `bun scripts/audit.ts` green in
   each project.
5. **Close the halt**: record both upgrade outcomes in the wave run; T-20261028-016
   item 3 (conflict-check consideration) closes as implemented-by-merge.
   L3 delivery to the remaining 14 projects happens through their normal
   upgrade visits — never hand-edit.

## 7. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — the change touches engine scripts only; no `.claude/` surface, no agent definition, no slash command | N/A |
| Antigravity (GEMINI.md) | None — justified: upgrade-project.ts / upgrade-policy.ts are platform-neutral delivery-engine files; GEMINI.md and `.gemini/` surfaces are not read, written, or re-mergened by this design | N/A |
| templates/common | Propagation required — both engine files have delivered L1 copies that publish through the sync pipeline (§6 step 3) | templates/common/scripts/upgrade-project.ts, templates/common/scripts/lib/upgrade-policy.ts |

## 8. Acceptance criteria

- [ ] `docs/workspace-schema.json` resolves to `{ policy: 'SCHEMA_MERGE', pass: TEMPLATE_TREE_SYNC_PASS }` in `resolveClaim`.
- [ ] `mergeWorkspaceSchemaData` implements the three block classes and atomic arrays (§4); arrays never union on this path.
- [ ] co-price merge fixture: designLint preserved byte-value-identical (all 6 keys), `platform_surfaces` + `routeAudit` landed, `version` updated.
- [ ] co-architect merge fixture: 122-entry allowlist preserved.
- [ ] Idempotency test passes (double merge is a fixed point).
- [ ] TEMPLATE_DELTA rows appear in the decision log for every withheld template change.
- [ ] `--disposition adopt-template=docs/workspace-schema.json` forces wholesale adoption through the existing disposition path.
- [ ] Dry-run MERGE verdict matches the apply outcome on the same inputs.
- [ ] Malformed JSON on either side hard-SKIPs with an explicit message.
- [ ] `bun test`, `bun scripts/audit.ts`, `bun scripts/validate-templates.ts` green at L0 before publish.
- [ ] co-price and co-architect upgrades re-run to completion with post-delivery audits green.
- [ ] ADR-0098 §2 conformance: this document uses one action per sentence, active voice, present tense.

## 9. NOT-DOING (recorded with rationale)

- Extending `validateDesignLintOverride` with `tokenSources`: unnecessary once
  the merge preserves `tokenSources` in the delivered schema; the audit.ts
  override remains the per-project gate escape hatch in its current shape.
- Per-leaf two-sided-edit detection against baseline content: the baseline
  stores `{hash, templateVersion}` only (scripts/upgrade-project.ts:214, :1974);
  storing baseline content per file per project for one file's edge case is not
  justified while TEMPLATE_DELTA rows + the adopt-template escape hatch give
  the operator visibility and a lever.
- Teaching `loadDesignLintConfig` (design-lint.ts) the variant.json override:
  rejected with Decision 1; revisit only if a project legitimately needs gate
  config that differs from its delivered schema AND cannot use the override in
  audit.ts's gate scope.
