---
lang: ko
lang_reason: legal
code: KR
name: Republic of Korea
status: active
last_verified: 2026-09-26
---

# Country Profile: KR — Republic of Korea

> **Advisory knowledge.** Verify against current statutes and codes before relying on any
> statement here. This profile never auto-executes — agents load it at engagement start and
> treat it as jurisdiction context, not law. The executable counterpart of this profile
> (concept labels and the machine-readable 건축용어 glossary) is
> `src/cad_intelligence/ontology/profiles/KR.yaml`, selected by the `CAD_COUNTRY` variable.

## Overview

co-architect reads Korean apartment floor plans (DWG) and produces room/door/window
recognition scored against Korean-labeled ground truths, interior elevations, and drawing
sets. Every drawing processed so far uses Korean space labels (거실, 주방, 욕실, …) and
Korean apartment conventions (mirrored units with `_R`, shared cores, expanded balconies,
sunken bathrooms). Korean is therefore the default user language and KR the default
country profile.

## Regulatory & Legal Framework

| Area | Primary instrument | Notes for recognition/drafting |
|------|--------------------|--------------------------------|
| Building code | 건축법 (Building Act) and 시행령/기준 | Room sizing, natural lighting/ventilation per use, stair and corridor widths — affects future code-check skills |
| Zoning | 국토의 계획 및 이용에 관한 법률 (National Land Planning and Utilization Act) | 용적률 (FAR) / 건폐율 (BCR) limits differ per region and use district |
| Architect licensing | 건축사법 (Architects Act) | Drawing-set signing/stamping rules for delivered DWG/PDF sets |
| Housing | 주택법 (Housing Act) | 공동주택 unit-area definitions (전용/공용/서비스면적) used by area schedules |

## Operational Formats

- Units: mm for all drawing dimensions; ㎡ (소수 첫째 자리) for areas in review output.
- Numbers: thousands separator in mm text (2,300); decimal point (not comma).
- Language: Korean for all user-facing review tables and messages; English for file
  contents, JSON keys, code and commit/PR text (workspace language policy).
- Area conventions: 전용면적 / 공용면적 / 서비스면적 / 공급면적 — see the glossary in
  `src/cad_intelligence/ontology/profiles/KR.yaml` and
  `skills/cad-space-recognition/references/GLOSSARY-ko.md`.

## Language & Communication Defaults

- Locale `ko-KR`; the workspace i18n settings govern translation zones.
- Korean drawing labels are kept verbatim in data (including odd whitespace) and
  normalized only when compared (`ontology/names.py`).
- Korean-language skills assets: `skills/cad-space-recognition/references/GUIDE-ko.md`
  (user-guide) and `references/GLOSSARY-ko.md` (terminology).

## Tooling & Skill Mapping

| Asset | Purpose |
|-------|---------|
| `CAD_COUNTRY=KR` (env, default) | selects `src/cad_intelligence/ontology/profiles/KR.yaml` — concept labels + 건축용어 glossary |
| `cad-space-recognition` v1.5.0 | vision-first recognition with Korean review flow and KR glossary (`references/GLOSSARY-ko.md`) |
| `reading-rules.json` R01–R26 | plan-reading rules; currently all `jurisdiction: *` — KR-specific rules are tagged `jurisdiction: [KR]` |
| `LAW_API_OC` (env) | 법제처 Open API key for statute lookup in compliance work |
