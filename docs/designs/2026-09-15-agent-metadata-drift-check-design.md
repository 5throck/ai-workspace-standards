---
schemaVersion: 1.0.0
spec-id: agent-metadata-drift-check
---

# Agent Metadata Drift Check — Extending Beyond Tier (status/version/model mapping)

## 1. Overview

Follow-up to the 2026-09-15 Check F (agent-tier-drift-check): adds computed
validation to the agent metadata dimensions that, like tier, are declared in
multiple places and compared by nothing. Closes the four gaps identified by
the 2026-09-15 sweep.

## 2. Background

The sweep confirmed the same "declared in several surfaces, compared
nowhere" pattern behind other dimensions, plus one live drift
(VERSION_MANIFEST.md pm row still said high — a generated artifact that no
gate reconciles). It also found `validate-model-registry.ts` wired to no
gate at all — manual-only.

| Dimension | Surfaces | Prior validation |
|-----------|----------|------------------|
| status | frontmatter ↔ lifecycle record Current Phase | none |
| last_updated | frontmatter ↔ record Last Updated | none (git date only) |
| version | frontmatter ↔ common-contract.json common_agents | format (semver) only; C-CM-03 covers common_skills but not common_agents |
| model-mapping prose | AGENTS.md §3.6 / CLAUDE.md / GEMINI.md / CODEX.md ↔ schema `models` | MM-01 is placement-only; validate-model-registry unwired |

## 3. Decision

1. **Check F extension** (lifecycle-sync-audit.ts, v1.10.0 → 1.11.0):
   - **(e) status ↔ Current Phase**: a `production` phase requires
     frontmatter status `active` (error). Contested phase vocabularies
     (draft/beta) report as warnings.
   - **(f) last_updated precedence**: a record `Last Updated` (first date
     token) older than frontmatter `last_updated` is an error — "the agent
     changed but the lifecycle record was never refreshed", the
     computational form of the AGENTS.md §8 duty. Equal-or-newer passes.
2. **Model-mapping prose validation** (validate-model-registry.ts,
   v1.2.0 → 1.3.0): AGENTS.md §3.6 WORKSPACE-MANAGED block must list the
   deduped per-tier model set from schema `models`; CLAUDE.md, GEMINI.md,
   and CODEX.md must list their own platform column's per-tier values.
   Mismatches follow the existing die()/exit-1 convention.
3. **audit.ts wiring**: validate-model-registry is spawned through the
   existing delegation pattern (spawnSync → Pass/Fail), so comment/prose
   model drift is caught by every full audit instead of by manual runs.
4. **C-CM-03a** (validate-templates.ts, v1.26.0 → 1.27.0): contract
   `common_agents` `version` must match
   `templates/common/agents/<name>.md` frontmatter version — the agent
   counterpart of the C-CM-03 skills check, same severity.

## 4. Requirements / Acceptance

1. An agent whose record Last Updated lags its frontmatter reports as a
   Check F error; refreshing the record returns a clean pass.
2. Changing any model ID in a mapping prose block fails
   validate-model-registry; reverting passes.
3. Breaking a common_agents contract version surfaces a C-CM-03a finding.
4. `bun scripts/audit.ts` passes end-to-end including the new model
   registry gate, with Check A version parity intact.

## 5. Non-goals

- Disposal or redesign of `sync-agent-status.ts`, and re-enabling
  `.githooks` mirror parity — owner decisions, deferred.
- Editing the VERSION_MANIFEST artifact by hand — dev-sync step 4.7
  regeneration owns it (regenerated once in this batch to land consistent).
- No changes to the script/skill registries — already sound via
  Check A/E/C-CM-03.

## 6. Accessibility & Preview

Backend governance tooling with no user-facing UI. ADR-0065 accessibility
requirements and ADR-0070 preview verification are not applicable.
