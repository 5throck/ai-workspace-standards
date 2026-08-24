---
code: XX
name: <Jurisdiction full name>
status: draft
last_verified: <YYYY-MM-DD — set only after the verification pass; leave blank while drafting>
---

# Country Profile: XX — <Jurisdiction full name>

> **Advisory knowledge.** Verify against current statutes, tariff schedules, and FTA texts
> before relying on any statement here. This profile never auto-executes — agents load it at
> Phase 0 intake and treat it as jurisdiction context, not law.

<!--
Blank country-profile skeleton for onboarding a second (or later) jurisdiction, derived from
the KR profile's five sections. Copy this file to `<ISO-3166-1-alpha-2>.md`, fill every
section, then run the onboarding checklist at the bottom. Guidance notes in HTML comments
explain what each field expects — delete them as you fill.
-->

## Overview

<!-- One paragraph (KR uses 4 sentences): the economy's trade intensity, the character of its
customs environment (digitization level, audit culture), and the 3-4 anchors trade-consulting
engagements revolve around (customs authority, electronic single-window if any, FTA network
breadth, drawback regime character). Write for an agent that has never worked this
jurisdiction. -->

## Regulatory & Legal Framework

<!-- Keep the three-column shape. Adapt ROWS to the jurisdiction — the KR profile covers:
customs clearance & tariff, tariff classification & valuation, FTA preferential origin,
export control, sanctions, duty drawback, export insurance & trade finance. Add rows for
jurisdiction-specific regimes (e.g. free-trade-zone law, halal/religious certification law)
and drop rows that genuinely do not exist. Cite instrument names in the official language
with an English translation on first use. -->

| Area | Primary instrument | Supervisory authority / notes |
|------|--------------------|-------------------------------|
| <area> | <statute/notice, official name> | <authority — and the operational note agents need (ruling systems, retention periods, audit culture)> |

<!-- **FTA network block** (keep if the jurisdiction has FTAs; otherwise replace with a
preferential-trade-agreement statement or an explicit "no FTA network" note — never leave
silent): list major agreements, then the one-line warning that each carries its own
rules-of-origin annex and criterion non-harmonization must never be assumed. -->

<!-- **Licensed professionals block**: identify the jurisdiction's licensed customs
intermediary role (KR example: customs brokers licensed by the customs authority), what only
they may do, and which classification determinations rest with an authority body rather than
the exporter. Engagements crossing into formal representation must be flagged for the
licensed role. -->

## Operational Formats

<!-- All seven rows are required — a blank cell must be researched, not guessed. -->

| Format | <XX> convention |
|--------|-----------------|
| Currency | <code, symbol, decimal places convention; FX-reference convention> |
| Date / time | <format; timezone> |
| Business identifiers | <registration/VAT identifiers — digit counts; privacy handling notes where applicable> |
| Customs declaration | <electronic single-window name + authority, or paper process description> |
| Harmonized codes | <national tariff digits = HS 6-digit international + national extensions; state the depth> |
| Document language | <official language(s); accepted international-document languages> |
| <jurisdiction-specific format row if any> | <e.g. certificate of origin issuing body format requirements> |

## Language & Communication Defaults

<!-- Country ≠ language. Keep the KR discipline: documentation language follows the project's
`i18n.locale_codes` setting (workspace schema), NOT this profile. State the jurisdiction's
default for client-facing prose, which documents stay in the official language, and the
statute-name convention (official name in original script with English translation on first
use). -->

## Tooling & Skill Mapping

<!-- List jurisdiction-scoped skills/tools available to projects scaffolded with
`--country <XX>` (KR examples: k-law, k-kosis). If none exist yet, state that explicitly —
agents then cite jurisdiction law from client-supplied sources and flag verification limits
in deliverables. -->

| Skill | Scope | Use under <XX> |
|-------|-------|----------------|
| <skill or "none yet"> | <XX> | <what it provides> |

**Deployment rule**: jurisdiction-scoped skills are `country_scoped_assets` (workspace schema
registry) — they deploy only to projects scaffolded with `--country <XX>`. Region-neutral
co-export projects do not receive them.

---

## Onboarding Checklist

- [ ] Copied this skeleton to `<ISO-3166-1 alpha-2>.md` (uppercase) and deleted the HTML-comment guidance
- [ ] Every Regulatory & Legal Framework row cites the instrument's official name with authority
- [ ] FTA network listed (or explicit no-FTA note) — no silent omission
- [ ] Licensed-professional boundary documented (what agents must escalate, never self-declare)
- [ ] All seven Operational Formats rows filled from verified sources
- [ ] Every factual claim verified against a primary source (statute text, customs authority site, official tariff schedule) — advisory banner stays
- [ ] `status: draft` → `active` and `last_verified` set only after the verification pass
- [ ] Any new jurisdiction-scoped skill registered as a `country_scoped_asset` in the workspace schema registry before this profile references it
