# MSDS Domain v1 — Scope Document

> **Status**: Approved (2026-06-17)
> **Domain**: `msds` (Material Safety Data Sheet / 화학물질안전보건자료)
> **Derived from**: `memory/meeting-2026-06-17-msds-domain-addition.md`, `memory/meeting-2026-06-17-msds-open-questions-resolution.md`

---

## 1. Purpose

Defines the v1 scope of the MSDS (Material Safety Data Sheet) domain within safety-os. The MSDS domain manages chemical substance safety data, GHS classification, chemical approval workflows, and interfaces with PSM/GMP domains as a chemical data provider.

## 2. Architectural Principle

Mirrors PSM/GMP module architecture with **new domain-onboarding SOP** applied (first new domain test case):

| Component | Count | Notes |
|-----------|-------|-------|
| Agent | 1 | `agents/domains/functional/msds/msds-agent.md` (migrated from `_shared/chemical-safety-agent.md`) |
| Workflows | 7 | 6 core + 1 reference (chemical-spill-reference) |
| Evidence Models | 6 | All include `ghs_version: "rev9"` field |
| Skills | 3 | msds-parser (hybrid), ghs-classifier, chemical-risk-assessment |
| Industry Profile | 1 | `industry-profiles/chemical-handling.yaml` |
| Regulations | 2 | OSHA-KR-MSDS, K-REACH |

## 3. Regulatory Scope

### v1 Coverage (Korea)
- **OSHA-KR Articles 110-114**: MSDS preparation, posting, labeling
- **OSHA-KR Article 104**: Hazard-factor classification criteria — statutory GHS anchor (시행규칙 별표 18; former legacy "Article 243" removed)
- **K-REACH Articles 10-14**: Chemical registration, evaluation, hazardous substance management
- **TCCL (유해화학물질관리법)**: Toxic substance management (integrated with K-REACH)
- **GHS Rev 9** (2021): International standard, Korean baseline since 2023

### v1 Exclusions (Deferred to v2)
- Spill response execution (delegated to emergency-agent via reference workflow)
- Chemical transport (위험물운송법)
- Chemical waste disposal (폐기물법)
- GHS Rev 10 migration (~2027)
- ML-based msds-parser internalization
- MSDS rule DB auto-expansion

## 4. Component Inventory

### 4.1 Workflows (7)

| Workflow | Type | Legal Basis |
|----------|------|-------------|
| msds-intake | core | OSHA-KR Art 110 + 시행규칙 §156 + GHS Rev 9 |
| ghs-classification | core | OSHA-KR Art 104 + 시행규칙 별표18 + GHS Rev 9 |
| chemical-approval | core | OSHA-KR Arts 117-118 + CCA + GHS |
| chemical-inventory | core | K-REACH Art 10 + OSHA-KR Art 110 |
| kreach-registration | core | K-REACH Art 11 + ME 고시 |
| hazard-labeling | core | OSHA-KR Art 115 + 시행규칙 §170 + GHS Rev 9 |
| **chemical-spill-reference** | **reference** | OSHA-KR Art 110 + 위험물안전관리법 |

**Reference workflow** dispatches to emergency-agent for execution; MSDS provides Section 6 data only.

### 4.2 Evidence Models (6)

All include `ghs_version` field (Rev 9 baseline, migration tracking):
1. `msds-record.json` — GHS 16 sections full schema (international compatible)
2. `ghs-classification-record.json` — Classification result (hazard classes, categories, H/P-Statements)
3. `chemical-approval-record.json` — New chemical introduction approval history
4. `chemical-inventory-record.json` — Monthly inventory snapshots
5. `kreach-registration-record.json` — ME registration history
6. `hazard-label-record.json` — Label generation history

### 4.3 Skills (3)

1. **`msds-parser`** (hybrid): Mode 1 rule-based (top 5 suppliers) + Mode 2 ML fallback (confidence <80%)
2. **`ghs-classifier`**: Rev 9 ruleset, composition → GHS classification
3. **`chemical-risk-assessment`**: Use-scenario based hazard evaluation

### 4.4 Agent Updates

- `agents/domains/functional/msds/msds-agent.md` (new — migrated from chemical-safety-agent)
- `agents/_shared/occupational-health-agent.md` Section B update: explicit MSDS data dependency

## 5. Multi-Source Legal Basis Requirement

Per meeting 2026-06-17, MSDS workflows require **minimum 3 sources** (stricter than GMP's 2):

- **OSHA-KR** (Korean statutory)
- **TCCL or K-REACH** (Korean delegated)
- **GHS** (international alignment)

## 6. Cross-Domain References

| Source Domain | Reference Field | MSDS Target |
|---------------|-----------------|-------------|
| PSM `psi-management` | `msds_record_ids` | `msds-record.json` IDs |
| GMP `cleaning-validation` | `cleaning_agent_msds_ref` | `msds-record.json` ID |
| GMP `supplier-qualification` | `msds_verification_required` | boolean |

## 7. Role Separation (MSDS vs Other Domains)

| Activity | MSDS | PSM | GMP | occupational-health-agent |
|----------|------|-----|-----|---------------------------|
| Chemical substance data | ✓ Owns | References (PSI) | References (cleaning agent) | References (OEL) |
| Process hazard analysis | — | ✓ Owns | — | — |
| Quality risk management | — | — | ✓ Owns | — |
| Exposure monitoring | — | — | — | ✓ Owns |
| Emergency response execution | Reference only | — | — | — |

## 8. KPIs

- 100% site chemicals have valid MSDS on file
- 0 prohibited substance introductions without approval
- MSDS parser accuracy ≥95% (top 5 suppliers) / ≥85% (others via ML fallback)
- K-REACH registration on-time: 100%
- 0 chemical regulatory inspection violations

## 9. Compliance Gates

| Gate | Verification |
|------|--------------|
| Multi-source legal_basis (≥3 entries per workflow) | `bun scripts/safety-audit.ts` v2.3.0 |
| `ghs_version` field in all msds-*.json | JSON schema validation |
| GHS 16 sections completeness in msds-record.json | JSON schema validation |
| Reference workflow has `workflow_type: reference` + `target_agent` | schema.yaml check |
| Role separation explicit in msds-agent Section B | Manual review |
| occupational-health-agent Section B references MSDS | Manual review |

## 10. Domain Onboarding SOP Verification

First new domain added via `docs/_shared/domain-onboarding-guide.md` SOP. All 11 steps:

1. ✓ Reserve domain name `msds` (Section 5 registry below)
2. ✓ Create standard substructure
3. ✓ Author the agent (Phase 2)
4. ✓ Author industry profile (Phase 2)
5. ✓ Author workflows (Phase 4-a)
6. ✓ Author evidence models (Phase 4-a)
7. ✓ Author skills (Phase 4-b)
8. ✓ Author regulations reference (Phase 1 — this document set)
9. ✓ Author scope document (this file)
10. [ ] Run audit (Phase 6)
11. [ ] Update CHANGELOG and memory log (Phase 6 completion)

### Active Domains Registry Update

| Domain | Added | Status | Industry Profile |
|--------|-------|--------|------------------|
| `psm` | pre-2026-06-17 | active | chemical-processing |
| `gmp` | 2026-06-17 | active (v1) | pharma-general |
| **`msds`** | **2026-06-17 (new)** | **active (v1)** | **chemical-handling** |
| `gdp` | planned v2 | pending | pharma-distribution |
| `glp` | planned v2 | pending | pharma-laboratory |
| `gcp` | planned v3 | pending | clinical-research |
| `gvp` | planned v3 | pending | pharmacovigilance |

## 11. Legal Disclaimer

> Regulatory interpretation is user responsibility. The MSDS domain provides workflow automation assistance only, not legal advice. All regulatory references must be verified by a qualified EHS or legal professional before operational use.
