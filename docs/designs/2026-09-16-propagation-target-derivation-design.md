---
schemaVersion: 1.0.0
spec-id: propagation-target-derivation
---

# Propagation Target Derivation — 2026-09-16

## 1. Overview

Lands ticket T-20260915-005 (M8) from the 2026-09-15 template-fleet
review: the propagation target lists are hand-maintained and silently
miss the next new variant. A new standing validator check (**PM-03**,
`propagation-targets`) in `scripts/validate-templates.ts` enforces, at
Error severity, that

- every variant-scoped `target_variants` list in
  `scripts/propagation-map.json` is exactly the actual
  `templates/co-*` directory set (modulo declared exclusions), and
- `docs/templates/common.lifecycle.json` `propagatedTo` is exactly the
  actual `templates/co-*` directory set.

Registering a new variant can then no longer forget these lists: the
validator fails with a fix hint naming the exact JSON pointer to edit.

## 2. Problem

1. **M8 — registration requires ~7 manual edits; the propagation lists
   silently miss the next new variant (T-20260915-005)**.
   `scripts/propagation-map.json` marker-inject domains
   (`governance-agents`, `variant-context`) enumerate all 13 `co-*`
   variants in `target_variants`, and
   `docs/templates/common.lifecycle.json` enumerates them again in
   `propagatedTo`. Nothing ties these lists to the actual
   `templates/` directory set. When the 14th variant is scaffolded, a
   forgotten listing means publishDocs() never injects the
   COMMON-AGENTS / COMMON-CONTEXT zones into it and the lifecycle
   record under-reports propagation — a silent propagation break of
   exactly the class PM-02 (T-20260910-018) fixed for zone-vs-listing
   drift, now applied to listing-vs-directory-set drift.

## 3. The equality rule and the exclusion mechanism

### 3.1 Derived variant directory set

`deriveCoVariantDirs(templatesDir)` (pure helper,
`scripts/lib/propagation-map-schema.ts`) returns the sorted set of
immediate subdirectories of `templates/` whose name starts with
`co-`. This is the single derivation every comparison consumes — the
validator passes the real `templates/` dir; unit tests pass synthetic
trees.

### 3.2 Structural target-shape classification (no name-based special cases)

A marker-inject domain is classified by the shape of its target
filename, not by its name:

- **variant-scoped** — the domain writes one file *per variant*:
  `target_file` is absent (publishDocs() then defaults to
  `basename(source_file)`, e.g. `AGENTS.md` for `governance-agents`)
  or contains the `{variant}` placeholder (e.g.
  `docs/{variant}.context.md` for `variant-context`). The natural
  target universe is by construction the `co-*` template dir set.
- **fixed-target** — `target_file` is present and carries no
  `{variant}` placeholder (e.g. `docs/context.md` for
  `constitution-context`). The domain writes the same relative file
  inside whichever template directories it explicitly declares. No
  `co-*` equality is imposed; the rule is: every declared target must
  be an existing template directory (`templates/<name>/`, `co-*` or
  `common`) and must carry the resolved target file
  (`templates/<name>/<target_file>`). `constitution-context`
  targeting `['common']` satisfies this structurally because
  `templates/common/docs/context.md` exists — a future fixed-target
  domain or an added fixed target is validated by the same rule
  without new code.

`markerInjectTargetScope(domain)` is the exported classifier.

### 3.3 Exclusion mechanism: `exclude_variants`

For variant-scoped domains the enforced invariant is
**`target_variants` ⊎ `exclude_variants` ≡ `co-*` dir set, disjoint**:

| Violation | Severity | Fix hint points at |
|-----------|----------|--------------------|
| `target_variants` entry that is not a real `co-*` dir (stale listing) | Error | `domains.<name>.target_variants` — remove the entry |
| `co-*` dir in neither `target_variants` nor `exclude_variants` (missed registration) | Error | `domains.<name>.target_variants` — add the dir, or declare it in `domains.<name>.exclude_variants` |
| `exclude_variants` entry that is not a real `co-*` dir (typo) | Error | `domains.<name>.exclude_variants` |
| dir listed in both arrays | Error | `domains.<name>.exclude_variants` |
| duplicate entries within one array | Error | the offending array |

`exclude_variants` is an **optional** per-domain field on the
marker-inject schema. It documents a *deliberate non-target* — a
variant that must not receive this domain's injection — so the
equality check can stay total (every dir accounted for) without
forcing every domain to spray every variant. It is distinct from the
existing PM-02 `excluded_variants` field, which marks variants that
*carry an adjudicated divergent copy* of the zone (they have a zone;
excluded variants must have none).

Current repo data is verified consistent: `governance-agents` and
`variant-context` list all 13 `co-*` dirs; both gain an explicit empty
`exclude_variants: []` so the contract is visible at the data site
(field is optional; the schema does not require it).

### 3.4 `propagatedTo` ≡ variant dirs

`docs/templates/common.lifecycle.json` `propagatedTo` must equal the
derived `co-*` set in both directions (stale entry → Error; missed
variant → Error), fix hint naming the `propagatedTo` array. The file
is L0-only: no propagation-map domain manages it and no L1 mirror
exists (`templates/common/docs/templates/` does not exist), so there
is no second copy to keep in sync. Error check id:
`common-lifecycle-propagatedto`.

## 4. Check home and schema SSOT

- The check is **PM-03 (`propagation-targets`)** in
  `scripts/validate-templates.ts`, placed after
  `checkMarkerZoneParity()` (PM-02) and reusing PM-01/PM-02's
  file-loading pattern (parse `scripts/propagation-map.json`, skip
  with an existing report on missing/invalid JSON). Severity: Error —
  registration drift silently breaks propagation for the missed
  variant.
- The **schema SSOT for propagation-map.json is
  `scripts/lib/propagation-map-schema.ts`** (`validatePropagationMap`
  — no JSON Schema file exists; `docs/workspace-schema.json` only
  lists the filename in an ignore list). It gains the
  `exclude_variants?: string[]` interface field, type validation
  (optional array of strings), and the three exported pure helpers
  (`deriveCoVariantDirs`, `markerInjectTargetScope`,
  `auditVariantScopedTargets`) so unit tests exercise the full
  decision logic without running the validator.

## 5. Version bumps (minor — new functionality)

| File | Version | Surfaces |
|------|---------|----------|
| `scripts/validate-templates.ts` | 1.30.0 → 1.31.0 | `@version` + header changelog; L0 + L1 SCRIPTS.md rows |
| `scripts/lib/propagation-map-schema.ts` | 1.2.0 → 1.3.0 | `@version`; L0 + L1 SCRIPTS.md rows (scripts-lib domain propagates it) |
| `scripts/propagation-map.json` | 1.9.0 → 1.10.0 | `version` field; explicit `exclude_variants: []` on the two variant-scoped domains; L1 mirror refreshed by the propagator (self-propagation domain) |

`docs/templates/common.lifecycle.json` data is unchanged (the check
lands green against it), so its version/history stay untouched per the
file's own convention of recording data changes only. L0→L1
propagation runs via `bun scripts/propagate-to-templates.ts --apply`
before the sync-time spec-check gate.

## 6. Test plan

`tests/unit/propagation-target-derivation.test.ts` (new, modeled on
`tests/unit/scaffold-delivery-parity.test.ts`):

- `deriveCoVariantDirs` on a synthetic tree: sorted output, `common/`
  and non-`co-` dirs and files excluded.
- `markerInjectTargetScope`: absent `target_file` → variant-scoped;
  `{variant}` placeholder → variant-scoped; fixed relative
  `target_file` → fixed-target.
- `auditVariantScopedTargets`: clean 13-dir case; stale listing;
  **fake 14th variant** appears in `missingVariants` with the exact
  name (the M8 negative shape); typo'd exclusion; listed-and-excluded
  overlap; duplicate listing.
- `validatePropagationMap`: `exclude_variants` type errors
  (non-array, non-string element) surface as schema errors; absent
  field stays valid.
- Real-tree invariants: the actual `scripts/propagation-map.json` and
  `docs/templates/common.lifecycle.json` are consistent with the
  actual `templates/` dir set (pins today's green state).

## 7. Accessibility

Backend/CLI-only work (a validator check, a schema/helper module, JSON
data, and unit tests). No user-facing UI is produced. Exempt from
ADR-0065 WCAG scope; the WCAG 2.1 AA baseline does not apply.

## 8. Preview Verification

Non-UI work — no rendered surface exists to screenshot. Exempt from
ADR-0070 preview verification; verification is via the executed
validation battery (unit suite, validate-templates, typecheck, audit,
scripts suite, lifecycle-sync-audit, review-baseline).
