# Workflow: Safety Training

## 1. Overview

This workflow manages the identification, delivery, recording, and verification of occupational safety and health training for manufacturing workers. Regular safety training is a statutory obligation under Korean law and a foundational control for preventing workplace accidents. This workflow covers new employee onboarding training, periodic refresher training, job-specific hazard training, and training triggered by regulatory changes or incident findings.

## 2. Legal Basis (legal_basis)

**legal_basis** (per `schema.yaml`):

1. **산업안전보건법 제29조 (근로자 안전보건교육)** — Article 29 mandates that employers provide safety and health education to all workers. Minimum training frequencies and durations are prescribed by regulation:
   - **신규채용 시 교육** (new employee training): minimum 8 hours (office) / 16 hours (manufacturing/hazardous)
   - **정기 교육** (periodic training): minimum 6 hours per quarter for manufacturing workers
   - **작업내용 변경 시 교육** (job change training): minimum 2 hours when work content changes
   - **특별교육** (special training, 법 제29조 제3항 + 규칙 §26·별표 4): minimum 16 hours for workers assigned to 39 designated high-risk work types
2. **산업안전보건법 시행규칙 제26조 (교육시간 및 교육내용 등)** — Rule §26 defines 특별교육 as the hazardous-work additional education under 법 제29조 제3항 and prescribes hours/content (별표 4/5). Anchor note (2026-08-24): the formerly cited "Article 31" is 건설업 기초안전보건교육 for construction day laborers — NOT the manufacturing special education.
3. **중대재해처벌법 제8조 (안전보건교육의 수강)** — Article 8 requires business owners to secure worker attendance of the mandated safety and health education.

Employers must maintain training records including attendance, curriculum, and trainer qualifications.

## 3. Trigger Conditions

- New employee onboarding (before commencement of work)
- Periodic quarterly training schedule (manufacturing workers: 6 hours/quarter)
- Worker assigned to a new task or work area (minimum 2 hours)
- Worker assigned to designated high-risk work (special training: minimum 16 hours)
- Regulation change affecting worker duties or site procedures
- Post-incident remediation: training identified as a corrective action
- Annual training needs analysis review

## 4. Agent Assignments

| Step | Agent | Role |
|------|-------|------|
| Training needs identification | training-agent | Gap analysis of workforce training records vs statutory requirements |
| Curriculum selection | training-agent | Selects or generates curriculum meeting legal minimum content |
| Training delivery | safety-workflow-manager | Coordinates delivery (in-person, online, OJT) |
| Attendance recording | safety-workflow-manager | Records attendance and trainer details |
| Competency verification | compliance-agent | Verifies training effectiveness and records |

## 5. Steps

1. **Training Needs Identification** — training-agent reviews the workforce roster against training evidence records (`training-record.json`, `training-compliance-record.json`) to identify: workers overdue for periodic training, new employees requiring onboarding training, workers assigned to new tasks or high-risk work requiring specific training, and any training gaps identified by the compliance-gap workflow or incident investigations.

2. **Curriculum Selection** — training-agent selects or generates a curriculum that meets or exceeds the legal minimum content requirements for the training type. For 특별교육 (special training on high-risk work), confirms the curriculum covers all 39 designated work types applicable to the site per the enforcement ordinance.

3. **Training Delivery** — safety-workflow-manager coordinates training delivery. Records: training type, date and time, location or platform, trainer name and qualifications, training materials reference, and list of attendees. For OJT (on-the-job training), confirms the trainer is a competent person for the relevant work.

4. **Attendance Recording** — safety-workflow-manager records attendance with each worker's signature confirming participation. Records are filed immediately after the session. For online training, captures system-generated completion records.

5. **Competency Verification** — compliance-agent confirms training effectiveness through: short assessment, practical demonstration, or supervisor sign-off confirming the worker can perform the work safely. Records the verification outcome for each worker.

## 6. Evidence Requirements

The following records must be created and retained (minimum 3 years per enforcement guidelines):

- Structured JSON evidence record conforming to `evidence-models/domains/functional/training/training-record.json` (primary audit artifact)
- Training attendance sheet with worker signatures and date
- Curriculum materials or reference to approved curriculum
- Trainer qualifications record
- Competency assessment results or supervisor sign-off
- Training register showing each worker's training history, type, hours, and next due date
- For 특별교육: certificate of completion referencing the specific high-risk work type
- File location: `memory/findings/training-YYYY-MM-DD-<type>-<session-id>.md`

## 7. Completion Criteria

The workflow is complete when:

- All identified workers have completed their required training within the prescribed timeframe
- Attendance records are signed and filed for each session
- Training records are saved as structured JSON per the `training-record.json` schema with `legal_basis` field populated
- Competency verification is documented for all workers
- Training register is updated with completion dates and next due dates
- All records are filed with `legal_basis` field populated
- Outstanding training gaps are reflected in the compliance monitoring tracker
