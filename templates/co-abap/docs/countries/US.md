---
code: US
name: United States of America
status: draft
last_verified: 2026-10-12
---
# Country Profile: US — United States of America

> Advisory knowledge. Verify against current statutes before relying on it.

## Overview

Profile for deliverables anchored to the US market — US-facing reports, interfaces, forms, and master data. The defining operational deltas against the KR default are the currency's decimal places, date/number notation, the DST-affected time zone, US customary units, and Letter paper.

## Regulatory & Legal Framework

Not mapped in this variant. Route jurisdictional questions (trade/customs, labor law, industry regulation) back to the PM for dispatch to a domain expert — do not answer them here.

## Operational Formats

Each row names the SAP concept that carries the convention. Checklist rules: `docs/sap-globalization-checklist.md`.

| Dimension | US convention | SAP development note |
|---|---|---|
| Currency | USD ($), **2 decimal places** | TCURX decimals for USD = 2; monetary output always `WRITE ... CURRENCY` |
| Date notation | `MM/DD/YYYY` (user-master date format) | Never assemble as text; rely on user profile or `SET COUNTRY 'US'` in non-interactive output |
| Number notation | `1,234.56` (comma grouping, period decimal) | Inherited from user master; batch/interface output fixes the country explicitly |
| Time zone | `America/New_York` etc. — **DST, shifts twice a year** | Never cache a fixed offset (-5/-4 EDT/EST); store UTC, convert at display via the zone ID (checklist T-4); watch batch schedules at DST transitions |
| Units | US customary (in, ft, lb, °F); metric co-display where the audience is mixed | T006 internal codes; conversion only via standard function units — never hardcoded factors (2.54, 0.3048) |
| Paper size | US Letter (8.5 × 11 in / 216 × 279 mm) | Spool device type and form page size LETTER; an A4-sized form printed on Letter breaks margins |
| Address format | US layout per T005 address format; ZIP/ZIP+4 | Use standard address handling |
| Business calendar | US factory/holiday calendar variant | Delivery and deadline logic uses the US calendar variant, not weekday arithmetic |

## Language & Communication Defaults

- Primary user language: English (`en`). One language spans many countries — do not infer the country from the language.
- Repository artifacts follow the workspace English-only policy (`docs/context.md`).
- Deliverable manuals for US audiences use the EN master (`07_user_manual.md`).

## Tooling & Skill Mapping

| Skill | Purpose |
|---|---|
| `sap-fi`, `sap-co`, `sap-mm`, `sap-sd`, `sap-pp`, `sap-le` | Module guidance (country-independent) |
| `i18n-locale-config`, `i18n-formatting` | Document-side locale and formatting guidance (workspace deliverables) |

No country-scoped skills are installed in this variant.
