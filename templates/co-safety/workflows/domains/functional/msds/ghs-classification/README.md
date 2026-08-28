# GHS 위해성 분류 (GHS Hazard Classification) Workflow

## 1. Objective
Apply GHS Rev 9 (2021) classification rules to chemical substances and mixtures per OSHA-KR Article 104 (유해인자의 분류기준 — statutory GHS anchor; delegated criteria in 산업안전보건법 시행규칙 별표 18). The formerly cited "Article 243" was a legacy pre-2008 article number that no longer exists in the current statute.

## 2. Applicability
All chemicals under the `chemical-handling` profile requiring GHS classification for labeling, SDS, and worker notification.

## 3. Workflow Steps

### Step 1: Composition Intake
- Receive chemical composition data from MSDS Section 3 or supplier specification.
- Identify each component's CAS number, concentration, and known hazard data.

### Step 2: Apply GHS Rev 9 Ruleset
- Use `skills/domains/functional/msds/ghs-classifier/` to apply classification rules.
- Evaluate hazard classes:
  - Physical hazards (explosives, flammables, oxidizers, gases under pressure, etc.)
  - Health hazards (acute toxicity, skin/eye corrosion, carcinogenicity, reproductive toxicity, etc.)
  - Environmental hazards (aquatic toxicity, ozone depletion)

### Step 3: Determine Categories
- For each identified hazard class, determine the category (e.g., Flammable Liquid Category 2).
- Apply cut-off values and bridging principles for mixtures.

### Step 4: Assign H/P-Statements
- Map classification to Hazard Statements (H-codes: H200-H499 series).
- Map to Precautionary Statements (P-codes: P100-P500 series).
- Apply Korean-specific additions/interpretations.

### Step 5: Label Elements
- Determine signal word (Danger vs Warning).
- Assign hazard pictograms (GHS01-GHS09).
- Generate label element combination for downstream `hazard-labeling` workflow.

### Step 6: Documentation
- Record `ghs_version: "rev9"` and full classification rationale.
- Reference supporting data (test results, literature, read-across).
- Flag low-confidence classifications for expert review.

## 4. Evidence Record
Generate `ghs-classification-record.json` with hazard classes, categories, H/P-Statements, label elements, and `ghs_version`.

## 5. Version Management
- v1 baseline: GHS Rev 9 (current Korean standard since 2023).
- Migration to Rev 10 expected ~2027 — track via `ghs_version_migration` field.
- When Korea adopts Rev 10: trigger change-control workflow to migrate classifications.

## 6. Confidence Scoring
- High confidence: test data available, classification per Annex I criteria
- Medium confidence: read-across from analog substances
- Low confidence: expert judgment or estimated data → flag for review

## 7. Legal Disclaimer
> Workflow automation assistance only. Final GHS classification for regulatory submission requires qualified toxicologist and EHS professional review.
