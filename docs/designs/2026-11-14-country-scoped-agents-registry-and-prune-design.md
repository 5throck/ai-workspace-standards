# Country-scoped agents registry relocation + upgrade prune — design

- **Spec id**: 2026-11-14-country-scoped-agents-registry-and-prune-design
- **Status**: implemented
- **Date**: 2026-11-14
- **Tickets**: T-20261112-004 (non-KR re-delivery), T-20261112-005 (registry relocation). Mechanical riders in the same landing: T-20261112-006 (orphan mirror removal), T-20261112-007 (SLR fix-text refresh).
- **Version**: upgrade-project.ts v1.97.0, country-scoped-agents.ts v1.1.0

## 1. Problem

T-20261112-005: the country-scoped AGENT registry lives as a TypeScript constant
(`COUNTRY_SCOPED_AGENTS` in scripts/lib/country-scoped-agents.ts v1.0.0) while the
module's own docstring claims the registry is
`docs/workspace-schema.json → country_scoped_assets.agents` — which does not exist
in the schema (only `skills`/`scripts`/`env`/`dirs`). The skills registry IS
schema-backed (`country_scoped_assets.skills`), so agents are the odd one out: a
hand-maintained root constant outside the schema SSOT pair.

T-20261112-004: the scaffold-time prune (`prune-country-scoped-assets.ts`) removes
country-scoped assets for non-matching countries, but upgrade-project's
`SYNC_IF_NEWER: agents/` pass has no country awareness — a non-KR project that
pruned `public-data-analyst.md` at scaffold time receives it AGAIN at the next
upgrade visit (template has it → project lacks it → hash-gated delivery re-adds
it, with its lifecycle record).

## 2. Fix

### R1 — registry relocation (country-scoped-agents.ts v1.1.0)

1. `docs/workspace-schema.json` AND its L1 mirror
   `templates/common/docs/workspace-schema.json` (hand-maintained pair) gain:

   ```json
   "country_scoped_assets": {
     ..., "agents": { "public-data-analyst": "KR" }
   }
   ```

2. `country-scoped-agents.ts` v1.1.0: the constant is replaced by
   `loadCountryScopedAgents(schemaPath?)` — reads `country_scoped_assets.agents`
   from the schema JSON (default: the repo-root docs/workspace-schema.json;
   explicit path for tests). A missing `agents` key yields `{}` (vacuously clean,
   same as an empty registry). Malformed JSON throws — fail-closed, same posture
   as the other schema readers. The pure helpers (`isPrunedForCountry`,
   `agentsToPrune`, `agentPrunePaths`, `scrubAgentReferenceLines`) are unchanged
   and now take the registry as an argument (they already do).

3. Consumers updated: `scripts/helpers/prune-country-scoped-assets.ts` and
   `scripts/helpers/scaffold-markers.ts` call `loadCountryScopedAgents()` instead
   of importing the constant. The helper CLI gains `--schema <path>` passthrough.

### R2 — upgrade-time country guard (upgrade-project.ts v1.105.0)

`SYNC_IF_NEWER: agents/` gains a pre-delivery country guard: when the template
agent under delivery is a country-scoped common agent (per the relocated registry)
whose scoped country does not match the project's `detectedCountry` (the same
source the scaffold prune uses; absent or `none` = region-neutral → withhold all
scoped agents), the pass SKIPS the copy — CORRECTIVE/INFO decision row, no bytes
delivered, no baseline written. The workspace-seed pass applies the same guard to
the agent's `docs/lifecycle/agents/<name>.md` record. Idempotent: a withheld agent
stays withheld every visit; KR projects keep everything.

A deliver-then-prune post-pass was implemented first and REJECTED by the
fixtures: deleting the just-delivered file left the delivered baseline in the
manifest, so the next visit re-fired TOMBSTONED (ERROR) on the pruned path
(caught by tests/unit/upgrade-decision-log.test.ts). Withholding before delivery
creates no baseline, so nothing re-fires — the final shape.

### R3 — riders (same landing, mechanical)

- **T-20261112-006**: `templates/co-architect/{.claude,.gemini,.agents,.codex,.hermes}/skills/{design-foundation,i18n-layout,i18n-specialist,accessibility-audit}/` are promotion-leftover orphan mirrors — the variant `skills/` SSOT does not carry these skills (verified 2026-11-14) and no other variant template carries these mirrors (co-work/co-price/co-security: 0). Removed (15 dirs). Project-level mirrors regenerate from the skills SSOT via sync-skills; template-side mirrors for non-SSOT skills are exactly the divergence class variant-mirror-parity flags on version bumps.
- **T-20261112-007**: `scripts/generate-skill-lifecycle-records.ts:856` fix text refreshed — the records are now blocking-gated, not "published by the templates PR".

## 3. Verification

- Unit: `tests/unit/country-scoped-agents.test.ts` — schema-backed load (existing
  schema yields public-data-analyst→KR), missing key → {}, malformed JSON throws,
  prune math unchanged from v1.0.0. `tests/unit/upgrade-country-agent-prune.test.ts`
  — the R2 guard removes the agent + record for a region-neutral project and keeps
  both for KR.
- Live: `upgrade-project Projects/co-price --dry-run` (region-neutral) shows the
  corrective row for public-data-analyst; co-newbiz (standalone, KR) unaffected.
- validate-templates + the full unit suite stay green; the L1 schema mirror diff
  must stay byte-identical between root and templates/common.

## 4. Out of scope

- T-20261112-008 (freeze-lift wave) — conditional on the freeze decision, untouched.
- T-20261112-009 (scaffold LC warning-count verification) — needs a scaffoldable
  fixture harness (new-project.ts is workspace-root-bound); deferred to its own
  design cycle, recorded in the ticket.
- U-20261113-008/-009/-010 (co-consult doctrine requests) — File Organization and
  CONSTITUTION-reference doctrine changes need an architect ruling; triaged to
  designed-pending, not implemented here.
