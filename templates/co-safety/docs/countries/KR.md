---
code: KR
name: Republic of Korea
status: active
last_verified: 2026-08-27
---
# Country Profile: KR - Republic of Korea

> Advisory knowledge. Verify against current statutes before relying on it.

## Overview

Profile for engagements anchored to the Republic of Korea. Korean EHS/GxP work is statute-dense and regulation-driven: the `산업안전보건법` (OSHA-KR) carries executive criminal exposure under the `중대재해처벌법` (SAPA), chemical safety is governed by the `화학물질관리법` (CCA), and GxP domains (GMP, GLP, GCP, GDP, GVP) operate under `약사법` and MFDS enforcement. Statutory text, administrative rules, and interpretation cases must be verified through statute lookup (`k-law`) at engagement time — never from memory. When this profile is active, it is the single home for Korean jurisdiction knowledge; base agents reference it rather than restating it.

## Regulatory & Legal Framework

Core EHS statute families:

| Statute | Domain |
|---------|--------|
| `산업안전보건법` (Occupational Safety and Health Act) | General EHS obligations; 위험성평가 (Art 36), 작업허가 (Art 38), PSM (Art 44), MSDS 비치 (Art 110) |
| `중대재해처벌법` (Serious Accidents Punishment Act) | Executive/corporate criminal liability for serious accidents; safety-and-health duty of the responsible executive |
| `화학물질관리법` (Chemical Control Act) | Chemical registration, risk assessment, MSDS/GHS classification |
| `고압가스안전관리법` (High-Pressure Gas Safety Act) | High-pressure gas storage, handling, and facility permits |
| `위험물안전관리법` (Hazardous Materials Safety Act) | Hazardous materials storage, handling, and fire prevention |
| `소방기본법` (Fire Services Act) | Fire prevention, emergency response, fire-safety facility standards |
| GxP family: `약사법` (Pharmaceutical Affairs Act), `의료기기법` (Medical Device Act), `생명윤리법` (Bioethics Act) | Pharmaceutical/medical-device/clinical-trial quality systems |

Regulators and public bodies:

- `고용노동부` (Ministry of Employment and Labor, MOEL) — the competent EHS ministry; OSHA-KR enforcement, SAPA investigation
- `한국산업안전보건공단` (Korea Occupational Safety and Health Agency, KOSHA) — OSH professional institution for system guidance and inspection support
- `소방청` (National Fire Agency) — fire-safety facility standards and emergency-response coordination
- `식품의약품안전처` (Ministry of Food and Drug Safety, MFDS) — GxP enforcement (GMP/GLP/GCP/GDP/GVP), pharmaceutical and medical-device regulation

Licensed professionals:

- `안전보건관리자` (Safety and Health Manager) — mandatory appointment under OSHA-KR for workplace safety management
- `비상계획관리자` (Emergency Plan Manager) — PSM emergency-plan oversight per OSHA-KR Art 44
- `공인노무사` (Certified Labor Attorney) — labor-law compliance advisory
- `변호사` (Attorney) — for matters requiring legal determination or litigation

Key obligations for EHS operations:

- `위험성평가` (Risk Assessment) — mandatory workplace risk evaluation per OSHA-KR Art 36
- `작업허가` (Permit-to-Work) — high-risk or non-routine work authorization per OSHA-KR Art 38
- `안전보건교육` (Safety Training) — worker safety training requirements per OSHA-KR Art 29
- `MSDS 비치` (MSDS Availability) — hazardous chemical safety data sheet placement per OSHA-KR Art 110
- `공정안전관리` (PSM) — Process Safety Management for high-hazard processes per OSHA-KR Art 44

## Operational Formats

- **Currency**: KRW (South Korean won)
- **Timezone**: Asia/Seoul (UTC+9, no daylight saving time)
- **Dates**: `YYYY-MM-DD` (ISO 8601)
- **Registrations relevant to EHS ops**: employer entities are identified by `사업자등록번호` (business registration number); workplaces by `사업장관리번호` (workplace management number)

## Language & Communication Defaults

Korean (`ko`) is the operating language of statutes, regulators, filings, and most client work product; English (`en`) is common with multinational clients. Both are within the project's i18n locale codes (`i18n.locale_codes` in `docs/workspace-schema.json`) — this profile references those settings and never redefines them (country and language are separate axes). Where a deliverable cites law, preserve statutory/case text verbatim in Korean.

## Tooling & Skill Mapping

| Skill | Purpose |
|-------|---------|
| `k-law` | Korean statute/precedent/administrative-rule lookup (National Law Information Center Open API, open.law.go.kr; requires the `LAW_API_OC` environment variable). MUST be used for statutory verification whenever this profile is active — never cite statute text from memory |
| `kr_safety` MCP | OSHA-KR and SAPA regulation index for cross-referencing articles and compliance requirements |

Both `k-law` and `kr_safety` are KR-scoped in the `country_scoped_assets` registry: they are deployed only to projects targeting Korea, so their absence indicates a non-KR project.
