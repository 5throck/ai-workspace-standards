---
name: psm-moc
owner: psm-agent
scope: workspace
status: active
description: Manage Process Safety Management (PSM) Management of Change (MOC) workflows
version: "1.0"
created: 2026-06-15
last_updated: 2026-07-09
metadata:
  type: domain
  triggers:
    - management of change
    - moc
    - change management
    - process change
    - 변경관리
    - 공정변경
  legal_basis:
    - 산업안전보건법 제44조 (공정안전관리)
    - PSM고시 제4항 (변경관리)
    - 중대재해처벌법 제4조 (안전·보건 확보 의무)
    - OSHA 1910.119(l) (PSM - Management of Change)
---
# PSM Management of Change (MOC) Skill

## Overview
This skill oversees the Management of Change (MOC) process to ensure that safety, health, and environmental risks are controlled when changes are made to facilities, documentation, personnel, or operations.

## Operational Steps
1. **Initiate MOC Request**: Document the proposed change, technical basis, and anticipated impact.
2. **Review Safety Impact**: Evaluate implications on Process Safety Information (PSI), operating procedures, and risk assessments.
3. **Approval Routing**: Route the MOC for technical, safety, and managerial approvals.
4. **Pre-Startup Safety Review (PSSR)**: Conduct PSSR if required before implementing the change.
5. **Implementation & Training**: Update affected documentation and train affected personnel.
6. **Closeout**: Verify all requirements are met and close the MOC record.

## Replacement-in-Kind (RIC) Applicability

A change qualifies as Replacement-in-Kind and may bypass full MOC review only when ALL of the following hold:

- The replacement satisfies the original design specifications, materials, and rated capacity exactly.
- No change to operating conditions, process chemistry, or service environment.
- Like-for-like configuration and connection points (no re-piping, re-wiring, or layout change).
- Not a temporary substitution — temporary changes always require a full MOC record with `change_type: "temporary"`.

If any criterion fails, classify the item as a permanent change and execute the full MOC workflow.

## Temporary Change Rules

For changes recorded with `change_type: "temporary"` (per `evidence-models/domains/functional/psm/psm-moc-record.json`):

- **Expiration date mandatory**: define a fixed end date at initiation; an MOC without an expiration date must not be approved.
- **Termination**: on expiry, terminate the temporary configuration and restore the baseline equipment, procedure, or operating condition; document the restoration in the MOC record.
- **Return-to-baseline verification**: confirm restoration during Closeout (step 6); extending a temporary change requires a new MOC record — never silent renewal.

