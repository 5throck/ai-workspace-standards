# Owner-Decision Batch — 2026-10-29 (U-20261028-014 / -016 / -022)

- **Status**: implemented
- **Date**: 2026-10-29
- **Owner**: automation-engineer + docs-writer (PM Gateway dispatch)
- **Tickets**: U-20261028-014 (co-abap, designLint per-variant override),
  U-20261028-016 (co-safety, workflow run-record schema + validation),
  U-20261028-022 (co-safety, promotion-checklist snapshot semantics)
- **Tier**: L0 workspace root + L1 (templates/common) + L2 (templates/co-safety)
- **Precedent**: docs/designs/2026-10-29-upstream-adjudication-mechanical-batch-design.md
  (one batch design doc, registered implemented after gates pass)

## 1. Context

Three owner-decision tickets from the 2026-10-28 upstream adjudication kept
their recommended defaults and need implementation rather than mechanical
repair: one mechanism (a per-variant designLint override), one missing spec +
validator arm (Safety OS workflow run records), and one semantics declaration +
one-time sync + durable cross-check (promotion checklist vs variant.json).
This doc is the Design Gate artifact for the batch; every item records the
verified evidence and the fix shape applied.

## 2. U-20261028-014 — designLint per-variant override (co-abap)

**Evidence** (verified): `docs/workspace-schema.json` `designLint` block ships
`scanRoots: ["templates/co-design/playground/src"]` (workspace-root path); the
delivered L1 copy `templates/common/docs/workspace-schema.json` carries the
same value. `scripts/audit.ts` `checkDesignLint()` (:1759-1812, v2.56.0+)
reads only that schema block (and a no-schema conventional default for L3
projects) via the pure helper `helpers/design-lint-roots.ts` v1.0.0 — a variant
cannot point the gate at its own UI sources or disable it per project. The
engine, `scripts/design-lint.ts` v2.4.0, likewise loads config exclusively
from `docs/workspace-schema.json` (`loadDesignLintConfig`, :305-320) and has no
allowlist CLI surface, so even a gate-level override could not carry literal
exemptions. `scripts/validate-templates.ts` Check 2 validates variant.json
required fields/lifecycle/country_config but has no `designLint` shape check.

**Fix shape**:
1. `helpers/design-lint-roots.ts` v1.0.0 → 1.1.0: new exported pure
   `validateDesignLintOverride(raw)` — when a project's `variant.json` carries
   a `designLint` block it must be `{ enabled: boolean (required),
   scanRoots?: string[], allowlist?: string[] }`; anything else returns a
   named error. Unit-pinned in `tests/unit/design-lint-roots.test.ts`.
2. `audit.ts` `checkDesignLint()` (v2.59.0 → 2.60.0): when the checkout's
   `variant.json` has a `designLint` block, it REPLACES the schema block as
   the gate's effective config (order: variant.json > workspace-schema;
   whole-block override — `enabled` is required so there is no partial-merge
   ambiguity). Invalid shape → Fail naming the violation (an explicit wrong
   config must not silently fall back). `enabled: false` → explicit Skip
   naming variant.json as the source. `enabled: true` → roots resolve from the
   override's scanRoots through the existing `resolveDesignLintRoots`
   (conventional fallback and the both-root-sets skip message unchanged);
   override `allowlist` entries are forwarded to the engine (see 3). A
   malformed `variant.json` itself does NOT fail this gate (other gates own
   that failure) — the gate falls back to schema behavior.
3. `scripts/design-lint.ts` v2.4.0 → 2.5.0: new repeatable `--allow <literal>`
   flag merged into the loaded config's allowlist. This is what makes the
   override's allowlist real: audit.ts spawns the engine with
   `--dir <root>` per scan root and `--allow <entry>` per override allowlist
   entry, so a project-level literal exemption works in L3 checkouts that have
   no `docs/workspace-schema.json` at all. Standalone `design-lint.ts` runs
   (no flags) are unchanged.
4. `scripts/validate-templates.ts` (v1.64.0 → 1.65.0), Check 2: when a
   template's `variant.json` declares `designLint`, the block must pass the
   same shape rule (`variant-designlint` finding otherwise). Shape parity
   between the validator and the gate comes from the shared helper's rule,
   restated inline (validate-templates does not import audit helpers).
5. Docs: short "Design-lint configuration (designLint)" subsection in
   `templates/common/docs/context.md` near the verification bullet that
   already cites the gate (:157) — the override order, the shape, and the
   engine passthrough. Both `docs/workspace-schema.json` and the L1 mirror get
   one sentence added to `designLint.description` naming the override order
   (the docs domain is disabled per ADR-0069, so the L1 copy is hand-maintained).

**Owner-decision note (co-abap adoption)**: whether co-abap adopts the gate is
the variant's own call. With the override, SKIP is explicit and harmless
(the v2.51.1/v2.56.0 naming work guarantees the skip always says why); the
mechanism only unblocks variants that WANT the gate — it does not push it.

## 3. U-20261028-016 — co-safety workflow run-record schema + validation

**Evidence** (verified): `templates/co-safety/agents/safety-workflow-manager.md`
mandates completion records at :69 (harness step 5: "Write workflow completion
record to `memory/workflows/YYYY-MM-DD-<workflow-id>.md`"), :76 (Write tool
scoped to `memory/workflows/`), :108 (Output Format "## Workflow Record" cites
the same path), :126 (constraint: records only to `memory/workflows/`), and
requires per-step documented evidence (:124) routed via the Audit Agent. The
workflow definitions carry `workflow_id` + `legal_basis`
(`workflows/_shared/tbm/schema.yaml`), but no schema in the hierarchy defines
the RUN-record fields, and `scripts/verify-memory.ts` validates only session
logs + the MEMORY.md index — nothing inspects `memory/workflows/`.

**Deviation from the dispatch text, recorded**: the dispatch named
`memory/workflow-runs/`; the agent spec and the ticket both mandate
`memory/workflows/`. The spec doc and validator target `memory/workflows/`
(the real path), matching the U-20261028-016 yaml `affected_paths`.

**Fix shape**:
1. New `templates/co-safety/docs/workflow-run-record.schema.md` (L2-authored):
   YAML-frontmatter + markdown body (the mandated path is `.md`; frontmatter
   carries the machine-validated fields, the body carries the narrative).
   Required fields, derived from the agent spec's own mandates (workflow id,
   date, participants, outcomes, evidence refs, sign-off) plus the ticket's
   enumeration (timestamp, dispatching agent ID, workflow ID, legal_basis
   array): `workflow_id` (non-empty string), `date` (YYYY-MM-DD, matches the
   filename prefix), `dispatched_by` (non-empty string), `agents` (non-empty
   string array), `legal_basis` (non-empty string array), `outcome`
   (non-empty string — decisions/outcome summary), `evidence` (non-empty
   string array of file paths), `sign_off` (non-empty string — records the
   accountable reviewer/acceptance status; per the agent spec's Disclaimer the
   SWM never legally approves, so the field documents human/organizational
   acceptance or an explicit `pending-acceptance`). Optional: `title`,
   `industry`, `task_type`, `site_id`, `urgency`, `open_items`. Body requires
   a non-empty remainder (narrative record, free-form).
2. `templates/co-safety/scripts/co-safety/audit-variant.ts` v1.2.0 → 1.3.0:
   new gate 3 — `memory/workflows/` absent or holding zero `.md` records →
   explicit green INFO "0 workflow runs recorded" (honest, no noise — the
   research warning about a bare empty-dir flag); records present → each
   filename must match `YYYY-MM-DD-<id>.md` and its frontmatter must satisfy
   the required-field shape above; any violation FAILs naming file + field.
   Frontmatter is parsed by a small dependency-free parser (flat `key: value`
   + `key:` / `  - item` lists) — the hook gains no js-yaml dependency.
3. The agent spec gains one line (:69 block) pointing at the schema doc.
4. `templates/co-safety/scripts/co-safety/SCRIPTS.md` audit-variant row bumped
   to 1.3.0 with the change note; the delivered project copies
   (`Projects/co-safety/scripts/co-safety/audit-variant.ts` — byte-identical
   pre-batch — and its `SCRIPTS.md`) are synced as direct working-tree edits
   (Projects/ is gitignored; they land with the project's next sync).

## 4. U-20261028-022 — promotion checklist snapshot semantics + sync + cross-check

**Evidence** (verified): `templates/co-safety/variant.json:358` declares
`"phaseAComplete": true` while `templates/co-safety/PROMOTION_CHECKLIST.md:6`
says `**Phase A Complete:** false` with every criterion row `Pending`; the
project copy is byte-identical to the template. Row-count audit against the
actual state: the skills claims are already factual (`skills[]` = 60;
`skill_manifest.variant_specific` = 4: risk-assessment, permit-to-work,
emergency-response, compliance-gap — the checklist row 3 names the same set);
row 1's "40 agent definition files" matches the calibrated definition count
(v1.4.0 roster calibration: 39 flat/self-contained + the pm.md override; the
common-delivered `i18n-specialist.md` extends pointer excluded); the row-2
breakdown "3 top-level" is stale — `agents[]` has 4 top-level entries and the
tree holds 41 agent markdown files (4 top-level + 12 `_shared/` + 3 functional
+ 22 industry).

**Semantics (declared)**: PROMOTION_CHECKLIST.md is an AUTHORED SNAPSHOT — it
records the promotion REVIEW at its time; machine state lives in
variant.json. The checklist is not regenerated (no generator exists and the
review narrative is hand-written); instead a durable cross-check makes silent
divergence on the Phase A flag impossible.

**Fix shape**:
1. One-time sync of `templates/co-safety/PROMOTION_CHECKLIST.md`, mirrored
   byte-identically into `Projects/co-safety/PROMOTION_CHECKLIST.md` (direct
   working-tree edit; project-owned; do NOT commit in any co-safety repo):
   - header line under the title: "Authored snapshot — machine state is
     variant.json" (per the design);
   - `**Phase A Complete:** false` → `true`;
   - row 1 ("Phase A complete") status `Pending` → `Complete` — its criterion
     is exactly the flag variant.json declares true; rows 2-10 remain the
     review's own Pending state (the beta→stable criteria are genuinely open
     and variant.json declares nothing about them);
   - row 2 breakdown reconciled: "4 top-level + 12 `_shared/` + 3 functional
     + 22 industry" with the i18n-specialist extends-pointer exclusion note
     (keeps both numeric claims inside the calibrated truth set {4, 40});
   - row 3's variant_specific list reordered to match variant.json order.
2. Durable cross-check: `scripts/validate-variant-claims.ts` v1.5.0 → 1.6.0
   gains check **u** — when `variant.json` declares a boolean
   `phaseAComplete` and `PROMOTION_CHECKLIST.md` exists, the checklist's
   "Phase A Complete" claim (parsed by new exported pure
   `parsePhaseAChecklistClaim`) must not contradict it; contradiction FAILs
   naming both values with the checklist line number. Checklist absent, no
   boolean declared, or no claim line → skip cleanly. Unit-pinned in
   `tests/unit/validate-variant-claims.test.ts`.

## 5. Validation

Per PR: `bun run test:unit`, `bun scripts/audit.ts`,
`bun scripts/validate-templates.ts`, `bun scripts/verify-scripts.ts --verify`,
plus `bun scripts/validate-variant-claims.ts --template co-safety` (the new
check u against the synced checklist) and
`bun scripts/propagate-to-templates.ts --check-drift` (script + helper domains
after `--apply`). Known pre-existing: the co-safety template audit T-08
failure; documented if it interferes with this batch's gates.

## 6. Decisions

- **whole-block override, `enabled` required (U-014)** — a partial merge of
  enabled/scanRoots/allowlist across two sources is exactly the ambiguity
  class the tickets complain about; variant.json wins or does not speak.
- **allowlist passthrough via design-lint.ts `--allow` (U-014)** — validating
  an allowlist the gate could not enforce would ship phantom config. The
  repeatable flag (~10 lines in the engine) makes the override real in L3
  checkouts, which have no workspace-schema.json for the engine to read.
- **`memory/workflows/`, not the dispatch's `memory/workflow-runs/` (U-016)** —
  the agent spec and ticket both name `memory/workflows/`; the validator must
  watch the path the spec actually mandates. Recorded as a deviation.
- **yaml frontmatter + body, dependency-free parser (U-016)** — the mandated
  record path is `.md`; frontmatter keeps the validated fields machine-greppable
  while the body stays a human narrative; the hook gains no new dependency.
- **rows 2-10 stay Pending (U-022)** — the snapshot semantics means the
  checklist keeps the review's own state; only claims that contradict
  variant.json's declared machine state (the Phase A flag) are reconciled and
  thereafter guarded.
- **registry versions**: audit.ts 2.59.0 → 2.60.0; design-lint-roots.ts 1.0.0 →
  1.1.0; design-lint.ts 2.4.0 → 2.5.0; validate-templates.ts 1.64.0 → 1.65.0;
  validate-variant-claims.ts 1.5.0 → 1.6.0; co-safety audit-variant.ts 1.2.0 →
  1.3.0 — SCRIPTS.md rows (L0 + L1 where mirrored) bumped with each.

## 7. Rollback

Single-commit revert per PR; the checklist sync and project-copy edits are
plain text (re-git or re-edit); no registry schema changes, no data migrations.
