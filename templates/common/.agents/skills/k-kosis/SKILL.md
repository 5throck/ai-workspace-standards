---
name: k-kosis
scope: common
description: >
  Queries the Korean Statistical Information Service (`통계청 KOSIS`, `국가통계포털`)
  Open API for national statistics — population, price indices, macroeconomic
  indicators, and other government-published statistical tables. Covers
  keyword search, table-list browsing, statistical data retrieval, and
  metadata lookup. Requires KOSIS_API_KEY environment variable.
version: 1.0.0
last_reviewed: 2026-08-23
status: active
owner: financial-analyst
prerequisites: KOSIS_API_KEY environment variable
l2_propagate: true
metadata:
  type: domain
  source: https://kosis.kr/openapi/
  license: KOGL (`공공누리`)
  category: macro-statistics
  locale: ko-KR
  triggers:
    - k-kosis
    - /k-kosis
    - KOSIS
    - '`통계청`'
    - '`국가통계포털`'
    - '`인구통계`'
    - '`물가지수`'
    - '`경제통계`'
    - '`국가통계`'
    - Korean national statistics
---

## Context

Unified skill for the Korean Statistical Information Service (KOSIS, `통계청 국가통계포털`) Open API — covers integrated keyword search, statistics-table-list browsing, statistical data retrieval, and statistics metadata lookup. Complements DART-based company financials (`k-dart`) and legal research (`k-law`): KOSIS supplies the macro/population/price-index context (e.g. CPI, population, industry production indices) needed to frame a company or market narrative against the broader Korean economy. Useful for pitch-deck research requiring macro-economic or industry-sizing context with citation.

## When to Use

- National statistic keyword search (e.g., "find the KOSIS table for `소비자물가지수`")
- Browsing a statistics category to find the right table/classification structure
- Pulling actual time-series data for a known table (e.g., "get annual population figures 2015-2024")
- Statistics metadata/explanation lookup (survey basis, period, source law, notes)
- Macro-economic or demographic context research to support market-sizing or industry-context slides
- Any engagement requiring verified Korean government statistical data with citation

## Execution Steps

1. **Verify Prerequisites**: Confirm `KOSIS_API_KEY` environment variable is set. If not, guide the user to the KOSIS Open API portal at <https://kosis.kr/openapi/> ("`활용신청`" menu) to apply for a key. ⚠️ **Unverified**: the exact approval process/turnaround is not documented on the fetched devGuide pages — do not assume a specific timeline; point the user to the portal itself.
2. **Discover the target table**: If the user only knows a statistic by name (not `orgId`/`tblId`), call `statisticsSearch.do` (`통합검색`) with `searchNm` to find candidate `ORG_ID`/`TBL_ID` pairs.
3. **Understand classification structure**: If the table's classification codes (`objL1`~`objL8`) or item codes (`itmId`) are not already known, call `statisticsList.do` (`통계목록조회`) starting from a relevant `vwCd`/`parentId` to browse the list and confirm structure, or inspect `TBL_VIEW_URL`/`LINK_URL` from the search result.
4. **Retrieve data**: Call `Param/statisticsParameterData.do` (`통계자료조회`) with the resolved `orgId`, `tblId`, `objL1`(~`objL8`), `itmId`, `prdSe`, and either (`startPrdDe`+`endPrdDe`) or `newEstPrdCnt` — never both.
5. **Metadata lookup (optional)**: If the user needs survey methodology, source law, or period notes, call `statisticsExplData.do` (`통계설명`) with `statId` (or `orgId`+`tblId`) and `metaItm`.
6. **Process Response**: Always pass `format=json` explicitly. Treat any non-list/non-array JSON response as a possible error envelope and print it raw for inspection — the exact error-response shape was not confirmed from the fetched devGuide pages and needs live-testing.
7. **Format Output**: Present results with compact formatting; append disclaimer "`통계청 KOSIS 국가통계포털 Open API 자료 기준`".
8. **Save to Deliverables**: Store research findings in `deliverables/research/` per project conventions.

## Output Format

- Integrated search: `TBL_NM` / `ORG_NM` / `STAT_NM` / `STRT_PRD_DE`~`END_PRD_DE` / `TBL_VIEW_URL` (top 5-10 relevant matches)
- Statistics list: `LIST_NM` / `TBL_NM` / `ORG_ID` / `TBL_ID` / `STAT_ID` (classification tree navigation)
- Statistical data: `TBL_NM` / `C1_NM`(~`C8_NM`) / `ITM_NM` / `UNIT_NM` / `PRD_DE` / `DT` (the value), sorted by period
- Statistics explanation: requested `metaItm` field(s) verbatim (e.g. `statsPeriod`, `basisLaw`, `dataUserNote`)

## Reference Material

- None yet; if recurring lookups reveal stable `vwCd`/classification patterns, capture them as `references/tables-ko.json` following the pattern in `skills/k-dart/references/terms-ko.json`.

## Related Skills

- k-dart
- k-law
- research
- storyline

## KOSIS Open API Specification

### Prerequisites

`KOSIS_API_KEY` environment variable must be set. Sign up and apply for a key at: <https://kosis.kr/openapi/> ("`활용신청`" menu in the portal navigation). ⚠️ The approval process itself is not confirmed from the fetched devGuide pages — guide the user to the portal rather than assuming a specific timeline.

### Discovery Flow

1. **`통합검색`** (`statisticsSearch.do`) — keyword search across all KOSIS tables when the user only knows the statistic's Korean name. Returns candidate `ORG_ID`/`TBL_ID` pairs plus `TBL_VIEW_URL`.
2. **`통계목록조회`** (`statisticsList.do`) — browse the hierarchical statistics list (by `vwCd`/`parentId`) to confirm classification structure (`objL1`~`objL8`) and item codes (`itmId`) before pulling data.
3. **`통계자료조회`** (`Param/statisticsParameterData.do`) — retrieve the actual numeric time-series once `orgId`, `tblId`, classification codes, and `itmId` are known.
4. **`통계설명`** (`statisticsExplData.do`) — optional metadata/methodology lookup, keyed by `statId` or `orgId`+`tblId`.

### 1. Statistical Data Retrieval (`통계자료조회`)

```
GET https://kosis.kr/openapi/Param/statisticsParameterData.do?method=getList
```

| Parameter | Required | Description |
|---|---|---|
| `apiKey` | Y | Issued authentication key |
| `orgId` | Y | Organization ID |
| `tblId` | Y | Statistical table ID |
| `objL1` | Y | Classification 1 (first classification code) |
| `objL2`~`objL8` | N | Classification 2~8 |
| `itmId` | Y | Item |
| `prdSe` | Y | Period type (e.g. `Y`=annual, `Q`=quarterly, `M`=monthly) |
| `startPrdDe` | N* | Start period |
| `endPrdDe` | N* | End period |
| `newEstPrdCnt` | N* | Number of most recent periods (defaults to most recent 1 period if omitted) |
| `prdInterval` | N | Period interval |
| `format` | Y | Response format (`json`) |
| `outputFields` | N | Response fields to include |
| `smblChk` | N | Statistical symbol flag |

\* Use either (`startPrdDe`+`endPrdDe`) OR `newEstPrdCnt`, not both. If neither is set, defaults to the most recent 1 time point.

Response fields: `ORG_ID`, `TBL_ID`, `TBL_NM`, `C1_NM`~`C8_NM` (+ `_ENG` variants), `ITM_ID`, `ITM_NM` (+`_ENG`), `UNIT_NM` (+`_ENG`), `PRD_SE`, `PRD_DE`, `DT` (the numeric value), `LST_CHN_DE`.

### 2. Statistics List (`통계목록조회`)

```
GET https://kosis.kr/openapi/statisticsList.do?method=getList
```

| Parameter | Required | Description |
|---|---|---|
| `apiKey` | Y | Issued authentication key |
| `vwCd` | Y | Service view code (e.g. `MT_ZTITLE`, `MT_OTITLE`) |
| `parentId` | Y | Starting list ID (some docs call it `parentListId`) |
| `format` | Y | Response format (`json`) |
| `content` | N | `html` or `json` |

Response fields: `VW_CD`, `VW_NM`, `LIST_ID`, `LIST_NM`, `ORG_ID`, `TBL_ID`, `TBL_NM`, `STAT_ID`, `SEND_DE`, `REC_TBL_SE`.

### 3. Integrated Search (`통합검색`)

```
GET https://kosis.kr/openapi/statisticsSearch.do?method=getList
```

| Parameter | Required | Description |
|---|---|---|
| `apiKey` | Y | Issued authentication key |
| `searchNm` | Y | Search keyword |
| `orgId` | N | Organization ID filter |
| `sort` | N | `RANK`=relevance (default) \| `DATE`=most recent |
| `startCount` | N | Page/start offset |
| `resultCount` | N | Result count |
| `format` | Y | Response format (`json`) |
| `content` | N | `html` or `json` |

Response fields: `ORG_ID`, `ORG_NM`, `TBL_ID`, `TBL_NM`, `STAT_ID`, `STAT_NM`, `CONTENTS`, `STRT_PRD_DE`, `END_PRD_DE`, `TBL_VIEW_URL`, `LINK_URL`, `STAT_DB_CNT`.

### 4. Statistics Explanation (`통계설명`)

```
GET https://kosis.kr/openapi/statisticsExplData.do?method=getList
```

| Parameter | Required | Description |
|---|---|---|
| `apiKey` | Y | Issued authentication key |
| `statId` | Y | Survey ID (alternatively `orgId`+`tblId`) |
| `metaItm` | Y | `All` or specific field(s): `statsNm`, `statsKind`, `basisLaw`, `writingPurps`, `statsPeriod`, `examinHistory`, `sampleExtrMthd`, `pubPeriod`, `dataUserNote` |
| `format` | Y | Response format (`json`) |
| `content` | N | `html` or `json` |

### Example Requests

```bash
# Integrated search — find tables matching a keyword (e.g. 소비자물가지수)
curl -fsS --get 'https://kosis.kr/openapi/statisticsSearch.do' \
  --data-urlencode "apiKey=$KOSIS_API_KEY" \
  --data-urlencode 'method=getList' \
  --data-urlencode 'searchNm=소비자물가지수' \
  --data-urlencode 'sort=RANK' \
  --data-urlencode 'resultCount=10' \
  --data-urlencode 'format=json'

# Statistics list — browse a classification tree
curl -fsS --get 'https://kosis.kr/openapi/statisticsList.do' \
  --data-urlencode "apiKey=$KOSIS_API_KEY" \
  --data-urlencode 'method=getList' \
  --data-urlencode 'vwCd=MT_ZTITLE' \
  --data-urlencode 'parentId=A' \
  --data-urlencode 'format=json'

# Statistical data retrieval — annual population figures, most recent 5 periods
curl -fsS --get 'https://kosis.kr/openapi/Param/statisticsParameterData.do' \
  --data-urlencode "apiKey=$KOSIS_API_KEY" \
  --data-urlencode 'method=getList' \
  --data-urlencode 'orgId=101' \
  --data-urlencode 'tblId=DT_1B040A3' \
  --data-urlencode 'objL1=00' \
  --data-urlencode 'itmId=T20' \
  --data-urlencode 'prdSe=Y' \
  --data-urlencode 'newEstPrdCnt=5' \
  --data-urlencode 'format=json'
```

> `orgId`/`tblId`/`objL1`/`itmId` values above are illustrative placeholders for the request shape — always resolve the real codes via the Discovery Flow (search → list) before querying live data.

### Response Shape / Response Policy

**Verified by live testing (2026-08-22)** — all four endpoints respond correctly with a valid `KOSIS_API_KEY`:

- Successful responses are a **raw JSON array** of row objects, e.g. `[{ORG_ID:"101",ORG_NM:"...",...}, ...]`.
- **Error responses use a confirmed `{err, errMsg}` object** (not an array): `{err:"30",errMsg:"데이터가 존재하지 않습니다."}` (no matching data) or `{err:"21",errMsg:"잘못된 요청 변수를 호출 하였습니다."}` (invalid request parameter — e.g. wrong `objL1`/`itmId` for the given `tblId`). Treat any object response (not wrapped in `[...]`) as an error; surface `err` + `errMsg` to the user directly.
- ⚠️ **Non-standard JSON**: KOSIS returns object keys **without quotes** (e.g. `{ORG_ID:"101",...}` rather than `{"ORG_ID":"101",...}`). This is not strict JSON — a strict `JSON.parse`/`json.loads` will fail. Parse with a lenient/JS-literal-tolerant method (e.g. Python: quote the keys with a regex before `json.loads`, or use a JS engine's `eval`-safe parser) rather than a strict JSON parser.
- ⚠️ **Korean-keyword encoding**: passing a literal Korean string directly as a `curl --data-urlencode` argument value can get mis-encoded in some shells (observed in Git Bash on Windows) — the server received garbled bytes and returned `err:30` (no data) even for a keyword that has real matches. **Always percent-encode Korean query values manually first** (e.g. `python3 -c "import urllib.parse; print(urllib.parse.quote('검색어'))"`) and inline the `%XX` sequence directly into the URL, rather than relying on `--data-urlencode` to encode a Korean literal passed inline in the command.
- Always pass `format=json` explicitly; omitting it may return HTML.
- For `statisticsParameterData.do`, default to `newEstPrdCnt=1` behavior (most recent period) only when the user does not specify a time range; otherwise prefer explicit `startPrdDe`/`endPrdDe`.
- **No code-lookup endpoint exists** among the four documented APIs for enumerating a table's valid `objL1`~`objL8`/`itmId` codes directly. In practice, resolve these either from `statisticsList.do`'s classification browsing, or by opening the table's `TBL_VIEW_URL`/`LINK_URL` (from a search/list result) in a browser to read the classification codes off the KOSIS web UI — guessing common codes (e.g. `00`, `T1`) reliably fails with `err:21`.
- Format numeric `DT` values with their `UNIT_NM` for readability, while preserving original figures.
- Append disclaimer at the end: "`통계청 KOSIS 국가통계포털 Open API 자료 기준`".

### Failure Modes

- `KOSIS_API_KEY` not set -> guide to portal `활용신청`, then stop
- `{err:"30", errMsg:"데이터가 존재하지 않습니다."}` -> no matching data; broaden the search keyword (and double-check the keyword wasn't mangled by shell encoding — see Response Policy) or verify `orgId`/`tblId`
- `{err:"21", errMsg:"잘못된 요청 변수를 호출 하였습니다."}` -> invalid parameter, most commonly a wrong `objL1`~`objL8`/`itmId` for the given `tblId` — do not guess these; resolve via `statisticsList.do` or the table's web view URL
- Any other `{err, errMsg}` object -> surface the message verbatim to the user
- Table/classification structure unclear -> fall back to `statisticsList.do` browsing or the table's `TBL_VIEW_URL` before guessing `objL1`~`objL8`/`itmId` values

### Notes

- Data source: [KOSIS 국가통계포털 Open API](https://kosis.kr/openapi/)
- This skill is read-only query only.
- License: `공공누리`(KOGL) — cite source when reproducing statistical figures in deliverables.
- Auth/approval process for `KOSIS_API_KEY` is not fully documented from the fetched devGuide pages; do not invent a signup URL or approval timeline beyond directing the user to the "`활용신청`" menu at <https://kosis.kr/openapi/>.
- Promoted from `co-pitch` (originally imported from `co-test`, 2026-08-22) into `templates/common/skills/` (2026-08-23) to match sibling common skills `k-dart`/`k-law`; `scope: common` and `l2_propagate: true` already set at the source.
