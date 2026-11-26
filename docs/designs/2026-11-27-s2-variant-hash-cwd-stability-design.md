# Design: S2 variant-hash standalone-checkout stability (delivery wave 3 hotfix)

- **Spec ID**: 2026-11-27-s2-variant-hash-cwd-stability-design
- **Date**: 2026-11-27
- **Status**: implemented
- **Owner**: automation-engineer
- **Related**: docs/designs/2026-11-26-skill-drift-structural-fixes-design.md (§4.2 S2, the change this repairs); T-20261123-005 (convergence closes this wave); co-abap PR #256 (observed failure), co-safety PR #242 (green confirmation)

## 1. Problem

The machinery batch (#2189, 2026-11-26) introduced S2 variant-token hash
compensation: `contentHash(content, variantName)` in
`scripts/lib/skill-graph-compat.ts` v1.2.0 reverse-substitutes the rendered
variant slug so a scaffold-rendered project copy hashes equal to its template
source. `VARIANT_NAME` was derived in `scripts/generate-skill-graph.ts` v2.1.0
as:

```ts
const VARIANT_NAME = isFleetProjectPath(ROOT, ROOT_TWO_UP) ? basename(ROOT) : undefined;
```

`isFleetProjectPath` requires the checkout to sit exactly at
`<workspace-root>/Projects/<name>` and reads
`<workspace-root>/docs/fleet-membership.json`. A standalone checkout of a fleet
project (every CI clone: hosted runners check out two levels deep, with no
`Projects/` layout and no membership file up-tree) derives `undefined` — no
compensation — while the committed `docs/skill-graph.json` was generated inside
a workspace checkout WITH compensation.

Consequence: `verify-skill-graph.ts` (same derivation, imported
`buildGraphWithReport`) failed on CI for every file whose body carries the
rendered backtick slug. Observed on co-abap PR #256: exactly 3 nodes
(`agent:root/read-only-analyst`, `skill:root/abap-code-review`,
`skill:root/abap-dev` — the only slug-bearing files: 2/3/4 slug occurrences)
reported as BOTH missing and extra, because `compareGraphs` treats a same-id
node with a differing `identityAttrs` (which includes `content_hash`) as
missing + extra (verify-skill-graph.ts:272-285). Documentation Audit = FAIL;
public-repo merge gate blocked.

Pre-S2 this could not happen: the hash had no variant parameter and was
environment-independent. This is an S2 regression, not a pre-existing quirk.

## 2. Change

`scripts/generate-skill-graph.ts` v2.2.0 (byte-identical twin
`templates/common/scripts/generate-skill-graph.ts`): derivation moved into an
exported pure helper; a fleet project is identified by its OWN `variant.json`,
which travels with the checkout:

```ts
export function resolveVariantName(root, rootTwoUp = resolve(root, "..", "..")) {
  if (existsSync(join(root, "variant.json"))) return basename(root);
  return isFleetProjectPath(root, rootTwoUp) ? basename(root) : undefined;
}
```

- Standalone project checkout (variant.json present): compensated — CI now
  derives the same hashes the committed graph carries.
- Nested `Projects/<name>` (membership present): unchanged (fallback arm).
- Workspace root / templates/common (no variant.json): `undefined` — the
  no-op arm, byte-identical to pre-fix behavior at those scopes (verified:
  root graph regeneration produces no diff).

Comment text deliberately avoids machine-local absolute path shapes
(`/home/<user>/`, `/Users/<user>/`) — co-develop's variant audit hook
(`scripts/audit-variant.ts` MACHINE_PATH_RE) fails tracked files carrying such
strings (observed on the first landing attempt; co-develop PR #220 and co-game
PR #80 landed only after the reword).

## 3. Acceptance / evidence

- `tests/unit/variant-name-cwd-stability.test.ts`: CI-shaped standalone tree
  (two levels deep, no membership up-tree) derives the variant name from its
  own variant.json; nested + membership derives the same; workspace root
  derives undefined; both shapes yield ONE name for the same project tree.
- Control: old generator in a CI-shaped standalone clone of co-abap @ PR #256
  head → verify exit 1; fixed generator → exit 0.
- Real CI: co-abap #256 Documentation Audit FAIL (run 45843192568) → PASS
  (run 45845710586) after the fix commit; co-safety #242 PASS first try.
- Fleet: the wave delivered the fixed generator to all 14 in-scope projects;
  12 merged within the wave cap.

## 4. Non-goals

- No change to `normalizeForHash`/`contentHash` semantics (skill-graph-compat
  v1.2.0 stays as designed); the defect was confined to the caller-side
  variant-name derivation.
- co-abap (#256) and co-price (#190) merged carrying the first-comment-text
  variant of v2.2.0 (functional byte-equality, comment-only delta vs the twin);
  S1 `SYNC_TEMPLATE_ADVANCE` delivers the reworded bytes on the next wave.
