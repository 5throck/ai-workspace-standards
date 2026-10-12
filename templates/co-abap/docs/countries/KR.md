---
code: KR
name: Republic of Korea
status: draft
last_verified: 2026-10-12
---
# Country Profile: KR — Republic of Korea

> Advisory knowledge. Verify against current statutes before relying on it.

## Overview

co-abap's operating context: a Korean development team delivering ABAP work on SAP trial/demo systems (NPL). This profile applies when a deliverable is anchored to the Korean market — user-facing reports, forms, master data, and business correspondence. It defines the operational-format assumptions SAP code and output must honor; the regulatory dimension is out of scope for this variant.

## Regulatory & Legal Framework

Not mapped in this variant. Route jurisdictional questions (trade/customs, labor law, industry regulation) back to the PM for dispatch to a domain expert — do not answer them here (see the i18n-specialist routing rules).

## Operational Formats

Each row names the SAP concept that carries the convention. Checklist rules: `docs/sap-globalization-checklist.md`.

| Dimension | KR convention | SAP development note |
|---|---|---|
| Currency | KRW (₩), **0 decimal places** | TCURX decimals for KRW = 0; monetary output always `WRITE ... CURRENCY` — omitting it shifts KRW amounts by 100× |
| Date notation | `YYYY.MM.DD` (user-master date format 1/3 depending on profile) | Never assemble as text; rely on user profile or `SET COUNTRY 'KR'` in non-interactive output |
| Number notation | `1,234.56` (comma grouping, period decimal) | Inherited from user master; batch/interface output fixes the country explicitly |
| Time zone | `Asia/Seoul` — UTC+9, **no daylight saving** | IANA-style ID; safe for fixed-offset reasoning but still store UTC and convert at display (checklist T-1..T-4) |
| Units | Metric (mm, cm, m, kg) | T006 internal codes with T006A Korean display texts; no imperial conversion in KR-facing output |
| Paper size | A4 (210 × 297 mm) | Spool device type and Smart Form/Adobe Form page size A4 — independent of document language (an English form printed in Seoul is A4) |
| Address format | KR layout per T005 address format; 5-digit postal code | Use standard address handling; one hardcoded layout for all countries is a defect |
| Business calendar | KR factory/holiday calendar variant | Delivery and deadline logic uses the KR calendar variant, not weekday arithmetic |

## Language & Communication Defaults

- Primary user language: Korean (`ko`). SAP logon language KO for Korean users; non-interactive contexts that read language-dependent texts set the language explicitly (`SET LANGUAGE`).
- Repository artifacts follow the workspace English-only policy (`docs/context.md`) — this profile documents Korean conventions, it is not written in Korean.
- User-facing deliverables (manuals) ship EN/KO (`07_user_manual.md` / `07_user_manual_ko.md`).

## Tooling & Skill Mapping

| Skill | Purpose |
|---|---|
| `sap-fi`, `sap-co`, `sap-mm`, `sap-sd`, `sap-pp`, `sap-le` | Module guidance (country-independent) |
| `i18n-locale-config`, `i18n-formatting` | Document-side locale and formatting guidance (workspace deliverables) |
| `translate` | File translation process for EN/KO deliverables |

No country-scoped skills (`k-law`, `k-dart`, `k-kosis`) are installed in this variant.
