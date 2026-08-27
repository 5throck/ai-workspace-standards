---
name: sae-causality-assessor
owner: gcp-agent
scope: workspace
status: active
description: Assess SAE causality using ImPACT criteria. Supports investigator and sponsor determinations for regulatory reporting.
version: "1.0"
created: 2026-06-17
last_updated: "2026-06-17"
metadata:
  triggers:
    - SAE 인과성 평가
    - causality assessment
    - ImPACT
    - WHO-UMC
    - Naranjo algorithm
    - ICH E2A
    - 중대이상반응 인과관계
    - 이상반응 인과성
  legal_basis:
    - "약사법 제34조의2 (임상시험 중 이상반응 기록·보고)"
    - "생명윤리 및 안전에 관한 법률 제13조 (기관위원회 IRB 보고) [UNVERIFIED — see anchor table]"
    - "의약품 임상시험 관리기준 (MFDS 고시 — SAE/SUSAR 인과성 평가 및 보고)"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# SAE Causality Assessor Skill

## Overview
Assesses causality between Investigational Product (IP) and Serious Adverse Events using established algorithms. Supports both investigator and sponsor assessments per ICH E2A requirements.

## Causality Algorithms

### ImPACT (Integrated Method for Protocol and Causality Tools)
Common in oncology trials. Evaluates:
1. **I**nformation — sufficient data for assessment?
2. **m**echanism — biologically plausible?
3. **P**attern — consistent with known IP effects?
4. **A**lternative causes — confounders present?
5. **C**hallenge/de-challenge — reproducible?
6. **T**ime course — temporally related?

### WHO-UMC System
WHO Uppsala Monitoring Centre criteria:
- Certain
- Probable
- Possible
- Unlikely
- Conditional
- Unassessable

### Naranjo Algorithm (clinical setting)
10-question scoring:
- >9 = Definite
- 5-8 = Probable
- 1-4 = Possible
- ≤0 = Doubtful

## Assessment Steps

### Step 1: Temporal Relationship
- Time from IP exposure to event onset
-是否符合 known biological plausibility
- Re-challenge/de-challenge pattern

### Step 2: Differential Diagnosis
- Alternative explanations (concomitant meds, underlying disease)
- Confounding factors (lifestyle, environmental)
- Similar events in non-exposed population

### Step 3: Pattern Recognition
- Compare to investigator's brochure (known adverse reactions)
- Cross-reference with safety database
- Consider class effects

### Step 4: Confidence Scoring
- Generate causality level: related / possibly_related / not_related / not_assessable
- Document rationale for each assessment factor

### Step 5: Investigator vs Sponsor
- **Investigator**: First-line assessment at site
- **Sponsor**: Aggregate review with full safety database
- Discrepancies: Trigger medical review discussion

## Output

Returns causality assessment report:
```json
{
  "sae_id": "...",
  "investigator_assessment": "possibly_related",
  "sponsor_assessment": "related",
  "algorithm_used": "ImPACT",
  "rationale": {
    "temporal_relationship": "IP started 3 days before event; biologically plausible",
    "alternative_causes": "Concomitant medication with similar ADR profile",
    "challenge_dechallenge": "Event persisted despite IP discontinuation (weak causal)",
    "pattern": "Consistent with IP class effect"
  },
  "consensus": "related_with_alternative_contribution",
  "follow_up_recommended": ["specialist consultation", "extended follow-up"]
}
```

## Korean-Specific Reporting

Per KGCP Article 73의2 + ICH E2A:
- **SUSAR** (suspected unexpected serious adverse reaction): both unexpected AND at least possibly related → MFDS expedited reporting
- **Expected SAE**: Annual aggregated report (PSUR)
- **Unrelated SAE**: Site file only

## Integration

- **Input from**: `gcp-sae-record.json`
- **Output to**: Updates causality_assessment field in SAE record
- **Escalation**: Disagreement between investigator and sponsor → medical review
- **Trigger**: SUSAR → MFDS expedited reporting workflow

## v2 Roadmap
- ML-assisted causality scoring
- Real-time safety signal detection across studies
- Bayesian inference for rare event assessment

## Legal Disclaimer
> Skill automation only. Final causality determination requires qualified physician/pharmacologist per ICH E2A. Medical judgment cannot be fully automated.
