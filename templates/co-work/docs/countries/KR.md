---
code: KR
name: Republic of Korea
status: active
last_verified: 2026-11-21
lang: ko
lang_reason: legal
---

# Country Profile: KR — Republic of Korea

> **Advisory knowledge.** Verify against current statutes, regulatory rules, and
> engagement conventions before relying on any statement here. This profile never
> auto-executes — agents load it at Phase 0 intake and treat it as jurisdiction context,
> not law.

## Overview

The KR context for general knowledge-work engagements: deliverables for Korean clients
follow Korean business-document conventions (formal report register, 존댓말 address
style), corporate and market facts trace to Korean disclosure and statistics systems, and
meeting/connectors material follows Korean business etiquette (title-first address,
hierarchy-aware communication). This profile carries the jurisdiction knowledge that
shapes sourcing, formats, and communication defaults for Korean engagements.

## Regulatory & Legal Framework

| Area | Primary instrument | Notes |
|------|--------------------|-------|
| Corporate disclosure | Electronic disclosure rules under the FSS framework | DART filings (`전자공시시스템`, 금융감독원) — receipt numbers are the citation unit for every corporate figure |
| Statistics | Statistics Act (`통계법`) framework | KOSIS / data.go.kr figures carry their statistical-table identifiers; `통계청` (Statistics Korea) is the citation authority |
| Financial market data | Capital Markets Act (`자본시장법`) framework | KRX market data cited with the trading date; ECOS (Bank of Korea) series cited with the series code |
| Personal information | Personal Information Protection Act (`개인정보보호법`) | Client deliverables must not expose identifiable personal data; pseudonymized/aggregated figures only |
| Commercial contracts | Korean Commercial Act (`상법`) framework | Contract-adjacent deliverables reference specific articles, never vague summaries; attorney review for binding legal claims |

**Licensed professionals:** attorney or certified-tax-accountant review is required for
deliverables that render binding legal or tax conclusions; general engagement work
documents claims with named sources instead.

## Operational Formats

| Format | KR convention |
|--------|---------------|
| Currency | KRW (₩); Korean numeral units (조/억/만) in Korean-language prose, Arabic numerals in tables |
| Date / time | YYYY-MM-DD; timezone Asia/Seoul (KST, UTC+9) |
| Document register | Formal report style (`~합니다`/`~이다` per the engagement's document-style registry); Korean client-facing prose, English git artifacts |
| Business etiquette | Title-first address (`홍길동 팀장`), company + title in meeting rosters; hierarchical order in attendee lists |
| Citation lines | Outlet/institution + date (e.g. `연합뉴스 2026-05-29`, `DART 공시 2026-03-31`) |

## Language & Communication Defaults

Country ≠ language: the deliverable language follows the project's `i18n.locale_codes`
setting and the Phase 0 assignment, not this profile. Under KR the default is `ko`; the
Korean AI-tell lint family (external-deps entries behind the humanize adapter) applies to
Korean deliverable prose only — an English deliverable for a Korean client is not linted
by it.

## Tooling & Skill Mapping

| Skill | Scope | Use under KR |
|-------|-------|--------------|
| `k-dart` | KR | DART OpenAPI — Korean corporate disclosures for research and analysis deliverables |
| `k-kosis` | KR | KOSIS statistical tables for market and demographic analysis |
| `k-opendata` | KR | data.go.kr datasets for public-sector research |
| `k-ecos` | KR | Bank of Korea ECOS series for macro-economic analysis |
| `k-krx` | KR | KRX market data for capital-market analysis |
| `k-law` | KR | Statutes and regulatory context (National Law Information Center); disclaimer "not legal advice" mandatory |

**Deployment rule**: these are `country_scoped_assets` (workspace schema registry) — they
deploy only to projects scaffolded with `--country KR`. Without them, Korean corporate and
statistical figures must come from client-supplied sources, with verification limits
flagged. Korean-language externals in the seed (`market_scope: ["ko-language"]`) are NOT
country-scoped — language scope never implies country scope (ADR-0057 §5).
