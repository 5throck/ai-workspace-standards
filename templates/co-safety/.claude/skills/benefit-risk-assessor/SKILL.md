---
name: benefit-risk-assessor
owner: gvp-agent
scope: workspace
status: active
description: Integrated benefit-risk assessment per EU GVP Module 12. Supports PrOACT-URL, BRAT, MCDA frameworks.
version: "1.0"
created: "2026-06-17"
last_updated: "2026-06-17"
metadata:
  triggers:
    - 편익위해평가
    - benefit-risk assessment
    - PrOACT-URL
    - BRAT
    - MCDA
    - 위해편익 균형
    - PBRER 재평가
    - RMP 재평가
  legal_basis:
    - 약사법 제73조의2
    - 약사법 제73조의3
    - ICH E2C(R2)
    - EU GVP Module XII
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Benefit-Risk Assessor Skill

## Overview
Conducts structured benefit-risk assessment for marketed pharmaceuticals per EU GVP Module 12. Supports multiple frameworks to accommodate different decision contexts.

## Frameworks

### PrOACT-URL (FDA)
- **Pr**oblem: Define decision context
- **O**bjectives: Establish endpoints
- **A**lternatives: Compare options (maintain / restrict / withdraw)
- **C**onsequences: Effects of each alternative
- **T**rade-offs: B vs R balance
- **U**ncertainty: Confidence intervals
- **R**isk tolerance: Acceptable threshold
- **L**inks: Chain of reasoning

### BRAT (PhRMA)
Benefit-Risk Action Team framework:
- Decision context
- Outcome identification
- Value tree construction
- Effects table
- Uncertainty evaluation
- Visualization

### MCDA (Multi-Criteria Decision Analysis)
Quantitative scoring:
- Define criteria (benefits and risks)
- Assign weights (stakeholder input)
- Score each criterion (0-1)
- Calculate weighted sum
- Sensitivity analysis

### Qualitative Narrative
For complex cases where quantification is impractical:
- Structured narrative
- Expert judgment
- Consensus building

## Workflow Steps

### Step 1: Define Decision Context
- Initial evaluation / routine PBRER / signal-triggered / re-evaluation
- Affected population (indication, demographics)
- Time horizon

### Step 2: Benefit Identification
- Primary efficacy endpoints (pivotal trials)
- Real-world effectiveness (post-market)
- Patient-reported outcomes
- Unmet medical need (comparator landscape)

### Step 3: Risk Identification
- Important identified risks (RMP)
- Important potential risks
- New signals in reporting period
- Cumulative ADR profile
- Quality issues affecting safety

### Step 4: Value Tree Construction
- Hierarchical model of benefits and risks
- Effects table: drug vs comparator vs no treatment

### Step 5: Stakeholder Weighting
- Patient perspective (what matters most)
- Clinician perspective (efficacy/safety priorities)
- Regulatory perspective (acceptable thresholds)

### Step 6: Score Integration
- MCDA: weighted sum of scores
- PrOACT: trade-off analysis
- Qualitative: structured narrative

### Step 7: Uncertainty Analysis
- Statistical confidence in evidence
- Missing data impact
- Sensitivity analysis (vary weights, scores)

### Step 8: Decision
- Favorable: maintain marketing authorization
- Favorable with monitoring: additional PV activities
- Uncertain: more data needed
- Unfavorable: restrict or withdraw

### Step 9: Documentation
- Benefit-Risk report per framework
- Submission for regulatory review

## Output

```json
{
  "product_id": "...",
  "framework_used": "MCDA",
  "decision_context": "PBRER annual review",
  "benefit_criteria": [
    { "criterion": "Primary efficacy (pivotal Phase 3)", "weight": 0.35, "score": 0.85 },
    { "criterion": "Patient QoL improvement", "weight": 0.20, "score": 0.70 }
  ],
  "risk_criteria": [
    { "criterion": "Hepatotoxicity risk", "weight": 0.25, "score": 0.40 },
    { "criterion": "Drug-drug interactions", "weight": 0.20, "score": 0.60 }
  ],
  "integrated_br_score": 0.66,
  "br_decision": "favorable_with_monitoring",
  "decision_rationale": "Favorable efficacy offset by moderate hepatotoxicity risk; additional LFT monitoring recommended",
  "uncertainty": "moderate (n=3 trials, limited long-term data)",
  "stakeholder_input": {
    "patient": "Symptom relief priority; tolerable LFT monitoring",
    "clinician": "Effective option but require baseline LFTs",
    "regulatory": "Acceptable with revised labeling"
  }
}
```

## Korean-Specific Considerations

### Re-evaluation Triggers
- 5-7 year cycle post-approval
- New safety signals (priority review)
- Foreign authority action
- Pediatric use expansion

### MFDS Communication
- Pre-submission meeting recommended
- Korean labeling implications
- Population-specific considerations (Korean ethnic pharmacokinetics)

## Integration

- **Input from**: `gvp-pbrer-record.json`, `gvp-signal-record.json`, `gvp-rmp-record.json`
- **Output to**: `gvp-br-record.json`
- **Triggers**: PBRER cycle, signal events, re-evaluation requests

## v2 Roadmap
- AI-assisted value tree generation
- Real-time stakeholder weight collection
- Probabilistic MCDA with Bayesian updates

## Legal Disclaimer
> Skill automation only. Final benefit-risk decisions require qualified Drug Safety Officer, Medical Director, and MFDS coordination per EU GVP Module 12.
