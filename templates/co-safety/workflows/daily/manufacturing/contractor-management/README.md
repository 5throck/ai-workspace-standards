# Workflow: Contractor Management

## 1. Overview

This workflow governs the safe management of contractors (도급업체) working within a manufacturing site. Under Korean law, the principal employer (도급인) has extensive safety obligations toward contractor workers operating in their controlled area. This workflow ensures contractors are registered, inducted, risk-assessed, permitted, monitored, and formally signed off, satisfying the principal employer's duty of care and regulatory obligations.

## 2. Legal Basis (legal_basis)

**legal_basis: 산업안전보건법 제63조 (도급인의 안전보건조치)**

- Article 63 requires the principal employer (도급인) to protect the safety and health of contractor workers operating within their workplace. The duty applies regardless of the contractual relationship and covers the entire duration of the contractor's presence on site.
- Principal employers must: provide safety information about site hazards, coordinate safety activities with contractors, and take measures to prevent accidents.
- Failure to comply exposes the principal employer to fines and, if a serious accident occurs, potential liability under 중대재해처벌법.

## 3. Trigger Conditions

- New contractor or subcontractor awarded a contract to work on-site
- Existing contractor commencing a new work package or entering a new work area
- Contractor personnel change (new workers added to an active contract)
- Annual renewal of contractor approval status
- Return of a contractor following a safety incident or suspension

## 4. Agent Assignments

| Step | Agent | Role |
|------|-------|------|
| Contractor registration | safety-workflow-manager | Collects and verifies contractor documentation |
| Safety induction | compliance-agent | Verifies induction content meets legal requirements |
| Risk assessment | risk-assessment-agent | Assesses contractor work-specific hazards |
| Permit issuance | safety-workflow-manager | Issues PTW for high-risk contractor tasks |
| On-site monitoring | safety-workflow-manager | Monitors contractor compliance during work |
| Exit sign-off | safety-workflow-manager | Confirms completion and site restoration |

## 5. Steps

1. **Contractor Registration** — safety-workflow-manager collects and verifies contractor documentation: business registration, safety management plan (안전보건관리계획서), public liability insurance, worker qualifications and certifications for licensed work, and the most recent safety inspection records for contractor-supplied equipment.

2. **Safety Induction** — compliance-agent verifies that the site safety induction covers all legally required content: site hazards and emergency procedures, site rules and prohibited behaviors, PPE requirements, incident reporting procedures, and site-specific risks. All contractor personnel must complete and sign induction records before commencing work.

3. **Risk Assessment for Contractor Work** — risk-assessment-agent conducts or reviews a risk assessment specific to the contractor's scope of work, considering interface hazards (contractor activities affecting site operations and vice versa). The assessment must identify interface hazards not captured by either party's standard risk assessments.

4. **Permit Issuance** — For any high-risk contractor tasks, safety-workflow-manager initiates the permit-to-work workflow. Contractor personnel must be named on the permit and confirm understanding of conditions.

5. **On-Site Monitoring** — safety-workflow-manager conducts periodic monitoring of contractor activities against the agreed safety management plan. Records of monitoring visits, any observations, and corrective actions issued are maintained.

6. **Exit Sign-Off** — Upon completion of the contract or work package, safety-workflow-manager confirms: all work is complete and verified, site is restored to agreed condition, all waste and contractor materials are removed, contractor equipment has been demobilized, and any outstanding corrective actions have been resolved.

## 6. Evidence Requirements

The following records must be created and retained:

- Contractor registration file: business docs, insurance certificates, qualifications
- Safety management plan (안전보건관리계획서) from contractor
- Signed induction records for each contractor worker
- Risk assessment specific to contractor scope (with interface hazards identified)
- Permit-to-work records for high-risk contractor tasks
- Monitoring visit logs with observations and corrective actions
- Exit sign-off record confirming site restoration
- File location: `memory/findings/contractor-YYYY-MM-DD-<contractor-id>.md`

## 7. Completion Criteria

The workflow is complete when:

- All contractor personnel have completed site induction with signed records
- A current risk assessment exists for all contractor work activities
- PTW is in place for all high-risk contractor tasks
- Monitoring has been conducted and documented throughout the contract period
- Exit sign-off is complete with site restoration confirmed
- All records are filed with `legal_basis` field populated
