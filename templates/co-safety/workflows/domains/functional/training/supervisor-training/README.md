# Workflow: Supervisor Training (관리감독자 교육)

## 1. Overview

This workflow guides the planning, delivery tracking, and evidence recording of legally mandated supervisor education (관리감독자 교육). It applies to all industries supported by this workflow profile: chemical, gas_terminal, power_generation, construction, medical_device, pharma, and manufacturing. The workflow produces a structured training record that satisfies 산업안전보건법 Article 32 requirements and supports employer obligations under 중대재해처벌법 Articles 7 and 8.

## 2. Legal Basis (legal_basis)

Citations below are verbatim-aligned with this workflow's `schema.yaml` `legal_basis` array (same articles, same order).

**Primary legal_basis: 산업안전보건법 Article 32**

- **산업안전보건법 Article 32** — Supervisor education / workplace safety measures (관리감독자 교육 / 작업장 안전조치): employers must provide mandatory education to supervisors responsible for workplace safety oversight.
- **중대재해처벌법 Article 7** — Dual liability for serious industrial accidents — corporate penalty (중대산업재해의 양벌규정): failure to deliver mandated supervisor education exposes the business owner and the corporation to serious-accident liability.
- **중대재해처벌법 Article 8** — Mandatory safety and health education attendance (안전보건교육의 수강): supervisors must attend the mandated safety and health education.

## 3. Trigger Conditions

- Supervisor appointed or newly designated with safety oversight duties
- Periodic supervisor education cycle due date approaching (`next_training_due` field in an existing `training-record.json`)
- Supervisor identified as overdue during gap analysis
- Safety Workflow Manager dispatches a training-plan update
- Escalation from any audit finding of missing supervisor education records

## 4. Agent Assignments

| Step | Agent | Role |
|------|-------|------|
| Scope definition | safety-workflow-manager | Initiates workflow, gathers supervisor roster and period context |
| Gap analysis | training-agent | Compares completion status against OSHA-KR Article 32 requirements |
| Curriculum generation | training-agent | Dynamically generates tailored curricula by role and hazard |
| Record sync | training-agent | Prepares updated training plans for dispatch |
| Documentation | safety-workflow-manager | Record creation and filing |

## 5. Steps

1. **Scope Definition** — safety-workflow-manager confirms the target supervisor population, applicable industries, and the reporting period. Assigns the training-agent to lead the compliance check.

2. **Gap Analysis** — training-agent reads existing `training-record.json` files for supervisors and compares `completion_date`, `hours_completed` vs `required_hours`, and `next_training_due` fields against 산업안전보건법 Article 32 requirements, validating every record's `legal_basis` array against `regulations/KR/legal-glossary.yaml`. Supervisors without current education are flagged as gaps.

3. **Curriculum Generation** — For flagged supervisors, training-agent dynamically generates tailored supervisor education curricula based on each supervisor's role, oversight scope, and identified hazards.

4. **Record Sync** — training-agent prepares updated training plans and requirements for dispatch to the Safety Workflow Manager.

5. **Documentation** — safety-workflow-manager creates the structured JSON evidence record per `evidence-models/domains/functional/training/training-record.json`, with a human-readable summary in `memory/training/`, and routes it for acknowledgment.

**Escalation**: If a supervisor is identified as operating without the mandated education (Article 32 violation), escalate immediately to PM (CSO) and Safety Workflow Manager. If a training evidence record fails schema validation or its `legal_basis` cannot be resolved against `regulations/KR/legal-glossary.yaml`, escalate as broken traceability.

## 6. Evidence Requirements

The following records must be created and retained to satisfy audit requirements:

- Structured JSON evidence record conforming to `evidence-models/domains/functional/training/training-record.json` (primary audit artifact)
- Every record's `legal_basis` field populated with the citations listed in Section 2 above
- Completion data fields filled: `completion_date`, `hours_completed` vs `required_hours`, `next_training_due`
- Human-readable summary in `memory/training/`
- Validation of the record's `legal_basis` array against `regulations/KR/legal-glossary.yaml`

## 7. Completion Criteria

The workflow is complete when:

- All supervisors in scope have a current education record under 산업안전보건법 Article 32
- All gaps identified in step 2 have been closed with generated curricula dispatched via step 4
- The evidence record is saved as structured JSON per `training-record.json` schema with `legal_basis` populated
- Any Article 32 violation (supervisor operating without mandated education) has been escalated to PM (CSO) and Safety Workflow Manager
