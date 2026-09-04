---
code: KR
name: Republic of Korea
status: active
last_verified: 2026-09-04
lang: ko
lang_reason: legal
---

# Country Profile: KR — Republic of Korea

> **Advisory knowledge.** Verify against current statutes, tariff schedules, and FTA texts
> before relying on any statement here. This profile never auto-executes — agents load it at
> Phase 0 intake and treat it as jurisdiction context, not law.

## Overview

South Korea is a trade-intensive economy (exports ≈ 40%+ of GDP) operating one of the world's
most digitized customs environments. Trade consulting engagements anchored here revolve around
the Korea Customs Service (KCS, `관세청`), the UNI-PASS electronic single-window, an unusually
broad FTA network, and a drawback regime that is generous but deadline-driven.

## Regulatory & Legal Framework

| Area | Primary instrument | Supervisory authority / notes |
|------|--------------------|-------------------------------|
| Customs clearance & tariff | Customs Act (`관세법`) | Korea Customs Service (KCS) — post-clearance audit culture; strict 5-year record retention |
| Tariff classification & valuation | Customs Act + HS-based tariff schedule (Korea Customs Tariff) | KCS rulings; advance classification ruling system |
| FTA preferential origin | Korea's FTA network (see below) | Origin certification via Korea Customs / issuing bodies; RVC and CTC rules per agreement |
| Export control | Foreign Trade Act (Chapter on Trade Security) + Strategic Items Trade Control Notice | Ministry of Trade, Industry and Energy (MOTIE) / Korea Strategic Trade Institute (KOSTI) — strategic-item classification, export licensing |
| Sanctions | Foreign Exchange Transactions Act + UN Security Council resolutions incorporated domestically | Bank of Korea / financial-intelligence enforcement; separate domestic sanctioned-party list |
| Duty drawback | Act on Special Cases Concerning the Refund of Customs Duties, etc. Levied on Raw Materials for Export | KCS — refund-eligible raw material determination, individual vs. simplified fixed-rate method |
| Export insurance & trade finance | Trade Insurance Act | K-SURE (Korea Trade Insurance Corporation); KITA (Korea International Trade Association) supports SME export documentation |

**KR FTA network (major agreements):** RCEP, Korea–US (KORUS), Korea–EU, Korea–China,
Korea–ASEAN, Korea–India (CEPA), Korea–EFTA, Korea–UK, Korea–Peru, Korea–Turkey,
Korea–Australia, Korea–Canada, Korea–Vietnam (VKFTA), Korea–Colombia, Korea–Israel,
Korea–Central America. Each carries its own rules-of-origin annex — never assume criterion
harmonization across agreements.

**Licensed professionals:** customs brokers (`관세사`, licensed by KCS) file declarations through
UNI-PASS on the client's behalf; engagements that cross into formal customs representation
must be flagged for a licensed `관세사`. Strategic-item classification determinations rest with
KOSTI — agents recommend pre-classification, never self-declare controlled status.

## Operational Formats

| Format | KR convention |
|--------|---------------|
| Currency | KRW (₩), no decimal places; FX-referenced values also quoted in USD |
| Date / time | YYYY-MM-DD; timezone Asia/Seoul (KST, UTC+9) |
| Business identifiers | Business registration number (10 digits) — personal-adjacent data, handle per privacy rules |
| Customs declaration | UNI-PASS electronic single-window (KCS); paper filings exceptional |
| Harmonized codes | 10-digit Korea Customs Tariff (HS 6-digit international + KR extensions) |
| Document language | Korean official; English accepted for international trade documents (B/L, invoice, COO) |

## Language & Communication Defaults

Country ≠ language: the project's documentation language follows its `i18n.locale_codes`
setting (workspace schema), not this profile. KR engagements default to `ko` for
client-facing prose with English trade documents per the row above; Korean statute names stay
in Korean with English translations on first use (e.g., `관세법` — Customs Act).

## Tooling & Skill Mapping

| Skill | Scope | Use under KR |
|-------|-------|--------------|
| `k-law` | KR | Statutory research for Customs Act, Foreign Trade Act, drawback statute texts (open.law.go.kr API) |
| `k-kosis` | KR | Trade statistics, export/import volume data for market-entry analysis |

**Deployment rule**: these are `country_scoped_assets` (workspace schema registry) — they
deploy only to projects scaffolded with `--country KR`. Region-neutral co-export projects do
not receive them; agents then cite jurisdiction law from client-supplied sources and flag
verification limits in deliverables.
