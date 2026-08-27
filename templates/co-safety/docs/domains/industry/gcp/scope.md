# GCP Domain v1 — Scope Document

> **Domain**: `gcp` (Good Clinical Practice / 임상시험 관리)
> **Status**: Approved (2026-06-17)

## 1. Purpose

GCP domain for clinical trial management per ICH E6(R3) and Korean KGCP. Covers protocol design, IRB review, informed consent, monitoring, safety reporting, and source data verification.

## 2. Domain Boundaries

| Boundary | Interface |
|----------|-----------|
| GLP → GCP | GLP final report supports IND application → GCP trial starts |
| GMP → GCP | GMP-produced IMP (Investigational Medicinal Product) for GCP trials |
| GCP → GVP | Trial SAE data flows to post-market pharmacovigilance (GVP) |
| GCP → emergency-agent | SAE-reporting-reference workflow for immediate safety signals |

## 3. Components

| Component | Count |
|-----------|-------|
| Agent | 1 (`gcp-agent`) |
| Workflows | 8 (7 core + 1 reference) |
| Evidence Models | 7 |
| Skills | 2 |
| Regulations | 2 (MFDS-GCP, ICH-E6) |
| Industry Profile | 1 (`clinical-research`) |

## 4. Workflows

| # | Workflow | Type | Key Topic |
|---|----------|------|-----------|
| 1 | protocol-management | core | Study protocol design, amendment, IRB submission |
| 2 | irb-review | core | IRB submission, review types (full/expedited/exempt) |
| 3 | informed-consent | core | ICF version control, participant consent |
| 4 | participant-enrollment | core | Eligibility verification, enrollment |
| 5 | monitoring-visits | core | CRA monitoring, SDV (Source Data Verification) |
| 6 | sae-reporting | core | SAE/SUSAR reporting per timelines |
| 7 | source-data-verification | core | Source documents, ALCOA+ |
| 8 | sae-reporting-reference | reference | Severe SAE → emergency-agent (safety signal dispatch) |

## 5. Common Fields (all gcp-*.json)

- `irb_approval_ref`: IRB approval record ID
- `ich_e6_compliance`: boolean (R3 compliance)
- `protocol_ref`: Study protocol record reference
- `site_id`: Investigational site identifier

Plus standard: `e_signature`, `nomenclature`, `audit_trail`, `legal_basis` (≥3)

## 6. Safety Reporting Timelines (Korean KGCP + ICH E2A)

| Event Type | Reporting Timeline |
|------------|-------------------|
| SUSAR (fatal/life-threatening) | 7 days to MFDS |
| SUSAR (other serious) | 8 additional days (15 total) |
| SAE (annual aggregated) | Annual safety report (PSUR) |
| Protocol deviation | Per protocol |

## 7. Legal Disclaimer

> Regulatory interpretation is user responsibility. GCP domain provides workflow automation only. Final trial decisions require qualified Investigator, Sponsor, and IRB review.
