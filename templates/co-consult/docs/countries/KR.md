---
code: KR
name: Republic of Korea
status: active
last_verified: 2026-08-23
---

# Country Profile: KR — Republic of Korea

> **Advisory knowledge.** Verify against current statutes and disclosure rules before relying
> on any statement here. This profile never auto-executes — agents load it at Phase 0 intake
> and treat it as jurisdiction context, not law.

## Overview

KR consulting engagements rely on the KR-scoped `k-law` common skill (registry-governed in
`country_scoped_assets`; deploys only to projects scaffolded with `--country KR`), Korean
company-disclosure data via DART, and Korean statistics via KOSIS. Agents reference it
through this profile rather than through a variant-local copy.

## Regulatory & Legal Framework

| Area | Primary instrument | Supervisory authority / notes |
|------|--------------------|-------------------------------|
| Statutory research | Korean statutes and precedents via the National Law Information Center | `k-law` skill (Open API queries); cite specific articles |
| Corporate disclosure | DART (FSS electronic disclosure system) | company-intelligence skill data source |
| National statistics | KOSIS (Statistics Korea) | workforce/market figures when KR-scoped |

## Operational Formats

| Format | KR convention |
|--------|---------------|
| Currency | KRW (₩) |
| Date / time | YYYY-MM-DD; timezone Asia/Seoul (KST, UTC+9) |
| Financial statements | K-IFRS framing for listed companies |

## Language & Communication Defaults

Country ≠ language: the project's documentation language follows its `i18n.locale_codes`
setting, not this profile. KR engagements commonly work in Korean; the
`company-intelligence` skill's Korean glossary (`references/terms-ko.json`) applies to
Korean-language deliverables.

## Tooling & Skill Mapping

| Skill | Scope | Use under KR |
|-------|-------|--------------|
| `k-law` (KR-scoped common skill) | KR | Statutes, precedents, regulatory context (National Law Information Center); use in Phase 1 research and route findings to `deliverables/research/` per the Output Destination Mapping in `docs/context.md` |

**Deployment rule**: `k-law` is a KR-scoped asset in the `country_scoped_assets` registry - it lives in `templates/common/skills/` and deploys only to projects scaffolded with `--country KR`. Under a non-KR active profile, agents must not cite it and should flag jurisdiction verification limits instead. If recurring lookups reveal stable target-specific parameter sets, capture them following the `k-dart` `references/terms-ko.json` pattern.
