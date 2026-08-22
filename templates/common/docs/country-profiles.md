# Country Profiles

Country profiles are advisory jurisdiction knowledge for work anchored to a specific country or region. This document explains what they are, how to read and author them, and how they interact with skill deployment.

## What Is a Country Profile?

A country profile is a single Markdown file capturing what changes when a project's domain is anchored to one jurisdiction:

- **Regulatory & legal framework** - domain statutes, regulators, licensed professions
- **Operational formats** - currency, date/number formats, timezone, units, addresses
- **Language & communication defaults** - which locale(s) the jurisdiction typically works in (references the project's i18n settings; see the country-vs-language principle below)
- **Tooling & skill mapping** - which country-scoped skills apply and what they are for

Profiles live in `docs/countries/<CODE>.md`, where `<CODE>` is an ISO 3166-1 alpha-2 country code (`KR`, `US`) or a well-known region code (`EU`, `ASEAN`).

Profiles are **advisory knowledge, not executable configuration**. Agents load the active profile at engagement start (Phase 0 intake) and treat it as context to verify, never as a script to run. Nothing in a profile auto-executes.

If no profile is active for the project, agents work region-neutrally: they confirm the applicable jurisdiction with the client instead of assuming one.

## Profile File Format

Every profile follows this structure (section order is normative):

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
[One-paragraph summary of the jurisdiction's relevance to the domain]

## Regulatory & Legal Framework
[Domain statutes, regulators, licensed professions]

## Operational Formats
[Currency, date/number formats, timezone, units, addresses]

## Language & Communication Defaults
[Which locale(s) apply - reference the project's i18n settings, do not redefine them]

## Tooling & Skill Mapping
[Table mapping country-scoped skills to their purpose, e.g. k-law -> statute lookup]
```

Rules:

- The filename must match the frontmatter `code` (`KR.md` carries `code: KR`)
- `status` is one of `active` (trusted), `draft` (usable, unverified), `stale` (needs re-verification)
- Refresh `last_verified` whenever the content is re-checked against current statutes; the workspace validator warns when a profile goes older than 12 months
- Every profile must carry the advisory disclaimer (see below)

## The ACTIVE.md Pointer File

When a project is scaffolded with a target country, `docs/countries/ACTIVE.md` records which profile the project operates under (or that it is region-neutral). It is project state, not template knowledge: promotion of a project into a variant template always excludes `ACTIVE.md` while carrying the profiles themselves.

## Country-Scoped Skill Deployment

Some skills in the workspace registry are country-scoped: their function requires access to a country-specific data system. Currently `k-law`, `k-dart`, and `k-kosis` are scoped to `KR` (Korean statute lookup, DART disclosure data, KOSIS statistics).

- They are deployed **only** to projects scaffolded with the matching target country (`--country KR`)
- Region-neutral projects (and projects targeting another country) do not receive them - they are pruned at scaffold time from all four skill roots (`skills/`, `.claude/skills/`, `.gemini/skills/`, `.agents/skills/`)
- The scope criterion is data-system access, never language
- The single source of truth is the `country_scoped_assets` registry in `docs/workspace-schema.json`

If your project needs a country-scoped skill it did not receive, either re-scaffold with the correct target country, or copy the skill from `templates/common/skills/` in the workspace repository per convention (copied skills do not auto-upgrade).

## Adding a Country Profile

1. Author `docs/countries/<CODE>.md` using the format above
2. Declare it in `variant.json`:

   ```json
   "country_config": {
     "profiles_dir": "docs/countries",
     "supported": ["<CODE>"],
     "default": null
   }
   ```

3. Run the workspace validators - every code in `supported` must have a matching profile file with well-formed frontmatter

`default` must stay `null`. A profile set declares what the variant supports; it never makes one jurisdiction the implicit default for every future project.

## Mandatory Advisory Disclaimer

Every profile must open with (or prominently include) a disclaimer in this spirit:

> Advisory knowledge. Verify against current statutes before relying on it.

## Country vs. Language

Country and language are separate axes. Language policy lives in the project's i18n settings (`i18n.locale_codes` in `docs/workspace-schema.json`); profiles reference those settings but never redefine them. One country may have multiple languages (CH, CA) and one language may span many countries (`en`). Note that `zh-CN`/`zh-TW` are language tags, not country codes.

## See Also

- ADR-0057 in the workspace repository (`docs/adr/0057-country-profile-mechanism.md`) - the decision record for this mechanism
- `docs/workspace-schema.json` - `country_config`, `country_scoped_assets`, and `i18n` sections
