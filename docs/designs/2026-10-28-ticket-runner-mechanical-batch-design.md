# Ticket Runner Mechanical Batch — 2026-10-28 (T-20261028-005/-002/-003/-007)

- **Status**: implemented
- **Date**: 2026-10-28
- **Owner**: governance-ticket runner (daily 04:00 KST batch)
- **Tickets**: T-20261028-005 (high), T-20261028-002 (normal), T-20261028-003 (normal), T-20261028-007 (low)
- **Tier**: L0 workspace root + co-safety variant template (templates/co-safety)

## 1. Context

The 2026-10-28 04:00 KST runner batch picked four mechanically actionable
tickets. All are small repairs with an existing decision of record; none opens
a new policy question. This doc is the Design Gate artifact for the batch and
records the scope decision for each.

## 2. T-20261028-005 — co-safety scaffolder durability (CS-1 + CS-2)

### 2.1 CS-1: scaffolder emits gate-failing frontmatter

`templates/co-safety/scripts/co-safety/new-domain.ts` emitted the legacy
per-platform tier map plus `model: inherit`:

```yaml
tier: {claude: medium, gemini-cli: medium, antigravity: medium}
model: inherit
```

Two gates reject this class today:

- `validate-templates.ts` `agent-quality-recursive` (v1.61.0, T-20261027-001)
  FAILs any non-scalar / invalid-value tier in nested template agent trees
  (ADR-0102 scalar form).
- `scripts/validators/schema-validator.ts` `AGENT_REQUIRED_FIELDS` requires
  `version`, which the emitted frontmatter also lacked.

**Change**: emit `version: "1.0.0"`, scalar `tier: medium`, drop
`model: inherit`, and convert the inline lifecycle map to block form with
`created` + `last_updated` — matching the shape of the current valid domain
agents (e.g. `gmp-agent.md`). Script header 1.0.1 → 1.0.2. The stub body is
unchanged: it is authored during SOP step 3 before the project audit runs
(onboarding step 7), and the body-completeness gate's scan surfaces
(template-recursive; project flat `agents/`) do not reach freshly scaffolded
nested domain trees, so a scaffold stub is not a gate subject.

Verified by sandbox smoke test (`bun new-domain.ts domtest functional`) —
emitted frontmatter passes the map-form/scalar/enum checks and the required
field list.

### 2.2 CS-2: stale `skills/domains/...` references (enumerated scope only)

The daily review report (Phase 1b CS-2) enumerates ten references in six
co-safety agent files pointing at the retired nested
`skills/domains/<tier>/<domain>/` layout. The real layout is flat
`skills/<skill-name>/`; all ten referenced skills exist there (verified:
gmp-qrm, gmp-change-control, gmp-deviation-capa,
temperature-excursion-analyzer, dts-verification,
protocol-deviation-analyzer, sae-causality-assessor, signal-detector,
benefit-risk-assessor, gas-dispersion-analyzer, tank-integrity-validator).

**Change**: prefix-only normalization of exactly the enumerated references in
the six agent files. **Explicitly out of scope** (flagged for the review
session, not mechanically enumerable here): the same stale pattern also appears
in workflows READMEs, `docs/domains/*/scope.md`, the `_shared/` onboarding
guides (which still teach `mkdir -p skills/domains/<tier>/<name>`),
`user-scenarios*.md`, `docs/_meta/VERSION_MANIFEST.md`, `safety-audit.ts`, the
scaffolder's own step-2 `mkdir` (which still creates the nested layout for a
NEW domain's skill dir — a design question, not a reference repair), and some
skills' cross-references. Those need case-by-case disposition (e.g. the
`psm-moc` rows point at a path with no flat counterpart).

## 3. T-20261028-002 — upgrade-script hygiene (globToRegExp + re-stamp scope)

Two defects in the upgrade/delivery layer:

1. `lib/upgrade-policy.ts` `globToRegExp` (upgrade-policy.ts:975-984): `a/**/b`
   must also match `a/b` (zero intermediate segments). Today the narrowed
   adopt-grants pattern silently skips such paths.
2. `upgrade-project.ts:4397-4415` (v1.74.0 post-delivery re-stamp): the
   `last_updated` re-stamp currently walks every dirty worktree file; restrict
   it to the delivery manifest's file set so unrelated local changes never get
   stamped by an upgrade run.

Unit tests pin both behaviors (`a/**/b` matches `a/b` and `a/x/b`; re-stamp
touches only manifest files).

## 4. T-20261028-003 + T-20261028-007 — docs housekeeping batch

- CHANGELOG rows for the #1659 / #1661 landings (record repair).
- CONSTITUTION.md §4.1 enforcement bullet aligned with validate-md-language
  v1.16.0 perimeter (EN-original scan + KO-twin `lang:` declaration gate).
- `docs/lifecycle/agents/i18n-specialist.md` Last-Updated stamp for the 1.3.0
  bump.
- `docs/templates/common-contract.json` project-resync description refreshed
  from v1.7.0 frontmatter.
- `validate-md-language.ts:224` two-statement line reflow (both copies).
- `templates/co-design/agents/README_ko.md` gains the I18N Specialist roster
  row the EN README carries (project-side KO copy already fixed it; template
  backport).

## 5. Validation

Per PR: `bun scripts/audit.ts`, `bun scripts/validate-templates.ts`,
`bun scripts/verify-scripts.ts --verify`, `bun test` (root). The co-safety
changes are additionally covered by the smoke test in §2.1 and the existence
check in §2.2; the T-002 changes carry new unit tests.

## 6. Decisions

- **Enumerated scope for CS-2** — normalize only the review-enumerated agent
  references; the broader stale-pattern sweep is a review-session follow-up
  (ticket comment records it) because several stale paths have no flat
  counterpart and need per-path disposition.
- **`version: "1.0.0"` added beyond the ticket text** — the ticket names tier +
  model, but the schema gate independently FAILs the missing `version` field;
  fixing only the named fields would leave every scaffolded agent red.
- **Stub body left as-is** — body completeness applies to template-tree scans;
  scaffolded project trees are authored during onboarding before audit.

## 7. Rollback

Single-commit reverts per PR; no data migrations, no registry schema changes.
