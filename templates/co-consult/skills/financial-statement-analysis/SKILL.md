---
name: financial-statement-analysis
scope: co-consult
description: >
  Comprehensive Korean financial statement analysis pipeline. Collects DART data,
  validates accounting integrity, normalizes to canonical financial model,
  extracts KPIs (profitability, growth, leverage, cash flow), builds a 5+ level
  ROIC value driver tree, and generates a structured Markdown report.

  Use when: "financial statement analysis", "ROIC analysis",
  "value driver tree", "financial KPI", "profitability analysis",
  "cash flow analysis", "fundamental analysis", "DART analysis",
  "financial metrics extraction", "corporate financial analysis".
status: active
owner: data-analyst
version: 1.0.0
last_reviewed: 2026-07-19
prerequisites:
  - k-dart
metadata:
  type: analysis
  tier: medium
  triggers:
    - financial statement analysis
    - ROIC analysis
    - value driver tree
    - financial KPI
    - profitability analysis
    - cash flow analysis
    - DART analysis
    - fundamental analysis
    - corporate financial analysis
    - financial metrics extraction
---

# Financial Statement Analysis Workflow

## Context

End-to-end financial statement analysis pipeline for Korean listed companies.
Uses DART (Financial Supervisory Service electronic disclosure system) data
to produce validated, normalized financial analysis with ROIC-based value driver decomposition.

**Architecture**: Bun (TypeScript) orchestration + Python pandas data processing.
This hybrid approach complies with the project's Computational Integrity policy
(Class A financial calculations must use validated external tools).

**Owner Agent**: `data-analyst` (dispatched by PM)

## When to Use

- A consulting engagement requires ROIC, profitability, growth, leverage, or cash-flow analysis of a Korean listed company
- The client or engagement lead asks for a "financial statement analysis", "fundamental analysis", or "value driver tree"
- `data-analyst` needs validated, normalized financial data before building a business case in `financial-modeling`
- Do NOT use for non-Korean companies (no DART coverage) or for engagements needing only qualitative company research — use `company-intelligence` instead

## Prerequisites

- `k-dart` skill — for DART data collection (Phase ①)
- Python 3 with `pandas` installed — for data processing (Phases ②–⑤)
- Bun runtime — for orchestration scripts

## Pipeline Stages

```
① DART Collection (k-dart)
    ↓
② Validation Engine (python/validate.py)
    ↓
③ Normalization (python/normalize.py)
    ↓
④ KPI Extraction (python/kpi.py)
    ↓
⑤ ROIC Value Driver Tree (python/driver_tree.py)
    ↓
⑥ Report Generation (scripts/financial-report.ts)
```

### ① DART Data Collection

Use the `k-dart` skill to collect raw financial data via DART OpenAPI `fnlttSinglAcntAll`.
Output: `deliverables/<company>/dart/<company-name>-<corp_code>-<start>-<end>.json`

**Required parameters**:
- Company name or ticker
- Corp code (8-digit DART code)
- Year range (e.g., 2020–2025)
- `fs_div`: CFS (consolidated) preferred, OFS (separate) as fallback
- `reprt_code`: 11011 (annual business report)

### ② Validation Engine

Validates raw DART data for accounting integrity.

**Rules**:
| Rule | Description | Threshold |
|------|-------------|-----------|
| Accounting Equation | Total Assets = Total Liabilities + Total Equity | Residual < 5B KRW |
| Cash Flow Reconciliation | Beginning Cash + OCF + ICF + FCF = Ending Cash | Residual < 1B KRW |
| NI → Retained Earnings | Retained earnings increase ≈ net income | 20% tolerance |
| Anomaly Detection | Flag YoY changes > 200% or sign flips | Base > 1B KRW |

**Runner**: `bun scripts/co-consult/financial-validate.ts <dart.json> --output <path>`

### ③ Normalization

Converts Korean DART account names to a Canonical Financial Model using
industry-specific mapping tables.

**Mapping table**: `python/mappings/ifrs_general.json`

**Canonical fields** (36 per year):
- Income: revenue, cogs, gross_profit, sg_and_a, rd_expense, depreciation, operating_income, ebit, ebt, nopat, tax_expense, net_income, fin_expense, fin_income
- Balance Sheet: total_assets, current_assets, cash, receivables, inventory, non_current_assets, ppe, intangible_assets, total_liabilities, current_liabilities, st_debt, lt_debt, lease_liabilities, right_of_use_assets, total_equity, retained_earnings
- Derived: invested_capital, working_capital
- Cash Flow: operating_cf, investing_cf, financing_cf, free_cash_flow, dividends_paid
- Cross-period: prev_revenue

**Runner**: `bun scripts/co-consult/financial-normalize.ts <dart.json> --mapping <path> --output <path>`

### ④ KPI Extraction

Computes financial KPIs from the canonical model.

**KPI Groups**:

| Group | KPIs |
|-------|------|
| Profitability | Gross Margin, Operating Margin, EBITDA Margin, Net Margin, ROE, ROA, ROIC |
| Growth | Revenue YoY, Operating Income YoY, Net Income YoY, Revenue 3yr CAGR |
| Leverage & Liquidity | D/E, D/A, Equity Ratio, Current Ratio, Quick Ratio, Interest Coverage, Net Debt |
| Cash Flow | OCF Margin, FCF, OCF/Debt, Dividend Payout, Cash Ratio, Asset Turnover, Receivables Turnover, Fixed Asset Turnover |
| Efficiency | COGS/Revenue, SG&A/Revenue, R&D/Revenue, Depreciation/PPE |

**Runner**: `bun scripts/co-consult/financial-kpi.ts <canonical.json> --output <path>`

### ⑤ ROIC Value Driver Tree

Builds a 5+ level decomposition of ROIC into its operational drivers.

**Tree structure**:
```
ROIC (L0)
├── NOPAT (L1)
│   ├── Revenue (L2) → Growth Drivers (L3) → YoY, CAGR (L4)
│   ├── Operating Margin (L2) → Gross/SGA/R&D/Depreciation (L3) → Detail (L4)
│   └── Tax Efficiency (L2) → Effective Rate, NOPAT Margin (L3)
└── Invested Capital (L1)
    ├── Working Capital (L2) → Receivables/Inventory/Payables Days (L3) → Ratios (L4)
    ├── Net Fixed Assets (L2) → PPE/Revenue, Capex (L3) → Turnover (L4)
    ├── Intangible Assets (L2) → Intangibles/Revenue, YoY (L3)
    └── Cash & Debt (L2) → Net Cash, D/E (L3)
```

Each node contains: value, YoY change, weight (contribution), comment (AI-filled).

**Runner**: `bun scripts/co-consult/financial-driver-tree.ts <canonical.json> --output <path>`

### ⑥ Report Generation

Generates a structured Markdown report from all pipeline outputs.

**Sections**:
1. Executive Summary
2. Financial Highlights
3. Profitability Analysis (with Returns)
4. Growth Analysis
5. Leverage & Liquidity
6. Cash Flow Analysis
7. ROIC & Value Driver Tree
8. Investment View (AI agent synthesizes)
9. Appendix A: Validation Summary
10. Appendix B: Data Coverage

**Runner**: `bun scripts/co-consult/financial-report.ts <canonical.json> <validation.json> <kpi.json> <tree.json> --output <path>`

## End-to-End Pipeline

Run all stages in sequence:
```bash
bun scripts/co-consult/financial-pipeline.ts <dart.json> --company <name> --output-dir <dir>
```

This creates the full output structure:
```
<output-dir>/
├── dart/dart-YYYY-MM-DD.json
├── validation/validation-report-YYYY-MM-DD.json
├── canonical/canonical-model-YYYY-MM-DD.json
├── kpi/kpi-report-YYYY-MM-DD.json
├── driver-tree/driver-tree-YYYY-MM-DD.json
└── reports/financial-analysis-<company>-YYYY-MM-DD.md
```

## Execution Steps

(also referred to as the Execution Protocol for the `data-analyst` agent)

1. **Receive dispatch from PM** with company name and year range
2. **Collect data** using `k-dart` skill (or use existing data if available)
3. **Run pipeline**:
   ```bash
   bun scripts/co-consult/financial-pipeline.ts <dart-file> --company <name>
   ```
4. **Review outputs** — check validation pass rate (>90% acceptable), coverage (>80% acceptable)
5. **Synthesize Investment View** — fill section 8 of the report with analytical insights
6. **Hand off** to `communications-lead` or `strategy-analyst` as appropriate

## Output Format

The pipeline emits one Markdown report (see §⑥ Report Generation for the section list) plus the intermediate JSON artifacts it was built from:

| Output | Destination | Format |
|--------|-------------|--------|
| Raw DART data | `deliverables/<company>/dart/` | JSON |
| Validation report | `deliverables/<company>/validation/` | JSON |
| Canonical model | `deliverables/<company>/canonical/` | JSON |
| KPI report | `deliverables/<company>/kpi/` | JSON |
| Driver tree | `deliverables/<company>/driver-tree/` | JSON |
| Final report | `deliverables/reports/` | Markdown |

## Error Handling

| Stage | Failure Mode | Recovery |
|-------|-------------|----------|
| ② Validation | Pass rate < 80% | Flag data quality issues, proceed with warnings |
| ③ Normalization | Coverage < 60% | Check industry mapping, may need custom mapping |
| ④ KPI | Missing key fields | Report which KPIs are unavailable due to missing inputs |
| ⑤ Driver Tree | NOPAT/IC unavailable | Report tree with null nodes and notes |

## Related Skills

- `k-dart` — DART data collection (prerequisite)
- `financial-modeling` — Consulting ROI/NPV business cases (complementary)
- `company-intelligence` — Broader company research (upstream)

## Notes

- All financial computations are performed by Python pandas (Class A Computational Integrity compliance)
- A NodeJS-Polars validation engine was considered as an alternative to `python/validate.py` and explicitly rejected — the pipeline keeps the Bun/TypeScript orchestration + Python/pandas computation split as-is
- The AI agent must NOT calculate financial figures directly
- Korean DART account names vary by company; the normalization mapping absorbs this variation
- The pipeline is loosely coupled — each stage can run independently with JSON I/O
- Future expansion: SEC EDGAR (US), EDINET (Japan) support via new mapping tables only
