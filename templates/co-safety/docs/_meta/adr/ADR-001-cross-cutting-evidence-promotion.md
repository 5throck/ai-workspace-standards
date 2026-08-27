# ADR-001: Cross-Cutting Evidence Model Promotion Pattern

**Status:** Accepted

**Date:** 2026-08-06

**Decision Makers:** Architect agent (PM-dispatched pilot)

---

## Context

Safety OS evidence models are organized by domain (`evidence-models/domains/`). Some evidence types — such as TBM (Tool Box Meeting) and LOTO (Lockout/Tagout) — appear across multiple domains with significant field overlap:

- **TBM** appeared in ehschem, ehsconst, gasterm, steelmaking, shipbuilding, and other domains. Each domain model duplicated ~70% of the same fields (meeting_date, attendees, topics, legal_basis) while adding domain-specific provisions (SAPA Art.12 for construction, gas leak procedures for gasterm, etc.).

> Correction (2026-08-24): "SAPA Art.12" in this historical narrative is now anchored as SAPA Art.5 (도급·용역·위탁 안전·보건 확보의무 — the construction contractor-tier duty); text preserved verbatim as decision history.
- **LOTO** appears in psm (the primary, most complete model), ehschem, ehsconst, gasterm, steelmaking, and shipbuilding. The psm-loto-record.json is the most comprehensive, but each domain has its own partial version with domain-specific energy types and isolation procedures.

Without a shared base, any update to common fields (e.g., adding a new energy type to the enum, changing the legal_basis format) required touching every domain model independently — a violation of DRY and a source of schema drift.

The TBM promotion (completed immediately prior) established the precedent: extract common fields into `evidence-models/_shared/<record-type>.json`, add an `industry_profile` discriminator and `industry_specific_fields` extension object, and preserve existing domain models for domain-specific provisions.

## Decision

### Pattern: Shared Base + Industry Profile + Extension

When an evidence type meets the promotion criteria (see checklist below), create a cross-cutting base model at `evidence-models/_shared/<record-type>.json` with the following structure:

1. **Common fields** extracted from the most complete domain model
2. **`industry_profile`** — enum of all applicable industries (same 15-industry set established by TBM: ehschem, gasterm, steelmaking, shipbuilding, powergen, waste, defense, semicon, battery, biotech, datacenter, logistics, railway, food, construction)
3. **`industry_specific_fields`** — `additionalProperties: true` object for domain-specific extension (e.g., `{voltage_class}` for powergen, `{gas_type}` for gasterm)
4. **`record_id` pattern** — `^<TYPE>-[A-Z]{2,8}-[0-9]{4}-[0-9]{4}$` for domain-scoped uniqueness
5. **References** to `base/common.schema.json` for `e_signature`, `nomenclature`, and `audit_trail` (relative path: `base/common.schema.json`)
6. **`legal_basis`** — `minItems: 3` array with common cross-industry base plus industry-specific additions

### Promotion Checklist

An evidence type is a candidate for cross-cutting promotion when ALL of the following are true:

| Criterion | Threshold | Rationale |
|---|---|---|
| **Domain count** | Appears in **3+** domains | Ensures the abstraction is warranted — below 3, duplication is acceptable |
| **Common field ratio** | **>70%** of fields are common across domains | If domains diverge too much, a shared base adds complexity without benefit |
| **Domain provisions can be parameterized** | Domain-specific fields fit in `industry_specific_fields` without structural conflict | If domains require mutually exclusive `required` fields, the shared base is not viable |
| **Regulatory alignment** | Common legal_basis can be expressed as a **shared base** (minItems: 3) with industry additions | Ensures the shared model does not water down regulatory precision |

### This Decision: LOTO Promotion

LOTO meets all criteria:
- **Domain count**: 6+ domains (psm, ehschem, ehsconst, gasterm, steelmaking, shipbuilding)
- **Common field ratio**: ~80% (equipment, energy sources, isolation points, locks, verification, removal, emergency removal, legal_basis — all common)
- **Domain provisions parameterizable**: Powergen adds `{voltage_class}`, gasterm adds `{gas_type}`, steelmaking adds `{furnace_type}`, etc. — all fit in `industry_specific_fields`
- **Regulatory alignment**: Common base of OSHA-KR Art.15/92 + 산업안전보건기준에관한규칙 Art.92 + SAPA Art.4/5 applies across all domains

### Files Created

| File | Purpose |
|---|---|
| `evidence-models/_shared/loto-record.json` | Cross-cutting LOTO base model (this decision) |
| `evidence-models/_shared/tbm-record.json` | Cross-cutting TBM base model (precedent, already exists) |

### Explicit Non-Decision: No Migration

This is a **pilot**. Existing domain models are NOT modified:
- `evidence-models/domains/functional/psm/psm-loto-record.json` — **preserved as-is**
- All other domain LOTO references — **preserved as-is**

The shared base is created as an OPTION for future adoption. Migration of domain models to reference the shared base (via `$ref` or alignment) is a separate decision requiring per-domain analysis.

## Consequences

### Positive

- **DRY**: Common LOTO fields defined once, reducing maintenance burden
- **Consistency**: All domains share the same field names, types, and enums for core LOTO data
- **Extensibility**: New industries can adopt LOTO by setting `industry_profile` + adding `industry_specific_fields`
- **Auditability**: Single source of truth for the LOTO evidence schema

### Negative

- **Indirection**: Agents consuming domain-specific models must now also be aware of the shared base for cross-domain queries
- **Partial adoption risk**: If some domains adopt the shared base and others don't, consumers must handle both shapes
- **Schema duplication persists**: Until migration is executed, the shared base AND domain models both exist — any field update must touch both

### Neutral

- **No breaking change**: Existing domain models are untouched; this is additive only
- **Precedent reinforced**: Establishes the TBM pattern as a repeatable process for future promotions

## Alternatives Considered

### Alternative 1: Keep domain models only (status quo)
- **Rejected**: TBM promotion already demonstrated the value; LOTO has even higher field overlap across domains. Status quo guarantees continued drift.

### Alternative 2: Merge all domain models into one (replace, not supplement)
- **Rejected**: Domain models contain domain-specific provisions (e.g., psm-loto has `tar_id` for turnaround tracking, ehsconst has SAPA Art.12 references) that don't belong in a shared base. Merging would lose domain precision.

> Correction (2026-08-24): the "SAPA Art.12 references" cited here are now cited as SAPA Art.5 (contractor-tier assurance duty); narrative preserved verbatim as decision history.

### Alternative 3: Use JSON Schema `$ref` from domain models to shared base
- **Rejected for now**: Too invasive for a pilot. Would require modifying existing domain models. Can be the migration strategy in a future decision.

## Future Work

1. **Domain migration**: Evaluate each domain's LOTO model for alignment with `_shared/loto-record.json`. Per-domain migration decisions will be documented in subsequent ADRs.
2. **Validation tooling**: Update the evidence model audit script to check that domain models referencing the shared base are aligned (field names, types, enums match).
3. **Future promotion candidates** (pending checklist evaluation):
   - **Confined Space Entry** — appears in 4+ domains (ehschem, ehsconst, steelmaking, shipbuilding); high common field ratio expected
   - **Hot Work Permit** — appears in 4+ domains; common fields (work_type, fire_watch, permit_duration) are strong candidates
   - **Inspection** — appears in most domains but may be too generic; needs closer evaluation of whether field overlap is structural or coincidental

## References

- **TBM promotion** (precedent): `evidence-models/_shared/tbm-record.json`
- **PSM LOTO model** (source): `evidence-models/domains/functional/psm/psm-loto-record.json`
- **Common schema**: `evidence-models/_shared/base/common.schema.json`
- **KOSHA GUIDE Z-40-2022**: Lockout/Tagout safety guide (Korean)
