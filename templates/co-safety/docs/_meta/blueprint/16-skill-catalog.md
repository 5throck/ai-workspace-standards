# Skill Catalog

## 1. Overview
This document serves as the comprehensive catalog of all verified skills available within the Safety OS ecosystem. Each skill is mapped to its primary owning agent and core operational objective.

## 2. Verified Skills

1. **compliance-gap**
   - **Owner**: compliance-agent
   - **Description**: Triggers a compliance gap analysis against applicable EHS regulations (OSHA-KR/SAPA).

2. **emergency-response**
   - **Owner**: emergency-agent
   - **Description**: Activates emergency response protocols upon receiving an incident, fire, spill, or injury report.

3. **legalize-kr-sync** — *removed 2026-08-26, superseded by the `k-law` skill (법제처 National Law Information Center Open API live queries)*

4. **permit-to-work**
   - **Owner**: safety-workflow-manager
   - **Description**: Triggers permit-to-work (PTW) issuance workflows for high-risk or non-routine work activities.

5. **risk-assessment**
   - **Owner**: risk-assessment-agent
   - **Description**: Executes the risk assessment workflow for hazard identification and risk scoring.

6. **hazop-analysis**
   - **Owner**: psm-agent
   - **Description**: Supports the systematic execution and documentation of HAZOP procedures.

7. **psm-moc**
   - **Owner**: psm-agent
   - **Description**: Generates and manages Management of Change (MOC) packages for process safety.

8. **root-cause-analysis**
   - **Owner**: incident-investigation-agent
   - **Description**: Executes 5-Why, RCA, and Bow-Tie investigations following an incident.

9. **audit-preparation**
   - **Owner**: audit-agent
   - **Description**: Generates regulatory audit preparation checklists and aggregates necessary evidence.

10. **contractor-onboarding**
    - **Owner**: contractor-safety-agent
    - **Description**: Manages contractor onboarding, compliance verification, and training package distribution.

## 3. Maintenance
This catalog must be updated concurrently with any changes to `skills/*/SKILL.md` files. The `audit-agent` ensures synchronization between this catalog and the actual skill files.
