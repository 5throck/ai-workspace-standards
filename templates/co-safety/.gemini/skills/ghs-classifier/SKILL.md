---
name: ghs-classifier
owner: msds-agent
scope: workspace
status: active
description: Apply GHS Rev 9 (2021) classification rules to chemical substances and mixtures per OSHA-KR Article 104 (유해인자의 분류기준; 산업안전보건법 시행규칙 별표 18). Outputs hazard classes, categories, H/P-Statements, label elements.
version: "1.0"
created: 2026-06-17
last_updated: 2026-06-17
metadata:
  triggers:
    - GHS 분류
    - GHS classification
    - 유해성 분류
    - H-Statement
    - 위험문구
    - 예방조치문구
    - P-Statement
    - GHS Rev 9
  legal_basis:
    - 산업안전보건법 제104조
    - 산업안전보건법 시행규칙 별표 18
    - 산업안전보건법 제110조
    - UN GHS Rev 9 (2021)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# GHS Classifier Skill (Rev 9 Ruleset)

## Overview
Applies UN GHS Rev 9 (2021) classification rules — the current Korean standard since 2023 — to determine hazard classification for chemical substances and mixtures.

## GHS Version
- **Current ruleset**: GHS Rev 9 (2021)
- **Korean baseline**: 2023-01-01 mandatory
- **Next migration**: GHS Rev 10 (~2027 KR mandation estimated)

All output records include `ghs_version: "rev9"` field. When Rev 10 is adopted, this skill will be updated via change-control workflow.

## Scope
- **In scope**: Pure substances + mixtures with full composition data
- **Out of scope**: Complex mixtures with unknown components (require supplier data)

## Hazard Classes Evaluated (per GHS Rev 9 Annex 1)

### Physical Hazards (Chapter 2.1-2.17)
1. Explosives (2.1)
2. Flammable gases (2.2)
3. Aerosols (2.3)
4. Oxidizing gases (2.4)
5. Gases under pressure (2.5)
6. Flammable liquids (2.6)
7. Flammable solids (2.7)
8. Self-reactive substances (2.8)
9. Pyrophoric liquids (2.9)
10. Pyrophoric solids (2.10)
11. Self-heating substances (2.11)
12. Substances emitting flammable gases on contact with water (2.12)
13. Oxidizing liquids (2.13)
14. Oxidizing solids (2.14)
15. Organic peroxides (2.15)
16. Metal corrosives (2.16)
17. Desensitized explosives (2.17)

### Health Hazards (Chapter 3.1-3.10)
1. Acute toxicity (3.1) — oral, dermal, inhalation
2. Skin corrosion/irritation (3.2)
3. Serious eye damage/irritation (3.3)
4. Respiratory sensitization (3.4)
5. Skin sensitization (3.5)
6. Germ cell mutagenicity (3.6)
7. Carcinogenicity (3.7)
8. Reproductive toxicity (3.8)
9. Specific target organ toxicity — single exposure (3.9)
10. Specific target organ toxicity — repeated exposure (3.10)
11. Aspiration hazard (3.11)

### Environmental Hazards (Chapter 4.1-4.2)
1. Hazardous to aquatic environment — acute/chronic (4.1)
2. Hazardous to ozone layer (4.2)

## Operational Steps
1. **Composition Intake**: Parse substance/mixture composition from MSDS Section 3 or supplier spec.
2. **Data Collection**: For each component, gather:
   - CAS number
   - Concentration (%)
   - Known hazard data (test data, literature)
3. **Substance Classification**: Apply Annex 1 criteria per hazard class.
4. **Mixture Classification**:
   - **Test data approach** (preferred): Use mixture test data if available
   - **Bridging principles**: If similar tested mixture exists
   - **Cut-off/concentration limits**: Apply Annex 1 thresholds per class
5. **Category Assignment**: Determine hazard category (1, 1A/1B/1C, 2, 3, 4) per class.
6. **H-Statement Assignment**: Map classification to H-codes (H200-H499 series).
7. **P-Statement Selection**: Select precautionary statements (P100-P500 series) per Korean guidelines.
8. **Label Elements**: Determine signal word, pictograms (GHS01-GHS09).
9. **Confidence Scoring**:
   - High: test data available
   - Medium: read-across from analog substances
   - Low: expert judgment or estimated → manual_review_required = true

## Mixture-Specific Rules

| Hazard Class | Cut-off Value | Notes |
|--------------|---------------|-------|
| Acute toxicity | ≥1% (Category 1-3), ≥1% (Category 4) | ATE formula |
| Skin corrosion | ≥1% (Cat 1), ≥3% (Cat 2) | Summation method |
| Eye damage | ≥1% (Cat 1), ≥3% (Cat 2) | Summation method |
| Carcinogenicity | ≥0.1% (Cat 1), ≥1.0% (Cat 2) | |
| Reproductive toxicity | ≥0.1% (Cat 1), ≥0.3% (Cat 2) | |

## Korean-Specific Additions
- 별표 1-3 substance lists (Korean priority substances)
- 한국 GHS 추가 분류 기준 (Korean-specific additions to UN GHS Rev 9)

## Output

Generates `ghs-classification-record.json` per `evidence-models/domains/functional/msds/ghs-classification-record.json` schema.

## v2 Roadmap
- GHS Rev 10 ruleset (2027 expected)
- Korean 별표 1-3 enhanced tracking
- Mixture bridging principles automation
- Confidence ML model (replace expert judgment)

## Legal Disclaimer
> Skill automation only. Final GHS classification for regulatory submission requires qualified toxicologist verification per OSHA-KR Article 104.
