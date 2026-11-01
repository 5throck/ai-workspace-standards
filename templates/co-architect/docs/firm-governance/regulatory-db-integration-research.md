---
lang: ko
lang_reason: legal
---

# Regulatory DB Integration Research Report

**Meeting Action Item**: A-05 (Architecture-Firm AI Agent Team — Research Agent + QA Agent)
**Author**: Research & Data Analyst (`agents/analyst.md`)
**Date**: 2026-06-16
**Status**: Findings Report (read-only output; recommendations submitted for PM/leadership decision)

---

## 1. Executive Summary

**Top recommendation**: Build the regulatory data layer on the **Korea Legislation Research Institute / Ministry of Government Legislation (법제처) National Law Information Center (law.go.kr) Open API** — operated through the official **National Legal Information Joint Use portal (`open.law.go.kr`)** and mirrored on the **Public Data Portal (`data.go.kr`)**. This source is **free, officially licensed under KOGL Type 1 (attribution only — commercial use, derivative works, and redistribution all permitted)**, covers the entire required scope (건축법, 시행령, 시행규칙, 소방시설법, 시/도 조례, 지구단위계획-related ordinances), and — critically for the freshness risk identified in the meeting — **exposes dedicated amendment-history APIs** (`법령 변경이력 목록 조회`, data.go.kr ID `15058499`; `법령 연혁 본문 조회`, ID `15058848`) that let the system detect every promulgation/enforcement-date change programmatically.

**Architecture**: Primary path = **periodic bulk sync + local indexed store (Option B)** rebuilt on a fixed cadence from the official Open API, with **on-demand live fetch (Option A)** as a freshness fallback before any QA Agent compliance claim. A "regulation freshness gate" — comparing the stored regulation's promulgation/enforcement date against the change-history API — must run **before every QA Agent verification step**. Commercial DBs (KLION / LexKorea / 인포라이프) are explicitly **not recommended as the primary source** (cost, opaque licensing, no clear machine-readability advantage over the free official API), but may be evaluated in Phase 3 as a curated cross-reference for case law / administrative interpretations, which the statute-only API does not cover.

**Confidence**: High on the source recommendation and licensing facts (verified against official 법제처, 공공데이터포털, and 공공누리(KOGL) sources — see §8). Medium on the precise Phase 3 commercial-DB path (pricing/API availability for KLION/LexKorea/인포라이프 could not be confirmed from public sources and requires direct vendor inquiry — flagged in §7).

---

## 2. Candidate Data Sources — Comparison

| # | Source | Authority / Credibility | Update Latency | API Availability | Cost / Licensing | Coverage Scope |
|---|--------|------------------------|----------------|------------------|------------------|----------------|
| **1** | **국가법령정보센터 + 공동활용 Open API** (`law.go.kr` / `open.law.go.kr`) | **Highest** — 법제처 (Ministry of Government Legislation), the official publisher of all Korean statutes | Same-day to a few days after promulgation; change-history APIs expose exact 공포일/시행일 | **Yes — official Open API**, ~103 API types; XML responses; requires server IP/domain registration + approval | **Free**; KOGL Type 1 (attribution, commercial use + derivatives + redistribution OK); some sub-APIs flagged "non-commercial only" — must check each | **Full**: 건축법/시행령/시행규칙, 소방시설법, all 시/도 조례 (via `자치법규` APIs), 연혁/변경이력, 법령해석 |
| **2** | **공공데이터포털 (data.go.kr)** — 법제처 mirrors + MOLIT services | **High** — official public-data gateway; same upstream 법제처 data | Same as #1 (it is the same data, re-exposed) | **Yes — OpenAPI**, key-issued, documented per-dataset | **Free**; KOGL Type 1 dominant; check each dataset's `이용허락범위` field | Mirrors #1; **plus** MOLIT-specific: `국토교통부 법령해석 본문 조회` (ID `15140240`), `토지이용규제법령정보서비스` (ID `15057174`) |
| **3** | **MOLIT (국토교통부) notices / 공공데이터 / 관보** | **High** for MOLIT-issued 고시/훈령/예규; building act is MOLIT's domain | Variable; 관보 publication is the trigger | **Partial** — MOLIT operates `data.molit.go.kr`, `stat.molit.go.kr`, `hub.go.kr` (건축인허가); not a single unified statute API | **Free**; public-data policy allows commercial use | High-value **supplement** for MOLIT 고시, 질의회신집, 입법예고; not a primary statute-replacement |
| **4** | **전자관보 (gwanbo.go.kr)** — 관보국 (국무조정실) | **Highest** for the legal act of promulgation itself (the authoritative "it is now law" signal) | Same-day on promulgation | **Limited** — search/browse; no robust machine API confirmed; RSS-style subscription noted as weak/absent | **Free**; public | **Promulgation events only** — the trigger signal for the freshness gate, not the full text |
| **5** | **Local ordinance sources (각 시/도 자치법규 시스템)** | High for that jurisdiction, but **fragmented** (17 separate systems) | Each 시/도 varies; aggregation is the pain point | **Fragmented** — most cities have search portals but inconsistent API exposure | Free, terms vary | 조례/규칙 for one jurisdiction; aggregation across all is exactly what source #1's `자치법규` API already solves |
| **6** | **Commercial legal DB (KLION, LexKorea/원앤씨, 인포라이프)** | Moderate–High editorial value (curated case law, 질의회신, 해석례) | Vendor-controlled; often fast but opaque | **Unclear/likely paid** — public pricing and API terms not verifiable; requires direct vendor inquiry | **Paid** (subscription; estimated enterprise-tier) | Statutes + **case law + administrative interpretations** — the layer the free API does **not** cover |
| **7** | **KLRI 영문법령 (elaw.klri.re.kr)** | High for English translations | Tracks Korean source | Yes (KLRI Open API) | Free | **English translations only** — relevant only if the firm serves foreign clients |

> **Key finding**: The free official path (#1 + #2) is not a compromise — it is the **authoritative primary source** that the commercial DBs (#6) themselves republish. The only gap the commercial DBs fill is **case law and administrative interpretations**, not the statute text itself.

---

## 3. Retrieval & Integration Approaches

### Option A — Direct API integration (live call per query)
**How**: Research/QA Agent calls `law.go.kr/DRF/lawSearch.do` (or the `data.go.kr` equivalent) at query time, parses the XML, and uses the result directly.

| Pros | Cons |
|------|------|
| Always current by construction | Latency per agent turn (network round-trip + XML parse) |
| Zero storage / sync infra | Rate limits and IP/domain approval gate; traffic spikes can throttle |
| No drift between store and source | No offline / degraded-mode behavior if 법제처 is down |
| | Every QA claim depends on external availability — fragile for a compliance gate |

### Option B — Periodic bulk sync + local index (RECOMMENDED PRIMARY)
**How**: A scheduled job pulls the full corpus (statutes + change-history) via Open API on a fixed cadence (e.g., nightly, plus an expedited "promulgation-detected" trigger), stores it in a local indexed store (vector + structured), and the agents read from local.

| Pros | Cons |
|------|------|
| Fast agent reads (no per-query network) | Requires a sync pipeline + storage |
| Deterministic, reproducible QA (same store version per project) | Staleness window = sync cadence (mitigated by freshness gate, §4) |
| Survives upstream outages | Must implement change detection + reconciliation |
| Enables semantic/vector indexing for the Research Agent | Requires discipline around version stamping (see §4) |

### Option C — On-demand web fetch (search + scrape)
**How**: Agent uses a search engine + HTML scrape of law.go.kr pages on demand.

| Pros | Cons |
|------|------|
| No API approval / key needed | **Legally fragile** — 법제처 explicitly provides an API; scraping when an API exists invites ToS / 부정경쟁방지법 / 정보통신망법 exposure |
| Picks up page-render-only changes | Brittle to UI changes; high maintenance |
| | Inconsistent structure → poor agent accuracy |
| | `robots.txt` must be checked and respected; even then, server-load arguments apply |

### Recommendation
- **Primary: Option B** (periodic bulk sync + local index) — driven by the official Open API.
- **Fallback: Option A** (live API call) — invoked by the freshness gate when a newer promulgation/enforcement date is detected, so the QA Agent always verifies against the latest authoritative text.
- **Explicitly reject Option C** as a primary path. The existence of a free, official, licensed API removes any justification for scraping and creates legal/reputational risk for a firm whose product is compliance.

---

## 4. Currency Tracking Mechanism (addresses the meeting's core risk)

The meeting correctly flagged that **agents do not track real-time amendments**. The mechanism below makes amendment detection a first-class, automated subsystem — not the agents' responsibility.

### 4.1 The three signals (in priority order)

1. **법제처 change-history APIs (primary signal — machine-readable)**
   - `법령 변경이력 목록 조회` (data.go.kr ID `15058499`): returns promulgation date, enforcement date, law name/number, and amendment type for every revision from enactment to latest.
   - `법령 연혁 본문 조회` (data.go.kr ID `15058848`): returns the full text at each historical revision.
   - `현행법령(공포일/시행일) 목록 조회` (law.go.kr): supports `ancYd` (공포일자 range) and `rrClsCd` (제개정 유형) parameters — directly queryable for "what changed since date X."

2. **전자관보 (gwanbo.go.kr) — promulgation event monitoring (trigger signal)**
   - The 관보 is the legal act that makes an amendment official. Monitoring it (or its derived feeds) gives the **earliest authoritative signal** that an amendment has occurred.
   - Caveat (verified): 법제처's per-statute amendment-notification is **limited**; there is no robust per-law RSS. The change-history API (#1) is therefore the more reliable machine signal.

3. **MOLIT 입법예고 / 고시 (early-warning signal)**
   - MOLIT publishes 입법예고 (legislative notice) before a building-act amendment takes effect — useful as a forward-looking "amendment pending" flag for high-priority statutes (건축법, 시행령).

### 4.2 Version/date stamping in stored regulations (mandatory schema)

Every regulation stored locally **must** carry, at minimum:
- `law_id` (법제처 stable ID, e.g., `lsId`)
- `law_name_ko` / `law_name_en`
- `promulgation_date` (공포일자) — the authoritative version anchor
- `enforcement_date` (시행일자)
- `amendment_type` (제정/일부개정/폐지 등)
- `source_url` (deep link to law.go.kr)
- `ingested_at` (when our sync pulled it)
- `source_checksum` (hash of canonical text — for drift detection)

### 4.3 Re-verification trigger

When the sync job detects, via the change-history API, that the upstream `promulgation_date` is newer than the stored one:
1. Mark the stored regulation as `STALE` in the local index.
2. Pull the new version, store it as a new versioned record (do not overwrite history).
3. Emit an event that downstream projects flagged against the prior version must be **re-verified**.

### 4.4 The "regulation freshness gate" (RECOMMENDED — hard requirement before any QA compliance claim)

Before the QA Agent issues **any** compliance verdict, the system must:

```
freshness_check(target_law_id):
    stored = local_store.get_latest(target_law_id)
    upstream = change_history_api.head(target_law_id)
    if upstream.promulgation_date > stored.promulgation_date:
        # Pull fresh, re-index, then proceed — OR — fail closed
        live_fetch_and_reindex(target_law_id)
        return FRESH_REVALIDATED
    elif stored.ingested_at older than max_trust_window (e.g., 7 days):
        return STALE_WARNING  # surface to user, do not auto-suppress
    else:
        return FRESH_OK
```

**The QA Agent must be blocked from emitting a "compliant" verdict when freshness is `STALE_WARNING` or when the freshness check itself fails.** This is the direct mitigation for the meeting's stated risk.

---

## 5. Cost & Licensing Considerations

### 5.1 Free vs. paid tradeoff

| Dimension | Free official path (법제처 / 공공데이터포털) | Paid commercial DB |
|-----------|------------------------------------------|---------------------|
| Statute text | ✅ Authoritative, complete | Republishes the same |
| Amendment history | ✅ Via dedicated APIs | Usually yes |
| Case law / 판례 | ❌ Not covered | ✅ Core value-add |
| Administrative interpretations (질의회신, 법령해석) | ⚠️ Partial (법제처_법령해석, MOLIT services) | ✅ Curated |
| Machine API | ✅ Stable, documented | Often unclear / paid |
| Redistribute to clients | ✅ KOGL Type 1 permits | Usually restricted |
| Annual cost | KRW 0 | Vendor-tier (TBD; not publicly listed) |

### 5.2 Terms of use for automated retrieval (VERIFIED)

- **Open API is the sanctioned channel.** 법제처 explicitly operates `open.law.go.kr` for automated use; the official guide states restrictions apply for (a) commercial use of APIs marked non-commercial, (b) traffic overloads, (c) other ToS violations. **Implication**: use the API, respect rate limits, and check each sub-API's `이용허락범위`.
- **KOGL (공공누리) Type 1** — the dominant license on 공공데이터포털 — permits **commercial use, derivative works (2차적 저작물), and redistribution, with attribution only**. This is permissive enough for a firm to embed regulation text in client deliverables, provided the source (법제처 / 공공데이터포털) is cited.
- **robots.txt / scraping** — `robots.txt` is a non-binding international advisory; even where it permits crawling, Korean law (정보통신망법 server-load provisions, 저작권법 database rights, 부정경쟁방지법 misappropriation) can still make unauthorized scraping legally hazardous. **Because a free official API exists, scraping has no defensible rationale and is disrecommended.**
- **저작권법 제7조** — statute text itself is **not copyrightable** (official works). However, 법제처's editorial compilation, formatting, and any derived metadata may carry database rights — another reason to consume via the licensed API rather than scrape.

### 5.3 Data ownership / redistribution limits

- **Internal use**: unrestricted under KOGL Type 1.
- **Client deliverables (e.g., compliance reports)**: permitted with attribution to 법제처/공공데이터포털. Recommend including a standardized citation block: *"법령 정보 출처: 법제처 국가법령정보센터 (law.go.kr), 공공데이터포털 (data.go.kr), 공공누리 제1유형."*
- **Re-distribution of the raw regulation corpus as a data product**: legally permitted under KOGL Type 1, but ethically/strategically questionable for a firm — not recommended as a business line.

---

## 6. Recommendation — Phased Plan

### Phase 2 MVP (target: a reliable, current source the two agents can trust)

| Step | Action | Owner Agent |
|------|--------|-------------|
| 2.1 | Register on `open.law.go.kr`; register production server IP/domain; obtain API key | DevOps / automation-engineer |
| 2.2 | Mirror-apply on `data.go.kr` for the key datasets (`15000115` 법제처 국가법령정보 공유서비스, `15058499` 변경이력 목록, `15058848` 연혁 본문, `15058294` 자치법규 본문, `15140240` MOLIT 법령해석) | automation-engineer |
| 2.3 | Build **sync pipeline** (Option B): nightly full sync + change-history-driven incremental; store with the §4.2 schema | automation-engineer |
| 2.4 | Build **freshness gate** (§4.4); wire it as a hard precondition on the QA Agent's compliance-verdict step | automation-engineer + QA Agent spec |
| 2.5 | Build **live-fetch fallback** (Option A) invoked when freshness gate detects a newer upstream version | automation-engineer |
| 2.6 | Curate the **statute scope list**: 건축법, 건축법 시행령, 건축법 시행규칙, 소방시설법 + 시행령 + 시행규칙, plus the firm's active jurisdictions' 조례 | PM + Research Agent |

**Phase 2 success criterion**: QA Agent cannot produce a compliance verdict without a passing freshness check; every stored regulation carries a promulgation-date stamp traceable to law.go.kr.

### Phase 3 (enhancement path)

| Step | Action | Rationale |
|------|--------|-----------|
| 3.1 | Evaluate **one commercial DB (KLION or LexKorea)** for case-law / 질의회신 coverage — direct vendor inquiry for API + pricing (flagged in §7) | Closes the gap the free API doesn't cover |
| 3.2 | Add **전자관보 monitoring** as an early promulgation signal | Tightens freshness latency from "next sync" to "same-day" |
| 3.3 | Add **MOLIT 입법예고** forward-looking feed | "Amendment pending" warnings for key statutes |
| 3.4 | Cross-jurisdiction 조례 aggregation hardening (verify the `자치법규` API's coverage for all 17 시/도 the firm serves) | Closes local-ordinance gaps |
| 3.5 | Semantic/vector index tuning for the Research Agent's natural-language statute search | Improves Research Agent retrieval quality |
| 3.6 | Audit trail: every QA verdict logs the exact regulation version (promulgation date + source URL) used | Legal defensibility for client deliverables |

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| API rate-limit / approval delay blocks production | Medium | High | Apply early in Phase 2; design sync to be polite (off-peak, throttled); cache aggressively |
| 법제처 API schema change | Low | Medium | Pin to documented endpoints; integration tests in sync pipeline; monitor 법제처 공지 |
| Stale data slips through if freshness gate is bypassed | Medium | **Critical** | Make the gate a **hard, non-bypassable precondition** in the QA Agent's tool graph — not a soft warning |
| 조례 coverage gaps (some 시/도 underrepresented in 자치법규 API) | Medium | Medium | Phase 3.4 audit; per-jurisdiction fallback to the city's own ordinance portal via API where available |
| Scraping temptation if API is briefly down | Low | High (legal) | Architectural rule: **no scraping path exists in the codebase**; outage = degraded mode, not scrape |
| Commercial-DB licensing blocks redistribution to clients | Medium (if pursued) | Medium | Confirm redistribution terms before any Phase 3.1 contract; keep free KOGL Type 1 data as the redistributable core |
| KOGL Type 1 attribution forgotten in client deliverables | Medium | Medium (reputational/legal) | Auto-inject standardized citation block in every report template |

---

## 7. Open Questions (require firm-specific decision)

1. **Jurisdiction scope**: Which 시/도 (and 구/군) does the firm actively serve? This determines the 조례 corpus to sync and whether the `자치법규` API's coverage is sufficient or per-city fallback is needed.
2. **Statute scope confirmation**: Beyond 건축법/시행령/시행규칙/소방시설법, does the firm need 조경법, 주차장법, 장애인·노인·임산부등의편의증진법, 옥상녹화/지구단위계획 조례, etc.? Finalize the statute-scope list before Phase 2.6.
3. **Case-law / 질의회신 requirement**: Does the QA Agent need to reason over administrative interpretations and court precedents, or only statute text? If the former, Phase 3.1 (commercial DB) becomes a Phase 2.5 item — confirm priority.
4. **Client-deliverable redistribution policy**: Will compliance reports quote regulation text directly (KOGL attribution required), or paraphrase? Determines the citation-block design.
5. **Max trust window for freshness**: What is the firm's tolerance for staleness — 24h, 7 days, 30 days? Drives sync cadence and the `STALE_WARNING` threshold.
6. **Commercial DB budget**: Is there budget for a KLION/LexKorea subscription in Phase 3, and is API access (not just web portal) a contractual requirement? Requires direct vendor inquiry — public sources did not confirm API availability or pricing.
7. **English-bilingual need**: Does the firm serve foreign clients requiring KLRI English translations (source #7)? If yes, add `elaw.klri.re.kr` Open API to scope.
8. **On-prem vs. cloud sync host**: Where does the sync pipeline + local store run? Affects 법제처 IP-registration step (server IP must be known at API-key application time).

---

## 8. Methodology & Evidence Summary

### Methodology
- **Approach**: Systematic web research via WebSearch, conducted in Korean and English, across official government portals, the Public Data Portal, the KOGL licensing authority, and corroborating industry sources.
- **Evidence standard**: Facts stated as verified are grounded in primary/official sources cited below. Inferences are labeled as such (e.g., "reasonable inference," "Phase 3 estimate"). Pricing/API specifics that could not be confirmed from public sources are explicitly flagged in §7 rather than asserted.
- **Scope limits**: This report covers **statute-text data sources** and the **freshness mechanism**. It does not cover internal architecture (vector DB choice, agent orchestration), which belongs to a separate architecture document.

### Verified facts & sources

**Primary source — 법제처 Open API**
- 국가법령정보 공동활용 (Open API portal): https://open.law.go.kr/LSO/main.do
- OPEN API 활용가이드 (API guide, ~103 API types): https://open.law.go.kr/LSO/openApi/guideList.do
- 자치법규 목록 조회 API (ordinance list, supports 지자체코드 e.g. 서울 `6110000`): https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=ordinListGuide
- 자치법규 법령 연계 목록 조회 API (e.g., 건축법 시행령 연계 조례): https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=ordinLsConListGuide
- 이용안내 (활용제한 — 상업적 이용 불가 API, 트래픽 초과): https://open.law.go.kr/LSO/information/guide.do

**Public Data Portal mirrors (data.go.kr)**
- 법제처 국가법령정보 공유서비스: https://www.data.go.kr/data/15000115/openapi.do
- 법제처_법령 변경이력 목록 조회 (ID 15058499) — amendment history: https://www.data.go.kr/data/15058499/openapi.do
- 법제처_법령 연혁 본문 조회 (ID 15058848) — per-revision full text: https://www.data.go.kr/data/15058848/openapi.do
- 법제처_자치법규 본문 조회 (ID 15058294): https://www.data.go.kr/data/15058294/openapi.do
- 법제처_국토교통부 법령해석 본문 조회 (ID 15140240): https://www.data.go.kr/data/15140240/openapi.do
- 국토교통부_토지이용규제법령정보서비스 (ID 15057174): https://www.data.go.kr/data/15057174/openapi.do

**MOLIT & related**
- 국토교통부 공공데이터 개방: https://www.molit.go.kr/USR/WPGE0201/m_35445/DTL.jsp
- 국토교통통계누리 Open API: https://stat.molit.go.kr/portal/openapi/main.do
- 건축서비스산업 정보체계 Open API (건축인허가): https://www.hub.go.kr/portal/psg/idx-intro-openApi.do
- 국토교통부 데이터 통합 채널: https://data.molit.go.kr/

**Official gazette & amendment signals**
- 대한민국 전자관보 (gwanbo.go.kr): https://gwanbo.go.kr/user/ofcttIntrcn/basis.do
- 법제처 RSS/메일 서비스 문의 (per-statute amendment alert limitations): https://www.moleg.kr/board.es?mid=a10205020000&bid=0005&act=view&list_no=46177
- 찾기쉬운 생활법령정보 RSS: https://www.easylaw.go.kr/CSP/RssRetrieveLst.laf
- 정책브리핑 RSS: https://www.korea.kr/etc/rss.do

**Licensing — KOGL (공공누리)**
- 공공누리 유형안내 (제0~4유형; 제1유형 = 출처표시, 상업적·비상업적 이용, 2차적 저작물 작성 가능): https://www.kogl.or.kr/info/license.do
- 공공데이터이용정책 (data.go.kr): https://www.data.go.kr/ugs/selectPortalPolicyView.do

**Industry precedent (real-world corroboration that this approach is viable)**
- 희림종합건축사사무소 — AI agent system reducing code-review from 3–5 days to <30 min (IT조선 / ZDNet Korea coverage, 2026): https://it.chosun.com/news/articleView.html?idxno=2023092160749
- 건축규제혁신센터 Archilaw (LLM Q&A over 건축법령 + 질의답례 + 법령해석): https://brb.auri.re.kr
- LLM 기반 건축법규 검토 시스템 연구 (kibim-2025-015-04-0)

**Commercial DB (could not fully verify pricing/API — flagged for direct inquiry)**
- KLION, LexKorea (원앤씨), 인포라이프 — public comparison and API/pricing data not verifiable from open sources; require direct vendor contact (see §7 Q6).

### Confidence summary

| Claim | Confidence | Basis |
|-------|-----------|-------|
| 법제처 provides a free, official Open API covering the full required scope | **Verified** | Official portal + guide |
| KOGL Type 1 permits commercial use, derivatives, and redistribution with attribution | **Verified** | Official KOGL license page |
| Dedicated amendment-history APIs exist (`15058499`, `15058848`) | **Verified** | data.go.kr dataset pages |
| Per-statute amendment RSS is limited/absent | **Verified (with caveat)** | 법제처 board Q&A; mitigated by change-history API |
| Commercial DBs (KLION/LexKorea/인포라이프) offer paid APIs at known prices | **Not verifiable** — flagged in §7 | Public sources insufficient |
| Scraping law.go.kr is legally riskier than using the API | **High confidence (inference)** | Existence of official API + Korean legal framework (정보통신망법, 부정경쟁방지법, 저작권법) |

---

*Prepared by the Research & Data Analyst agent. This is a findings report; the PM and firm leadership own the implementation decisions, captured as open questions in §7.*
