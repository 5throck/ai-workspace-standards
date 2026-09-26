---
code: KR
name: Republic of Korea
status: active
last_verified: 2026-08-19
lang: ko
lang_reason: legal
---

# Country Profile: KR — Republic of Korea

> **Advisory knowledge.** Verify against current statutes and regulator guidance before
> relying on any statement here. This profile never auto-executes — agents load it at
> Phase 0 intake and treat it as jurisdiction context, not law.
>
> Provenance: authored 2026-09-12 when this project adopted the KR country profile
> (post-scaffold flip from region-neutral), adapted from the fleet country-profile
> skeleton. Verified 2026-09-26 via the adopted `region-profiles/KR.yaml` layer
> (provenance-validated statutory data, verified_on 2026-08-19 — ADR-0091); status promoted to `active`.

## Overview

Profile for pricing engagements anchored to the Republic of Korea. Korean pricing work operates under an active competition-regulator regime: the `공정거래위원회` (Korea Fair Trade Commission, KFTC) enforces both unfair trade practices (including resale price maintenance) and consumer display/advertising rules, while consumer-facing price claims are additionally shaped by e-commerce consumer-protection duties. The market is price-transparent (heavy e-commerce, posted-price culture) and unusually rich in public price statistics, so benchmarking work should anchor on official series (KOSIS, Bank of Korea ECOS) rather than memory. Statutory text and regulator guidance must be verified through statute lookup (`k-law`) at engagement time.

## Regulatory & Legal Framework

Core statute families relevant to pricing:

| Statute | Domain |
|---------|--------|
| `독점규제 및 공정거래에 관한 법률` (Monopoly Regulation and Fair Trade Act, 통칭 `공정거래법`) | Unfair trade practices: resale price maintenance (`재판매가격유지`) prohibited in principle (narrow statutory exceptions), price-dumping/predatory-pricing review (`부당한 가격의 공급`), competitor agreements and price-signal coordination (`부당한 공동행위`) |
| `소비자기본법` (Framework Act on Consumers) | Unfair display/advertising (`표시·광고`) rules enforced via KFTC deliberation — misleading reference prices, fake-discount claims, bait pricing |
| `전자상거래 등에서의 소비자보호에 관한 법률` (Act on Consumer Protection in Electronic Commerce) | Online price display accuracy, order/cancellation duties for e-commerce pricing and promotion flows |
| `부가가치법` (Value-Added Tax Act) | Single standard VAT rate (10% at last review — verify at engagement time); tax-inclusive vs tax-exclusive display conventions for B2C vs B2B quotes |

Regulators and public bodies:

- `공정거래위원회` (Korea Fair Trade Commission, KFTC) — competition enforcement and display/advertising deliberation (`표시광고심의`); the primary exposure route for pricing recommendations
- `한국소비자원` (Korea Consumer Agency) — consumer complaints and dispute mediation touching price claims
- `국세청` (National Tax Service) — VAT administration and tax-invoice (`세금계산서`) practice

Licensed professionals:

- `변호사` (attorney) — any legal determination on pricing-conduct risk (RPM, dumping, cartel exposure) must be escalated; this project advises, it does not render legal opinions
- `공인회계사` (certified public accountant, CPA) — VAT treatment and tax-inclusive price structuring

Key cautions for pricing work:

- Never facilitate competitor price agreements or orchestrated price signaling — `부당한 공동행위` exposure; benchmark from public data only
- Supplier-imposed resale price maintenance is prohibited in principle — model recommended prices as independent retailer decisions
- Reference-price and discount claims (`정가 대비 할인`) need substantiation of the genuine prior price — fake-anchor display is a KFTC enforcement theme
- State explicitly whether quoted prices are VAT-inclusive; mixed conventions in one deliverable invite consumer-law exposure

## Operational Formats

- **Currency**: KRW (`원`, symbol `₩`) — no decimal subunit in practice; round modeled prices to whole won
- **Timezone**: Asia/Seoul (UTC+9, no daylight saving time)
- **Dates**: `YYYY-MM-DD` (ISO 8601)
- **VAT**: single standard rate 10% (verify at engagement time; no reduced rates at last review)
- **Business identifiers**: entities identified by `사업자등록번호` (10-digit business registration number, doubles as the VAT identifier) — treat as non-public business data
- **Number formatting**: thousands grouping with commas; `원` suffix in client-facing prose

## Language & Communication Defaults

Korean (`ko`) is the operating language of statutes, regulator guidance, and most client work product; English (`en`) is common with multinational clients. Both are within the project's i18n locale codes (`i18n.locale_codes` in `docs/workspace-schema.json`) — this profile references those settings and never redefines them (country and language are separate axes). Where a deliverable cites law or regulator guidance, preserve statutory text verbatim in Korean.

## Tooling & Skill Mapping

> Structured regulatory layer: [`region-profiles/KR.yaml`](../../region-profiles/KR.yaml) (ADR-0091) — provenance-validated sections for M&A, labor, tax, FX, sanctions, and more.

| Skill | Use under KR |
|-------|--------------|
| `k-law` | Statute lookup (`공정거래법`, `소비자기본법`, `전자상거래법`, `부가가치법`) — verify pricing-relevant rules at engagement time |
| `k-kosis` | Statistics Korea (KOSIS) series — consumer price index (`소비자물가지수`), industry statistics for willingness-to-pay and cost benchmarking |
| `k-ecos` | Bank of Korea ECOS — producer price indices, exchange-rate reference series for import-cost pass-through modeling |
| `k-dart` | DART disclosures — listed competitors' segment revenue and price-change disclosures for public benchmarking |
| `k-opendata` | Public Data Portal (`data.go.kr`) datasets (e.g. customs HS trade statistics) for import-cost and market-sizing inputs |
| `k-krx` | Korea Exchange market data — context for listed competitors' financials; peripheral to core pricing work |

**Deployment rule**: the skills above are `country_scoped_assets` (workspace schema
registry) — they deploy only to projects with the KR country profile. This project
adopted them via `skill_manifest.allowlist` in `variant.json` at profile adoption.
