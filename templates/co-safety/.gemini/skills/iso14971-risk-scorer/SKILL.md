---
name: iso14971-risk-scorer
owner: meddevice-agent
scope: workspace
status: active
description: ISO 14971 risk estimation and scoring for medical devices. Severity × Probability matrix, residual risk evaluation.
version: "1.1.0"
created: "2026-06-18"
last_updated: "2026-08-26"
metadata:
  triggers:
    - ISO 14971
    - 위해 추정
    - risk estimation
    - 심각도 발생확률 매트릭스
    - severity probability matrix
    - 잔여위험
    - residual risk
    - ALARP
  legal_basis:
    - 의료기기법 제28조 (의료기기 품질관리 — KGMP-MD)
    - 의료기기법 제31조 (의료기기 위해사항 보고)
    - 의료기기법 제6조 (의료기기 제조업 허가)
    - 의료기기 제조 및 품질관리 기준 (MFDS 고시 — KGMP-MD)
    - "ISO 14971:2019"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# ISO 14971 Risk Scorer Skill

## Overview
ISO 14971 위해 추정 및 평가 — 심각도(Severity) × 발생확률(Probability) 매트릭스 기반 risk scoring.

## Risk Estimation Matrix

| Severity \ Probability | Improbable | Remote | Occasional | Probable | Frequent |
|------------------------|------------|--------|------------|----------|----------|
| Negligible             | Low        | Low    | Low        | Medium   | Medium   |
| Minor                  | Low        | Low    | Medium     | Medium   | High     |
| Serious                | Low        | Medium | Medium     | High     | Critical |
| Critical               | Medium     | Medium | High       | Critical | Critical |
| Catastrophic           | Medium     | High   | Critical   | Critical | Critical |

## Appendix — Cross-Walk to EHS 1-25 Scale (Consult-Mode Alignment Guidance)

> **Consult-mode alignment guidance only.** This cross-walk exists so that device-risk
> outputs can be compared against the common EHS 1-25 scale used by `risk-assessment-agent`
> (normative bands defined on `risk_score_before` in
> `evidence-models/domains/functional/risk-assessment/risk-assessment-record.json`:
> 1-5 Low / 6-12 Medium / 13-19 High / 20-25 Critical; escalation threshold >= 13).
> It never replaces the qualitative matrix above — normative device-risk decisions stay
> on the ISO 14971 labels. Derivation rule: corner anchors Negligible×Improbable = 1 and
> Catastrophic×Frequent = 25; scale kept symmetric (cell(S,P) = cell(P,S)); monotone
> non-decreasing along both axes; every cell snapped into the band already published in
> the qualitative matrix, so band(numeric) always equals the ISO label.

| Severity \ Probability | Improbable | Remote | Occasional | Probable | Frequent |
|------------------------|------------|--------|------------|----------|----------|
| Negligible   (S1)      | 1          | 2      | 4          | 7        | 9        |
| Minor        (S2)      | 2          | 3      | 7          | 10       | 14       |
| Serious      (S3)      | 4          | 7      | 12         | 15       | 21       |
| Critical     (S4)      | 7          | 10     | 15         | 20       | 23       |
| Catastrophic (S5)      | 9          | 14     | 21         | 23       | 25       |

Properties of this mapping:

- **Band-exact**: each numeric score lands in the same EHS band as its qualitative label
  in the matrix above (e.g. Serious+Probable = 15 = High), so consult-mode comparison can
  never contradict the ISO determination.
- **Escalation-consistent**: the minimum High cell is 14 and the maximum Medium cell is 12,
  so the EHS escalation threshold (score >= 13) partitions the matrix exactly into the
  union of High + Critical cells.
- **Endpoints anchored**: Catastrophic+Frequent = 25, Negligible+Improbable = 1.

## ISO 14971 Process

### Step 1: Hazard Identification
- Intended use / intended users
- Foreseeable misuse
- Reasonably foreseeable misuse
- Hazard identification (energy, biological, chemical, information)

### Step 2: Risk Estimation
- Severity (S1-S5): Negligible → Catastrophic
- Probability (P1-P5): Improbable → Frequent
- Risk level = f(S, P) — matrix lookup

### Step 3: Risk Evaluation
- Compare to risk acceptability criteria
- Broadly acceptable / ALARP / Unacceptable

### Step 4: Risk Control
- Inherent safety by design
- Protective measures (alarms, interlocks)
- Information for safety (IFU, labeling)
- Residual risk disclosure

### Step 5: Residual Risk Evaluation
- Overall residual risk
- Benefit-risk comparison (Class 3/4 devices)
- Risk management report

## Korean Class-Specific Requirements

| Class | Risk Management Depth |
|-------|-----------------------|
| Class 1 | Simplified (basic ISO 14971) |
| Class 2 | Standard ISO 14971 |
| Class 3 | Full + benefit-risk analysis |
| Class 4 | Full + clinical data + PMCF |

## Output

Returns risk estimation:
```json
{
  "hazard_id": "H-001",
  "hazard_description": "Electrical shock from power supply",
  "severity": "Critical (S4)",
  "probability": "Remote (P2)",
  "risk_level_before": "Medium",
  "risk_control": "Double insulation + grounding + IFU warning",
  "residual_severity": "Critical (S4)",
  "residual_probability": "Improbable (P1)",
  "risk_level_after": "Low",
  "residual_risk_acceptable": true,
  "overall_residual_risk": "ALARP"
}
```

## Legal Disclaimer
> 자동화 위해 추정 보조. 최종 위해 수용성 판정은 자격을 갖춘 의료기기 위해관리자 + 임상 평가자.
