# HR Metric Definition Dictionary Schema

## Purpose

This schema provides a structured contract for HR metric definitions, ensuring that calculation formulas, data sources, refresh cadence, and ownership are explicitly recorded for each metric. This structure makes metric results reproducible across analysts and dashboard cycles.

The dictionary is grounded in the `hr-metrics-analysis` skill:
- **Step 1** ("Define the Standard HR Metric Set") requires recording an explicit formula/definition so results are reproducible
- **Step 3** ("Dashboard Specification Design") defines per-metric fields: name/formula, data source (system of record), refresh cadence, and owner

This schema formalizes those requirements as a persistent, machine-readable dictionary that can be referenced throughout an engagement.

**Decision record**: Closes `docs/variant-benchmark-backlog.md` section 12 "No metric-definition dictionary" (gap closed 2026-08-25).

## Schema Overview

The schema consists of two top-level fields and an array of metric objects:

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema_version` | string | Yes | Version identifier (must be `"1.0.0"` for this schema) |
| `scope` | string | No | Engagement or project scope, e.g. `"FY2026 workforce baseline diagnosis"` |

### Per-Metric Fields

Each metric in the `metrics` array must include:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Stable kebab-case identifier (pattern: `[a-z0-9]+(-[a-z0-9]+)*`), e.g. `"turnover-rate-voluntary"` |
| `name` | string | Yes | Human-readable metric name |
| `definition` | string | Yes | Plain-language definition of what the metric measures |
| `formula` | string | Yes | Explicit calculation formula, e.g. `"separations in period / average headcount in period (voluntary split)"` |
| `unit` | string | No | Result unit, e.g. `"percent"`, `"days"`, `"ratio"` |
| `data_sources` | array of strings | Yes | Systems of record, e.g. `["HRIS payroll export", "ATS requisition report"]` |
| `refresh_cadence` | enum | Yes | One of: `"real-time"`, `"daily"`, `"weekly"`, `"monthly"`, `"quarterly"`, `"annual"` |
| `owner` | string | Yes | Role accountable for data quality and refresh |
| `iso_30414_area` | string | No | ISO 30414 reporting area link (see `docs/iso-30414-metrics-mapping.md`, areas 1-11) |
| `benchmark_guardrail` | string | No | External-benchmark citation requirement note; benchmarks must cite source name and recency per skill Step 4 |
| `notes` | string | No | Additional context or caveats |

**Note**: The `refresh_cadence` enum includes two values (`"quarterly"`, `"annual"`) beyond the four cadences listed in the skill's Step 3 (real-time, daily, weekly, monthly), supporting longer reporting cycles.

## Consumption

### Step 1: Standard Metric Set Definition

When defining the standard metric set (skill Step 1), record each in-scope metric as a dictionary entry. The dictionary is the durable form of this step's definitions.

For metrics with natural splits, such as turnover rate with voluntary/involuntary breakdowns, create separate `id` entries sharing one formula family (e.g., `"turnover-rate-voluntary"` and `"turnover-rate-involuntary"`).

### Step 3: Dashboard Specifications

When designing dashboard specifications (skill Step 3), pull formula, data source, refresh cadence, and owner from the metric dictionary rather than restating them. The dictionary serves as the single source of truth for these fields.

### Ownership

The `data-analyst` agent owns the metric dictionary through its `required_skills: [hr-metrics-analysis]` binding. When a metric lacks a dictionary entry, define one before first use rather than computing from an unstated formula.

## Governance

### Per-Engagement Artifacts

Metric dictionaries are per-engagement artifacts. In scaffolded co-hr projects, store the dictionary at `docs/metrics/metric-dictionary.json`. The schema itself (`docs/metric-dictionary-schema.json`) provides the validation contract.

### Versioning

- **Additive field changes** (new optional fields) bump `schema_version` minor (e.g., `1.0.0` → `1.1.0`)
- **Breaking changes** (removing or renaming required fields) bump `schema_version` major (e.g., `1.0.0` → `2.0.0`) and require a CHANGELOG entry

### Benchmark Guardrails

The `benchmark_guardrail` field enforces the skill's Step 4 requirement: benchmarks must cite source name and recency. Never fabricate industry figures without a cited source. When no reliable benchmark is available, state that explicitly rather than inventing one.

### Schema File

The schema definition lives at `docs/metric-dictionary-schema.json` in the co-hr template. Validate dictionary instances against this schema to ensure compliance.
