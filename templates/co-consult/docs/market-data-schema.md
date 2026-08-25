# Market Data Schema — Canonical Financial Model

> **Contract**: [`market-data-schema.json`](market-data-schema.json) (JSON Schema draft-07) defines the column, unit, and currency contract for quantitative market data entering the analysis pipeline. Every ingestion source MUST produce this shape before its data reaches the KPI pipeline.
>
> **Backlog origin**: `docs/variant-benchmark-backlog.md` §4 — "No quantitative dataset schema convention for ingested market data (column contracts, units, currency)", closed 2026-08-26.

## Why a schema

The pipeline already had an implicit contract: `financial-normalize.ts` (+ `python/normalize.py`) converts raw disclosure JSON into a canonical financial model, and `financial-kpi.ts` (+ `python/kpi.py`) computes KPIs from it. The contract lived only in the code — a second ingestion provider (row 78's provider-agnostic direction: OpenBB-style multi-provider market data) would have to reverse-engineer the Python to interoperate. The schema makes the shape explicit, validatable, and provider-neutral: **DART is the KR reference producer; any provider that emits this shape is a first-class citizen downstream.**

## The shape

```text
{
  "meta": {
    "company", "corp_code", "ticker", "industry",
    "currency": "KRW",            ← ISO 4217
    "unit": "KRW_billions",       ← currency + magnitude; governs EVERY data value
    "years": ["2022", "2023", "2024"],  ← oldest-first (growth KPIs read year[i-1], year[i-2])
    "mapping_version", "mapped_at",
    "coverage": { "total_fields", "mapped", "missing", "coverage_pct" }
  },
  "data": {
    "2024": { "revenue": 12.3, "cogs": 7.1, ..., "investing_cf": -2.0 },
    ...one key per fiscal year...
  },
  "unmapped_accounts": [ { "year", "sj_div", "account_nm", "thstrm_amount" } ]
}
```

## Line-item contract (26 columns)

All values are `number | null` **in `meta.unit`** — `null` means the disclosure did not report the item. Never zero-fill an unreported item; a zero is a reported zero and flows into KPIs as data.

| Statement | Fields |
|-----------|--------|
| Income statement | `revenue`, `cogs`, `gross_profit`, `sg_and_a`, `rd_expense`, `operating_income`, `ebit`, `fin_expense`, `nopat`, `net_income`, `dividends_paid` |
| Balance sheet | `total_assets`, `current_assets`, `inventory`, `receivables`, `cash`, `ppe`, `total_liabilities`, `current_liabilities`, `st_debt`, `lt_debt`, `total_equity`, `invested_capital` |
| Cash flow / other | `operating_cf`, `investing_cf`, `depreciation` |

The field set is exactly the vocabulary `python/kpi.py` reads (`_g(d, "<field>")`) — adding a KPI that needs a new line item means extending both the schema and the mapping profile in the same change.

**Cross-field invariant** (not expressible in JSON Schema draft-07, enforced by the reference producer): the set of year keys in `data` equals `meta.years`. Consumers iterate `meta.years`, so an undeclared extra year key is silently ignored — treat a mismatch as a producer bug.

## Units and currency rules

1. **Single unit per model.** `meta.unit` (`^[A-Z]{3}_(millions|billions)$`, e.g. `KRW_billions`) governs every value in `data`. Mixed-scale models are invalid by construction.
2. **Currency is ISO 4217** in `meta.currency` and embedded in `meta.unit` — the two must agree.
3. **No percentages in `data`.** Ratios, margins, and growth rates are computed downstream (`financial-kpi.ts` outputs); the model stores only amounts. This is what makes cross-company aggregation safe.
4. **Scale conversion happens at ingestion** (normalize.py divides KRW disclosures by 1e9 → billions), never in consumers.

## Consumers

| Consumer | What it reads |
|----------|---------------|
| `scripts/co-consult/financial-kpi.ts` → `python/kpi.py` | `meta.years`, `meta.company`, `meta.unit`, per-year line items (profitability, growth, leverage, cash-flow, efficiency KPIs) |
| `scripts/co-consult/financial-driver-tree.ts` | Same canonical model, driver-tree decomposition |
| `financial-statement-analysis` skill | Pipeline orchestration; stores the model at `deliverables/<company>/canonical/` |
| `financial-modeling` skill | Baseline-company financials for benefit models (Step 1 inputs MUST be schema-valid canonical models, not ad-hoc figures) |

## Extension rules

- Adding a line item: additive change, bump `mapping_version` and add the field to the schema's per-year properties in the same change.
- Changing a field's meaning or unit semantics: breaking change — all downstream KPI definitions must be re-checked; record the decision in the project's decision log.
- New ingestion provider: emit this shape (write a provider-specific normalizer modeled on `python/normalize.py`); the mapping profile (`python/mappings/`) stays the pluggable part.
