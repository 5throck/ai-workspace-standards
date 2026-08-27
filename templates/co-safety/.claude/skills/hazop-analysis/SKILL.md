---
name: hazop-analysis
version: 1.1.0
created: 2026-06-04
last_updated: 2026-08-23
owner: psm-agent
scope: workspace
status: active
description: Facilitate Hazard and Operability (HAZOP) analysis for process safety management
metadata:
  triggers:
    - HAZOP 분석
    - HAZOP analysis
    - 공정위험성평가
    - guideword 분석
    - process hazard analysis
    - PHA
    - 이상 시나리오 도출
  legal_basis:
    - 산업안전보건법 제44조 (공정안전관리)
    - 공정안전관리 고시 (PSM고시) 제3항 (공정위험성평가)
    - 중대재해처벌법 제4조 (안전·보건 확보 의무)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema
# HAZOP Analysis Skill

## Overview
This skill facilitates Hazard and Operability (HAZOP) studies, a structured and systematic examination of complex planned or existing processes or operations in order to identify and evaluate problems that may represent risks to personnel or equipment.

## Operational Steps
1. **Define the Scope**: Identify the process nodes, design intent, and parameters to be analyzed.
2. **Apply Guidewords**: Use the full IEC 61882 guideword set against process parameters: None, More, Less, Reverse, As well as, Part of, Other than, Before, After, Early, Late.
3. **Identify Deviations**: Determine potential deviations from design intent.
4. **Determine Causes and Consequences**: Analyze what causes the deviation and its potential impact.
5. **Identify Safeguards**: List existing safeguards preventing the deviation or mitigating consequences.
6. **Rank Risk**: Score each deviation on a Likelihood x Severity basis (1-25 scale) and band it per the normative risk bands defined in `evidence-models/domains/functional/risk-assessment/risk-assessment-record.json` (the repo's single source of truth): 1-5 Low / 6-12 Medium / 13-19 High / 20-25 Critical; any score >= 13 requires escalation.
7. **Recommend Actions**: Propose recommendations to address unacceptable risks; register each unresolved recommendation as a `FIND-YYYY-NNNN` finding record and track it to closure through its linked `CA-YYYY-NNNN` corrective-action record until verified — a HAZOP recommendation is closed only when its corrective action is verified.
8. **Document**: Record all findings in the HAZOP worksheet and generate an evidence record conforming to `evidence-models/domains/functional/psm/psm-pha-record.json`.

