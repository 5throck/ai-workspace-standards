---
name: protocol-deviation-analyzer
owner: gcp-agent
scope: workspace
status: active
description: Analyze clinical trial protocol deviations per ICH E6(R3). Classifies severity, identifies trends, recommends CAPA.
version: "1.0.0"
created: 2026-06-17
last_updated: "2026-06-17"
metadata:
  triggers:
    - 프로토콜 이탈
    - protocol deviation
    - ICH E6(R3)
    - important deviation
    - CAPA
    - IRB 보고
    - KGCP
    - 임상시험 이탈
  legal_basis:
    - "약사법 제34조 (임상시험의 계획 승인 등)"
    - "약사법 제34조의2 (임상시험실시기관 지정 — 이상반응 기록·보고 포함)"
    - "생명윤리 및 안전에 관한 법률 제13조 (기관위원회 IRB) [UNVERIFIED — see anchor table]"
    - "의약품 임상시험 관리기준 (MFDS 고시 — KGCP 프로토콜 준수 및 중요 이탈 보고)"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Protocol Deviation Analyzer Skill

## Overview
Analyzes protocol deviations per ICH E6(R3) — classifies severity (minor/major/important), identifies trends across sites, recommends Corrective and Preventive Actions (CAPA).

## Deviation Classification

### Important Deviation (ICH E6(R3))
Deviations that significantly affect:
- Participant safety, rights, or welfare
- Data integrity (primary endpoints, safety data)
- Trial's scientific value

Examples:
- Enrollment of ineligible participant
- ICF obtained after study procedure
- IP dosing error >20% of protocol dose
- Missed primary endpoint assessment

### Major Deviation
Deviations that require CAPA but don't meet "important" threshold:
- Visit outside window (within reasonable bounds)
- Minor procedure deviation
- Source document correction needed

### Minor Deviation
Documentation issues:
- Form completion delay
- Translation clarification
- Administrative correction

## Analysis Steps

### Step 1: Deviation Detection
- Source: monitoring findings, investigator reports, participant feedback
- Capture: description, date, site, participant (if applicable), deviation type

### Step 2: Severity Classification
- Apply ICH E6(R3) criteria
- Consult Investigator's Brochure for safety context
- Cross-reference with protocol inclusion/exclusion

### Step 3: Root Cause Analysis
- Common causes:
  - Site training deficiency
  - Protocol complexity
  - System/process failure
  - Participant non-compliance
  - Translation/communication issue

### Step 4: Trend Analysis
- Aggregate across sites, time periods
- Identify site outliers
- Trigger for-cause monitoring if pattern emerges

### Step 5: CAPA Recommendation
- **Corrective**: Fix immediate issue (e.g., re-consent participant)
- **Preventive**: System-wide (e.g., retraining, protocol amendment)

### Step 6: Documentation
- Update CAPA tracking
- Report to IRB (important deviations: immediate; major: continuing review)
- Report to Sponsor per timeline

## Korean-Specific

Per KGCP, important deviations must be reported to IRB within 7 days. MFDS notification may be required for SUSAR-related deviations.

## Integration

- **Input from**: `gcp-monitoring-record.json`, source data records
- **Output to**: Updates deviation findings in monitoring record; triggers CAPA workflow
- **Escalation**: Important deviations → IRB notification + Sponsor

## v2 Roadmap
- ML-based deviation prediction (early warning)
- Risk-based monitoring integration
- Site performance scoring

## Legal Disclaimer
> Skill automation only. Final deviation classification requires qualified CRA and Investigator per ICH E6(R3).
