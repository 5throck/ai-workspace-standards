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

`ACTIVE.md` records the **primary** jurisdiction. An engagement that spans additional jurisdictions may load extra profiles from `docs/countries/` and list them as secondaries in the `ACTIVE.md` body — the project still operates under one primary profile at a time.

## Country-Scoped Skill Deployment

Some skills in the workspace registry are country-scoped: their function requires access to a country-specific data system. Currently `k-law`, `k-dart`, and `k-kosis` are scoped to `KR` (Korean statute lookup, DART disclosure data, KOSIS statistics).

- They are deployed **only** to projects scaffolded with the matching target country (`--country KR`)
- Region-neutral projects (and projects targeting another country) do not receive them - they are pruned at scaffold time from all four skill roots (`skills/`, `.claude/skills/`, `.gemini/skills/`, `.agents/skills/`)
- The scope criterion is data-system access, never language
- The single source of truth is the `country_scoped_assets` registry in `docs/workspace-schema.json`

The registry governs three asset classes - **skills**, **scripts**, and **env**. Env credentials ship inside `# >>> country-scoped:<CC>` / `# <<< country-scoped:<CC>` marker blocks in `.env.sample` and are pruned at scaffold time unless the target country matches, so a region-neutral project never receives another country's API keys. Project-specific env vars stay outside the marker blocks and are never touched by pruning.

If your project needs a country-scoped skill it did not receive, either re-scaffold with the correct target country, or copy the skill from `templates/common/skills/` in the workspace repository per convention (copied skills do not auto-upgrade).

### Deregistration Path

Withdrawing support for a country-scoped asset:

1. Remove the asset from `country_scoped_assets` in **both** schema copies - `docs/workspace-schema.json` and `templates/common/docs/workspace-schema.json` - in the same commit (the two `country_scoped_assets` sections must stay byte-identical)
2. Remove the shipped asset from `templates/common/` in every mirror directory: the `.env.sample` marker block for env keys, or the skill directories in `skills/`, `.claude/skills/`, `.gemini/skills/`, and `.agents/skills/` for skills
3. Mark the country profile `status: stale` if its *Tooling & Skill Mapping* section referenced the asset
4. Run `bun scripts/validate-templates.ts` - the registry integrity checks confirm nothing dangles: a registered key missing from every marker block, or an unregistered key sitting inside one, is an error

### Personal/Global Skill Bundles

Skills installed in a user's global skill directories (e.g. `~/.claude/skills/`) are personal machine assets, outside workspace governance. They may overlap with workspace skills but can drift from them, they are invisible to scaffold-time pruning and workspace validators, and they may fire in sessions regardless of the project's target country. Never assume a global bundle is present or current: projects rely on their project-local skills only.

## Profile Freshness & Ownership

Every profile has an owner and a freshness contract:

- **Owner** — the variant that ships the profile owns its accuracy. Re-verification is scheduled by that variant's maintainers (via the workspace PM), not by a central scheduler.
- **Cadence** — re-verify each profile every 6 months, or before any release that leans on its content. The workspace validator's 12-month `last_verified` warning is a backstop, not the process.
- **Transitions** — `draft` becomes `active` on its first full verification; `active` becomes `stale` when the 12-month warning fires or a known regulatory change invalidates content.
- **Stale handling** — a `stale` profile stays loadable: agents must flag its staleness to the client at Phase 0 intake and verify affected statements against current sources. Profiles are never auto-deleted.

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

When a region-neutral document must state a jurisdiction-specific fact, tag it with an explicit parenthetical marker - (KR: ...) - instead of restructuring the document around it (the `co-hr` / `co-export` / `co-news` convention). The marker keeps jurisdiction anchors greppable and removable when the document is re-scoped.

## See Also

- ADR-0057 in the workspace repository (`docs/adr/0057-country-profile-mechanism.md`) - the decision record for this mechanism
- `docs/workspace-schema.json` - `country_config`, `country_scoped_assets`, and `i18n` sections
