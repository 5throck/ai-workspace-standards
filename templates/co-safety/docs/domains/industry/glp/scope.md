# GLP Domain v1 — Scope Document

> **Domain**: `glp` (Good Laboratory Practice / 비임상시험 관리)
> **Status**: Approved (2026-06-17)

## 1. Purpose

Defines v1 scope of GLP domain for non-clinical laboratory studies. GLP covers pharmaceutical pre-clinical safety testing (MFDS) and chemical hazard assessment (ME under K-REACH). Implements OECD GLP principles for international data acceptance (MAD).

## 2. Korea-Specific Dual Authority

GLP in Korea is regulated by **two separate authorities** depending on test purpose:

| Authority | Test Purpose | Regulation |
|-----------|--------------|------------|
| **MFDS** | Pharmaceutical non-clinical safety (drug IND applications) | 비임상시험 관리기준 + 약사법 |
| **ME (환경부)** | Chemical hazard assessment (K-REACH) | 위해성평가 시험기관 관리기준 + K-REACH |
| **OECD** | International mutual recognition (MAD) | OECD C(97)186/Final |

Some test facilities hold both MFDS and ME GLP certification.

## 3. Domain Boundaries

| Boundary | Interface |
|----------|-----------|
| MSDS → GLP | `msds_record_ref` (test article chemical data) |
| GLP → GMP | `clinical_trial_application_ref` (final report supports IND) |
| GLP → MSDS | Test data feeds back to MSDS Section 11 (toxicology) |
| GLP → K-REACH | Hazard assessment reports submitted to ME |

## 4. Components

| Component | Count |
|-----------|-------|
| Agent | 1 (`glp-agent`) |
| Workflows | 8 (7 core + 1 reference) |
| Evidence Models | 7 |
| Skills | 2 |
| Regulations | 3 (MFDS-GLP, ME-KREACH-GLP, OECD-GLP) |
| Industry Profile | 1 (`pharma-laboratory`) |

## 5. Workflows (mapped to OECD GLP Sections)

| # | Workflow | OECD Section | Type |
|---|----------|--------------|------|
| 1 | test-article-management | Section 7 | core |
| 2 | study-protocol | Section 8 | core |
| 3 | study-conduct | Section 9 | core |
| 4 | data-management | Section 9 + 10 | core |
| 5 | personnel-qualification | Section 2 | core |
| 6 | equipment-calibration | Section 5 | core |
| 7 | qau-inspection | Section 3 (QAU) | core |
| 8 | study-inspection-reference | OECD MAD inspections | reference |

## 6. Common Fields (all glp-*.json)

- `glp_certification_authority`: MFDS / ME / both / OECD_MAD_only
- `oecd_mad_applicable`: boolean (whether data is MAD-eligible)
- `study_director_id`: OECD GLP requires designated Study Director
- `msds_record_ref`: Reference to MSDS for test article (when applicable)

Plus standard: `e_signature`, `nomenclature`, `audit_trail`, `legal_basis` (≥3)

## 7. Records Retention

Per OECD GLP Section 11:
- Raw data: minimum 10 years post-study
- Final report: lifetime of product + 5 years (pharmaceuticals)
- Test article samples: as required by protocol (typically 5 years)
- Tracked via `audit_trail.retention_period` field

## 8. Legal Disclaimer

> Regulatory interpretation is user responsibility. GLP domain provides workflow automation only. Final study acceptance and regulatory submission require qualified Study Director and QAU verification.
