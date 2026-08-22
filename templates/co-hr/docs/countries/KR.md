---
code: KR
name: Republic of Korea
status: active
last_verified: 2026-08-23
---
# Country Profile: KR - Republic of Korea

> Advisory knowledge. Verify against current statutes before relying on it.

## Overview

Profile for engagements anchored to the Republic of Korea. Korean labor-law work is statute-dense and precedent-driven: work rules (`취업규칙`) operate under a filing regime, dismissal and labor-practice disputes route through the `노동위원회` (Labor Relations Commission), and occupational safety carries executive criminal exposure under the `중대재해처벌법`. Statutory text, administrative rules, and precedent must be verified through statute lookup (`k-law`) at engagement time - never from memory. When this profile is active, it is the single home for Korean jurisdiction knowledge; base agents reference it rather than restating it.

## Regulatory & Legal Framework

Core labor statute families:

| Statute | Domain |
|---------|--------|
| `근로기준법` (Labor Standards Act) | Wages, working time, statutory leave, work rules (`취업규칙`) requirements |
| `노동조합및노동관계조정법` (Trade Union and Labor Relations Adjustment Act) | Unions (`노동조합`), collective bargaining (`단체교섭`), dispute adjustment |
| `근로자참여및협력증진에관한법률` (Act on the Promotion of Worker Participation and Cooperation) | Statutory basis for the `노사협의회` (Labor-Management Council) - legally distinct from a union; do not conflate council consultation duties with bargaining duties |
| `산업안전보건법` (Occupational Safety and Health Act) | General OSH obligations; `산업안전보건위원회` (Occupational Safety and Health Committee) operation |
| `중대재해처벌법` (Serious Accidents Punishment Act) | Executive/corporate criminal liability for serious accidents; safety-and-health duty of the responsible executive |

Regulators and public bodies:

- `고용노동부` (Ministry of Employment and Labor) - the competent labor ministry; work-rule filing and labor-administration guidance
- `노동위원회` (Labor Relations Commission) - quasi-judicial relief proceedings for unfair dismissal (`부당해고`) and unfair labor practice (`부당노동행위`)
- `한국산업안전보건공단` (Korea Occupational Safety and Health Agency, KOSHA) - safety-and-health professional institution for OSH system guidance

Licensed professionals:

- `공인노무사` (certified labor attorney) - the licensed labor professional for Korean labor-law matters
- `변호사` (attorney) - for matters requiring legal determination or litigation

Key obligations for HR operations:

- Work rules (`취업규칙`) drafting and filing - prepare and file with the competent labor office where statutory thresholds are met; amendments follow the statutory consultation/reporting procedure
- Wage and working-time rules - wage statements, overtime, flexible working-time schemes, and statutory leave entitlements per `근로기준법`
- Restructuring - voluntary-retirement (`희망퇴직`) programs require documented business necessity and defensible selection criteria

## Operational Formats

- **Currency**: KRW (South Korean won)
- **Timezone**: Asia/Seoul (UTC+9, no daylight saving time)
- **Dates**: `YYYY-MM-DD` (ISO 8601)
- **Registrations relevant to HR ops**: employer entities are identified by `사업자등록번호` (business registration number); individual workers by `주민등록번호` (resident registration number) - the latter is sensitive personal data, so collect and store it only where legally required and prefer alternatives for identity verification in HR systems

## Language & Communication Defaults

Korean (`ko`) is the operating language of statutes, regulators, filings, and most client work product; English (`en`) is common with multinational clients. Both are within the project's i18n locale codes (`i18n.locale_codes` in `docs/workspace-schema.json`) - this profile references those settings and never redefines them (country and language are separate axes). Where a deliverable cites law, preserve statutory/case text verbatim in Korean.

## Tooling & Skill Mapping

| Skill | Purpose |
|-------|---------|
| `k-law` | Korean statute/precedent/administrative-rule lookup (National Law Information Center Open API, open.law.go.kr; requires the `LAW_API_OC` environment variable). MUST be used for statutory verification whenever this profile is active - never cite statute text from memory |
| `k-kosis` | Korean national statistics (KOSIS) for labor-market and workforce statistics |

Both skills are KR-scoped in the `country_scoped_assets` registry: they are deployed only to projects scaffolded with `--country KR`, so their absence indicates a non-KR project.
