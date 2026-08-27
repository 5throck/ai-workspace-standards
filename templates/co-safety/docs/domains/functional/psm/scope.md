# PSM Domain v1 — Scope Document

> **Status**: Approved (2026-06-20)
> **Domain**: `psm` (Process Safety Management / 공정안전관리)
> **Tier**: Functional (Tier 1) — cross-industry methodology service
> **Derived from**: OSHA-KR Article 44, OSHA PSM 29 CFR 1910.119 (14 elements)

---

## 1. Purpose

Defines the v1 scope of the PSM (Process Safety Management / 공정안전관리) domain within safety-os. The PSM domain provides process safety methodology and evidence management for facilities with "covered processes" — regardless of industry sector. It functions as a **Tier 1 functional service** referenced by industry domains (gasterm, powergen, ehschem) rather than as a standalone industry coordinator.

## 2. Architectural Principle

PSM is a **functional (Tier 1) domain** — it supplies PSM methodology to any industry domain that operates covered processes:

| Component | Count | Notes |
|-----------|-------|-------|
| Agent | 1 | `agents/domains/functional/psm/psm-agent.md` |
| Workflows | 15 | All core (no reference workflows — emergency dispatch via industry domains) |
| Evidence Models | 15 | One per PSM element |
| Skills | 1 | `skills/domains/functional/psm/moc/` (Management of Change) |
| Regulations | 1 | `regulations/KR/Chemical-Plant-Safety.yaml` |
| Industry Profile | N/A | Cross-industry; referenced by `chemical-processing`, `gas-terminal`, `power-generation` profiles |

**Consumer pattern**: Industry domains declare `psm_applicable: true` and reference PSM evidence via `psm_record_ref` / `psm_psi_ref` fields in their own evidence models.

## 3. Regulatory Scope

### 3.1 v1 Coverage (Korea)
- **OSHA-KR Article 44**: PSM mandatory for covered processes (공정안전보고서 제출 의무)
- **OSHA-KR Article 36**: Risk assessment (위험성평가) — cross-reference
- **OSHA-KR Enforcement Decree Article 43** (별표 13 규정량): PSM covered-facility determination — hazardous substances handled at or above threshold quantities (indexed in `regulations/KR/OSHA-KR-Decree.yaml`; former "Article 33" citation here was a mis-citation — Art 33 is 명예산업안전감독관의 해촉)
- **고용노동부 고시 KOSHA Guide P-2**: PSM audit standards

### 3.2 Covered Process Criteria (OSHA-KR Art 44)
Facilities handling hazardous substances at or above threshold quantities — including:

| Facility Type | PSM Obligation | Primary Industry Domain |
|---------------|:--------------:|------------------------|
| Refinery / Petrochemical plant | ✓ | `ehschem` |
| Specialty chemical plant | ✓ | `ehschem` |
| Large-scale LNG terminal | ✓ | `gasterm` (`psm_applicable: true`) |
| Large-scale LPG base | ✓ | `gasterm` (`psm_applicable: true`) |
| LNG-fired power plant (large gas) | ✓ | `powergen` (field planned v1.1) |
| High-pressure boiler power plant | ✓ | `powergen` (field planned v1.1) |
| Semiconductor fab (special gases) | Conditional | *(semicon — future)* |
| Pharmaceutical large-scale chemical | Conditional | `gmp` (case-by-case) |

### 3.3 v1 Exclusions (Deferred)
- Nuclear facilities (원자력안전위원회 별도 규제)
- Offshore platforms (해양수산부 관할)
- Pipeline transport PSM (별도 한국가스공사 기준)
- Real-time DCS/BPCS integration (v2)
- Automated PHA consequence modeling (v2)

## 4. Component Inventory

### 4.1 Workflows (15) — OSHA 14 PSM Elements Coverage

| Workflow | PSM Element | Legal Basis |
|----------|-------------|-------------|
| `psi-management` | Element 1: Process Safety Information | OSHA-KR Art 44 |
| `pha-hazop` | Element 2: Process Hazard Analysis | OSHA-KR Art 44 |
| `sop-management` | Element 3: Operating Procedures | OSHA-KR Art 44 |
| `contractor-management` | Element 5: Contractors | OSHA-KR Art 44 |
| `mi-inspection` | Element 6: Mechanical Integrity | OSHA-KR Art 44 |
| `moc-process` | Element 7: Management of Change | OSHA-KR Art 44 |
| `pssr-review` | Element 8: Pre-Startup Safety Review | OSHA-KR Art 44 |
| `eap-emergency-planning` | Element 9: Emergency Planning & Response | OSHA-KR Art 44 |
| `incident-investigation-psm` | Element 11: Incident Investigation | OSHA-KR Art 44 |
| `psm-compliance-audit` | Element 12: Compliance Audits | OSHA-KR Art 44 |
| `employee-participation` | Element 13: Employee Participation | OSHA-KR Art 44 |
| `hot-work-permit` | Element 10: Hot Work Permits | OSHA-KR Art 44 |
| `loto-lockout-tagout` | — | OSHA-KR Art 38 + 안전보건규칙 Art 92 |
| `psm-worker-training` | Element 4: Training | OSHA-KR Art 44 |
| `trade-secrets-management` | Element 14: Trade Secrets | OSHA-KR Art 44 |

> Elements 4 (Training), 10 (Hot Work Permits), 13 (Employee Participation) were originally planned for v1.1 but have been implemented ahead of schedule.

> **Framework reconciliation — Korean 12-element vs US 14-element mapping**: AGENTS.md describes the statutory Korean framework as "12 elements of OSHA-KR Article 44" (산안법 제44조 + 시행령 공정안전관리 기준·고시). This document instead maps its workflows onto the **US OSHA 29 CFR 1910.119 14-element taxonomy** as the workflow-coverage checklist, which is normative *for this inventory*; for evidence-record `legal_basis`, the Korean Article 44 framework remains the binding obligation. The 12 Korean management elements cover the same subject matter as US elements 1-13; US element 14 (Trade Secrets) is carried here as a standalone workflow. Element numbers in §4.1 follow this document's own sequence (see footnote above: Training = 4, Hot Work Permits = 10, Employee Participation = 13) and do not replicate the CFR's literal section order.

### 4.2 Evidence Models (15)

| Evidence Model | Key Fields |
|----------------|-----------|
| `psm-psi-record.json` | `record_id`, `document_type`, `msds_identifier`, `document_version`, `approval_history` |
| `psm-pha-record.json` | `record_id`, `node_id`, `deviations`, `risk_grade`, `recommendations` |
| `psm-sop-record.json` | `sop_id`, `sop_version`, `change_summary`, `acknowledgments` |
| `psm-contractor-record.json` | `contractor_id`, `evaluation_score`, `training_verification` |
| `psm-mi-record.json` | `record_id`, `equipment_id`, `inspection_date`, `status`, `maintenance_history` |
| `psm-moc-record.json` | `record_id`, `change_id`, `title`, `description`, `status`, `legal_basis`, `hazard_review`, `approval_chain` |
| `psm-pssr-record.json` | `checklist_items`, `startup_approval`, `moc_reference` |
| `psm-eap-record.json` | `record_id`, `emergency_scenarios`, `response_procedures`, `drill_records` |
| `psm-incident-investigation-record.json` | `record_id`, `immediate_causes`, `root_causes`, `corrective_actions` |
| `psm-compliance-audit-record.json` | `record_id`, `audit_scope`, `findings`, `corrective_action_plan` |
| `psm-trade-secrets-record.json` | `record_id`, `protected_information`, `disclosure_controls` |
| `psm-employee-participation-record.json` | `record_id`, `activity_type`, `participants`, `implementation_status` |
| `psm-hot-work-permit-record.json` | `record_id`, `permit_number`, `fire_hazard_assessment`, `closure_signature` |
| `psm-loto-record.json` | `record_id`, `permit_number`, `energy_types_isolated`, `isolation_points`, `lock_type` |
| `psm-worker-training-record.json` | `record_id`, `worker_id`, `training_type`, `completion_status`, `test_score` |

### 4.3 Skills (1)

| Skill | Purpose |
|-------|---------|
| `moc` | Management of Change review — structured hazard assessment for process/equipment changes |

> Additional skills (pha-facilitator, pssr-checklist) planned for v1.1.

## 5. Cross-Domain Reference Interface

PSM is consumed by industry domains via standard reference fields:

| Consumer Domain | Reference Field | PSM Target |
|-----------------|-----------------|-----------|
| `ehschem` | `psm_psi_ref` | `psm-psi-record.json` ID |
| `gasterm` | `psm_applicable: true` + `psm_record_ref` | All applicable PSM records |
| `powergen` | `psm_applicable` *(planned v1.1)* | `psm-psi-record.json`, `psm-pha-record.json` |
| `msds` | `msds_record_ids` in PSI | `msds-record.json` IDs (reverse) |

**Principle**: PSM does NOT dispatch industry domains. Industry domains call PSM as a service. Emergency dispatch always routes through the industry domain's reference workflow → `emergency-agent`.

## 6. Role Separation

| Activity | PSM | ehschem | gasterm | powergen | emergency |
|----------|:---:|:-------:|:-------:|:--------:|:---------:|
| PSM methodology (PHA, MOC, PSSR…) | ✓ Owns | References | References | References | — |
| Industry operating procedures | — | ✓ Owns | ✓ Owns | ✓ Owns | — |
| Chemical substance data (PSI) | References MSDS | — | — | — | — |
| Emergency response execution | — | Reference only | Reference only | Reference only | ✓ Owns |
| Regulatory compliance audit | ✓ (PSM elements) | ✓ (TCCL/K-REACH) | ✓ (고압가스법) | ✓ (전기사업법) | — |

## 7. KPIs

- PSM compliance audit score ≥ 90% (KOSHA Guide P-2)
- 0 overdue PHA recommendations (critical/high severity)
- MOC completion rate: 100% before implementation
- PSSR sign-off: 100% before startup
- PSM incident investigation closure: ≤ 30 days (immediate cause) / ≤ 90 days (root cause)

## 8. Compliance Gates

| Gate | Verification |
|------|--------------|
| `legal_basis` field present in all PSM workflow schemas | `bun scripts/safety-audit.ts` |
| `applicable_industries` declared in all workflow schemas | `bun scripts/safety-audit.ts` |
| Evidence model `$ref` depth correct (`../../../`) | `bun scripts/safety-audit.ts` |
| MOC skill exists at `skills/domains/functional/psm/moc/` | `bun scripts/safety-audit.ts` T-08 |

## 9. Legal Disclaimer

> Regulatory interpretation is user responsibility. The PSM domain provides workflow automation assistance only, not legal advice. All references to OSHA-KR Article 44 and related regulations must be verified by a qualified EHS professional before operational use. Covered process determination and threshold quantity calculation must be confirmed with MOEL (고용노동부) guidance.
