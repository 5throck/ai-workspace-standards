---
name: dart-disclosure-parser
description: >
  Real-time Korean DART Open API corporate disclosure and financial statement parsing rules,
  data normalization, and accounting line-item extraction for consulting intelligence.
version: 1.0.0
status: active
owner: strategy-analyst
last_reviewed: 2026-08-06
prerequisites: API_K_DART environment variable, DART Open API access key
scope: co-consult
l2_propagate: true
metadata:
  type: financial-analysis
  triggers:
    - dart-disclosure-parser
    - /dart-disclosure-parser
    - DART parsing
    - DART OpenAPI parse
    - financial statement parser
    - corporate disclosure parser
---

# 📈 Skill: dart-disclosure-parser

## Context

In strategic consulting (`co-consult`) and financial modeling workflows, extracting real-time corporate filings, regulatory disclosures, and financial statements from the Financial Supervisory Service (FSS) DART (Data Analysis, Retrieval and Transfer System) Open API requires structured parsing, currency/unit normalization, and accounting schema alignment.

`dart-disclosure-parser` provides comprehensive rules, execution steps, and schema mappings for parsing real-time DART Open API responses (JSON/XML), extracting financial statements (K-IFRS / K-GAAP), normalizing accounting line items, and auditing major corporate event reports for competitive and market intelligence.

## When to Use

- Parsing raw DART Open API disclosure query results (`list.json`) or financial statements (`fnlttSinglAcnt.json`, `fnlttMultiAcnt.json`).
- Extracting key financial statement line items (Revenue, Operating Profit, Net Income, Total Assets, Total Liabilities, Total Equity) across fiscal periods.
- Distinguishing and normalizing Consolidated Financial Statements (CFS) vs Non-Consolidated Financial Statements (OFS).
- Parsing major corporate event filings (capital increases/reductions, bond issuances, treasury stock transactions, M&A, litigation, dividend announcements).
- Extracting auditor opinions (Unqualified, Qualified, Adverse, Disclaimer of Opinion) and audit notes from periodic business reports (Annual Report, Quarterly Report, Semi-Annual Report).

## Execution Steps

1. **Environment & API Key Verification**
   - Confirm `API_K_DART` environment variable is available.
   - Verify rate limits and quota parameters (maximum 10,000 requests per key/day).

2. **Corporate Entity Resolution (`corp_code`)**
   - Resolve 8-digit DART corporate unique identifier (`corp_code`) from company name or 6-digit stock ticker code using `corpCode.xml`.
   - Distinguish public listed entities (KOSPI, KOSDAQ, KONEX) from unlisted disclosure entities.

3. **Endpoint Payload Fetching & Ingestion**
   - Ingest API response payloads for targeted endpoints:
     - Disclosure list: `/api/list.json`
     - Single company financial statements: `/api/fnlttSinglAcnt.json`
     - Multi-company financial comparison: `/api/fnlttMultiAcnt.json`
     - Major corporate event filings: `/api/piMerger.json`, `/api/piIncrease.json`, etc.

4. **Accounting Line-Item Parsing & Normalization**
   - Parse standardized K-IFRS account codes (`account_id`) and account names (`account_nm`).
   - Map raw K-IFRS line-item API codes to standardized consulting financial metrics:
     - `account_nm` matching `"매출액"` / `"수익(매출액)"` -> `revenue`
     - `account_nm` matching `"영업이익"` / `"영업이익(손실)"` -> `operating_profit`
     - `account_nm` matching `"당기순이익"` / `"당기순이익(손실)"` -> `net_income`
     - `account_nm` matching `"자산총계"` -> `total_assets`
     - `account_nm` matching `"부채총계"` -> `total_liabilities`
     - `account_nm` matching `"자본총계"` -> `total_equity`
   - Handle negative values formatted in parenthetical convention `(1,000)` or leading minus `-1,000`.

5. **Financial Statement Type & Currency Standardization**
   - Identify statement scope (`fs_div`): `CFS` (Consolidated) vs `OFS` (Non-Consolidated). Default to `CFS` when available.
   - Convert reported amounts (`thstrm_amount`, `pvctrm_amount`, `lsqtrm_amount`) into standardized units (e.g. KRW Billions / KRW Millions) with explicit decimal precision.

6. **Audit Opinion & Corporate Event Extraction**
   - Parse audit opinion status fields (`audit_opinion`).
   - Extract event summary key-value pairs (issue quantity, offer price, conversion price, decision date) for corporate actions.

7. **Structured Output Generation & Research Storage**
   - Output structured JSON or markdown summary tables.
   - Store research deliverables in `deliverables/research/dart/` per project conventions.

## DART API Status Code Handling

| Status Code | Meaning | Parser Action |
|-------------|---------|---------------|
| `000` | Normal Response | Proceed with parsing |
| `010` | Invalid API Key | Prompt user to verify `API_K_DART` environment variable |
| `011` | Expired Key | Request user to issue a new DART Open API key |
| `013` | No Data Found | Return empty dataset indicator with query parameter summary |
| `020` | Daily Limit Exceeded | Throttle requests or notify operator of quota exhaustion |
| `100` | Invalid Parameter | Log parameter error and output diagnostic suggestion |
| `800` | System Maintenance | Log server temporary unavailability |

## Canonical Parsing Examples

### Example 1: Financial Statement Response Parsing

```typescript
export interface DartFinancialItem {
  corp_code: string;
  bsns_year: string;
  stock_code: string;
  reprt_code: string;
  account_nm: string;
  fs_div: 'CFS' | 'OFS';
  thstrm_nm: string;
  thstrm_amount: number | null;
  pvctrm_amount: number | null;
}

export function parseDartFinancials(rawItems: any[]): Record<string, number | null> {
  const metrics: Record<string, number | null> = {
    revenue: null,
    operating_profit: null,
    net_income: null,
    total_assets: null,
    total_liabilities: null,
    total_equity: null,
  };

  for (const item of rawItems) {
    const name = item.account_nm?.trim();
    const amountStr = item.thstrm_amount?.replace(/,/g, '').trim();
    const amount = amountStr && amountStr !== '-' ? parseFloat(amountStr) : null;

    if (/^(매출액|수익\(매출액\)|영업수익)$/.test(name)) metrics.revenue = amount;
    else if (/^영업이익(\(손실\))?$/.test(name)) metrics.operating_profit = amount;
    else if (/^당기순이익(\(손실\))?$/.test(name)) metrics.net_income = amount;
    else if (/^자산총계$/.test(name)) metrics.total_assets = amount;
    else if (/^부채총계$/.test(name)) metrics.total_liabilities = amount;
    else if (/^자본총계$/.test(name)) metrics.total_equity = amount;
  }

  return metrics;
}
```

## Output Format

Structured JSON object with normalized financial metrics and disclosure metadata, plus a markdown summary table:

```json
{
  "corp_code": "00126380",
  "bsns_year": "2023",
  "fs_div": "CFS",
  "metrics": {
    "revenue": 258935338,
    "operating_profit": 6566927,
    "net_income": 15487500,
    "total_assets": 426211837,
    "total_liabilities": 185483553,
    "total_equity": 240728284
  },
  "unit": "KRW_MILLIONS"
}
```

## Related Skills

- `k-dart`: Raw DART Open API endpoint caller and reference query executor.
- `financial-modeling`: Financial model construction, forecasting, and quantitative valuation.
- `company-intelligence`: Comprehensive corporate profile and group structure synthesis.
- `competitive-intelligence`: Peer comparison and market share intelligence gathering.
