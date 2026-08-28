# Workflow: Permit to Work (PTW)

## 1. Overview

This workflow controls the authorization and safe execution of non-routine, high-risk work activities in manufacturing environments. A Permit to Work (작업허가서) is a formal written document that authorizes specific work in a specific area for a defined time window, confirming that hazards have been assessed and controls are in place. This workflow applies to hot work, confined space entry, work at height, electrical isolation, and other designated high-risk work types.

## 2. Legal Basis (legal_basis)

**legal_basis: 산업안전보건법 제38조 (안전조치), 산업안전보건법 제39조 (보건조치)**

- Article 38 requires employers to implement safety measures to prevent injuries from falls, collapse, fire, explosion, and contact with moving machinery.
- Article 39 requires employers to implement health protection measures for work involving hazardous substances, dust, radiation, extreme temperatures, or noise.
- The PTW system is the primary administrative control mechanism satisfying these obligations for non-routine high-risk work.

## 3. Trigger Conditions

- Any non-routine work in a manufacturing area that has not been covered by a standard operating procedure
- Work classified as high-risk: hot work (welding, cutting, grinding, open flame), confined space entry, work at height above 2m, electrical isolation or live work, chemical handling outside normal process, excavation or ground disturbance
- Contractor personnel commencing work on-site (see also contractor-management workflow)
- Maintenance or repair work on energized or pressurized equipment

## 4. Agent Assignments

| Step | Agent | Role |
|------|-------|------|
| Work scope definition | safety-workflow-manager | Initiates PTW, identifies work type and location |
| Risk assessment | risk-assessment-agent | Assesses hazards specific to the permitted work |
| Control verification | safety-workflow-manager | Confirms all controls are in place before issuance |
| Permit approval | compliance-agent | Reviews for regulatory compliance and approves |
| Work monitoring | safety-workflow-manager | Monitors active permit and escalates issues |
| Permit close-out | safety-workflow-manager | Verifies completion and formally closes permit |

## 5. Steps

1. **Work Scope Definition** — safety-workflow-manager receives the work request and classifies the work type. Confirms: work description, location, duration, performing personnel, and all energy sources or hazardous conditions present.

2. **Risk Assessment** — risk-assessment-agent conducts a task-specific risk assessment per the risk-assessment workflow. The completed risk assessment is attached to the permit. Work must not proceed if residual risk exceeds the site's acceptable threshold.

3. **Control Verification** — safety-workflow-manager physically verifies (or delegates to site supervisor) that all required controls are in place: energy isolation confirmed complete by referencing the corresponding `psm-loto-record.json` record under `loto_record_ref` (lockout/tagout itself is performed and recorded by psm-agent's dedicated `loto-lockout-tagout` workflow, not confirmed directly by SWM here), atmospheric testing completed (for confined spaces), fire watch assigned (for hot work), fall arrest systems in place (for height work), PPE available and correct specification.

4. **Permit Issuance** — compliance-agent reviews the permit package for regulatory completeness and approves. safety-workflow-manager issues the permit with: permit number, work type, authorized personnel list, valid time window, all required controls listed, issuing authority signature.

5. **Work Execution** — Permitted work proceeds within the authorized time window and scope. Any change to scope, personnel, or conditions requires permit suspension and re-assessment.

6. **Permit Close-Out** — Upon work completion, the performing authority confirms: work is complete, all personnel have exited the work area, tools and materials are removed, equipment is restored to safe state, and the area is left clean. safety-workflow-manager records the close-out and formally closes the permit.

## 6. Evidence Requirements

The following records must be created and retained:

- Signed PTW form including all required fields (permit number, dates, personnel, controls, signatures)
- Attached risk assessment record (reference by `memory/findings/` path)
- Control verification checklist with confirming signatures
- `loto_record_ref` — reference to the corresponding `psm-loto-record.json` record when the permitted work requires energy isolation (lock-out/tag-out)
- Atmospheric test results (for confined space work)
- Any permit suspensions or modifications with reasons documented
- Post-work sign-off with performing authority signature
- File location: `memory/findings/ptw-YYYY-MM-DD-<permit-number>.md`

## 7. Completion Criteria

The workflow is complete when:

- The permit is formally closed with performing authority sign-off recorded
- The work area has been confirmed safe and restored
- All permit documentation is filed in `memory/findings/` with `legal_basis` field populated
- Any deviations, near-misses, or issues during the work are recorded
- Closed permit is retained for audit purposes per the minimum 3-year retention period
