# Disclosure Ingestion Contract

## Purpose

This contract defines a provider-agnostic interface for ingesting corporate financial disclosures from jurisdiction-specific data systems. It decouples the disclosure ingestion pattern from any single provider, enabling non-KR country profiles to plug in their local data systems without creating ad-hoc skills. The DART (Korean Financial Supervisory Service) implementation serves as the normative reference — all new providers must emit the same canonical schema and follow the same storage conventions.

## Contract Overview

The ingestion pipeline follows a four-stage architecture with clear interface boundaries:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 1: Provider Adapter                                                  │
│  Fetch raw disclosures from a jurisdiction system (e.g., DART, SEC EDGAR)  │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 2: Canonical Disclosure Record                                       │
│  Provider-agnostic schema (ALL providers emit this format)                  │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 3: Storage/Cache Convention                                          │
│  File layout: data/disclosures/<provider>/<corp>/<period>/                   │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 4: Consumers                                                         │
│  Skills and scripts that consume canonical records:                         │
│  - financial-statement-analysis (full pipeline)                             │
│  - financial-modeling (NPV/ROI business cases)                              │
│  - financial-kpi.ts (KPI extraction)                                        │
│  - financial-driver-tree.ts (ROIC decomposition)                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Canonical Disclosure Record Schema

All provider adapters must emit records conforming to this schema:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | string | Yes | Provider identifier (e.g., "dart", "sec_edgar", "edinet") |
| `provider_corp_id` | string | Yes | Provider-specific corporate identifier (8-digit corp_code for DART, CIK for SEC) |
| `corp_name` | string | Yes | Full corporate name |
| `period` | string | Yes | Fiscal period in ISO 8601 format (YYYY-MM for quarterly, YYYY for annual) |
| `report_type` | string | Yes | Report type code (e.g., "annual", "quarterly", "semi_annual") |
| `language` | string | Yes | ISO 639-1 language code (e.g., "ko", "en", "ja") |
| `retrieved_at` | string | Yes | ISO 8601 timestamp of retrieval |
| `source_url` | string | Yes | Permanent URL to the source filing |
| `statements` | object | Yes | Nested object containing BS/IS/CF statements with line items |
| `statements.balance_sheet` | array | Yes | Balance sheet line items: `[{concept, value, unit, currency}]` |
| `statements.income_statement` | array | Yes | Income statement line items |
| `statements.cash_flow_statement` | array | Yes | Cash flow statement line items |
| `raw_ref` | string | Yes | Path to the untouched raw file (preservation before normalization) |

### Normalization Rules

1. **Currency codes**: ISO 4217 alphabetic codes only (e.g., "KRW", "USD", "JPY", "EUR")
2. **Units**: Full-scale units (e.g., "full_won", "full_dollar", "full_yen") — no mixed scales like 10,000 or 100,000,000 unit multipliers
3. **Period semantics**: `period` represents the fiscal period covered, not the filing date. Use YYYY-MM for quarterly reports (Q1=YYYY-03, Q2=YYYY-06, Q3=YYYY-09, Q4=YYYY-12 or YYYY-12 for annual)
4. **Missing values**: Use `null` for missing or unavailable values. NEVER use `0` as a placeholder — `0` is a valid financial value
5. **Line item structure**: Each line item in `statements.*` must include:
   - `concept`: Standardized metric name (e.g., "revenue", "operating_profit", "total_assets")
   - `value`: Numeric amount (integer or float, no commas or currency symbols)
   - `unit`: Unit name from the canonical scale (e.g., "full_won", "full_dollar")
   - `currency`: ISO 4217 code

## Provider Adapter Requirements

A new provider adapter must satisfy the following checklist:

- **Idempotent fetch**: Running the adapter twice with the same parameters yields identical canonical records
- **Raw preservation**: Store the original raw file before any normalization (path recorded in `raw_ref`)
- **Rate-limit respect**: Honor provider API rate limits and implement exponential backoff on transient errors
- **Error taxonomy**: Distinguish between three error classes:
  - **Transient**: Network timeouts, rate limits (retry with backoff)
  - **Permanent**: Invalid credentials, deprecated endpoints (fail fast, notify user)
  - **Not found**: No data for given corp_code/period (return empty result set, not an error)
- **No hardcoded credentials**: API keys and authentication tokens must come from environment variables only — never hardcoded in skill files
- **Schema compliance**: All emitted records pass the canonical schema validation (required fields present, types match)
- **English-only output**: Field values (except `corp_name` and proper nouns) must be in English — numeric values and standardized codes are language-independent

## DART Reference Implementation (KR)

The KR country profile provides the normative implementation via the `k-dart` skill:

| Contract Stage | DART Asset |
|----------------|-------------|
| Provider Adapter | `templates/common/skills/k-dart/SKILL.md` (L1 common skill, KR-scoped) |
| Canonical Record | Emitted by `k-dart` as structured JSON with the schema above |
| Storage Convention | `data/disclosures/dart/<corp_code>/<bsns_year>/` |
| Consumers | `financial-statement-analysis` skill (Stages ②–⑦ of the pipeline) |

The DART implementation is **normative** — new providers should study its structure as the reference pattern for jurisdiction-specific adaptations.

## Registering a New Provider

To add a new provider to the contract:

1. **Write the adapter**: Create a country-profile skill following the `k-dart` pattern (e.g., `sec-edgar` for US, `edinet` for Japan). The skill must fetch from the provider's API, normalize to the canonical schema, and store files under `data/disclosures/<provider>/`
2. **Emit canonical records**: Ensure the adapter's JSON output matches the Canonical Disclosure Record schema field-for-field. Run `bun scripts/validate-json-schema.ts <adapter-output> <disclosure-schema.json>` to verify
3. **Validate against schema checklist**: Confirm all required fields are present and normalization rules are respected (currency ISO 4217, full-scale units only, ISO 8601 dates, `null` for missing values)
4. **Add provider row**: Update the Provider Registry table below with the new provider's details

### Provider Registry

| Provider | Jurisdiction | Provider Corp ID Format | Status | Adapter Skill |
|----------|--------------|------------------------|--------|---------------|
| DART | KR | 8-digit corp_code | Implemented (normative reference) | `k-dart` (common, KR-scoped) |
| SEC EDGAR | US | 10-digit CIK | Placeholder — not implemented | N/A |
| EDINET | JP | 4-digit EDINET code | Placeholder — not implemented | N/A |
| EU Registries | EU | LEI or national ID | Placeholder — not implemented | N/A |

## Out of Scope

This contract explicitly does NOT cover:

- **Real-time feeds**: The ingestion pattern assumes batch retrieval of historical filings, not streaming real-time data
- **Paid data vendors**: Commercial data providers (Bloomberg, Refinitiv, FactSet) require separate licensing and are out of scope for this provider-agnostic interface
- **Intra-period estimates**: The contract covers filed, audited disclosures only — guidance, forecasts, or interim estimates are excluded
- **Non-financial disclosures**: ESG reports, sustainability disclosures, and non-financial regulatory filings are not part of this schema (may be covered by separate contracts)

---

## Related Documentation

- `templates/co-consult/skills/financial-statement-analysis/SKILL.md`: Full 7-stage pipeline consuming canonical records
- `templates/common/skills/k-dart/SKILL.md`: Normative DART provider adapter implementation
- `templates/co-consult/scripts/co-consult/financial-kpi.ts`: Consumer expecting canonical schema
- `templates/co-consult/scripts/co-consult/financial-driver-tree.ts`: Consumer expecting canonical schema
- `docs/variant-benchmark-backlog.md`: §4 row 7 (backlog entry that motivated this contract)
