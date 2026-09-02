---
name: k-opendata
scope: common
description: >
  Queries Korea's Public Data Portal (`공공데이터포털`, data.go.kr) Open API —
  a shared gateway hosting Open APIs from dozens of Korean government agencies
  under one account/service-key system. Documents the portal's common
  activation flow (활용신청 → 개발/운영계정 → 인증키) and the verified Korea
  Customs Service (`관세청`) trade-statistics endpoints (HS-code-level
  import/export by country, national/regional totals) as the primary
  reference API set. Requires DATA_GO_KR_API_KEY environment variable.
version: 1.0.0
last_reviewed: 2026-09-03
status: active
owner: hs-classification-specialist
prerequisites: DATA_GO_KR_API_KEY environment variable
relates_to:
  - skill: hs-classification-workflow
    type: composes_with
  - skill: market-entry-strategy
    type: composes_with
  - skill: landed-cost-calculation
    type: composes_with
  - skill: k-kosis
    type: relates_to
l2_propagate: true
metadata:
  type: domain
  source: https://www.data.go.kr/
  license: KOGL (`공공누리`)
  category: trade-statistics
  locale: ko-KR
  triggers:
    - k-opendata
    - /k-opendata
    - 공공데이터포털
    - data.go.kr
    - '`관세청`'
    - '`수출입무역통계`'
    - '`품목별 국가별 수출입실적`'
    - Korea Customs Service trade statistics
    - HS code trade data
lang: ko
lang_reason: proper-noun
---

## Context

Unified skill for Korea's Public Data Portal (`공공데이터포털`, data.go.kr) — the shared Open API
gateway for Korean government agencies. One portal account and one issued `serviceKey` work
across *every* dataset hosted there, but each individual dataset (agency + API) still requires
its own separate `활용신청` (usage request) before that specific endpoint will accept the key.
This skill documents the shared activation mechanics plus the Korea Customs Service (`관세청`)
trade-statistics family of APIs, which give **HS-code-level** import/export figures — the exact
gap that `k-kosis` cannot fill (KOSIS has no public per-HS-code trade table; see `k-kosis`
Notes). Use this whenever HS-code-specific 수출입 실적/동향 (trade performance/trend) data is
needed for classification, market-entry, or landed-cost work.

## When to Use

- HS-code-level import/export value, weight, or trade-balance lookup (national total, by
  country, or by 시도) — e.g. "HS 841440 수출입 동향 조회"
- Cross-checking a UN Comtrade or KOSIS-proxy trade figure against the authoritative Korean
  customs-clearance source
- Any other data.go.kr-hosted government dataset the user names explicitly (this skill's
  *activation flow* section applies portal-wide, even though the documented endpoints below
  are customs-specific)

## Execution Steps

1. **Verify Prerequisites**: Confirm `DATA_GO_KR_API_KEY` environment variable is set. If not,
   guide the user through **Portal Activation Flow** below — do not attempt to query without a
   key (`SERVICE_KEY_IS_NULL`, error code 20).
2. **Select the endpoint**: Match the user's need to one of the **Korea Customs Service Trade
   Statistics APIs** below. For a single HS code across countries/time, `품목별 국가별
   수출입실적(GW)` (`nitemtrade`) is almost always correct.
3. **Resolve required parameters**: `strtYymm`/`endYymm` (YYYYMM, must span ≤ 1 year per
   request — loop year-by-year for longer ranges, matching the loop pattern used against UN
   Comtrade earlier in this kind of task) and `cntyCd` (2-letter country code) are required for
   `nitemtrade`; only `hsSgn` (the HS code, up to 10 digits) is optional-but-essential for this
   use case — always pass it.
4. **Query**: Call the endpoint over HTTPS with `serviceKey` URL-encoded (the key contains `+`,
   `/`, `=` — use `--data-urlencode`, never raw string interpolation, or the key will be
   silently mangled).
5. **Parse Response**: Default response is **XML** (unlike KOSIS's JSON). Check the
   `<resultCode>`/`<resultMsg>` envelope first — `00` is success; anything else is a documented
   error (see Failure Modes). Some data.go.kr APIs accept `&type=json` for a JSON response —
   ⚠️ **unverified for this specific API**; try it, and fall back to XML parsing if unsupported.
6. **Aggregate if needed**: `cntyCd` is required per call — there is no confirmed "world total"
   pseudo-code. To get a national total across all countries, either loop every country code
   and sum, or check whether the sibling `국가별 수출입실적(GW)` / `수출입총괄(GW)` APIs expose
   a pre-aggregated total (not yet verified — resolve via that dataset's `openapi.do` spec page
   before relying on it).
7. **Format Output**: Present figures with unit (USD amount, kg weight) and period, sorted
   chronologically; append disclaimer "`공공데이터포털(data.go.kr) 관세청 Open API 자료 기준`".
8. **Save to Deliverables**: Store research findings in `deliverables/research/` per project
   conventions.

## Output Format

- Trade data: HS code / product name / country / period (YYYYMM) / export amount (USD) /
  export weight (kg) / import amount (USD) / import weight (kg) / trade balance, sorted by
  period
- Always cite: "`공공데이터포털(data.go.kr) 관세청 Open API 자료 기준`"

## Reference Material

- None yet; if recurring lookups reveal a confirmed JSON response shape or a verified
  world-total aggregation path, capture them as `references/customs-endpoints-ko.json`
  following the pattern in `skills/k-dart/references/terms-ko.json`.

## Related Skills

- k-kosis (macro/aggregate statistics — not HS-code-level; use this skill instead for
  per-HS-code trade figures)
- hs-classification-workflow (HS code must be confirmed before trade-trend lookup is meaningful)
- market-entry-strategy
- landed-cost-calculation

## 공공데이터포털 (data.go.kr) Open API Specification

### Portal Activation Flow

⚠️ **Not independently live-tested this session** — derived from `data.go.kr` help documentation
and general-purpose search (fetched 2026-09-03). Confirm exact UI copy/timing against the live
portal, as public-sector portals occasionally reorganize.

1. **회원가입/로그인**: Create a data.go.kr account (separate system from KOSIS/DART/Law Open
   API accounts — each Korean government Open API portal has its own account).
2. **데이터셋 검색**: Search `데이터셋 > 오픈API` for the target dataset (e.g. "관세청 품목별
   국가별 수출입실적").
3. **활용신청**: Open the dataset's `openapi.do` detail page and click `활용신청`. Required
   fields: 인증유형, 활용용도, 활용목적, 상세기능 선택, 표준약관 동의.
4. **개발계정 vs 운영계정**:
   - **개발계정 (dev)**: Immediate/fast approval in most cases; traffic-capped (관세청 APIs:
     10,000 calls/day). Sufficient for research/lookup use.
   - **운영계정 (production)**: Requires review — must register a usage case (활용사례) and
     request a specific traffic quota. Only needed for a deployed, recurring-traffic service.
5. **인증키 발급**: 마이페이지 → 인증키 확인. **One service key per account, shared across every
   data.go.kr Open API** the account has been approved for — but each individual dataset must
   still be separately `활용신청`-approved before that key will work against it.
6. **Exception**: Some 관세청 datasets (e.g. `수출이행내역`) additionally require separate
   **UNI-PASS** (unipass.customs.go.kr) membership — check the dataset's detail page for this
   requirement before assuming the data.go.kr key alone is sufficient.

### Korea Customs Service (`관세청`) Trade Statistics APIs

| API (Korean name) | Granularity | Base URL | Status |
|---|---|---|---|
| 품목별 국가별 수출입실적(GW) | HS code × country × month | `https://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList` | ✅ Spec fetched — see below |
| 품목별 수출입실적(GW) | HS code × month (no country split) | resolve via [openapi.do](https://www.data.go.kr/data/15101609/openapi.do) | ⚠️ Not yet fetched |
| 국가별 수출입실적(GW) | Country × month (no HS split) | resolve via [openapi.do](https://www.data.go.kr/data/15101612/openapi.do) | ⚠️ Not yet fetched |
| 수출입총괄(GW) | National monthly total | resolve via [openapi.do](https://www.data.go.kr/data/15102108/openapi.do) | ⚠️ Not yet fetched |
| 시도별 수출입실적(GW) | Korean 시/도 × month | resolve via [openapi.do](https://www.data.go.kr/data/15101643/openapi.do) | ⚠️ Not yet fetched |
| 수출이행내역 | Export fulfillment records | resolve via [openapi.do](https://www.data.go.kr/data/15126269/openapi.do) | ⚠️ Requires separate UNI-PASS membership |

#### 1. 품목별 국가별 수출입실적 (`getNitemtradeList`)

```
GET https://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList
```

| Parameter | Required | Description |
|---|---|---|
| `serviceKey` | Y | Issued authentication key (≤100 chars; URL-encode — contains reserved chars) |
| `strtYymm` | Y | Start period, `YYYYMM` (e.g. `202401`) — window must be ≤ 1 year |
| `endYymm` | Y | End period, `YYYYMM` |
| `cntyCd` | Y | Country code, 2 characters (e.g. `CN`, `US`, `JP`) |
| `hsSgn` | N | HS code, up to 10 digits — omit for all HS codes to that country (large response) |

Response format: **XML**. Documented fields: result code/message, period, country name/code,
product name, HS code, export weight (kg), export amount (USD), import weight (kg), import
amount (USD), trade balance.

⚠️ **Not live-tested this session** — spec fetched from the dataset's `openapi.do` page via
WebFetch (2026-09-03), not exercised against the live endpoint with a real key. Before relying
on this in a deliverable, run one real query and confirm: exact XML tag names, `resultCode`
success value, and whether `&type=json` is supported.

#### Example Request (untested — confirm on first real use)

```bash
curl -sS --get 'https://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList' \
  --data-urlencode "serviceKey=$DATA_GO_KR_API_KEY" \
  --data-urlencode 'strtYymm=202401' \
  --data-urlencode 'endYymm=202412' \
  --data-urlencode 'cntyCd=CN' \
  --data-urlencode 'hsSgn=841440'
```

### Failure Modes

- `DATA_GO_KR_API_KEY` not set → guide through Portal Activation Flow, then stop
- Error code `20` (`SERVICE_KEY_IS_NULL`) → key missing/not passed correctly — check
  URL-encoding of the key value
- Error code `22` (traffic quota exceeded) → dev account daily cap (10,000/day for 관세청 APIs)
  hit; wait for reset or request 운영계정 quota increase
- `strtYymm`/`endYymm` span > 1 year → split into multiple calls, one per ≤1-year window (loop
  by year, same pattern as querying UN Comtrade year-by-year)
- No confirmed world-total `cntyCd` value → do not guess; loop per-country and sum, or resolve
  a pre-aggregated sibling API first

### Notes

- Data source: [공공데이터포털 (data.go.kr)](https://www.data.go.kr/)
- This skill is read-only query only.
- License: `공공누리`(KOGL) — cite source when reproducing trade figures in deliverables.
- Created 2026-09-03 in `co-export` after establishing that neither KOSIS nor UN Comtrade give
  an exact, HS-code-level, 관세청-sourced figure as directly as data.go.kr's customs APIs do;
  follows the `k-kosis`/`k-dart`/`k-law` sibling pattern. Not yet promoted to
  `templates/common/skills/` at the workspace root — this project checkout has no
  `templates/common/` directory to propagate into.
