---
name: glp-study-protocol-validator
owner: glp-agent
scope: workspace
status: active
description: Validate study protocol compliance with OECD GLP Section 8 requirements.
version: "1.0"
created: 2026-06-17
last_updated: 2026-06-17
metadata:
  triggers:
    - 시험계획서 검증
    - study protocol validation
    - GLP protocol
    - OECD GLP Section 8
    - 시험책임자
    - Study Director
    - 시험물질 특성
    - 보존기간 3년
  legal_basis:
    - OECD GLP Principles Section 8
    - 비임상시험 관리기준(식약처 고시)
    - 환경부 GLP 고시
    - K-REACH
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# GLP Study Protocol Validator Skill

## Overview
Validates that GLP study protocols include all required content per OECD GLP Section 8.3 (Protocol content).

## Required Protocol Content (OECD GLP Section 8.3)

### 1. Identification
- Study title
- Study number (unique identifier)
- Test facility name and address
- Sponsor name and address
- Study Director name

### 2. Test Article and Reference Article
- Identification (chemical name, CAS, code)
- Purity and characterization data
- Stability data reference
- Storage conditions

### 3. Justification
- Scientific rationale
- Selection of test system
- Dose selection rationale
- Statistical methods justification

### 4. Test System
- Species/strain justification
- Number justification
- Source of supply
- Housing/management conditions

### 5. Methods
- Dosing regimen
- Observation schedule
- Endpoints and measurements
- Statistical analysis plan
- Quality control measures

### 6. Records
- Records to be maintained
- Retention period (minimum 10 years)
- Archive location

## Validation Steps

### Step 1: Structure Check
- All required sections present
- Logical organization
- Page numbering and table of contents

### Step 2: Identification Completeness
- All parties identified
- Contact information complete
- Study number unique

### Step 3: Test Article Cross-Reference
- Test article data consistent with MSDS
- Lot/batch identification
- Purity and stability data referenced

### Step 4: Scientific Justification
- Test system selection justified
- Dose selection rationale
- Statistical methods appropriate

### Step 5: Records Plan
- Retention period meets minimum 10 years
- Archive identified
- Index plan defined

### Step 6: Approval Signatures
- Study Director signature
- Test Facility Management approval
- Sponsor confirmation (when applicable)
- QAU review documentation

## Output

Returns validation report:
```json
{
  "protocol_id": "...",
  "validation_result": "pass | fail",
  "missing_sections": [],
  "incomplete_sections": [],
  "cross_reference_issues": [],
  "approval_completeness": "complete | incomplete"
}
```

## Korean-Specific Additions

For MFDS GLP (의약품):
- Korean language requirement (or Korean summary)
- MFDS notification reference
- Korean pharmacopoeia reference

For ME K-REACH GLP (화학물질):
- 환경부 고시 reference
- OECD test guideline reference
- Hazard assessment scope

## Integration

- **Input from**: `glp-study-protocol-record.json`
- **Output to**: Updates validation status in same record
- **Escalation**: Missing required section → block approval

## v2 Roadmap
- AI-assisted protocol drafting
- Cross-study consistency checks
- Multi-site study coordination

## Legal Disclaimer
> Skill automation only. Final protocol approval requires Study Director signature per OECD GLP Section 8.2.
