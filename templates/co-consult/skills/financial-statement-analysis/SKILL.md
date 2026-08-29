---
name: financial-statement-analysis
scope: co-consult
description: >
  Comprehensive financial statement analysis pipeline for the home-jurisdiction disclosure
  system (KR profile: DART). Collects DART data,
  validates accounting integrity, normalizes to canonical financial model,
  extracts KPIs (profitability, growth, leverage, cash flow), builds a 5+ level
  ROIC value driver tree, and generates a structured Markdown report.

  Use when: "financial statement analysis", "ROIC analysis",
  "value driver tree", "financial KPI", "profitability analysis",
  "cash flow analysis", "fundamental analysis", "DART analysis",
  "financial metrics extraction", "corporate financial analysis".
status: active
owner: data-analyst
version: 1.3.1
last_reviewed: 2026-07-19
prerequisites:
relates_to:
  - skill: company-intelligence
    type: composes_with
  - skill: financial-modeling
    type: composes_with
  - skill: insight-synthesis
    type: composes_with
  - skill: k-dart
    type: relates_to
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

End-to-end financial statement analysis pipeline for listed companies in the active
country profile's jurisdiction (KR: Korean listed companies).
Uses DART (Financial Supervisory Service electronic disclosure system) data
to produce validated, normalized financial analysis with ROIC-based value driver decomposition.

**Jurisdiction scope**: the pipeline targets the KR disclosure system (DART). Under a non-KR
active country profile (or a region-neutral engagement), agents must not run it — request
client-supplied disclosures instead and flag verification limits. See the country profiles
under docs/countries/ (KR profile: Tooling & Skill Mapping).

**Architecture**: Bun (TypeScript) orchestration + Python pandas data processing.
This hybrid approach complies with the project's Computational Integrity policy
(Class A financial calculations must use validated external tools).

**Owner Agent**: `data-analyst` (dispatched by PM)

## When to Use

- PM dispatches a financial statement analysis task for a listed company (KR profile: Korean listed company with DART data)
- A client engagement requires ROIC-based value driver decomposition or peer benchmarking
- DART data has been collected (via `k-dart` skill) and needs end-to-end analysis through the pipeline
- An existing analysis needs re-validation with updated financial data

## Prerequisites

- `k-dart` skill — for DART data collection (Phase ①)
- Python 3 with `pandas` installed — for data processing (Phases ②–⑤)
- Bun runtime — for orchestration scripts

## Execution Steps

See [Pipeline Stages](#pipeline-stages) for the per-stage breakdown. The high-level
execution protocol for the `data-analyst` agent is:

1. **Receive dispatch from PM** with company name and year range
2. **Collect data** using `k-dart` skill (or use existing data if available)
3. **Run pipeline**:
   ```bash
   bun scripts/co-consult/financial-pipeline.ts <dart-file> --company <name>
   ```
4. **Review outputs** — check validation pass rate (>90% acceptable), coverage (>80% acceptable)
5. **Cross-validate against FnGuide** (Stage ⑦) — for domestic listed companies only; record match/mismatch in the report
6. **Synthesize Investment View** — fill section 8 of the report with analytical insights
7. **Hand off** to `communications-lead` or `strategy-analyst` as appropriate

## Output Format

| Output | Destination | Format |
|--------|-------------|--------|
| Raw DART data | `deliverables/<company>/dart/` | JSON |
| Validation report | `deliverables/<company>/validation/` | JSON |
| Canonical model | `deliverables/<company>/canonical/` | JSON — MUST conform to [docs/market-data-schema.json](../../docs/market-data-schema.json) (column/unit/currency contract; see [market-data-schema.md](../../docs/market-data-schema.md)) |
| KPI report | `deliverables/<company>/kpi/` | JSON |
| Driver tree | `deliverables/<company>/driver-tree/` | JSON |
| Final report | `deliverables/reports/` | Markdown |

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
⑥ Report Generation (scripts/co-consult/financial-report.ts)
    ↓
⑦ FnGuide Cross-Validation (domestic listed companies only)
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

**Mapping table**: `python/mappings/ifrs_general.json` — see `income_statement`, `balance_sheet`, and `cash_flow_statement` in `docs/terms-ko.json` for the Korean account-name variants this table must cover (e.g. service companies reporting revenue/COGS under a different pair of account names than manufacturers, or `sj_div` differences between IS/CIS filings).

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

### ⑦ FnGuide Cross-Validation (domestic listed companies only)

DART is the primary source of truth, but the normalization/mapping layer (Stage ③) is
company-specific and can silently drop fields (e.g. non-standard account names, wrong
`sj_div`, consolidated vs separate mismatch). For **domestic Korean listed companies**,
after Stage ⑥ report generation, cross-check headline figures against FnGuide
(`comp.fnguide.com`) — the same underlying data source Naver Finance
(`finance.naver.com`) displays, and reachable via WebFetch/browser tools when
`finance.naver.com` itself is blocked.

**Fields to cross-check** (Annual, latest 3 years): Revenue, Operating Income,
Net Income, Total Assets, Total Equity.

**Procedure**:
1. Fetch `https://comp.fnguide.com/SVO2/ASP/SVD_Finance.asp?pGB=1&gicode=A<6-digit-stock-code>&MenuYn=Y&NewMenuID=103&stkGb=701` — **do not** add `ReportGB=B`, which forces the separate-financials view; omit it to get the page's default view and read the basis label shown in the table header (Korean on the live page — see `consolidation_basis` in `docs/terms-ko.json` for the three label variants and their meaning).
2. Match the DART pipeline's `fs_div` (CFS/OFS, from Stage ① collection params) to the basis FnGuide actually rendered — consolidated↔CFS, separate/individual↔OFS. If they don't match, the comparison is invalid; re-fetch to align basis before comparing figures.
3. Compare the 5 fields above for each of the latest 3 fiscal years. Treat a mismatch as **material** if it exceeds ~1% (rounding between 100-million-KRW units and KRW_billions aside).
4. **On match**: note "FnGuide cross-validated ✅" in the report's Appendix A (Validation Summary) with the fetch date.
5. **On mismatch**: do not silently trust either source — diagnose which stage produced the divergence (wrong `fs_div` collected in Stage ①, mapping gap in Stage ③, or a genuine FnGuide/DART reporting-basis difference such as restated financials) before reporting the analysis as complete. Common root cause: consolidated/separate basis mismatch (see step 2) rather than an actual data error.

**Applicability**: Skip this stage for non-domestic-listed entities (private/unlisted
subsidiaries, foreign issuers) — FnGuide only covers KRX-listed companies.

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

## Error Handling

| Stage | Failure Mode | Recovery |
|-------|-------------|----------|
| ② Validation | Pass rate < 80% | Flag data quality issues, proceed with warnings |
| ③ Normalization | Coverage < 60% | Check industry mapping, may need custom mapping |
| ④ KPI | Missing key fields | Report which KPIs are unavailable due to missing inputs |
| ⑤ Driver Tree | NOPAT/IC unavailable | Report tree with null nodes and notes |
| ⑦ FnGuide Cross-Validation | Figures mismatch FnGuide | Check consolidated/separate/individual basis mismatch first (most common cause); if bases align and mismatch persists, re-examine Stage ① `fs_div` collection and Stage ③ mapping coverage before trusting the report |

### Language

- All raw inputs are Korean (DART filings, FnGuide/Naver labels) — pipeline stages
  (validate/normalize/kpi/driver_tree) consume Korean account names directly and
  emit English canonical field names; no translation step is needed for the numeric
  pipeline itself.
- Report body: English (per workspace language policy), with Korean account/company
  names preserved in parentheses where it aids traceability back to the DART filing.
- Exception: If the user explicitly requests the report in Korean, write in Korean.

## Reference Material

- `docs/terms-ko.json` (workspace root — **not** a per-skill file): SSOT for
  Korean-original DART/financial-statement terminology — consolidation-basis
  labels (consolidated/separate/individual), `sj_div` filing-section codes,
  and income statement / balance sheet / cash flow account-name variants
  (including the non-standard revenue/opex labels some service companies
  use). Shared with `company-intelligence` and any other skill that needs
  Korean business terminology — do not fork a local copy under this skill's
  `references/`; edit `docs/terms-ko.json` directly so all consuming skills
  stay in sync. Non-Markdown reference asset, exempt from the workspace
  English-only doc policy — see the Language Policy Exception in `context.md`
  and the SSOT rule in `docs/co-consult.context.md` (Domain Rules). Consult
  this file when Stage ③ normalization coverage drops (new/unmapped Korean
  account name) or when Stage ⑦ FnGuide cross-validation shows a
  consolidated/separate/individual basis mismatch.

## Related Skills

- `k-dart` — DART data collection (prerequisite)
- `financial-modeling` — Consulting ROI/NPV business cases (complementary)
- `company-intelligence` — Broader company research (upstream); shares the
  `docs/terms-ko.json` SSOT glossary

## Notes

- All financial computations are performed by Python pandas (Class A Computational Integrity compliance)
- The AI agent must NOT calculate financial figures directly
- Korean DART account names vary by company; the normalization mapping absorbs this variation
- The pipeline is loosely coupled — each stage can run independently with JSON I/O
- Future expansion: SEC EDGAR (US), EDINET (Japan) support via new mapping tables only
