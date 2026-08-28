# Workflow: Training Compliance Tracking (교육 이수 추적 및 준수 관리)

## 1. Overview

This workflow guides the continuous monitoring of training completion rates, overdue workers, and compliance gaps across all mandated education types (regular, special, supervisor, new hire, MSDS). It applies to all industries supported by this workflow profile: chemical, gas_terminal, power_generation, construction, medical_device, pharma, and manufacturing. The workflow produces a structured compliance record that satisfies 산업안전보건법 Articles 29 and 15 requirements and supports employer obligations under 중대재해처벌법 Article 8 (안전보건교육의 수강).

## 2. Legal Basis (legal_basis)

Citations below are verbatim-aligned with this workflow's `schema.yaml` `legal_basis` array (same articles, same order).

**Primary legal_basis: 산업안전보건법 Article 29**

- **산업안전보건법 Article 29** — Worker safety and health education (근로자 안전보건교육): employers must provide mandatory safety and health education to workers; this workflow tracks completion of that obligation.
- **중대재해처벌법 Article 7** — Dual liability for serious industrial accidents — corporate penalty (중대산업재해의 양벌규정): unresolved training non-compliance exposes the business owner and the corporation to serious-accident liability.
- **산업안전보건법 Article 15** — Safety and Health Management Supervisor duties (안전보건관리책임자): the management-level oversight role accountable for ensuring education obligations are met.

## 3. Trigger Conditions

- Compliance period opens (monthly `YYYY-MM` or quarterly `YYYY-Qn`)
- Scheduled gap-analysis cycle per training-agent Section C protocol
- Overdue worker detected in any training type tracked by `by_training_type`
- Safety Workflow Manager requests a compliance snapshot
- Escalation from any audit finding on training evidence records

## 4. Agent Assignments

| Step | Agent | Role |
|------|-------|------|
| Scope definition | safety-workflow-manager | Initiates workflow, defines reporting period |
| Gap analysis | training-agent | Reads training/compliance records, computes completion rate, overdue, gaps |
| Record sync | training-agent | Prepares updated training plans for dispatch |
| Documentation | safety-workflow-manager | Record creation and filing |

## 5. Steps

1. **Scope Definition** — safety-workflow-manager confirms the compliance period (`YYYY-MM` or `YYYY-Qn`) and applicable industries. Assigns the training-agent to lead the tracking run.

2. **Gap Analysis** — training-agent reads `training-record.json` and `training-compliance-record.json` from `evidence-models/domains/functional/training/` to determine each worker's current compliance status (completion rate, overdue, gaps), comparing against OSHA-KR Article 29 requirements and validating every record's `legal_basis` array against `regulations/KR/legal-glossary.yaml`. Workers who have not received training on updated risk assessment results for their assigned tasks are flagged.

3. **Compliance Computation** — training-agent computes `compliance_rate_pct`, `total_workers`, `trained_workers`, `overdue_workers`, and per-type breakdowns (`by_training_type`: regular, special, supervisor, new_hire, msds). Workers operating without the mandated safety training set `sapa_risk_flagged=true`.

4. **Record Sync** — training-agent prepares updated training plans and requirements for dispatch to the Safety Workflow Manager to close identified gaps.

5. **Documentation** — safety-workflow-manager creates the structured JSON evidence record per `evidence-models/domains/functional/training/training-compliance-record.json`, with a human-readable summary in `memory/training/`, and routes it for acknowledgment.

**Escalation**: If any worker is identified as operating without the mandated safety training (Article 29 violation) or `sapa_risk_flagged=true`, escalate immediately to PM (CSO) and Safety Workflow Manager. If a compliance evidence record fails schema validation or its `legal_basis` cannot be resolved against `regulations/KR/legal-glossary.yaml`, escalate as broken traceability.

## 6. Evidence Requirements

The following records must be created and retained to satisfy audit requirements:

- Structured JSON evidence record conforming to `evidence-models/domains/functional/training/training-compliance-record.json` (primary audit artifact)
- Every record's `legal_basis` field populated with the citations listed in Section 2 above
- Required fields filled: `record_id` (`TRAIN-COMP-YYYY-NNNN`), `period`, `compliance_rate_pct`, `total_workers`, `trained_workers`
- Per-type breakdown (`by_training_type`) and overdue detail (`overdue_worker_list`) where gaps exist
- Human-readable summary in `memory/training/`
- Validation of the record's `legal_basis` array against `regulations/KR/legal-glossary.yaml`

## 7. Completion Criteria

The workflow is complete when:

- The compliance period's `compliance_rate_pct` has been computed from current training records
- All overdue workers are enumerated with `days_overdue` and flagged via `sapa_risk_flagged` where applicable
- The evidence record is saved as structured JSON per `training-compliance-record.json` schema with `legal_basis` populated
- Updated training plans closing the identified gaps have been dispatched to the Safety Workflow Manager
- Any Article 29 violation has been escalated to PM (CSO) and Safety Workflow Manager
