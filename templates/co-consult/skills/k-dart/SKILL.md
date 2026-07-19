---
name: k-dart
scope: co-consult
description: >
  Queries the Korean Financial Supervisory Service (FSS) DART OpenAPI for
  corporate disclosures, company profiles, financial statements, and major
  event reports. Requires API_K_DART environment variable.
version: 1.0.0
last_reviewed: 2026-07-19
status: active
owner: strategy-analyst
prerequisites: none
metadata:
  source: https://github.com/NomaDamas/k-skill/blob/main/k-dart/SKILL.md
  license: MIT
  category: finance
  locale: ko-KR
---

## Context

Use in Phase 1 when a consulting engagement requires Korean corporate financial data from the FSS DART (Electronic Disclosure System) OpenAPI. Covers public company filings, financial statements, dividends, capital changes, litigation, auditor opinions, and employee status. Owned by the Strategy Analyst for financial modeling and competitive intelligence workflows.

## When to Use

- Korean public company disclosure search (e.g., "show recent Samsung Electronics filings")
- Company profile lookup (e.g., "tell me about Kakao's corporate overview")
- Financial statement retrieval (e.g., "LG Energy Solution 2024 annual financials")
- Dividend, capital change, treasury stock, or litigation status queries
- Any engagement requiring verified Korean regulatory filing data

## Execution Steps

1. **Verify Prerequisites**: Confirm `API_K_DART` environment variable is set. If not, guide user to obtain key at <https://opendart.fss.or.kr/uss/umt/EgovMberInsertView.do>
2. **Resolve corp_code**: If user provides a company name or stock code (not corp_code), download and parse `corpCode.xml` to resolve the 8-digit corp_code
3. **Select Endpoint**: Match user request to the appropriate DART API endpoint (see DART API Specification below)
4. **Execute API Call**: Use `curl` with `$API_K_DART` to call the endpoint with required parameters
5. **Process Response**: Parse JSON response, handle non-000 status codes per the status code table
6. **Format Output**: Present results with compact formatting; append disclaimer "DART data basis / not investment advice"
7. **Save to Deliverables**: Store research findings in `deliverables/research/` per Output Destination Mapping in `docs/co-consult.context.md`

## Output Format

- Disclosure search: filing name / receipt date / submitter (latest 5-10 items)
- Company profile: company name / representative / industry / address / fiscal year-end
- Financial statements: revenue / operating profit / net income / total assets / total liabilities / total equity (key items)
- Major event reports: summary of key decisions and dates

## Related Skills

- financial-modeling
- competitive-intelligence
- company-intelligence
- insight-synthesis

## DART API Specification

### Prerequisites

`API_K_DART` environment variable must be set. Issue key at: <https://opendart.fss.or.kr/uss/umt/EgovMberInsertView.do>

### corp_code Resolution

Most DART API endpoints require `corp_code` (8-digit unique identifier). When the user provides only a company name or stock code (6 digits):

1. **Download the full corp_code list (`corpCode.xml`)** and parse it to resolve `corp_code`:

**macOS / Linux (bash):**

```bash
[ -f /tmp/dart_corp/CORPCODE.xml ] || {
  curl -fsS -o /tmp/dart_corp.zip \
    "https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=$API_K_DART"
  mkdir -p /tmp/dart_corp && unzip -o /tmp/dart_corp.zip -d /tmp/dart_corp
}

grep -B2 -A3 'COMPANY_NAME' /tmp/dart_corp/CORPCODE.xml | awk '
/<corp_code>/{code=$0; gsub(/.*<corp_code>|<\/corp_code>.*/,"",code)}
/<corp_name>/{name=$0; gsub(/.*<corp_name>|<\/corp_name>.*/,"",name)}
/<stock_code>[0-9]/{stock=$0; gsub(/.*<stock_code>|<\/stock_code>.*/,"",stock); print code, stock, name}
'
```

**Windows (PowerShell):**

```powershell
$dartDir = "$env:TEMP\dart_corp"
if (-not (Test-Path "$dartDir\CORPCODE.xml")) {
  Invoke-WebRequest "https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=$env:API_K_DART" -OutFile "$dartDir.zip"
  New-Item -ItemType Directory -Path $dartDir -Force | Out-Null
  Expand-Archive "$dartDir.zip" -DestinationPath $dartDir -Force
}

[xml]$xml = Get-Content "$dartDir\CORPCODE.xml"
$xml.result.list | Where-Object { $_.corp_name -like '*COMPANY_NAME*' -and $_.stock_code.Trim() -ne '' } |
  Select-Object corp_code, stock_code, corp_name
```

2. Use the resolved `corp_code` for subsequent API calls.

> **Note:** If `/tmp/dart_corp/CORPCODE.xml` already exists, reuse it without re-downloading. The file is approximately 30MB and contains the complete list of entities (listed + unlisted).

### Supported Endpoints

All requests use the format: `GET https://opendart.fss.or.kr/api/{endpoint}.json?crtfc_key=$API_K_DART&...`

#### 1. Disclosure Search

```http
GET /api/list.json?crtfc_key={key}&bgn_de={YYYYMMDD}&end_de={YYYYMMDD}
     [&corp_code={code}]
     [&last_reprt_at=Y|N] [&pblntf_ty=A..J] [&pblntf_detail_ty=...]
     [&corp_cls=Y|K|N|E] [&sort=date|crp|rpt] [&sort_mth=asc|desc]
     [&page_no=1] [&page_count=10]
```

| Parameter | Name | Type | Required | Description |
|-----------|------|------|----------|-------------|
| `crtfc_key` | API Key | STRING(40) | Y | Issued authentication key |
| `corp_code` | Entity Code | STRING(8) | N | 8-digit unique identifier |
| `bgn_de` | Start Date | STRING(8) | Y | Search start date (YYYYMMDD). Default: end_de. **Without corp_code, max 3-month range** |
| `end_de` | End Date | STRING(8) | Y | Search end date (YYYYMMDD). Default: today |
| `last_reprt_at` | Latest Report Only | STRING(1) | N | Y or N. Default: N |
| `pblntf_ty` | Disclosure Type | STRING(1) | N | A=periodic, B=major events, C=issuance, D=equity, E=other, F=external audit, G=fund, H=securitization, I=exchange, J=FTC |
| `pblntf_detail_ty` | Detail Type | STRING(4) | N | A001=annual report, A002=semi-annual, A003=quarterly, B001=major event, F001=audit report, etc. |
| `corp_cls` | Entity Class | STRING(1) | N | Y=KOSPI, K=KOSDAQ, N=KONEX, E=other. Cannot combine multiple values |
| `sort` | Sort By | STRING(4) | N | date / crp / rpt. Default: date |
| `sort_mth` | Sort Order | STRING(4) | N | asc / desc. Default: desc |
| `page_no` | Page Number | STRING(5) | N | 1~n. Default: 1 |
| `page_count` | Page Size | STRING(3) | N | 1~100. Default: 10 |

> **Important:** DART OpenAPI `list.json` does NOT have a `corp_name` parameter. To search by company name, resolve `corp_code` first using the procedure above.

#### 2. Company Overview

```http
GET /api/company.json?crtfc_key={key}&corp_code={code}
```

#### 3. Financial Statements (Single Entity, All Statements)

```http
GET /api/fnlttSinglAcntAll.json?crtfc_key={key}&corp_code={code}&bsns_year={YYYY}&reprt_code={code}&fs_div={OFS|CFS}
```

`reprt_code`: 11013(Q1), 11012(semi-annual), 11014(Q3), 11011(annual report)
`fs_div`: OFS(individual), CFS(consolidated)

#### 4. Capital Increase/Decrease Status

```http
GET /api/irdsSttus.json?crtfc_key={key}&corp_code={code}&bsns_year={YYYY}&reprt_code={code}
```

#### 5. Dividends

```http
GET /api/alotMatter.json?crtfc_key={key}&corp_code={code}&bsns_year={YYYY}&reprt_code={code}
```

#### 6. Treasury Stock Acquisition/Disposal

```http
GET /api/tesstkAcqsDspsSttus.json?crtfc_key={key}&corp_code={code}&bsns_year={YYYY}&reprt_code={code}
```

#### 7. Auditor Name and Audit Opinion

```http
GET /api/accnutAdtorNmNdAdtOpinion.json?crtfc_key={key}&corp_code={code}&bsns_year={YYYY}&reprt_code={code}
```

#### 8. Employee Status

```http
GET /api/empSttus.json?crtfc_key={key}&corp_code={code}&bsns_year={YYYY}&reprt_code={code}
```

#### 9. Paid-in Capital Increase Decision

```http
GET /api/pifricDecsn.json?crtfc_key={key}&corp_code={code}&bgn_de={YYYYMMDD}&end_de={YYYYMMDD}
```

> For paid-in only: `piicDecsn.json`. For free (stock dividend) only: `fricDecsn.json`.

#### 10. Lawsuits

```http
GET /api/lwstLg.json?crtfc_key={key}&corp_code={code}&bgn_de={YYYYMMDD}&end_de={YYYYMMDD}
```

#### 11. Overseas Listing Decision

```http
GET /api/ovLstDecsn.json?crtfc_key={key}&corp_code={code}&bgn_de={YYYYMMDD}&end_de={YYYYMMDD}
```

#### 12. Overseas Delisting Decision

```http
GET /api/ovDlstDecsn.json?crtfc_key={key}&corp_code={code}&bgn_de={YYYYMMDD}&end_de={YYYYMMDD}
```

#### 13. Convertible Bond Issuance Decision

```http
GET /api/cvbdIsDecsn.json?crtfc_key={key}&corp_code={code}&bgn_de={YYYYMMDD}&end_de={YYYYMMDD}
```

#### 14. Exchangeable Bond Issuance Decision

```http
GET /api/exbdIsDecsn.json?crtfc_key={key}&corp_code={code}&bgn_de={YYYYMMDD}&end_de={YYYYMMDD}
```

#### 15. Merger/Division Decision

```http
GET /api/cmpDvmgDecsn.json?crtfc_key={key}&corp_code={code}&bgn_de={YYYYMMDD}&end_de={YYYYMMDD}
```

### Example Requests

```bash
# Disclosure search (Samsung Electronics, corp_code=00126380)
curl -fsS --get 'https://opendart.fss.or.kr/api/list.json' \
  --data-urlencode "crtfc_key=$API_K_DART" \
  --data-urlencode 'corp_code=00126380' \
  --data-urlencode 'bgn_de=20260101' \
  --data-urlencode 'end_date=20260419' \
  --data-urlencode 'page_count=5'

# Company overview
curl -fsS --get 'https://opendart.fss.or.kr/api/company.json' \
  --data-urlencode "crtfc_key=$API_K_DART" \
  --data-urlencode 'corp_code=00126380'

# Financial statements (consolidated, annual report)
curl -fsS --get 'https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json' \
  --data-urlencode "crtfc_key=$API_K_DART" \
  --data-urlencode 'corp_code=00126380' \
  --data-urlencode 'bsns_year=2024' \
  --data-urlencode 'reprt_code=11011' \
  --data-urlencode 'fs_div=CFS'
```

### Response Format

All responses include `status` and `message` fields:

```json
{
  "status": "000",
  "message": "OK",
  "list": [ ... ]
}
```

### Status Codes

| status | Meaning |
|--------|---------|
| 000 | Success |
| 010 | Unregistered key |
| 011 | Unusable key |
| 012 | Inaccessible IP |
| 013 | No data found |
| 014 | File does not exist |
| 020 | Request limit exceeded (generally 20,000+ requests) |
| 021 | Max company count exceeded (max 100) |
| 100 | Field error (invalid field value) |
| 800 | Source system under maintenance |
| 900 | Undefined error |

### Response Policy

- If `status` is not `"000"`, inform the user with the appropriate error message.
- If `status: "013"` (no data), suggest verifying the date range, report type, or `corp_code`.
- If `status: "020"` (rate limit exceeded), inform the user and suggest retrying later.
- For financial statements: default `reprt_code` to annual report (11011), `fs_div` to consolidated (CFS) if not specified.
- For major event reports (endpoints 9-15): default date range to the most recent 1 year if not specified.
- Format numbers with readable units (eok, jo) while preserving original figures.
- Append disclaimer at the end: "Based on FSS DART disclosure data / Not investment advice"

### Failure Modes

- `API_K_DART` not set -> guide to key issuance, then stop
- `status` != `"000"` -> reference status code table for error guidance
- `corp_code` not found -> ask user to verify company name
- No data for given period/report -> suggest changing period or `reprt_code`

### Notes

- Data source: [DART OpenAPI](https://opendart.fss.or.kr/intro/main.do)
- This skill is read-only query only.
- Usage monitoring: [OpenDART Usage Status](https://opendart.fss.or.kr/mng/apiUsageStatusView.do)
