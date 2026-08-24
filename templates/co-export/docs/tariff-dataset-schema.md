# Tariff Dataset Schema

## Purpose

This schema defines a structured local dataset contract for offline HS tariff-line lookup. It enables the `hs-classification-workflow` skill to consult home-jurisdiction tariff schedules without requiring live portal access, ensuring post-clearance audit reproducibility and WTO-framework benchmark parity (tariff schedules as machine-readable datasets).

**Decision record**: Closes `docs/variant-benchmark-backlog.md` section 10 "No tariff-schedule dataset schema" — gap closed 2026-08-25.

## Schema Overview

The dataset is a JSON object conforming to `tariff-dataset-schema.json` with the following structure:

| Top-level field | Type | Required | Description |
|----------------|------|----------|-------------|
| `schema_version` | string (const: "1.0.0") | Yes | Schema contract version |
| `jurisdiction` | string (pattern: `^[A-Z]{2}$`) | Yes | ISO 3166-1 alpha-2 of the home jurisdiction (must match a country profile under `docs/countries/`) |
| `nomenclature` | string | Yes | Nomenclature edition, e.g. "HSK 2026" or "HS 2022" |
| `captured_at` | string (date format) | Yes | As-of date of the capture; rates older than the current tariff year must be re-captured before use |
| `source` | string | Yes | Authoritative source, e.g. "Korea Customs Service tariff portal" |
| `entries` | array (minItems: 1) | Yes | Tariff-line entries |

### Entry-level fields

Each object in the `entries` array represents a tariff line:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hs_code` | string (pattern: `^[0-9]{6}([0-9]{2}){0,2}$`) | Yes | 6-digit HS subheading plus optional 2+2 digits of national tariff-line depth |
| `description` | string (minLength: 1) | Yes | Product description for the tariff line |
| `units` | string | No | Statistical supplementary units, e.g. "kg", "1000 pcs", or "none" |
| `duty` | object | Yes | Duty rate structure (see below) |
| `vat_note` | string | No | VAT/consumption tax note, e.g. "VAT 10% on CIF + duty" |
| `effective_from` | string (date format) | Yes | Effective start date |
| `effective_to` | string (date format) | No | Effective end date (for historical entries) |
| `source_ref` | string | No | Per-line citation for audit reproducibility |
| `notes` | string | No | Additional notes or caveats |

### Duty structure

The `duty` object contains:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mfn_ad_valorem_pct` | number (min: 0) | Yes | MFN ad valorem rate (percentage) |
| `specific_duty` | string | No | Specific duty when applicable, e.g. "KRW 500/kg" |
| `preferential` | array | No | Preferential rates under FTAs (see below) |

### Preferential rates

Each object in the `preferential` array represents an FTA rate:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agreement` | string | Yes | FTA/agreement short name, e.g. "VKFTA", "RCEP" |
| `rate_pct` | number (min: 0) | Yes | Preferential rate (percentage) |
| `rule_ref` | string | No | Origin-rule reference for the `fta-origin-determination` skill to verify |

## Consumption

The `hs-classification-workflow` skill (Execution Step 6) consumes this schema as follows:

1. **Location**: In scaffolded co-export projects, the tariff dataset is stored at `docs/countries/<code>/tariff-dataset.json` (where `<code>` matches the `jurisdiction` field).

2. **Lookup flow**:
   - The skill reads the home jurisdiction's dataset file
   - Finds the tariff-line entry matching the classified `hs_code`
   - Extracts MFN rate (`duty.mfn_ad_valorem_pct`) plus applicable preferential rates
   - Records `captured_at` and `source_ref` in the output for audit reproducibility

3. **Fallback behavior**:
   - If the dataset file is absent, missing, or `captured_at` predates the current tariff year, the skill falls back to portal lookup
   - The gap is recorded in the skill output as a data quality flag

## Capture Discipline

For post-clearance audit reproducibility, the following fields are **mandatory**:

- `captured_at`: As-of date when the dataset was extracted from the authoritative source
- `source`: Name of the authoritative source (e.g., customs portal)
- `source_ref` (per-entry): Citation or reference number for the specific tariff line

**Datasets are snapshots, not live mirrors**. Each capture represents a point-in-time extract. When the underlying tariff schedule changes, a new capture must be created with an updated `captured_at` date.

## Extending

Schema evolution follows semantic versioning:

- **Minor version bump** (e.g., 1.0.0 → 1.1.0): Additive field changes that do not break existing datasets
- **Major version bump** (e.g., 1.0.0 → 2.0.0): Removing or renaming fields, or changing required field constraints — requires a CHANGELOG entry and migration guide

When extending the schema, update the `const` value in the `schema_version` field and document the change in this file's "Purpose" section.
