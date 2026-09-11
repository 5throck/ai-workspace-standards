---
name: k-ecos
scope: common
description: >
  Queries the Bank of Korea Economic Statistics System (`한국은행 경제통계시스템
  ECOS`) Open API for Korean macro-financial statistics — base rate, exchange
  rates, money supply, interest rates, GDP, and the `100대 통계지표` (100 key
  indicators) quick lookup. Covers statistics-table discovery, item-code
  lookup, time-series data retrieval, terminology glossary, and metadata
  lookup. Requires ECOS_API_KEY environment variable; a public demo key
  (`sample`) works for smoke tests capped at 10 rows per request.
version: 1.0.0
last_reviewed: 2026-09-11
status: active
owner: financial-analyst
prerequisites: ECOS_API_KEY environment variable (public demo key `sample` usable for ≤10-row queries)
l2_propagate: true
relates_to:
  - skill: k-dart
    type: composes_with
  - skill: k-kosis
    type: composes_with
  - skill: k-opendata
    type: composes_with
metadata:
  type: domain
  source: https://ecos.bok.or.kr
  license: ECOS Open API terms (`경제통계 Open API 이용약관`)
  category: financial-statistics
  locale: ko-KR
  triggers:
    - k-ecos
    - /k-ecos
    - ECOS
    - '`한국은행`'
    - '`한국은행 Open API`'
    - '`경제통계시스템`'
    - '`기준금리`'
    - '`환율`'
    - '`본원통화`'
    - '`100대 통계지표`'
    - Bank of Korea statistics
    - Korean monetary statistics
---

## Context

Unified skill for the Bank of Korea (BOK, `한국은행`) Economic Statistics System (ECOS, `경제통계시스템`) Open API — covers statistics-table discovery, item-code lookup, time-series data retrieval, the `100대 통계지표` (100 key indicators) latest-value snapshot, statistical terminology glossary, and metadata lookup. ECOS is the authoritative primary source for Korean monetary and financial statistics (base rate, market rates, exchange rates, money supply/liquidity, credit, household finances) that KOSIS (`k-kosis`) mostly re-publishes secondhand. Complements DART-based company financials (`k-dart`) and public-portal trade data (`k-opendata`): ECOS supplies the central-bank-grade macro-financial series needed to frame a company or market narrative against Korean monetary conditions. Useful for pitch-deck research requiring verified BOK statistics with citation.

## When to Use

- Time-series retrieval for a known BOK statistic (e.g., "get `한국은행 기준금리` monthly 2020–2024")
- Finding the right ECOS table/series by browsing the statistics tree ("`기준금리 관련 통계표 찾아줘`")
- Latest-value snapshot of headline indicators via the `100대 통계지표` (exchange rates, growth rate, income) — fastest path for a single number
- Item-structure lookup for a table (item codes, units, available cycles, data coverage)
- Statistical terminology lookup ("what does `소비자동향지수` mean, per BOK")
- Macro-financial context research to support market-sizing or monetary-condition slides
- Any engagement requiring verified Bank of Korea statistics with citation

## Execution Steps

Prefer the bundled helper `scripts/ecos-fetch.ts` (see Helper Script) for retrieval steps — it handles encoding, pagination, retry, and error normalization; the raw requests below are the fallback.

1. **Verify Prerequisites**: Confirm `ECOS_API_KEY` environment variable is set. If not, either use the public demo key `sample` (works for all six services, capped at 10 rows per request — enough for smoke tests and the `KeyStatisticList` quick lookup) or guide the user to <https://ecos.bok.or.kr> ("`MyPage` → `인증키 신청`") to apply for a personal key.
2. **Discover the target table**: If the user only knows a statistic by name (not `통계표코드`/STAT_CODE), browse `StatisticTableList` (`서비스 통계 목록`) — it returns the hierarchical category tree (`STAT_NAME` values like `1.1.1. 본원통화`) where searchable leaves carry `SRCH_YN=Y`. There is no keyword-search endpoint; locate the table by category navigation or from the ECOS web UI (<https://ecos.bok.or.kr> → `통계검색` shows each table's `통계표코드` in its URL/meta).
3. **Resolve item codes**: Call `StatisticItemList` (`통계 세부항목 목록`) with the table code to get `ITEM_CODE`/`ITEM_NAME`, `GRP_CODE` (item group = filter dimension), per-cycle availability (`CYCLE`, `START_TIME`~`END_TIME`, `DATA_CNT`), and `UNIT_NAME`. Use this to pick the cycle and item codes instead of guessing.
4. **Retrieve data**: Call `StatisticSearch` (`통계 조회 조건 설정`) with the table code, cycle (`A`/`S`/`Q`/`M`/`SM`/`D` — never `YY`/`QQ`/`MM`/`DD`), cycle-matching date formats, and optional item codes. Pass `요청시작건수`/`요청종료건수` to page through large result sets (1-based row range; `list_total_count` reports the full total).
5. **Quick lookup (optional)**: For headline numbers ("`지금 원달러 환율?`", "`경제성장률?`"), call `KeyStatisticList` (`100대 통계지표`) first — no parameters beyond counts, returns the latest value/classification/unit for each of the ~101 key indicators.
6. **Glossary/metadata (optional)**: Call `StatisticWord` (`통계용어사전`) with a term, or `StatisticMeta` (`통계메타DB`) with a data name, for BOK's official explanation. Percent-encode Korean path segments.
7. **Process Response**: Always pass `json` as the `요청유형`. A successful response is `{"<ServiceName>":{"list_total_count":N,"row":[...]}}`; an error is a bare `{"RESULT":{"CODE":"...","MESSAGE":"..."}}` — treat any response with `RESULT` and no `row` as an error and surface `CODE`+`MESSAGE` verbatim.
8. **Format Output**: Present rows sorted by `TIME`; pair `DATA_VALUE` with `UNIT_NAME`; keep original figures.
9. **Save to Deliverables**: Store research findings in `deliverables/research/` per project conventions; append disclaimer "`한국은행 경제통계시스템 ECOS Open API 자료 기준 (조회: YYYY-MM-DD)`" with the actual retrieval date.

## Output Format

- Table discovery: `P_STAT_CODE` / `STAT_CODE` / `STAT_NAME` / `CYCLE` / `SRCH_YN` (category tree navigation)
- Item lookup: `GRP_NAME` / `ITEM_CODE` / `ITEM_NAME` / `CYCLE` / `START_TIME`~`END_TIME` / `DATA_CNT` / `UNIT_NAME`
- Statistical data: `STAT_NAME` / `ITEM_NAME1`~`ITEM_NAME4` / `UNIT_NAME` / `TIME` / `DATA_VALUE` (the value), sorted by period
- 100 key indicators: `CLASS_NAME` / `KEYSTAT_NAME` / `DATA_VALUE` / `CYCLE` (latest period) / `UNIT_NAME`
- Glossary: `WORD` / `CONTENT` verbatim
- Metadata: `LVL` / `CONT_NAME` / `META_DATA`

## Reference Material

- `references/terms-ko.json` — Korean-term → ECOS code mapping (service names, cycle codes, verified starter tables, glossary). Keep SKILL.md English; look up Korean terms there.
- Starter table codes, live-verified 2026-09-11 (codes may change — always confirm coverage via `StatisticItemList`): `722Y001` (`한국은행 기준금리 및 여수신금리`; item `0101000` `한국은행 기준금리`, cycles A/Q/M/D), `200Y101` (`주요지표(연간지표)` — e.g. item `10101` `국내총생산(명목, 원화표시)`), `102Y004` (`본원통화 구성내역(평잔, 원계열)` — official-guide sample data).
- If recurring lookups reveal stable table/item patterns, add them to `references/terms-ko.json` rather than this file.

## Related Skills

- k-dart
- k-kosis
- k-opendata
- research

## ECOS Open API Specification

### Prerequisites

`ECOS_API_KEY` environment variable. Sign up and apply at <https://ecos.bok.or.kr> ("`MyPage` → `인증키 신청`"; registration is on the Open API portal, not the main ECOS statistics site).

The literal demo key `sample` is accepted by all six services for read-only testing, capped at **10 rows per request** (exceeding it returns `ERROR-301`). Prefer it for smoke tests and `KeyStatisticList` lookups; use a personal key for real data pulls.

### Request URL Format

All services use one positional path-parameter template (https and http both accepted per the official guide):

```
https://ecos.bok.or.kr/api/{서비스명}/{인증키}/{요청유형}/{언어구분}/{...service-specific segments}
```

Common leading segments:

| # | Segment | Values | Notes |
|---|---------|--------|-------|
| 1 | `서비스명` | see below | English service name (e.g. `StatisticSearch`) |
| 2 | `인증키` | issued key or `sample` | |
| 3 | `요청유형` | `json` \| `xml` | always pass explicitly |
| 4 | `언어구분` | `kr` \| `en` | `en` returns translated names/units |

### Cycle Codes and Date Formats

`StatisticSearch` cycle segment (`주기`) — **not** `YY`/`QQ`/`MM`/`DD`; the wrong alphabet is the most common cause of `ERROR-100`:

| Cycle | Meaning | Date format (`검색시작일자` / `검색종료일자`) |
|---|---|---|
| `A` | `연` (annual) | `2024` |
| `S` | `반년` (semi-annual) | e.g. `2024S1` ⚠️ Unverified |
| `Q` | `분기` (quarterly) | `2024Q1` |
| `M` | `월` (monthly) | `202401` |
| `SM` | `반월` (semi-monthly) | ⚠️ Unverified — confirm format from `StatisticItemList` `START_TIME`/`END_TIME` |
| `D` | `일` (daily) | `20240101` |

The date format must match the cycle exactly, otherwise `ERROR-101` (`주기와 다른 형식의 날짜 형식입니다`). When unsure of a table's cycles and coverage, read `CYCLE`/`START_TIME`/`END_TIME` from `StatisticItemList` first.

### 1. StatisticSearch (`통계 조회 조건 설정`) — main data endpoint

```
GET https://ecos.bok.or.kr/api/StatisticSearch/{인증키}/{요청유형}/{언어}/{요청시작건수}/{요청종료건수}/{통계표코드}/{주기}/{검색시작일자}/{검색종료일자}/{통계항목코드1}/{통계항목코드2}/{통계항목코드3}/{통계항목코드4}
```

| Segment | Required | Description |
|---|---|---|
| `요청시작건수`/`요청종료건수` | Y | 1-based row range of the full result (guide sample: `1`/`10`); page through via `list_total_count` |
| `통계표코드` | Y | e.g. `722Y001` |
| `주기` | Y | `A`/`S`/`Q`/`M`/`SM`/`D` |
| `검색시작일자`/`검색종료일자` | Y | cycle-matching format |
| `통계항목코드1`~`4` | N | item path (1–4 levels). Omit to receive **all** items of the table |

Response row fields: `STAT_CODE`, `STAT_NAME`, `ITEM_CODE1`~`4`, `ITEM_NAME1`~`4`, `UNIT_NAME`, `WGT`, `TIME`, `DATA_VALUE`.

### 2. StatisticTableList (`서비스 통계 목록`) — category tree

```
GET https://ecos.bok.or.kr/api/StatisticTableList/{인증키}/{요청유형}/{언어}/{요청시작건수}/{요청종료건수}/{통계표코드}
```

| Segment | Required | Description |
|---|---|---|
| `통계표코드` | N | filters to one table when given |

Response row fields: `P_STAT_CODE`, `STAT_CODE`, `STAT_NAME`, `CYCLE`, `SRCH_YN`, `ORG_NAME`. Navigate the hierarchy via `P_STAT_CODE` → `STAT_CODE`; leaves with `SRCH_YN=Y` are queryable in `StatisticSearch`.

### 3. StatisticItemList (`통계 세부항목 목록`) — item codes per table

```
GET https://ecos.bok.or.kr/api/StatisticItemList/{인증키}/{요청유형}/{언어}/{요청시작건수}/{요청종료건수}/{통계표코드}
```

Response row fields: `STAT_CODE`, `STAT_NAME`, `GRP_CODE`, `GRP_NAME`, `ITEM_CODE`, `ITEM_NAME`, `P_ITEM_CODE`, `P_ITEM_NAME`, `CYCLE`, `START_TIME`, `END_TIME`, `DATA_CNT`, `UNIT_NAME`, `WEIGHT`. `GRP_NAME` names the filter dimension (`계정항목`, `지역코드`, …); item codes are passed to `StatisticSearch` in group order.

### 4. KeyStatisticList (`100대 통계지표`) — latest headline values

```
GET https://ecos.bok.or.kr/api/KeyStatisticList/{인증키}/{요청유형}/{언어}/{요청시작건수}/{요청종료건수}
```

No service-specific segments. ~101 rows; response row fields: `CLASS_NAME`, `KEYSTAT_NAME`, `DATA_VALUE`, `CYCLE` (latest period), `UNIT_NAME`. Best first stop for "current" values (`환율`, `경제성장률`, `기준금리`, `가구소득`, …).

### 5. StatisticWord (`통계용어사전`) — glossary

```
GET https://ecos.bok.or.kr/api/StatisticWord/{인증키}/{요청유형}/{언어}/{요청시작건수}/{요청종료건수}/{용어}
```

| Segment | Required | Description |
|---|---|---|
| `용어` | Y | Korean term (e.g. `소비자동향지수`) — percent-encode |

Response row fields: `WORD`, `CONTENT` (BOK's official explanation, up to 4000 chars).

### 6. StatisticMeta (`통계메타DB`) — metadata

```
GET https://ecos.bok.or.kr/api/StatisticMeta/{인증키}/{요청유형}/{언어}/{요청시작건수}/{요청종료건수}/{데이터명}
```

| Segment | Required | Description |
|---|---|---|
| `데이터명` | Y | Korean data name (e.g. `경제심리지수`) — percent-encode |

Response row fields: `LVL`, `P_CONT_CODE`, `CONT_CODE`, `CONT_NAME`, `META_DATA`.

### Quick Recipes (verified 2026-09-11)

```bash
# 1) Latest headline values (환율/성장률/기준금리/…): page with a personal key,
#    or 1/10 windows with the sample key
curl -fsS 'https://ecos.bok.or.kr/api/KeyStatisticList/'"$ECOS_API_KEY"'/json/kr/1/101/'
# → filter rows client-side by CLASS_NAME/KEYSTAT_NAME; CYCLE holds the latest period

# 2) BOK base rate, most recent 12 months (item 0101000 = 한국은행 기준금리)
curl -fsS 'https://ecos.bok.or.kr/api/StatisticSearch/'"$ECOS_API_KEY"'/json/kr/1/12/722Y001/M/202509/202608/0101000/'

# 3) Annual nominal GDP (200Y101 주요지표(연간지표), item 10101 = 국내총생산(명목))
curl -fsS 'https://ecos.bok.or.kr/api/StatisticSearch/'"$ECOS_API_KEY"'/json/kr/1/10/200Y101/A/2020/2025/10101/'
```

All three return the standard success envelope; recipe 1 works with the `sample` key only in 10-row windows.

### Helper Script

`scripts/ecos-fetch.ts` (self-contained, bun) wraps everything in this section — Korean path-segment encoding, 1-based row-range pagination (respecting the `sample` key's ≤10-row windows), exponential backoff on `ERROR-602`/HTTP 5xx, and error-envelope normalization. Prefer it over hand-rolled `curl`; the raw requests above are the no-tooling fallback.

```bash
# BOK base rate, monthly, most recent 12 months → markdown table
bun scripts/ecos-fetch.ts --service StatisticSearch --table 722Y001 --cycle M \
  --from 202509 --to 202608 --items 0101000 --format md --sample

# Latest key indicators (auto-pages the sample-key cap)
bun scripts/ecos-fetch.ts --service KeyStatisticList --sample --format md
```

`scripts/verify-terms.ts` re-validates the codes in `references/terms-ko.json` against the live API (drift check — run it before trusting recorded codes, and refresh the file's `verified` date when it passes):

```bash
bun scripts/verify-terms.ts          # uses the sample key; --include-unverified to check all entries
```

### Example Requests

```bash
# Latest headline values — 100 key indicators (works with the `sample` key)
curl -fsS --get 'https://ecos.bok.or.kr/api/KeyStatisticList/sample/json/kr/0/10/'

# BOK base rate, monthly 2021, item 0101000 (한국은행 기준금리)
curl -fsS 'https://ecos.bok.or.kr/api/StatisticSearch/'"$ECOS_API_KEY"'/json/kr/1/12/722Y001/M/202101/202112/0101000/'

# Same query without item codes — returns ALL items of the table for the period
curl -fsS 'https://ecos.bok.or.kr/api/StatisticSearch/'"$ECOS_API_KEY"'/json/kr/1/10/722Y001/M/202601/202608/'

# Annual GDP (명목) from the guide's example table 200Y101, item 10101
curl -fsS 'https://ecos.bok.or.kr/api/StatisticSearch/'"$ECOS_API_KEY"'/json/kr/1/10/200Y101/A/2020/2023/10101/'

# Browse the category tree (839 nodes as of 2026-09-11)
curl -fsS 'https://ecos.bok.or.kr/api/StatisticTableList/'"$ECOS_API_KEY"'/json/kr/1/10/'

# Item codes / coverage of a table
curl -fsS 'https://ecos.bok.or.kr/api/StatisticItemList/'"$ECOS_API_KEY"'/json/kr/1/10/722Y001'

# Glossary lookup — percent-encode the Korean term
WORD=$(python3 -c "import urllib.parse; print(urllib.parse.quote('소비자동향지수'))")
curl -fsS 'https://ecos.bok.or.kr/api/StatisticWord/'"$ECOS_API_KEY"'/json/kr/1/10/'"$WORD"'/'
```

### Response Shape / Response Policy

**Verified by live testing (2026-09-11)** — all six services respond correctly with the `sample` key:

- Success: a single JSON object keyed by the service name, e.g. `{"StatisticSearch":{"list_total_count":12,"row":[{...}, ...]}}` (`KeyStatisticList` additionally carries `row_count`). Iterate `row`; use `list_total_count` for pagination.
- Error: a bare object `{"RESULT":{"CODE":"...","MESSAGE":"..."}}` with no `row` key — surface `CODE`+`MESSAGE` verbatim. Note the guide lists codes as `정보-100`/`에러-301` etc., but the JSON payload spells them `INFO-100`/`ERROR-301`.
- **Cycle-code alphabet gotcha**: the widely-copied tutorials use `YY`/`QQ`/`MM`/`DD`; the live API returns `ERROR-100` for those. Only `A`/`S`/`Q`/`M`/`SM`/`D` are accepted (official guide + verified live).
- Row-range segments are 1-based in the official sample (`1`/`10`); a leading `0` was also observed to work live (treated as start-of-list). Prefer the documented `1`.
- Omitting all item codes returns every item in the table for the date range — convenient but can be large; filter client-side or narrow the item path.
- Korean path segments (`용어`, `데이터명`) must be percent-encoded; a literal UTF-8 Korean path segment was observed to 404 at the CDN level.
- `DATA_VALUE` is returned as a string; keep the original string in deliverables and format for display only.
- Append disclaimer at the end: "`한국은행 경제통계시스템 ECOS Open API 자료 기준 (조회: YYYY-MM-DD)`" with the actual retrieval date.

### Failure Modes

| Code | Meaning (verbatim source) | Action |
|---|---|---|
| `INFO-100` | `인증키가 유효하지 않습니다` | Check `ECOS_API_KEY`; `sample` only works with ≤10-row ranges |
| `INFO-200` | `해당하는 데이터가 없습니다` | No data for the table/cycle/dates — verify coverage via `StatisticItemList` |
| `ERROR-100` | `필수 값이 누락되어 있습니다` | Usually a wrong cycle code (`MM` vs `M`) or malformed dates — re-check the segment order |
| `ERROR-101` | `주기와 다른 형식의 날짜 형식입니다` | Date format doesn't match the cycle (`2024` for `A`, `2024Q1` for `Q`, `202401` for `M`, `20240101` for `D`) |
| `ERROR-200` | `파일타입 값이 누락 혹은 유효하지 않습니다` | Use `json` or `xml` |
| `ERROR-300`/`ERROR-301` | `조회건수 값이 누락/타입이 유효하지 않습니다` | Row range missing or non-integer; with `sample`, also fires above 10 rows |
| `ERROR-400` | `검색범위가 적정범위를 초과하여 60초 TIMEOUT` | Narrow the date range or item path and retry |
| `ERROR-500` | `서버 오류 / 해당 서비스를 찾을 수 없습니다` | Check the service name spelling |
| `ERROR-600`/`ERROR-601` | `DB Connection / SQL 오류` | Transient server-side fault — retry later |
| `ERROR-602` | `과도한 OpenAPI호출로 이용이 제한되었습니다` | Rate-limited — back off and retry after a wait |

### Notes

- Data source: [한국은행 경제통계시스템 ECOS Open API](https://ecos.bok.or.kr) — official developer guide at `개발가이드` → `개발 명세서` (SPA; each service's spec page has a `개발명세서 다운로드` button).
- This skill is read-only query only.
- License/terms: `경제통계 Open API 이용약관` — cite "`출처: 한국은행 경제통계시스템`" plus the retrieval date when reproducing figures in deliverables. Per-consumer daily/hourly quotas are not publicly documented; only `ERROR-602` signals throttling.
- ECOS is the primary source for monetary/financial statistics; KOSIS (`k-kosis`) re-publishes some of the same series — prefer ECOS for BOK-originated series and for English-language BOK names via `언어구분=en`.
- All endpoint shapes, the cycle-code alphabet, the `sample` key behavior, and every error code table row above were verified against the live API and the official SPA guide on 2026-09-11.
