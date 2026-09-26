---
status: Accepted
date: 2026-09-26
author: PM
---

# ADR-0091: KR Profile & LLM Configuration Standard — the co-newbiz Model, Fleet-Wide

## Context

The Projects/co-* fleet configures Korean country-profiles and LLM integration in divergent ways. Measured divergence (2026-09-26 survey): machine-readable `country_config` exists only in co-newbiz and co-safety (co-price tracks the active country via `docs/countries/ACTIVE.md` + a skill allowlist; co-consult has docs+env only); the structured provenance-validated `region-profiles/` layer exists only in co-newbiz; co-abap and co-design have no KR adoption at all; app-level LLM configuration exists in co-newbiz (`CO_NEWBIZ_LLM_*`) and co-price (`PRICE_AI_*`) with different naming conventions. Additionally co-safety's `country_config.default: "KR"` violates the country-profiles rule that `default` MUST stay `null`.

Projects/co-newbiz — a standalone-track project slated for variant promotion — carries the most complete and newest configuration model, verified live: a four-layer KR profile (variant.json `country_config` → `docs/countries/KR.md`+`ACTIVE.md` → `region-profiles/KR.yaml` provenance-validated structured YAML → `.env.sample` `country-scoped:KR` marker block) and a project-namespaced LLM env convention (`<PROJ>_LLM_PROVIDER/BASE_URL/API_KEY/MODEL`) with optional-by-design deterministic fallback (ADR-0118, ADR-0074).

## Decision

1. **The co-newbiz model is the fleet standard** for KR Profile configuration and project-level LLM configuration. Reference implementation: `Projects/co-newbiz/` (`variant.json country_config`, `docs/countries/`, `region-profiles/` incl. `_schema.yaml`+`_validate.ts`, `.env.sample`).
2. **KR Profile four layers are mandatory for every project that adopts a country** (`country_config.supported` non-empty): machine-readable `country_config` (with `default: null` — co-safety's `"KR"` is corrected to comply); `docs/countries/<CC>.md` in the standard five-section format + `ACTIVE.md`; `region-profiles/<CC>.yaml` with ALL required sections and per-section provenance (`source`/`verified_on`/`maintainer`) + `_schema.yaml` + `_validate.ts`; the `.env.sample` marker block with the `country_scoped_assets` env keys. Region YAML jurisdiction content is shareable across projects (the statutes are jurisdiction-owned, not project-owned); per-project deltas live in the Tooling & Skill Mapping section and `maintainer` fields.
3. **Projects without country adoption** declare the mechanism uniformly: `country_config = { profiles_dir: "docs/countries", supported: [], default: null }` — divergence by omission is eliminated.
4. **Project-level LLM configuration pattern**: `<PROJ>_LLM_PROVIDER|BASE_URL|API_KEY|MODEL` in the project's `.env.sample`, optional-by-design with deterministic fallback, per-feature executor toggles where applicable. Projects with existing LLM apps rename to this convention in the same PR as their app code (co-price: `PRICE_AI_*` → `CO_PRICE_LLM_*`). Projects without LLM-consuming apps set no LLM keys. The AGENTS.md `WORKSPACE-MANAGED: tier-model-mapping` block is workspace-managed and out of scope (already fleet-uniform).
5. **Enforcement stays per-project**: region-profiles `_validate.ts` (copied from co-newbiz) runs in each adopting project's own audit; `country_config` remains governed by validate-templates B-checks at the template layer and per-project audits at the project layer. No new workspace-wide FAIL gate is introduced by this ADR.
6. **Delivery**: per-project PRs through each project's own `/sync` (fleet-conversion precedent, 2026-09-25/26 batch); no workspace template changes — this standard regulates Projects-layer configuration.

## Consequences

- **Positive**: one machine-readable shape for country adoption across the fleet; provenance-validated regulatory data everywhere (unsourced placeholders become impossible to land silently); LLM configuration becomes predictable per project (`<PROJ>_LLM_*`) with a documented fallback contract; co-safety's default-country violation is corrected.
- **Cost**: co-price's env keys and app code rename (breaking for its local `.env` — migration note in its PR); region-profile authoring effort per adopting project (content shareable from the co-newbiz KR baseline); per-project `_validate.ts` copies to maintain.
- **Neutral**: co-abap/co-design remain non-KR by content while gaining the uniform declaration; the docs propagation domain stays disabled (ADR-0069 unaffected — these are project-owned paths).

## References

- Design: `docs/designs/2026-09-26-kr-llm-config-standardization-design.md`
- Reference implementation: `Projects/co-newbiz/` — `variant.json:636-642`, `docs/countries/`, `region-profiles/KR.yaml`+`_schema.yaml`+`_validate.ts`, `.env.sample:4-31,63-70`, `app/web-next/lib/llm.ts`, ADR-0118/0074/0097-0099
- ADR-0057 (country-profile mechanism), ADR-0069 (L1 docs independence), country-profiles rule (`templates/common/docs/country-profiles.md` L100-113 — `default: null`)
- Fleet divergence survey: 2026-09-26 session (co-price/co-safety/co-abap/co-consult/co-design samples)
