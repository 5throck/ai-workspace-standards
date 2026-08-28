# Workflow: Equipment Inspection

## 1. Overview

This workflow governs the systematic inspection of manufacturing equipment to verify safe operating condition, detect defects before they cause harm, and maintain compliance with statutory inspection requirements. It covers both daily pre-shift checks performed by operators and periodic formal inspections performed by safety personnel or certified inspectors. Defects identified during inspection trigger a corrective action sub-process before affected equipment is returned to service.

## 2. Legal Basis (legal_basis)

**legal_basis: 산업안전보건법 제93조 (안전검사), 산업안전보건법 제89조 (자율안전확인의 신고)** — 앵커 정정(2026-08-24): 자율안전확인은 현행법 제89-92조이며, 구(舊) "제108조" 표기는 조번호 잔류 오류.

- Article 93 mandates that certain categories of high-risk machinery and equipment (압력용기, 크레인, 리프트, 곤돌라, 국소 배기장치 등) undergo statutory safety inspections (안전검사) by an accredited inspection body at prescribed intervals.
- Article 89 requires manufacturers and importers of self-certified safety equipment (자율안전확인 대상 기계·기구) to confirm and declare compliance with safety standards before supply.
- Operators and employers have an ongoing duty to maintain equipment in safe condition between statutory inspections.

## 3. Trigger Conditions

- **Daily pre-shift**: Before operation of any designated high-risk equipment (크레인, 프레스, 용접기, 컨베이어, etc.)
- **Periodic scheduled**: As defined in the site's inspection schedule and statutory inspection calendar
- **Post-incident**: Following any equipment-related incident, near-miss, or abnormal operation
- **Post-maintenance**: After repair, modification, or return from storage
- **Regulatory due date**: When a statutory 안전검사 renewal is due per 제93조 schedule

## 4. Agent Assignments

| Step | Agent | Role |
|------|-------|------|
| Checklist selection | safety-workflow-manager | Identifies correct checklist for equipment type |
| Physical inspection | audit-agent | Executes inspection against checklist |
| Defect recording | audit-agent | Documents all findings with evidence |
| Corrective action | safety-workflow-manager | Assigns actions, tracks resolution |
| Sign-off | safety-workflow-manager | Records completion and clears equipment for use |

## 5. Steps

1. **Inspection Checklist Selection** — safety-workflow-manager identifies the equipment type and selects the appropriate inspection checklist. For equipment subject to 제93조 statutory inspection, confirms whether the statutory inspection certificate is current. Assigns audit-agent to conduct the inspection.

2. **Physical Inspection** — audit-agent conducts the inspection against the checklist, covering: structural integrity, guarding and safety devices, controls and emergency stops, fluid levels and condition, fasteners and connections, electrical safety, labeling and markings, and load/capacity markings where applicable.

3. **Defect Recording** — audit-agent documents every defect or non-conformance found: description of defect, location on equipment, photographic evidence where possible, and preliminary severity assessment (Safety Critical / Major / Minor). Safety Critical defects require immediate equipment isolation.

4. **Corrective Action Assignment** — safety-workflow-manager creates a corrective action for each defect: action description, responsible person, target completion date, and required verification method. Safety Critical defects require a written hold-out tag and must not be cleared for use until repaired and re-inspected.

5. **Sign-Off** — Upon completion of corrective actions, safety-workflow-manager verifies repairs and signs off the inspection record. Equipment is cleared for use. Record is filed.

## 6. Evidence Requirements

The following records must be created and retained:

- Completed inspection checklist with all items marked and inspector signature
- Photographic evidence for any defects identified
- Corrective action records for each defect with resolution confirmation
- For statutory inspections: inspection certificate from accredited body (보험개발원 or equivalent)
- Equipment isolation tag records for Safety Critical defects (tag-out / hold-out log)
- File location: `memory/findings/equipment-inspection-YYYY-MM-DD-<equipment-id>.md`

## 7. Completion Criteria

The workflow is complete when:

- All checklist items have been inspected and recorded
- All identified defects have been assigned corrective actions
- Safety Critical defects have been resolved and re-inspected before equipment is returned to service
- The inspection record is signed off and filed with `legal_basis` field populated
- Statutory inspection certificates are current and on file
