---
code: JP
name: Japan
status: draft
last_verified: 2026-10-12
---
# Country Profile: JP — Japan

> Advisory knowledge. Verify against current statutes before relying on it.

## Overview

Profile for deliverables anchored to the Japanese market — JP-facing reports, interfaces, forms, and master data. Beyond the usual currency/date/time deltas, Japan adds three dimensions most profiles do not have: era-based (和暦) dates in official documents, full-width character conventions, and an April–March fiscal year.

## Regulatory & Legal Framework

Not mapped in this variant. Route jurisdictional questions (trade/customs, labor law, industry regulation) back to the PM for dispatch to a domain expert — do not answer them here.

## Operational Formats

Each row names the SAP concept that carries the convention. Checklist rules: `docs/sap-globalization-checklist.md`.

| Dimension | JP convention | SAP development note |
|---|---|---|
| Currency | JPY (¥), **0 decimal places** | TCURX decimals for JPY = 0; monetary output always `WRITE ... CURRENCY` — omitting it shifts JPY amounts by 100× |
| Date notation | `YYYY/MM/DD`; official documents may use era years (和暦, e.g. Reiwa) | Never assemble as text; rely on user profile or `SET COUNTRY 'JP'` in non-interactive output. Era-based display is a presentation-layer concern — keep the stored value a plain date |
| Number notation | `1,234.56` (comma grouping, period decimal) | Inherited from user master; batch/interface output fixes the country explicitly |
| Time zone | `Asia/Tokyo` — UTC+9, **no daylight saving** | IANA-style ID; safe for fixed-offset reasoning but still store UTC and convert at display (checklist T-1..T-4) |
| Units | Metric (mm, cm, m, kg) | T006 internal codes with T006A Japanese display texts |
| Paper size | A4 for business output; JIS B-series (B4/B5) common for ledgers and publications | Spool device type / form page size A4 by default; confirm B-series needs per form before committing a layout |
| Address format | JP layout per T005; 7-digit postal code (`〒NNN-NNNN`); large-to-small order (prefecture → city → ward → street), building name last | Use standard address handling; a Western small-to-large layout is a visible defect on JP-facing forms |
| Name order | Family name first (氏名); forms and master-data name fields must not silently swap order | Preserve field semantics end-to-end (capture, storage, output); do not "normalize" to given-name-first in code |
| Character width | Full-width (zenkaku) alphanumerics/punctuation common in Japanese text | Never mix widths silently in comparisons, keys, or interfaces; Unicode (post-2025 mandatory) — no Shift-JIS-dependent code |
| Fiscal year | April–March | FI fiscal year variant with non-calendar start; postings, depreciation, and period-end reporting key off it — never assume calendar-year periods in JP-scoped logic |
| Business calendar | JP factory/holiday calendar variant | Delivery and deadline logic uses the JP calendar variant, not weekday arithmetic |

## Language & Communication Defaults

- Primary user language: Japanese (`ja`). SAP logon language JA for Japanese users; non-interactive contexts that read language-dependent texts set the language explicitly (`SET LANGUAGE`).
- Repository artifacts follow the workspace English-only policy (`docs/context.md`) — this profile documents Japanese conventions, it is not written in Japanese.
- User-facing deliverables (manuals) for JP audiences are translated from the EN master (`07_user_manual.md`) via the `translate` process.

## Tooling & Skill Mapping

| Skill | Purpose |
|---|---|
| `sap-fi`, `sap-co`, `sap-mm`, `sap-sd`, `sap-pp`, `sap-le` | Module guidance (country-independent) |
| `i18n-locale-config`, `i18n-formatting` | Document-side locale and formatting guidance (workspace deliverables) |
| `translate` | File translation process for EN deliverables |

No country-scoped skills are installed in this variant.
