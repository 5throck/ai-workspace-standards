---
status: Accepted
date: 2026-08-23
author: PM + Automation Engineer + Docs Writer
---

# ADR-0057: Country Profile Mechanism for Variant Templates

## Context

Before this ADR, the workspace had **no mechanism for managing country-specific characteristics**, while several variants were hard-anchored to a single jurisdiction:

- **co-hr**: Korean labor-law compliance baked into roughly 15 files at 69 occurrences (`근로기준법`, labor commissions, `공인노무사`, `required_skills: [k-law]`)
- **co-export**: roughly 63 files at 415 occurrences (FTA/customs/export-control written from the Korean side)
- **co-news**: Korean journalism defaults (DART via `k-dart`, `k-law`); `variant.json` explicitly stated "(Korean default...)"

The existing i18n concept covers only *language* zones (`docs/workspace-schema.json` → `i18n.locale_codes`). Country and language are different axes, and only one of them had a home.

Additionally, **country-specific skills were deployed to every project**: `k-law`, `k-dart`, and `k-kosis` live in `templates/common/skills/` and their platform mirrors, so every generated project received them regardless of target country. `create-l3-scaffold.ts` copied `templates/common/` wholesale, so new L3 variant drafts were no exception.

Four lifecycle flows needed a unified country mechanism:

1. New project creation - `scripts/new-project.ts`
2. New variant creation - `skills/create-variant/SKILL.md` → `scripts/create-l3-scaffold.ts`
3. Project → variant promotion - `scripts/project-to-variant.ts` (lightweight) / `scripts/l3-to-variant-pipeline.ts` (full pipeline)
4. Existing variant maintenance - follow-up migrations plus continuous validator checks

## Decision

### 1. Variant-owned country profiles at `docs/countries/<CODE>.md`

Each variant owns the country profiles it needs. `<CODE>` is an ISO 3166-1 alpha-2 country code (`KR`, `US`) or a well-known region code (`EU`, `ASEAN`), matching `^[A-Z]{2,4}$`.

- **No central profile registry in `templates/common/`**: common defines the convention only (see `templates/common/docs/country-profiles.md`). Jurisdiction knowledge differs per domain, so profiles belong to the variant that needs them. If duplication across variants emerges later, the promotion path is to lift a profile into `templates/common/` at that point - not to pre-build a shared registry for a need that has not materialized.
- **Region-neutral by default**: `country_config.default` must remain `null`. A variant declares which jurisdictions it *supports*; it never makes one jurisdiction the implicit default for all future projects. Validators warn on a non-null `default`.
- **Advisory, never auto-executed**: profiles are jurisdiction knowledge loaded at engagement start (Phase 0 intake). Agents treat a profile as context to verify, not as a script to run. With no active profile, agents operate region-neutrally and confirm the applicable jurisdiction with the client.

### 2. Optional `country_config` key in `variant.json`

```json
"country_config": {
  "profiles_dir": "docs/countries",
  "supported": ["KR"],
  "default": null
}
```

Registered in `docs/workspace-schema.json` under `variant_extensions._shared.country_config` (mirrored to `templates/common/docs/workspace-schema.json`) and added to `docs/templates/variant.schema.json`. No existing validator rejects unknown top-level keys, so registration is purely additive.

### 3. `country_scoped_assets` registry + scaffold-time pruning

A new SSOT section in `docs/workspace-schema.json` (mirrored to the templates/common copy), following the machine-readable precedent of `i18n.locale_codes`:

```json
"country_scoped_assets": {
  "description": "Skills and scripts whose function is specific to one country/region. Pruned from generated projects at scaffold time unless the project's target country matches. Registry-only (no SKILL.md frontmatter marking) - single source of truth. Scope criterion is country-specific data-system access, NEVER language.",
  "skills": { "k-law": "KR", "k-dart": "KR", "k-kosis": "KR" },
  "scripts": {}
}
```

A shared helper (`scripts/helpers/prune-country-scoped-assets.ts`) applies one rule at both scaffold entry points - `new-project.ts` (new projects) and `create-l3-scaffold.ts` (new variant drafts, via its new `--country <CODE>` flag): for each registered asset scoped to country `C`, if the selected country is not `C` (including region-neutral), the asset is removed from all four skill roots (`skills/`, `.claude/skills/`, `.gemini/skills/`, `.agents/skills/`). Result: only KR-target projects/drafts receive the `k-*` skills; region-neutral and other-country projects receive none of them.

The scope criterion is **data-system access, never language**: a skill qualifies only if it accesses a country-specific data system (e.g. `k-law` queries the Korean National Law Information Center). Language skills such as `translate` can never be country-scoped.

### 4. Promotion pipelines carry knowledge, not selections

When `project-to-variant.ts` or `l3-to-variant-pipeline.ts` promotes a project into `templates/<name>/`:

- **Exclude `docs/countries/ACTIVE.md`** - it records *this project's* country selection (project state), not reusable template knowledge
- **Carry `docs/countries/<CODE>.md` profiles** - they are durable jurisdiction knowledge and legitimate template assets
- **Preserve `country_config`** into the generated/updated `variant.json`, keeping `supported` in sync with the carried profiles
- **Refuse registry-scoped skill copies** - country-scoped skills already live in `templates/common/`; copying them into a variant (the co-consult `k-law` fork pattern) is blocked
- The printed manual checklist gains country items (profiles are jurisdiction knowledge, not project data; `supported` matches carried profiles)

### 5. Principle: country ≠ language

`i18n.locale_codes` remains the single source of truth for language. Country profiles **reference** language defaults but never redefine language policy. The two axes are independent:

- One country, multiple languages (CH: de/fr/it; CA: en/fr)
- One language, multiple countries (en)
- `zh-CN`/`zh-TW` are language+region hybrid *language* tags, not country codes

## Profile File Format

```markdown
---
code: KR
name: Republic of Korea
status: active          # active | draft | stale
last_verified: 2026-08-23
---
# Country Profile: KR - Republic of Korea
> Advisory knowledge. Verify against current statutes before relying on it.
## Overview
## Regulatory & Legal Framework      (domain statutes, regulators, licensed professions)
## Operational Formats               (currency, date/number, timezone, units, addresses)
## Language & Communication Defaults (references i18n.locale_codes; never redefines them)
## Tooling & Skill Mapping           (table: k-law -> Korean statute lookup, k-dart -> DART)
```

Section order is normative, the filename must match the frontmatter `code`, and the advisory disclaimer is mandatory in every profile. Validators check frontmatter integrity (code/name/status/`last_verified`) and warn when `last_verified` is older than 12 months.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Central profile registry in `templates/common/` | Domain knowledge differs per variant and duplication is rare; promote to common only when actual duplication emerges |
| `SKILL.md` frontmatter marking for country scope | The registry-SSOT pattern matches the `i18n.locale_codes` precedent; frontmatter marking would require editing all four skill-root copies per skill and drifts silently |
| `country_config` manifest key without profile files | No home for jurisdiction knowledge (statutes, regulators, formats); agents would re-derive it every engagement |

## Consequences

**Positive:**

- Region-neutral becomes the default posture; jurisdiction knowledge has a discoverable, loadable home instead of being scattered through agent prose
- `k-*` skills disappear from projects that cannot use them - less noise, and no orphan `required_skills` references once PR-B/C/D stop agents from hard-requiring them
- One declarative registry drives both scaffold entry points (`new-project.ts`, `create-l3-scaffold.ts`), so the rule cannot diverge between flows

**Negative / Trade-offs:**

- `k-*` skills become invisible to non-KR projects; an engineer who wants them in a region-neutral project must re-scaffold with `--country KR` or copy from `templates/common/` per convention (no auto-upgrade)
- The registry must stay in sync with `templates/common/skills/`; a validator integrity check (ERROR on a registered skill that no longer exists) guards the drift
- co-hr/co-export/co-news remain Korea-anchored in prose until their migration PRs land; the mechanism ships ahead of the content migration
- New validator surface: country-config checks (profile existence, frontmatter integrity, freshness, undeclared `docs/countries/`, non-null `default`) and registry integrity

## Implementation

| File | Change |
|------|--------|
| `docs/workspace-schema.json` | `variant_extensions._shared.country_config` + new top-level `country_scoped_assets` section |
| `templates/common/docs/workspace-schema.json` | Mirror update (same commit, per ADR-0053) |
| `docs/templates/variant.schema.json` | `country_config` property (profiles_dir string; supported `^[A-Z]{2,4}$` array; default string or null) |
| `scripts/helpers/prune-country-scoped-assets.ts` | New shared scaffold-time prune helper |
| `scripts/new-project.ts` | `--country <CODE>` flag + interactive prompt; prune after copy/overlay; provenance/`ACTIVE.md`/template-version recording |
| `scripts/create-l3-scaffold.ts` | `--country <CODE>` flag; prune after common copy |
| `scripts/project-to-variant.ts`, `scripts/l3-to-variant-pipeline.ts` | ACTIVE.md exclusion, profile carry, `country_config` preservation, scoped-skill copy refusal, checklist items |
| `scripts/validate-templates.ts` | Country-config checks + registry integrity |
| `scripts/helpers/substitute-placeholders.ts` | Optional country argument; `{{COUNTRY}}` substitution ("the applicable jurisdiction" when unselected) |
| `templates/common/docs/country-profiles.md` | User/agent-facing convention doc (ships into generated projects) |
| `skills/create-variant/SKILL.md`, `skills/project-to-variant/SKILL.md` | Country-profile guidance (`--country` flag, jurisdiction-neutral base content, promotion rules) |

Variant migrations follow in separate PRs: PR-B (co-hr), PR-C (co-export), PR-D (co-news + remaining-variant audit).

**References:**

- `templates/common/docs/country-profiles.md` - the convention as it ships into generated projects
- `docs/governance/variant-contract.md` - README/user-guide standards the migrations must respect
- ADR-0053 - docs propagation policy (why the workspace-schema.json mirror is updated but not registered for propagation)
- `i18n.locale_codes` in `docs/workspace-schema.json` - the language SSOT this mechanism deliberately does not touch
