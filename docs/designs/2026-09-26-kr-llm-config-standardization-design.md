# KR Profile & LLM Config Standardization Design — co-newbiz Model Fleet-Wide

- **Date**: 2026-09-26
- **Status**: Approved (user decisions: LLM naming unified to `<PROJ>_LLM_*`; region-profiles full 12-section adoption)
- **Related**: ADR-0091 (decision record), ADR-0057 (country-profile mechanism), ADR-0069 (L1 docs independence), ADR-0118/0074 (co-newbiz LLM architecture)
- **Scope**: Align all Projects/co-* to the co-newbiz configuration model per ADR-0091. Reference implementation is NOT modified except verification.

---

## 1. Background

Measured divergence (2026-09-26 survey of co-price/co-safety/co-abap/co-consult/co-design + co-newbiz): three mechanisms track country adoption (machine-readable `country_config` in co-newbiz/co-safety, `ACTIVE.md`+allowlist in co-price, docs+env only in co-consult); co-abap/co-design have no KR footprint; the provenance-validated `region-profiles/` layer exists only in co-newbiz; app-level LLM config naming diverges (co-newbiz `CO_NEWBIZ_LLM_*` vs co-price `PRICE_AI_*`); co-safety's `country_config.default: "KR"` violates the `default: null` rule.

## 2. Standard Profile (co-newbiz model)

**KR Profile layers** (mandatory for country-adopting projects):
1. `variant.json.country_config = { profiles_dir: "docs/countries", supported: [<ISO2>…], default: null }`
2. `docs/countries/<CC>.md` — frontmatter `code/name/status/last_verified`, sections: Overview / Regulatory & Legal Framework / Operational Formats / Language & Communication Defaults / Tooling & Skill Mapping; + `docs/countries/ACTIVE.md` pointer
3. `region-profiles/<CC>.yaml` — top-level `code`/`name_ko` + required sections (merger_control, foreign_investment_screening, labor, tax, fx_and_repatriation, anti_corruption, sanctions_screening, data_transfer, environmental_liability_succession, incentives, typical_closing_weeks); EVERY section carries `source` (statute citations) / `verified_on` / `maintainer`; + `_schema.yaml` (contract) + `_validate.ts` (bun validator, rejects unsourced sections)
4. `.env.sample` — `# >>> country-scoped:<CC>` marker block with the `country_scoped_assets` env keys (KR: DART_API_KEY, LAW_API_OC, KOSIS_API_KEY, DATA_GO_KR_API_KEY, ECOS_API_KEY, KRX_API_KEY), one provenance comment per key

**LLM pattern** (projects with LLM-consuming apps): `.env.sample` carries `<PROJ>_LLM_PROVIDER` (`openai-compatible|anthropic|gemini|custom|none`), `<PROJ>_LLM_BASE_URL`, `<PROJ>_LLM_API_KEY`, `<PROJ>_LLM_MODEL`; unset = deterministic fallback (platform fully functional without an LLM); per-feature executor toggles where the app has stage seams. AGENTS.md tier-model-mapping is workspace-managed and excluded.

## 3. Requirements

- R1: every Project/co-* carries `country_config` (adopting: supported non-empty; non-adopting: `supported: []`); `default: null` everywhere (co-safety corrected).
- R2: KR-adopting projects carry all four layers; region-profiles content covers ALL required sections with provenance.
- R3: co-price renames `PRICE_AI_*` → `CO_PRICE_LLM_*` across `.env.sample`, app code, and tests; migration note in the PR.
- R4: relocation/adjudication preserves rule text (N2 analog for config: renames are mechanical, behavior-preserving except the explicit co-safety default correction).

## 4. Acceptance Criteria

- AC1: `country_config` present in 12/12 projects, `default: null` 12/12.
- AC2: 4 KR-adopting projects each carry region-profiles with all required sections passing `_validate.ts`.
- AC3: co-price has zero `PRICE_AI_` references remaining (code+tests+env samples); `CO_PRICE_LLM_*` wired.
- AC4: KR `.env.sample` marker blocks balanced and key-complete (validate-templates B-06 rules pass per project).
- AC5: per-project audit green at land time.

## 5. Waves

| Wave | Content | Projects |
|---|---|---|
| WA1 | co-price full alignment (country_config, KR.md normalize, region-profiles adoption, LLM rename) | co-price |
| WA2 | co-safety (default correction, KR.md normalize, region-profiles), co-consult (country_config, KR.md normalize, region-profiles) | co-safety, co-consult |
| WB | non-KR 8 projects: `country_config` declaration + docs/governance/agents/ delivery check | co-abap, co-deck, co-design, co-architect, co-develop, co-export, co-game, co-security |
| WC | fleet verification + report | — |

Each project lands via its own `/sync`; per-project one-design-doc registered (ADR-0074 convention).

## 6. Verification Plan

1. `country_config` presence/shape scan across 12 projects (scripted).
2. `bun region-profiles/_validate.ts` green in each KR-adopting project.
3. co-price: zero `PRICE_AI_` matches (grep) and unit tests green after rename.
4. validate-templates (workspace) + per-project audit green at each project's /sync.
5. Marker-block balance: B-06 rules pass on every touched `.env.sample`.

## 7. Risks

| Risk | Mitigation |
|---|---|
| co-price rename breaks its app | app code + tests updated in the same PR; migration note (old→new key mapping) in the PR body |
| Region YAML content drift between projects | content authored once from the co-newbiz KR baseline; per-project deltas confined to Tooling & Skill Mapping + maintainer |
| Partial fleet state (some projects pending) | WARN-level only; no FAIL gate depends on fleet completeness |
| co-abap/co-newbiz parallel sessions | workspace `templates/co-abap` untouched; project conversions confined to Projects/<name> |

## 8. Accessibility & Preview Verification Statements

- Accessibility (ADR-0065): exempt — configuration standardization, no user-facing UI.
- Preview Verification (ADR-0070): exempt — verification is script-based (§6).

## 9. References

- ADR-0091; co-newbiz reference implementation (paths in ADR-0091 References)
- `templates/common/docs/country-profiles.md` (L100-113: `default: null` rule), `docs/workspace-schema.json:118` (`country_scoped_assets`), `scripts/helpers/prune-country-scoped-assets.ts`, validate-templates B-05/B-06
- ADR-0118 (stage-scoped LLM decision support), ADR-0074 (multi-provider abstraction)
