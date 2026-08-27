# GVP Domain v1 — Scope Document

> **Domain**: `gvp` (Good Pharmacovigilance Practice / 약물감시)
> **Status**: Approved (2026-06-17) — **7th and final GxP domain**

## 1. Purpose

GVP domain for post-market drug safety surveillance per KGVP + ICH E2 series. Completes the pharmaceutical lifecycle coverage (GLP → GCP → GMP → GDP → GVP) in safety-os.

## 2. Domain Boundaries

| Boundary | Interface |
|----------|-----------|
| GCP → GVP | Trial SAE data → post-market signal context |
| GMP → GVP | Quality defects affecting safety → safety signal |
| GDP → GVP | Cold chain excursions → product safety signals |
| MSDS → GVP | Occupational exposure signals (manufacturing/distribution staff) |
| GVP → emergency-agent | Urgent safety actions via `urgent-safety-action-reference` workflow |

## 3. Components

| Component | Count |
|-----------|-------|
| Agent | 1 (`gvp-agent`) |
| Workflows | 8 (7 core + 1 reference) |
| Evidence Models | 7 |
| Skills | 2 |
| Regulations | 2 (MFDS-GVP, ICH-E2) |
| Industry Profile | 1 (`pharmacovigilance`) |

## 4. Workflows

| # | Workflow | Type | Key Topic |
|---|----------|------|-----------|
| 1 | icsr-intake | core | Individual Case Safety Reports (ICSR) receipt and triage |
| 2 | signal-detection | core | Statistical signal detection across case database |
| 3 | pbrer-generation | core | Periodic Benefit-Risk Evaluation Report (annual, ICH E2C(R2)) |
| 4 | risk-management-plan | core | RMP development, update, implementation |
| 5 | pms-study-management | core | Post-Marketing Surveillance (Korea-specific mandatory) |
| 6 | benefit-risk-assessment | core | Ongoing benefit-risk balance evaluation |
| 7 | labeling-update | core | Safety labeling changes based on PV findings |
| 8 | urgent-safety-action-reference | reference | Urgent regulatory action dispatch (recall, restriction) |

## 5. Common Fields (all gvp-*.json)

- `ich_e2_compliance`: boolean (E2 series compliance)
- `pbrer_cycle_ref`: PBRER cycle identifier
- `product_id`: Drug product identifier (GTIN/Korean)
- `rmp_version_ref`: Risk Management Plan reference (when applicable)

Plus standard: `e_signature`, `nomenclature`, `audit_trail`, `legal_basis` (≥3)

## 6. Reporting Timelines

| Report Type | Timeline | Authority |
|-------------|----------|-----------|
| Expedited serious ICSR (mandatory) | 15 days | MFDS |
| Annual PBRER | Yearly | MFDS |
| Signal validation | 30 days from signal identification | Internal |
| Labeling update request | Per MFDS protocol | MFDS |
| Urgent safety action | Immediate | MFDS + Sponsor |

## 7. Korean-Specific

### PMS (Post-Marketing Surveillance)
- Mandatory for new drugs first 6-8 years post-approval
- Korean-specific study design (population-based)
- Results feed into re-evaluation process

### Drug Re-evaluation (재평가)
- Cycle: 5-7 years post-approval
- Triggered by safety signals, new evidence
- Outcome: maintain approval / restrict / withdraw

### KIDS (의약품안전사용센터)
- Voluntary ADR reporting collection
- Healthcare professional training
- Signal analysis support to MFDS

## 8. Legal Disclaimer

> Regulatory interpretation is user responsibility. GVP domain provides workflow automation only. Final benefit-risk decisions require qualified Drug Safety Officer and MFDS coordination.
