---
code: KR
name: Republic of Korea
status: active
last_verified: 2026-11-21
lang: ko
lang_reason: legal
---

# Country Profile: KR — Republic of Korea

> **Advisory knowledge.** Verify against current statutes, disclosure-system rules, and
> business-document conventions before relying on any statement here. This profile never
> auto-executes — agents load it at Phase 0 intake and treat it as jurisdiction context,
> not law.

## Overview

The KR context for lecture-deck production: decks and lecture materials are most often
consumed by Korean corporate and public-sector audiences, where business-document norms
(존댓말 narration register, formal report conventions), citation practice for Korean media
and disclosure sources, and Hangul typography all shape the deliverable. The variant's
built-in Korean typography defaults (Noto Sans KR / Pretendard / MaruBuri font pools and
the theme Hangul line-break rules) already carry the presentation layer; this profile
covers the jurisdiction knowledge around sources and formats.

## Regulatory & Legal Framework

| Area | Primary instrument | Notes |
|------|--------------------|-------|
| Corporate disclosure | Electronic disclosure rules under the FSS framework | DART filings (`전자공시시스템`, 금융감독원) — receipt numbers are the citation unit for every corporate figure used in deck research |
| Statistics | Statistics Act (`통계법`) framework | KOSIS / data.go.kr figures carry their statistical-table identifiers; `통계청` (Statistics Korea) is the citation authority |
| Financial market data | Capital Markets Act (`자본시장법`) framework | KRX market data cited with the trading date; ECOS (Bank of Korea) series cited with the series code |
| Personal information | Personal Information Protection Act (`개인정보보호법`) | Case studies and audience examples must not expose identifiable personal data |
| Copyright | Copyright Act (`저작권법`) | News clippings and report excerpts used as deck visuals stay within short-quotation practice; full-page scans require permission |

**Licensed professionals:** none required for deck production itself; legal or tax claims
in deck content must be attributed to a named professional source or flagged for client
verification.

## Operational Formats

| Format | KR convention |
|--------|---------------|
| Currency | KRW (₩); Korean numeral units (조/억/만) in narration, Arabic numerals on slides |
| Date / time | YYYY-MM-DD; timezone Asia/Seoul (KST, UTC+9); fiscal years follow the calendar year for most disclosures |
| Number formatting | Korean grouping units (억 = 1e8, 조 = 1e12) — narration says `1조5천억 원` while the slide shows `150조원`-scale axis labels; never mix `$` figures with ₩ narration without a stated FX basis |
| Audience address | 존댓말 (polite register) in scripts and narration; `~습니다` style for corporate and lecture audiences |
| Citation lines | Outlet/institution + date (e.g. `연합뉴스 2026-05-29`, `DART 공시 2026-03-31`); disclosure figures cite the DART receipt number in the references appendix |

## Language & Communication Defaults

Country ≠ language: the deck language follows the project's `i18n.locale_codes` setting
and the Phase 0 assignment, not this profile. Under KR the default is `ko`; the Korean
AI-tell lint (external-deps id `humanize`) applies to Korean narration text only — an
English-language deck about a Korean topic is not linted by it.

## Tooling & Skill Mapping

| Skill | Scope | Use under KR |
|-------|-------|--------------|
| `k-dart` | KR | DART OpenAPI — Korean corporate disclosures for deck research (company overview, financial statements, major-report search) |
| `k-kosis` | KR | KOSIS statistical tables for market-size and demographic slides |
| `k-opendata` | KR | data.go.kr datasets for public-sector topic decks |
| `k-ecos` | KR | Bank of Korea ECOS series for macro-economic slides |
| `k-krx` | KR | KRX market data for industry and capital-market slides |
| `k-law` | KR | Statutes and regulatory context (National Law Information Center) when deck content touches regulated claims |

**Deployment rule**: these are `country_scoped_assets` (workspace schema registry) — they
deploy only to projects scaffolded with `--country KR`. Without them, Korean corporate and
statistical figures must come from client-supplied sources, with verification limits
flagged. The `humanize` external (Korean AI-tell lint, storyline Step 1.6) is NOT
country-scoped — it is a `ko-language` dependency delivered to every co-deck project
regardless of country.
