# Food Manufacturing Industry — Thermal Hazard Control Workflow

> **Status**: This README was finalized in Task 12. However, `signature_hazard` in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review (`status: draft`). Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically control burn and scald hazards and fryer/dryer fire/explosion risk arising from high-temperature sources in food manufacturing — fryers, dryers, retorts/steamers, ovens/grills, and boiler piping — to secure worker safety.

This is an **industry-unique workflow** — a food-industry-specific thermal-hazard control procedure that does not duplicate any workflow under `workflows/_shared/`.

## 2. Scope
- **Industry**: Food manufacturing and processing (code: `food`)
- **Processes**: Frying/stir-frying, drying/heating, steaming/boiling, oven/grill work, boiler/steam piping, pre-pack cooling
- **Trigger points**: During risk assessment, on new equipment or capacity change, on cooking-oil/solvent change, and at recurring inspection intervals

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads thermal-hazard risk assessment, verifies control adequacy, develops fire-response plans |
| Supervisor / Work Lead | Supervises procedural compliance, issues/inspects PPE, halts work on temperature-equipment anomaly |
| Worker | Follows standard procedures, wears heat-resistant PPE, immediately reports cooking-oil/steam leaks or abnormal signs |
| Health Manager | Runs health examinations (burns, heat illness) and first-aid response |
| Industrial Health & Safety Committee | Reviews thermal-hazard incidents and near-misses |

## 4. Procedure
1. **Hazard identification**: Identify high-temperature sources (fryers, dryers, retorts, ovens, boilers) and contact/radiant-heat/scald pathways (steam, boiling liquids). Confirm cooking-oil auto-ignition points and dryer dust-explosion potential.
2. **Risk assessment**: Evaluate burn risk and fryer/dryer fire/explosion risk. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
3. **Engineering controls**: Insulation/protective covers, automatic temperature control and overheat protection, local exhaust (oil-mist/steam removal), automatic fire-suppression (fryer/dryer-specific) — applied first in the control hierarchy.
4. **Administrative controls**: Standard procedures, work permits (hot work), fire-response procedures, recurring equipment inspection and cleaning (prevents spontaneous ignition of residues).
5. **PPE**: Heat-resistant gloves/apron/sleeves, safety eyewear, slip-resistant safety footwear — applied as the final tier of the hierarchy.
6. **Training & drills**: Burn-prevention training, fryer/dryer fire-response drills (e.g. never use water on oil fires), first-aid training.
7. **Recordkeeping & audit**: Generate the evidence record (§6); log recurring inspection, training, and fire-drill results.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/food/food-thermal-hazard-control-record.json`](../../../../../evidence-models/domains/industry/food/food-thermal-hazard-control-record.json) (skeleton, `status: draft`)

- **Record ID format**: `FOOD-THERMAL-HAZARD-CONTROL-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as temperature measurements, equipment inspection history, and fire-drill results.

## 6. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated).

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 식품위생법 Article 48
- 건강기능식품에 관한 법률 Article 13
- 소방기본법 Article 16

### Gloss
| Korean | Abbreviation | English |
|--------|--------------|---------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 식품위생법 | FSA | Food Sanitation Act |
| 건강기능식품에 관한 법률 | HSF-Act | Health Functional Food Act |
| 소방기본법 | BFS | Basic Act on Fire Services |

## 7. Regulatory Notes
Food safety is primarily a product-quality regime (FSA HACCP) overlaid on standard OSHA-KR worker-safety controls. Key worker hazards: cooking-oil burns, dryer-fire, cold-storage asphyxiation, and repetitive-strain in packing lines.

## 8. Unverified Citations
The following items were flagged [UNVERIFIED] in the anchor table and require specialist re-verification:

- 식품위생법 (FSA) Article 48 [UNVERIFIED-via-legalize-kr-full-text] — confirmed present in the kr_safety catalog; sourced from Food-Sanitation-Act.yaml (mcp-kr-legislation).

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
