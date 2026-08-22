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

KR consulting engagements rely on the `k-law` variant skill (a co-consult fork of the common
KR statutory-research skill), Korean company-disclosure data via DART, and Korean statistics
via KOSIS. The fork copy exists because co-consult agents reference it directly in
`variant.json` / AGENTS.md; it stays in sync with the common skill's KR scope.

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
| `k-law` (variant fork) | KR | Statutes, precedents, regulatory context (National Law Information Center) |

**Deployment rule**: `k-law` is a KR-scoped asset (fork copy of the common skill; the
`country_scoped_assets` registry governs the common original). The fork deploys with the
variant; under a non-KR target country, agents must not cite it and should flag
jurisdiction verification limits instead.
