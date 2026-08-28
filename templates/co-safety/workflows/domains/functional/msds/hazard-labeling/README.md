# GHS 경고 라벨링 (GHS Hazard Labeling) Workflow

## 1. Objective
Generate and verify GHS-compliant warning labels for chemical containers, packaging, and storage areas per OSHA-KR Article 115 (용기 등의 경고표시 — warning labels on containers/packages) and UN GHS Rev 9 label elements.

## 2. Applicability
All chemical containers, packages, and storage areas at site facilities under the `chemical-handling` profile.

## 3. Workflow Steps

### Step 1: Classification Lookup
- Retrieve GHS classification from `ghs-classification-record.json` (or trigger `ghs-classification` if missing).
- Confirm `ghs_version` matches current Korean standard (Rev 9).

### Step 2: Label Element Determination
- **Signal word**: Danger (high hazard) or Warning (moderate hazard).
- **Hazard pictograms**: GHS01-GHS09 based on classification.
- **Hazard statements (H-codes)**: per GHS Rev 9 Annex 3.
- **Precautionary statements (P-codes)**: per GHS Rev 9 Annex 3 (selected by chemical manufacturer).
- **Product identifier**: chemical name + CAS number.
- **Supplier identification**: name, address, emergency phone.

### Step 3: Label Design
- Apply Korean bilingual label format (Korean primary, English secondary).
- Comply with size requirements per 산업안전보건법 시행규칙 제170조 (경고표시 방법 및 기재항목 — delegated under OSHA-KR Article 115; 규격·그림문자 등 per MOEL 고시).
- Include required pictograms at minimum sizes.

### Step 4: Generation
- Generate label files (PDF for printing, electronic formats for inventory).
- Apply batch identification for production batches.

### Step 5: Verification
- Pre-print verification: all required elements present.
- Post-application verification: label legibility, attachment security.
- Periodic audit: random container checks.

### Step 6: Storage Area Signage
- Generate area warning signs for bulk storage (warehouses, tanks).
- Include: pictograms, signal word, emergency contacts, fire protection requirements.

### Step 7: Update on Reclassification
- Trigger label update when GHS classification changes.
- Withdraw obsolete labels from inventory.
- Track label version history.

## 4. Evidence Record
Generate `hazard-label-record.json` with substance ID, label elements, generation timestamp, application records.

## 5. Required Label Elements (GHS Rev 9)
1. Product identifier
2. Pictogram(s)
3. Signal word
4. Hazard statement(s)
5. Precautionary statement(s)
6. Supplier identification
7. Supplementary information (per Korean requirements)

## 6. KPI
- 100% labeled containers in compliance with GHS Rev 9
- 0 unlabeled/mislabeled containers during self-inspection

## 7. Legal Disclaimer
> Workflow automation assistance only. Final label approval requires qualified EHS professional verification per OSHA-KR Article 115.
