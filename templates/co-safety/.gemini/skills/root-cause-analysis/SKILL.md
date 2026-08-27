---
name: root-cause-analysis
version: 1.0.0
owner: incident-investigation-agent
scope: workspace
status: active
description: Conduct Root Cause Analysis (RCA) for safety incidents
metadata:
  triggers:
    - 근본원인분석
    - root cause analysis
    - RCA
    - 5 whys
    - fishbone diagram
    - 사고조사
    - CAPA 수립
  legal_basis:
    - "산업안전보건법 제57조 (산업재해 조사·기록)"
    - "산업안전보건법 제36조 (위험성평가 — CAPA 연계)"
    - "중대재해처벌법 제4조 (사업주 안전보건 확보의무)"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema
# Root Cause Analysis (RCA) Skill

## Overview
This skill provides a structured approach for investigating safety incidents to identify underlying root causes and prevent recurrence, supporting compliance with SAPA and OSHA-KR.

## Operational Steps
1. **Data Collection**: Gather all relevant facts, witness statements, and environmental conditions at the time of the incident.
2. **Timeline Reconstruction**: Build a chronological sequence of events leading up to the incident.
3. **Apply RCA Methodology**: Utilize tools such as "5 Whys", Fishbone Diagram, or Fault Tree Analysis.
4. **Identify Root Causes**: Distinguish between direct causes, contributing factors, and systemic root causes.
5. **Develop Corrective/Preventive Actions (CAPA)**: Formulate actionable steps to eliminate the identified root causes.
6. **Reporting**: Generate a formal incident investigation report and log the CAPA in the compliance registry.

