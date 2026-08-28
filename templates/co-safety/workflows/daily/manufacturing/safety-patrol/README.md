# Workflow: Safety Patrol

## 1. Overview

This workflow governs the conduct of structured safety patrols (안전순찰) through manufacturing areas. Safety patrols are a primary mechanism for identifying unsafe acts and unsafe conditions before they result in incidents. They fulfill the active safety management duties of the safety manager (안전보건관리책임자) and supervisors (관리감독자) under Korean law. Patrol findings trigger hazard corrections and feed into the site's risk register.

## 2. Legal Basis (legal_basis)

**legal_basis: 산업안전보건법 제15조 (안전보건관리책임자 직무), 산업안전보건법 제16조 (관리감독자 직무)**

- Article 15 defines the duties of the employer-designated safety and health manager (안전보건관리책임자), which include conducting workplace inspections and hazard identification.
- Article 16 requires line supervisors (관리감독자) to conduct workplace safety inspections within their area of responsibility and take corrective action on identified hazards.
- Together, these articles establish the active supervisory duty that safety patrols fulfill. Documentation of patrols provides evidence of the employer's active safety management.

## 3. Trigger Conditions

- **Daily patrol**: High-risk areas (hot work zones, chemical storage, heavy machinery) — recommended daily
- **Weekly patrol**: General manufacturing floor — minimum weekly per 제16조 supervisor duties
- **Scheduled patrol**: Per the site's annual patrol schedule, including joint patrols with worker safety representatives
- **Incident follow-up**: A targeted patrol of the incident area following any incident or near-miss to verify corrective actions are implemented
- **Regulatory inspection preparation**: Prior to a planned 고용노동부 inspection

## 4. Agent Assignments

| Step | Agent | Role |
|------|-------|------|
| Route selection | safety-workflow-manager | Defines patrol route and scope based on trigger |
| Observation recording | risk-assessment-agent | Captures unsafe acts and conditions systematically |
| Hazard identification | risk-assessment-agent | Classifies observations against risk categories |
| Immediate corrective action | safety-workflow-manager | Issues immediate instructions for critical hazards |
| Follow-up scheduling | audit-agent | Tracks corrective actions to closure |

## 5. Steps

1. **Patrol Route Selection** — safety-workflow-manager defines the patrol route based on the trigger type (daily high-risk, weekly general, follow-up, or scheduled). The patrol route should cover all work areas within scope and be varied to avoid predictability. Confirms the patrol leader (안전보건관리책임자 or 관리감독자) and any accompanying personnel.

2. **Observation Recording** — risk-assessment-agent (or patrol leader with agent support) systematically records all observations during the patrol: unsafe acts (workers not following procedures, improper PPE use, unsafe lifting), unsafe conditions (housekeeping, guarding, labeling, storage), positive observations (good practice to acknowledge), and environmental conditions. Photographs are taken for all significant hazards.

3. **Hazard Identification** — risk-assessment-agent classifies each observation: Critical (immediate risk of serious injury — requires immediate stop-work), Major (significant risk requiring prompt correction within 24 hours), Minor (low risk, correctable within standard maintenance cycle). Critical hazards trigger an immediate corrective action instruction on the spot.

4. **Immediate Corrective Action** — safety-workflow-manager issues verbal and written instructions for Critical and Major hazards identified during the patrol. Confirms the responsible supervisor has acknowledged the instruction. For Critical hazards, confirms work has stopped or hazard is immediately controlled before the patrol continues.

5. **Follow-Up Scheduling** — audit-agent records all corrective actions in the tracking register with responsible person, due date, and required verification method. Schedules follow-up checks to verify completion. Patrol findings are summarized in the patrol record and shared with site management.

## 6. Evidence Requirements

The following records must be created and retained:

- Completed patrol checklist with all areas inspected and observations recorded
- Photographic evidence for all Major and Critical hazards identified
- Corrective action assignments with responsible persons, due dates, and priority
- Confirmation of immediate corrective actions taken for Critical hazards during patrol
- Follow-up verification records confirming corrective action completion
- Monthly patrol summary for management review
- File location: `memory/findings/safety-patrol-YYYY-MM-DD-<route-id>.md`

## 7. Completion Criteria

The workflow is complete when:

- The patrol has covered all areas defined in the route with observations recorded
- All Critical hazards have been immediately addressed and documented
- All Major and Minor hazards have been assigned corrective actions with due dates
- The patrol record is signed by the patrol leader and filed with `legal_basis` field populated
- Follow-up checks are scheduled in the tracking system for all open corrective actions
- Patrol summary is communicated to site management and relevant supervisors
