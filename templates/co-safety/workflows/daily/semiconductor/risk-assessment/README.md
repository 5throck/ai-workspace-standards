# Workflow: Risk Assessment

## 1. Overview

This workflow guides safety personnel through the systematic identification of workplace hazards, scoring of risk levels, assignment of control measures, and documentation of findings. It applies to all fab cleanroom operations and tool maintenance tasks, particularly at the start of a shift, when tasks change, or when equipment is modified. The workflow produces a legally compliant risk assessment record that satisfies 산업안전보건법 제36조 requirements.

## 2. Legal Basis (legal_basis)

**legal_basis: 산업안전보건법 제36조 (위험성평가 실시)**

- Article 36 of the Occupational Safety and Health Act (산업안전보건법) requires employers to proactively identify and assess occupational hazards and implement measures to eliminate or reduce risk.
- Assessments must be conducted: before commencement of a new project or task, when work methods change, when new machinery or substances are introduced, after an incident, and at least annually for ongoing work.
- Records must be retained for a minimum of 3 years.

## 3. Trigger Conditions

- Daily start-of-shift for high-risk or regulated work areas
- New task assignment or change in work method
- Introduction of new equipment, materials, or chemicals
- Following an incident or near-miss in the work area
- Annual periodic review of the risk register
- Worker or supervisor raises a safety concern about a task

## 4. Agent Assignments

| Step | Agent | Role |
|------|-------|------|
| Scope definition | safety-workflow-manager | Initiates workflow, gathers context |
| Hazard enumeration | risk-assessment-agent | Systematic hazard identification |
| Risk scoring | risk-assessment-agent | Likelihood × Severity matrix scoring |
| Control assignment | risk-assessment-agent | Hierarchy of controls recommendation |
| Documentation | safety-workflow-manager | Record creation and filing |

## 5. Steps

1. **Scope Definition** — safety-workflow-manager confirms the work task, work area, personnel involved, and assessment period. Assigns the risk-assessment-agent to lead the hazard identification.

2. **Hazard Enumeration** — risk-assessment-agent systematically identifies all hazards across categories: physical (machinery, energy, noise, vibration), chemical (substances, dust, fumes), biological, ergonomic (manual handling, repetitive motion), and psychosocial. Each hazard is recorded with a brief description of the potential harm.

3. **Risk Scoring** — For each identified hazard, risk-assessment-agent assigns:
   - **Likelihood** (1=rare, 2=unlikely, 3=possible, 4=likely, 5=almost certain)
   - **Severity** (1=negligible, 2=minor, 3=moderate, 4=major, 5=catastrophic)
   - **Risk Level** = Likelihood × Severity
   - Risk bands: 1–5 Low, 6–12 Medium, 13–19 High, 20–25 Critical. The normative band table is defined in `evidence-models/domains/functional/risk-assessment/risk-assessment-record.json` (see `risk_score_before`) — that schema is the single source of truth; scores ≥ 13 trigger escalation.

4. **Control Assignment** — risk-assessment-agent recommends controls following the hierarchy: Elimination → Substitution → Engineering controls → Administrative controls → PPE. Each control is assigned to a responsible person with a target completion date.

5. **Documentation** — safety-workflow-manager creates the risk assessment record as structured JSON per `evidence-models/domains/functional/risk-assessment/risk-assessment-record.json` schema, with a human-readable summary in `memory/assessments/risk-assessment-YYYY-MM-DD-<scope>.md`, and routes for responsible person acknowledgment.

## 6. Evidence Requirements

The following records must be created and retained to satisfy audit requirements:

- Structured JSON evidence record conforming to `evidence-models/domains/functional/risk-assessment/risk-assessment-record.json` (primary audit artifact)
- Human-readable summary in `memory/assessments/risk-assessment-YYYY-MM-DD-<scope>.md`
- Responsible person signature or digital acknowledgment (`e_signature` field in JSON record)
- Record of any residual risks accepted by management with justification
- Version history if the assessment is revised (`audit_trail.record_status` field)

## 7. Completion Criteria

The workflow is complete when:

- All hazards for the defined scope have been identified and scored
- Controls have been assigned for all Medium, High, and Critical risks
- The assessment record is saved as structured JSON per `risk-assessment-record.json` schema with `legal_basis` field populated, and a human-readable summary is saved to `memory/assessments/`
- Responsible person acknowledgment is obtained
- Any Critical or High risks have been escalated to the site safety manager for review
