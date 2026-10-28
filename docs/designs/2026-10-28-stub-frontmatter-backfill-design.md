# Design: Stub Frontmatter Scalar Backfill in the Delivery Agents Pass

- **Spec ID**: `2026-10-28-stub-frontmatter-backfill-design`
- **Date**: 2026-10-28
- **Author**: automation-engineer (Design Gate Row 0, dispatched per T-20261028-010)
- **Tickets**: T-20261028-010 (kind: manual, priority: high)
- **Status**: implemented (this change set landed with the design — single-mechanical-fix batch)
- **NEW vs UPDATE**: new spec. Prior art it extends: `normalizeAgentTierFrontmatter`
  (lib/upgrade-policy v1.24.0, T-20261027-005) normalizes an EXISTING tier block but
  never adds a missing field; this design covers the complementary case (the field is
  absent entirely).

## 0. Conclusion

The validate-model-registry v2.1.0 missing-tier FAIL flip (T-20261027-003, landed in
template-v0.22.0) turned stale project extends-stubs red: co-price/co-export/co-security
`agents/pm.md` carried no `tier:` scalar because their frontmatter predates the field,
and no delivery pass ever adds a missing frontmatter key (delivery replaces frontmatter
wholesale; `normalizeAgentTierFrontmatter` only rewrites an existing block; the MERGE
pass never touches frontmatter beyond the tier block). The three stubs were hand-mirrored
during the v0.22.0 wave; this design makes the delivery pass do it mechanically.

Fix: in the upgrade `SYNC_IF_NEWER: agents/` pass, when a template extends-stub dead-ends
in the STUB skip path (MERGE_MANAGED files such as `agents/pm.md`, or stubs whose
`extends:` target does not resolve) and the PROJECT file at that rel is itself
stub-shaped, backfill the MISSING top-level scalar `tier` / `version` / `last_updated`
frontmatter keys from the template counterpart (last_updated = the delivery date), write
the stub back, and log one decision entry `STUB_FM_BACKFILL` (INFO). Bodies are never
touched — frontmatter scalars only (frontmatter ownership for stubs is template-side;
body stays project-owned, cf. U-20261028-001).

## 1. Context

### 1.1 Why a stub survives a run untouched

Project extends-stubs exist only where the delivery pass never delivers a body:

- `agents/pm.md` is MERGE_MANAGED (upgrade-policy `MERGE_MANAGED_FILES`) — the agents/
  pass STUB-skips it (`STUB_SKIP`, INFO) and the MERGE pass owns the body; the MERGE
  pass's only frontmatter write is the v1.75.0 tier-block normalizer, which by design
  never ADDS a missing `tier:` key.
- The v1.75.0 extends-target arm (non-MERGE_MANAGED stubs, e.g. the variant
  `i18n-specialist.md` stubs) either delivers the target's complete frontmatter
  (tier/version/last_updated present after delivery) or preserves the file under an
  explicit CONFLICT (ERROR) disposition. A stub-shaped file therefore never survives
  the extends-target arm with missing scalars — the STUB skip path is the only branch
  that leaves one untouched.

Verified against the fleet (2026-10-28, read-only scan): 12 stub-shaped project agent
files (11 `pm.md`, 1 project-local `docs-writer.md` in co-newbiz with no template
counterpart) — all currently carry all three scalars after the hand-mirror wave. The
fix is forward-looking: it removes the hand-mirror step from every future wave.

### 1.2 Field sources

| Field | Source when missing | Rationale |
|---|---|---|
| `tier` | the template stub's scalar `tier:` value (comment-stripped) | frontmatter ownership for stubs is template-side (ADR-0102) |
| `version` | the template stub's `version:` scalar, copied verbatim | the project stub's version lineage IS the variant stub's (scaffold provenance) |
| `last_updated` | the delivery date (`YYYY-MM-DD`) | matches the v1.74.0 post-delivery re-stamp convention; the stub's date records when its frontmatter was last refreshed, not the template's authoring date |

### 1.3 Scope guards

- The project file must itself be stub-shaped (`isExtendsStub` — a column-0 `extends:`
  inside the frontmatter). Resolved agent bodies are never touched by this step: their
  frontmatter is delivered wholesale by the version-gated passes, and the v1.24.0
  normalizer contract ("never invent structure") stays intact for them.
- MISSING = the top-level (column-0) key is absent from the project stub frontmatter.
  An empty-value `tier:` key stays out of scope (the v1.24.0 normalizer treats it as
  "never invent structure"; no real stub carries that shape). Nested keys (the
  `lifecycle:` block's `last_updated:`) are never touched — top-level anchors only,
  same scope as `bumpFrontmatterLastUpdated` (helpers/upgrade-versions v1.1.0).
- Fields already present are left byte-identical (idempotent; deliberate divergence —
  e.g. a project stub pinning an older version — is NOT overwritten; only absence is
  repaired).
- CRLF-preserving, exactly like the v1.24.0 normalizer.

## 2. Problem statement

1. The model-registry validator FAILs any delivered-context agent whose frontmatter
   lacks a scalar `tier` — including stub-shaped `pm.md` files that predate the field.
2. No delivery pass repairs absence: the MERGE pass normalizes existing tier blocks
   only; the agents/ pass STUB-skips MERGE_MANAGED files; the extends-target arm
   delivers complete frontmatter only when a body delivery actually fires.
3. Absence is therefore repaired by hand per wave — exactly the class of mechanical
   work the delivery pass should own (T-20261028-010).

## 3. Decision record

| # | Decision | Rationale |
|---|---|---|
| D1 | **Pure helper `backfillStubFrontmatter(projectContent, templateContent, deliveryDate)` in lib/upgrade-policy.ts** returning `{ content, changed, filled }`. Guards: project content must be stub-shaped (`extends:` in frontmatter); template content must carry frontmatter. Fill = append the missing column-0 keys at the END of the frontmatter body (YAML mapping — key order is insignificant; append keeps the diff minimal and never reorders existing keys). `last_updated` is filled with `deliveryDate` (validated `^\d{4}-\d{2}-\d{2}$`; an invalid date string means nothing is filled for that key). CRLF detected from the frontmatter block and preserved. | The parse/fill split follows the established lib boundary (v1.24.0 normalizer precedent): pure, idempotent, unit-testable; upgrade-project.ts (L0-only) stays the wiring site. |
| D2 | **Wiring site: the STUB skip branch only.** In the agents/ pass, after the `STUB_SKIP` decision is recorded (the branch that never delivers a body), read the project file; when it exists, is stub-shaped, and the helper reports `changed`, write the backfilled content (apply mode; dry-run classifies + logs without writing), `noteDelivered(rel)` (the TIER NORMALIZED precedent — a normalization write counts as a delivered path), and log the console line + decision `{path, pass: 'AGENTS'/'SYNC_IF_NEWER: agents/', verdict: 'STUB_FM_BACKFILL', severity: INFO, detail: fields filled + source}`. | The extends-target arm's every untouched branch either replaces frontmatter wholesale (fields present afterward) or preserves the file under an explicit CONFLICT disposition (mutating it there would bypass the disposition machinery). Firing the helper before the version gates would also change classification semantics (a missing-version stub currently delivers as UPDATE). The STUB skip branch is the one place a stub-shaped file survives untouched with absence intact — the exact shape T-20261028-010 names. |
| D3 | **Decision verdict `STUB_FM_BACKFILL` (INFO)** joins `DecisionVerdict` + `DECISION_SEVERITY_CONTRACT`. One name covers the whole field set (tier/version/last_updated are backfilled as one write, one row) — a per-field verdict family would multiply rows for a single mechanical repair. The pass label follows the agents/ pass convention: `pass: 'SYNC_IF_NEWER: agents/'`, policy `'SYNC'`. The ticket's shorthand "AGENTS pass" maps to that label; the detail string names the fields and their sources (template counterpart / delivery date). | INFO = expected mechanics (design §7 severity semantics); one row per touched file keeps the manifest readable. |
| D4 | **No body byte changes.** The helper rebuilds ONLY the frontmatter block span (the same `frontmatterBody` slice-and-splice shape as v1.24.0); body bytes are asserted unchanged in unit tests (including the byte-identical case when all fields are present). | Ticket constraint: "frontmatter ownership for stubs is template-side; body stays project-owned, cf. U-20261028-001". |
| D5 | **Registry/lifecycle bookkeeping.** upgrade-project.ts 1.79.0 → 1.80.0; lib/upgrade-policy.ts 1.27.0 → 1.28.0; L1 twin republished via propagate-to-templates (`--apply`), `verify-scripts --check-drift` green; SCRIPTS.md rows (root + L1) updated; `docs/lifecycle/scripts/upgrade-project.md` metadata + phase-history row; `tests/unit/upgrade-decision-log.test.ts` extended (v1.1.0 → 1.2.0). | Standard change set for an L0+L1 script pair (2026-10-28-dev-sync-staged-count-design D5 precedent). |

## 4. Mechanism

### 4.1 Helper contract (lib/upgrade-policy.ts)

```ts
export interface StubFrontmatterBackfill {
  /** Project content after the backfill (identical to the input when nothing changed). */
  content: string;
  /** True when at least one missing scalar was filled. */
  changed: boolean;
  /** The filled top-level keys, in fill order (subset of tier/version/last_updated). */
  filled: string[];
}

export function backfillStubFrontmatter(
  projectContent: string,
  templateContent: string,
  deliveryDate: string,
): StubFrontmatterBackfill
```

Rules (in order):

1. Project frontmatter must exist AND carry a column-0 `extends:` key (stub-shaped) —
   otherwise return unchanged. This is the helper-level guard that makes "non-stub
   agents never hit this path" hold even if a future caller mis-wires it.
2. Template counterpart frontmatter must exist — otherwise unchanged.
3. For `tier`: absent column-0 `tier:` in the project FM AND a scalar `tier:` in the
   template FM → fill the comment-stripped template scalar.
4. For `version`: absent column-0 `version:` in the project FM AND any `version:`
   scalar in the template FM → fill the verbatim trimmed scalar (quotes preserved).
5. For `last_updated`: absent column-0 `last_updated:` in the project FM AND
   `deliveryDate` matches `^\d{4}-\d{2}-\d{2}$` → fill `last_updated: <deliveryDate>`.
6. Fill order: tier, version, last_updated; keys append at the end of the FM body;
   EOL style detected from the block.

### 4.2 Engine wiring (upgrade-project.ts, STUB skip branch)

After the existing `STUB_SKIP` `recordDecision` and before `continue`:

```
projRaw = readFileSync(projFile) when it exists
backfill = backfillStubFrontmatter(projRaw, rawTpl, deliveryDate)
if (backfill.changed):
  console.log `  ${dryTag}STUB FM BACKFILL: ${rel} — filled ${filled.join(', ')} (template counterpart; frontmatter only, body untouched)`
  if (!dryRun) writeFileSync(projFile, backfill.content); noteDelivered(rel)
  recordDecision(rel, 'SYNC', 'SYNC_IF_NEWER: agents/', 'STUB_FM_BACKFILL',
    `backfilled missing stub frontmatter scalar(s) ${filled.join(', ')} from the template counterpart (last_updated = delivery date) — frontmatter only, body untouched`)
```

Files whose frontmatter already carries all three fields: helper returns unchanged →
no write, no decision row, byte-identical file (the current fleet state — the 12
stub-shaped files all carry the fields post-hand-mirror).

## 5. Rollout and validation

| Layer | Change |
|---|---|
| L0 code | `scripts/lib/upgrade-policy.ts` 1.28.0 (`backfillStubFrontmatter` + `STUB_FM_BACKFILL` contract row); `scripts/upgrade-project.ts` 1.80.0 (STUB-skip wiring) |
| Tests | `tests/unit/upgrade-decision-log.test.ts` 1.2.0 — helper cases (all-three-missing → all filled + row shape; all-present → byte-identical; non-stub → unchanged; body bytes unchanged in every case; CRLF preserved; last_updated = delivery date not the counterpart's) + engine case (temp project stub `agents/pm.md` without tier gets `tier: medium` from the co-develop/common counterpart, INFO row in the manifest) |
| L1 mirror | `templates/common/scripts/lib/upgrade-policy.ts` + `templates/common/scripts/upgrade-project.ts` republished (propagate-to-templates --apply); SCRIPTS.md rows both mirrors |
| Lifecycle | `docs/lifecycle/scripts/upgrade-project.md` metadata + phase-history row |

## 6. Acceptance criteria

- [ ] A temp-fixture project stub `agents/pm.md` without `tier`/`version`/`last_updated`
      ends the run with all three filled (tier/version from the template counterpart,
      last_updated = delivery date), an `STUB_FM_BACKFILL` INFO decision row in the
      manifest, and body bytes unchanged. (In-test only — `Projects/` is never touched.)
- [ ] A stub whose frontmatter already carries all three fields is byte-identical after
      the run (no write, no decision row).
- [ ] A resolved (non-stub) agent body missing tier is NOT backfilled by this step.
- [ ] CRLF stub fixtures keep CRLF endings.
- [ ] `bun scripts/audit.ts`, `bun scripts/validate-templates.ts`,
      `bun scripts/verify-scripts.ts --verify`, `bun test` all green.
- [ ] L1 twin drift check green; SCRIPTS.md rows agree with script headers.

## 7. Consequences

- **Positive**: the model-registry missing-tier FAIL class for stale stubs self-heals on
  the next upgrade; the v0.22.0 hand-mirror step is retired mechanically; the decision
  log makes every backfill visible (INFO) with its provenance.
- **Costs/risks**: one extra frontmatter parse per template stub candidate per run —
  negligible. The fill is append-only and never rewrites existing keys, so deliberate
  project divergence (a pinned older version) is safe. Risk of scope creep into resolved
  bodies is closed by the helper-level `extends:` guard (D4/D1).
- **Explicitly out of scope**: backfilling resolved agent bodies (v1.24.0 contract
  unchanged); the extends-target arm's CONFLICT-skip paths (disposition machinery
  governs those); repairing empty-value `tier:` keys; the project-local co-newbiz
  `docs-writer.md` stub (no template counterpart exists — nothing to source from).

## 8. References

- Ticket: `tickets/governance/T-20261028-010.yaml`
- Upstream: U-20261028-001 (frontmatter ownership for stubs is template-side;
  body stays project-owned)
- Prior art: lib/upgrade-policy v1.24.0 `normalizeAgentTierFrontmatter` (existing-block
  normalizer); helpers/upgrade-versions v1.1.0 `bumpFrontmatterLastUpdated` (top-level
  anchor + delivery-date conventions); v1.75.0 extends-target pass (T-20261027-005)
- Validator: `scripts/validate-model-registry.ts` v2.1.0 missing-tier FAIL
  (T-20261027-003, template-v0.22.0)
- Engine branch under change: `scripts/upgrade-project.ts` STUB skip path
  (`isExtendsStub(rawTpl)` → `STUB_SKIP` branch of `SYNC_IF_NEWER: agents/`)
