---
code: KR
name: Republic of Korea
status: active
last_verified: 2026-09-04
lang: ko
lang_reason: legal
---

# Country Profile: KR — Republic of Korea

> **Advisory knowledge.** Verify against current statutes, disclosure-system rules, and press
> regulations before relying on any statement here. This profile never auto-executes — agents
> load it at Phase 0 intake and treat it as jurisdiction context, not law.

## Overview

The KR market context: KRX-listed companies disclose through DART (`전자공시시스템`, operated by
the Financial Supervisory Service / `금융감독원`), financial journalism follows the Sedaily /
TheBell register conventions (see the source-material style guide), and the default article
language is Korean.

## Regulatory & Legal Framework

| Area | Primary instrument | Supervisory authority / notes |
|------|--------------------|-------------------------------|
| Corporate disclosure | Electronic disclosure rules under the FSS framework | DART filings — receipt numbers are the citation unit for every figure |
| Commercial-law claims | Korean Commercial Act (`상법`) | Cite specific articles (e.g., Article 418) — never vague summaries |
| Press disputes / corrections | Act on Press Arbitration and Remedies (`언론중재법`) — `정정보도` (corrective report) mechanics | Press Arbitration Commission; follow-on remedies for disputed reporting |
| Broadcast/content standards | Broadcast Communications Act framework | `방송통신심의위원회` (Korea Communications Standards Commission) — content-deliberation exposure |
| Legal research | National Law Information Center | Via the `k-law` skill; disclaimer "not legal advice" mandatory |

**Licensed professionals:** attorney review for defamation-adjacent or `정정보도`-triggering
conclusions; the variant produces journalism, not legal advice.

## Operational Formats

| Format | KR convention |
|--------|---------------|
| Currency | KRW (₩); numeral grouping in Korean units (jo/eok/man) in Korean-language articles only |
| Date / time | YYYY-MM-DD; timezone Asia/Seoul (KST, UTC+9) |
| Article language | Korean default (see Language below); git artifacts always English |
| Disclosure citation | DART receipt number; disclaimer "Based on FSS DART (Financial Supervisory Service electronic disclosure system) filing data" |

## Language & Communication Defaults

Country ≠ language: the article/output language follows the project's `i18n.locale_codes`
setting and the Phase 0 assignment, not this profile. Under KR the default is `ko`; the
Korean numeral-grouping units appear only in Korean-language articles.

## Tooling & Skill Mapping

| Skill | Scope | Use under KR |
|-------|-------|--------------|
| `k-dart` | KR | DART OpenAPI — disclosure search, company overview, financial statements, major-report search |
| `k-law` | KR | Statutes, precedents, regulatory context (National Law Information Center) |

**Deployment rule**: these are `country_scoped_assets` (workspace schema registry) — they
deploy only to projects scaffolded with `--country KR`. Without them, financial figures and
legal claims must come from client-supplied sources, with verification limits flagged.
