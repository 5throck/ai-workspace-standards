---
lang: ko
lang_reason: proper-noun
name: k-krx
scope: common
description: >
  Queries the KRX (Korea Exchange, `한국거래소`) Data Marketplace OPEN API for
  Korean exchange market data — KOSPI/KOSDAQ/KONEX stock daily trading,
  stock master (종목기본정보) data, ETF/ETN/ELW quotes, index series, bonds,
  derivatives, commodities, and ESG products. Covers service discovery across
  the 7-category / 31-service catalog, authentication, request formatting,
  and error handling. Requires KRX_API_KEY environment variable (issued via
  openapi.krx.co.kr with administrator approval; no public demo key).
version: 1.0.0
last_reviewed: 2026-09-11
status: active
owner: financial-analyst
prerequisites: KRX_API_KEY environment variable (issued via openapi.krx.co.kr; administrator approval required)
l2_propagate: true
relates_to:
  - skill: k-dart
    type: composes_with
  - skill: k-ecos
    type: composes_with
  - skill: k-kosis
    type: composes_with
  - skill: k-opendata
    type: composes_with
metadata:
  type: domain
  source: https://openapi.krx.co.kr
  license: KRX Data Marketplace OPEN API terms (`이용약관`)
  category: market-data
  locale: ko-KR
  triggers:
    - k-krx
    - /k-krx
    - KRX
    - '`한국거래소`'
    - '`KRX Open API`'
    - '`정보데이터시스템`'
    - '`주식 시세`'
    - '`코스피`'
    - '`코스닥`'
    - '`코넥스`'
    - '`일별매매정보`'
    - '`종목기본정보`'
    - Korean stock market data
    - KOSPI market data
    - KOSDAQ market data
---

## Context

Unified skill for the KRX (Korea Exchange, `한국거래소`) Data Marketplace OPEN API — the official paid-free statistics API over KRX trading data: daily trading for KOSPI/KOSDAQ/KONEX listed shares, warrant securities, listed stock master information, ETF/ETN/ELW, index series (KRX/KOSPI/KOSDAQ, bond, derivatives), bond markets, futures/options, petroleum/gold/emissions commodity markets, and ESG products. KRX is the authoritative primary source for Korean exchange market data — anything visible on the KRX 정보데이터시스템 (data.krx.co.kr) download screens is available here as an API. Complements company fundamentals (`k-dart`), central-bank statistics (`k-ecos`), national statistics (`k-kosis`), and portal trade data (`k-opendata`): KRX supplies the market-price layer (quotes, volumes, listings, indices) needed to frame a company or market narrative against actual trading activity. Useful for pitch-deck research requiring verified Korean market data with citation.

## When to Use

- Daily OHLCV/market-cap retrieval for KOSPI/KOSDAQ stocks (e.g., "get 2026 August daily trading for 삼성전자")
- Listed stock master data (ISIN code, listing date, listed shares, capital) for an exchange segment
- ETF/ETN/ELW daily trading data or NAV-related product information
- Index time series (KRX 시리즈, KOSPI/KOSDAQ series, bond indices, derivatives indices)
- Bond, futures/options, or commodity (petroleum, gold, emissions) market daily trading
- Investor-facing materials needing verified Korean exchange data with citation
- Any engagement requiring official Korea Exchange market data

## Execution Steps

1. **Verify Prerequisites**: Confirm `KRX_API_KEY` environment variable is set. If not, guide the user through key issuance (see Prerequisites) — note that both the key issuance and the per-service usage application require administrator approval, which takes time; apply early.
2. **Select Service**: Match the request to one of the 31 services in the Service Catalog below (7 categories: 지수/주식/증권상품/채권/파생상품/일반상품/ESG). Most user requests map to a `*_bydd_trd` (daily trading) or `*_isu_base_info` (stock master) service.
3. **Resolve Parameters**: Open the service's detail page (URL pattern in the catalog) while logged in to the portal and read its 개발 명세서 (specification: request parameters and output fields, downloadable per service). Parameter and output field names are published per service there — do not guess them.
4. **Execute API Call**: `curl` with the `AUTH_KEY` header against `https://data-dbg.krx.co.kr/svc/apis/{category}/{apiId}.{json|xml}` (see Request URL Format).
5. **Process Response**: A JSON success payload carries the data rows; an error is a bare `{"respCode":"...","respMsg":"..."}` object — treat any response with `respCode` and no data payload as an error and surface `respCode`+`respMsg` verbatim (see Error Handling).
6. **Format Output**: Present rows sorted by date; keep original figures; convert units only for display (거래대금 in 억/조 KRW etc.) while preserving raw values in deliverables.
7. **Save to Deliverables**: Store research findings in `deliverables/research/` per project conventions; append disclaimer "`한국거래소 Data Marketplace OPEN API 자료 기준 (조회: YYYY-MM-DD)`" with the actual retrieval date.

## Output Format

- Daily trading: one row per (date × instrument) — price (open/high/low/close), change, volume, trading value; exact field names per the service's 개발 명세서
- Stock master: ISIN/단축코드, Korean/English name, listing date, listed shares, market cap basis fields
- Index series: date / index value / change per series
- Always state the service name, the queried period, and the retrieval date in deliverables

## Reference Material

- `references/terms-ko.json` — Korean service/category name → API ID mapping (all 31 services with English glosses and coverage start dates). Keep SKILL.md English; look up Korean terms there.

## Related Skills

- k-dart
- k-ecos
- k-kosis
- k-opendata

## KRX Open API Specification

### Prerequisites

`KRX_API_KEY` environment variable. Issue flow (all steps on the [KRX OPEN API portal](https://openapi.krx.co.kr/contents/OPP/MAIN/main/index.cmd)):

1. Sign up (`회원가입` — individual: identity verification or social login; business: business registration info)
2. Log in → `마이페이지` → `API 인증키 신청` (`/contents/OPP/MYPG/mypage/OPPMYPG001.cmd`) — **usable only after administrator approval**
3. Apply for the desired API service (`API 사용 신청`) with purpose (`신청 목적`) and usage period (`이용기간`: 1M/3M/6M/1Y) — **approved per service by an administrator**
4. Develop against the approved services; usage status is visible in `마이페이지` → `이용현황`

**No public demo key exists** — unlike some other Korean public APIs, placeholder keys are rejected (verified live 2026-09-11: literal `sample`/`test`/`public` keys all return `401 Unauthorized Key`).

### Authentication

Pass the issued key in the HTTP request header field **`AUTH_KEY`** (portal wording: "Request 헤더에 인증키 값을 AUTH_KEY 필드에 추가하여 전달"). Never put the key in a query string.

### Request URL Format

All services use one positional path template — the API ID is the path suffix, and the response format is chosen by the file extension:

```
https://data-dbg.krx.co.kr/svc/apis/{category}/{apiId}.{json|xml}
```

| Segment | Values | Notes |
|---|---|---|
| `category` | `idx` \| `sto` \| `etp` \| `bon` \| `drv` \| `gen` \| `esg` | 지수/주식/증권상품/채권/파생상품/일반상품/ESG |
| `apiId` | see Service Catalog | e.g. `stk_bydd_trd` |
| extension | `json` \| `xml` | `json` recommended |

The portal's own sample-test form uses the parallel path `/svc/sample/apis/{category}/{apiId}.{json|xml}` (in-browser `샘플테스트` on each service detail page). Data-filter query parameters (date range, ticker codes, market segments, etc.) are per service and defined in its 개발 명세서 — attach them as ordinary query parameters.

### Service Catalog (31 services, all verified 2026-09-11)

Detail page for each service (login required for spec/sample): `https://openapi.krx.co.kr/contents/OPP/USES/service/OPPUSES00{cat}_S2.cmd?BO_ID={boId}`

| Category | Service (Korean) | API ID | Coverage from | boId |
|---|---|---|---|---|
| idx | KRX 시리즈 일별시세정보 | `krx_dd_trd` | 2010-01-04 | SsgXTEspyJESKvyXZtCU |
| idx | KOSPI 시리즈 일별시세정보 | `kospi_dd_trd` | 2010-01-04 | EREKZauXnMmxyIlqzeDN |
| idx | KOSDAQ 시리즈 일별시세정보 | `kosdaq_dd_trd` | 2010-01-04 | nimebcamqFNIPNcRrHoO |
| idx | 채권지수 시세정보 | `bon_dd_trd` | 2010-01-04 | vMxIKCtPBUeRytCqkoFv |
| idx | 파생상품지수 시세정보 | `drvprod_dd_trd` | 2010-01-04 | rPBjbLtScMwmSXWDOYPd |
| sto | 유가증권 일별매매정보 | `stk_bydd_trd` | 2010-01-04 | JvJFzlAENzZlPBDNGAWC |
| sto | 코스닥 일별매매정보 | `ksq_bydd_trd` | 2010-01-04 | hZjGpkllgCBCWqeTsYFj |
| sto | 코넥스 일별매매정보 | `knx_bydd_trd` | 2013-07-01 | HSiRvxGSYnvaKuAuqpqp |
| sto | 신주인수권증권 일별매매정보 | `sw_bydd_trd` | 2010-01-04 | erXKnEAzTqcGnkcoSdGA |
| sto | 신주인수권증서 일별매매정보 | `sr_bydd_trd` | 2010-02-12 | YieGrzzJtKhbaNLuKmhz |
| sto | 유가증권 종목기본정보 | `stk_isu_base_info` | 2010-01-04 | PiwgMdTwmsenXhmqqxuj |
| sto | 코스닥 종목기본정보 | `ksq_isu_base_info` | 2010-01-04 | CifLHplnUFMgpHIMMPXs |
| sto | 코넥스 종목기본정보 | `knx_isu_base_info` | 2013-07-01 | COgTLqgmGlqyJvaEFNIc |
| etp | ETF 일별매매정보 | `etf_bydd_trd` | 2010-01-04 | nrEpCLaZpoLCTzPUMxuF |
| etp | ETN 일별매매정보 | `etn_bydd_trd` | 2014-11-17 | VujebrcOsZQMybnUuwLk |
| etp | ELW 일별매매정보 | `elw_bydd_trd` | 2010-01-04 | brBhSEuDCUNpmfsCslfM |
| bon | 국채전문유통시장 일별매매정보 | `kts_bydd_trd` | 2010-01-04 | CEnOyORzHgXWpdbUfWyf |
| bon | 일반채권시장 일별매매정보 | `bnd_bydd_trd` | 2010-01-04 | JfStBNhXISpVVfBHgspT |
| bon | 소액채권시장 일별매매정보 | `smb_bydd_trd` | 2010-01-04 | yrTTOsXuYzHprbWLuYzd |
| drv | 선물 일별매매정보 (주식선물 외) | `fut_bydd_trd` | 2010-01-04 | ilaVYOabbaicHbKTsqga |
| drv | 주식선물(유가) 일별매매정보 | `eqsfu_stk_bydd_trd` | 2010-01-04 | JzVvQnspImpuqtZlFWpJ |
| drv | 주식선물(코스닥) 일별매매정보 | `eqkfu_ksq_bydd_trd` | 2015-08-03 | henfdJADfLTCUCBWIRCj |
| drv | 옵션 일별매매정보 (주식옵션 외) | `opt_bydd_trd` | 2010-01-04 | AoTvuFpukvuBsfypkZbq |
| drv | 주식옵션(유가) 일별매매정보 | `eqsop_bydd_trd` | 2010-01-04 | fwWKgzbevDVtAoECgkpA |
| drv | 주식옵션(코스닥) 일별매매정보 | `eqkop_bydd_trd` | 2017-06-26 | AFNbHSizSPnEssZoUqiS |
| gen | 석유시장 일별매매정보 | `oil_bydd_trd` | 2012-03-30 | rTvrZvAFKfcaLPOggJtW |
| gen | 금시장 일별매매정보 | `gold_bydd_trd` | 2014-03-24 | sxveSnWzWNzWxQASsgEG |
| gen | 배출권 시장 일별매매정보 | `ets_bydd_trd` | 2015-01-12 | IZiYdcgRQFMeENJPEMKG |
| esg | ESG 증권상품 | `esg_etp_info` | 2020-01-02 | dpRoGGhdnfSZSrMFtUCz |
| esg | 사회책임투자채권 정보 | `sri_bond_info` | 2019-01-01 | MwsSXzVIceQhMSJUeCdp |
| esg | ESG 지수 | `esg_index_info` | 2020-01-02 | WgFYvEvsseQMARfMVZCq |

### Example Requests

```bash
# KOSPI (유가증권시장) listed shares — daily trading, JSON
curl -fsS -H "AUTH_KEY: $KRX_API_KEY" \
  'https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd.json'

# Same service in XML
curl -fsS -H "AUTH_KEY: $KRX_API_KEY" \
  'https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd.xml'

# ETF daily trading
curl -fsS -H "AUTH_KEY: $KRX_API_KEY" \
  'https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd.json'

# KOSDAQ listed stock master information
curl -fsS -H "AUTH_KEY: $KRX_API_KEY" \
  'https://data-dbg.krx.co.kr/svc/apis/sto/ksq_isu_base_info.json'
```

Attach the service's date-range / instrument filter query parameters exactly as named in its 개발 명세서 (step 3 of Execution Steps) — parameter names are not uniform across services and must not be guessed.

### Error Handling

Verified live (2026-09-11): an unauthenticated or unauthorized call returns a bare error envelope:

```json
{"respCode": "401", "respMsg": "Unauthorized Key"}
```

Treat any JSON object carrying `respCode`/`respMsg` without a data payload as an error and surface both fields verbatim. Codes other than `401` are documented per service in the portal spec documents; map unknown codes to "see the service's 개발 명세서 / FAQ" rather than guessing.

### Response Policy

- This skill is read-only query only.
- A successful JSON payload is the data rows for the requested service; iterate rows and keep original string figures in deliverables (format for display only).
- If `respCode` indicates auth failure, check that the key is valid **and** that the specific service was approved for use (`마이페이지` → `발급내역`/`이용현황`); key validity alone is not enough.
- Append disclaimer at the end: "`한국거래소 Data Marketplace OPEN API 자료 기준 (조회: YYYY-MM-DD)`"
- When reproducing figures in client-facing deliverables, cite "`출처: 한국거래소(KRX)`" plus the retrieval date, and confirm the portal `이용약관` for redistribution constraints.

### Keyless Fallback (⚠️ unofficial — use only when no key is available)

The KRX 정보데이터시스템 web UI (<https://data.krx.co.kr>) exposes its download datasets through an internal JSON gateway (`POST /comm/bldAttendant/getJsonData.cmd` with a `bld` screen code, e.g. `dbms/MDC/STAT/standard/MDCSTAT01501` for the all-stock quote screen). Open-source libraries (e.g. pykrx) are built on it. ⚠️ Unverified/unofficial: this gateway is not a published API, can change without notice, and is unsuitable for bulk extraction — prefer the official OPEN API for anything reproducible, and treat fallback results as best-effort smoke data only.

### Failure Modes

| Symptom | Cause | Action |
|---|---|---|
| `401 Unauthorized Key` envelope | Key missing/invalid, expired usage period, or service not approved | Check `KRX_API_KEY`; verify 발급내역/이용현황 on the portal; re-apply if the usage period lapsed |
| `404` on an API path | Wrong category segment or API ID | Copy the API ID from the Service Catalog / terms-ko.json verbatim |
| Empty/short data | Requested period predates the service's coverage start | Check Coverage from in the Service Catalog |
| Portal spec/sample page shows "로그인 필요" | Spec and sample test require a logged-in portal session | Log in at openapi.krx.co.kr, then reopen the service detail page |

### Notes

- Data source: [KRX Data Marketplace OPEN API](https://openapi.krx.co.kr/contents/OPP/MAIN/main/index.cmd) — service intro (`서비스 소개`), usage guide (`서비스 이용방법`), service list (`서비스 목록`), notices, and FAQ live on the portal.
- All request paths, the 31 API IDs, the `AUTH_KEY` header name, the `json`/`xml` extension mechanism, and the error envelope above were verified against the live portal and API on 2026-09-11. Per-service request/output field names were not verifiable without an approved key — always read them from the service's 개발 명세서.
- Rate limits/quotas are not publicly documented; usage is tracked per application in `마이페이지` → `이용현황`.
- Market-price context pairs well with company fundamentals (`k-dart`) and macro statistics (`k-ecos`); prefer KRX for anything traded on-exchange (quotes, volumes, indices, listings).
