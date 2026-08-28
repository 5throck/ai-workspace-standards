---
name: signal-detector
owner: gvp-agent
scope: workspace
status: active
description: Statistical signal detection in pharmacovigilance case database. Implements PRR, ROR, BCPNN, EBGM disproportionality methods.
version: "1.0.0"
created: "2026-06-17"
last_updated: "2026-06-17"
metadata:
  triggers:
    - 시그널 탐지
    - signal detection
    - PRR
    - ROR
    - BCPNN
    - EBGM
    - 부작용 신호
    - disproportionality analysis
  legal_basis:
    - "약사법 제68조의8 (부작용 등의 보고)"
    - "약사법 제33조 (의약품등 재평가 — 시그널 기반 안전정보 반영)"
    - "의약품 이상반응 보고 등에 관한 규정 (MFDS 고시 — 시그널 탐지·관리)"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Signal Detector Skill

## Overview
Performs statistical signal detection in pharmacovigilance case database using multiple disproportionality methods per EU GVP Module 9.

## Disproportionality Methods

### PRR (Proportional Reporting Ratio)
- Standard MHRA (UK Medicines and Healthcare products Regulatory Agency) method
- Signal threshold: PRR ≥ 2, chi-square ≥ 4, n ≥ 3 cases
- Formula: PRR = (a/(a+b)) / (c/(c+d))

### ROR (Reporting Odds Ratio)
- Used by Netherlands Lareb, similar to PRR
- Signal threshold: ROR ≥ 1 with lower 95% CI > 1
- Formula: ROR = (a*d) / (b*c)

### BCPNN (Bayesian Confidence Propagation Neural Network)
- Used by WHO-UMC for VigiBase
- Information Component (IC) metric
- Signal threshold: IC025 > 0

### EBGM (Empirical Bayes Geometric Mean)
- Used by US FDA
- EB05 ≥ 2 threshold
- Empirical Bayes shrinkage of MRP (Multi-item Gamma Poisson)

## 2x2 Contingency Table
|                | Target AE | All Other AEs |
|----------------|-----------|---------------|
| Target drug    | a         | b             |
| All other drugs | c        | d             |

## Workflow Steps

### Step 1: Database Query
- Select reporting period
- Filter for specific drug + specific AE MedDRA PT
- Build 2x2 contingency table

### Step 2: Calculate Statistics
- PRR + 95% CI
- ROR + 95% CI
- BCPNN IC + IC025 (when VigiBase data accessible)
- EBGM + EB05 (when FDA data accessible)

### Step 3: Threshold Evaluation
- Apply each method's signal threshold
- Multi-method agreement increases signal confidence

### Step 4: Clinical Review
- Statistical signal ≠ clinical signal
- Plausibility (mechanism, class effect)
- Confounders (concomitant drugs, demographics)
- Case series review

### Step 5: Action Recommendation
- Validate / Reject / Monitor signal
- If validated → update RMP, PBRER addendum
- Critical → trigger labeling update or urgent action

## Output

```json
{
  "signal_id": "...",
  "drug": "...",
  "ae_term_meddra_pt": "...",
  "case_count": 17,
  "prr": 3.42,
  "prr_ci_lower": 2.15,
  "prr_ci_upper": 5.44,
  "prr_threshold_met": true,
  "ror": 3.55,
  "ror_ci_lower": 2.21,
  "ror_ci_upper": 5.69,
  "ror_threshold_met": true,
  "chi_square": 23.4,
  "signal_detected": true,
  "methods_agreeing": 2,
  "clinical_plausibility": "high",
  "recommended_action": "validate"
}
```

## Korean-Specific Considerations
- Korean ADR database (KIDS) is smaller than VigiBase → statistical power limited for rare events
- Combine with foreign authority data for stronger signals
- MFDS may require additional PV activities for validated signals

## Integration

- **Input from**: `gvp-icsr-record.json` (case database)
- **Output to**: `gvp-signal-record.json`
- **External**: WHO VigiBase API (v2 roadmap)

## v2 Roadmap
- ML-based signal prediction (early warning)
- Time-series signal detection
- Subgroup analysis (pediatric, elderly, pregnant)
- Real-world evidence integration

## Legal Disclaimer
> Skill automation only. Signal validation requires qualified Drug Safety Officer clinical review per EU GVP Module 9.
