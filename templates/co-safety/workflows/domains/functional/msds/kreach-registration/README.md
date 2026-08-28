# K-REACH 화학물질 등록 (K-REACH Chemical Registration) Workflow

## 1. Objective
Register chemical substances with Ministry of Environment (ME) per K-REACH Article 11 (pre-manufacture/import new chemical registration) and ensure ongoing compliance for existing chemicals.

## 2. Applicability
- All new chemicals before manufacture/import (90-day lead time per K-REACH Article 11).
- All existing chemicals exceeding 1 ton/year threshold (Article 10 transition to Article 11 full registration).
- Substance designated as Hazardous Concern Substance (위해우려화학물질).

## 3. Workflow Steps

### Step 1: Registration Trigger Detection
- New chemical identified (not in K-REACH existing chemical inventory).
- Existing chemical crosses 1 ton/year threshold (from `chemical-inventory` workflow).
- Substance designated as Hazardous Concern Substance by ME.

### Step 2: Pre-Registration Data Collection
- Substance identity (CAS number, molecular formula, purity).
- Manufacture/import volume and use category.
- Hazard data (GHS classification, toxicological studies).
- Exposure scenarios (intended use, worker exposure, environmental release).
- Risk management measures.

### Step 3: Lead Time Management
- New chemicals: file at least 90 days before intended manufacture/import.
- Existing chemicals (≥1 ton): annual reporting per Article 10.
- Track application status with ME.

### Step 4: Submission
- Submit via K-REACH online portal (KEITI manages).
- Pay applicable fees.
- Receive registration number and any conditions.

### Step 5: Post-Registration Compliance
- Update `msds-record.json` with registration number.
- Implement any risk management conditions.
- Annual tonnage update reporting.
- Cooperate with ME risk assessment requests.

### Step 6: Trade Secret Protection (if applicable)
- File Confidential Business Information (CBI) claim per K-REACH Article 13.
- Provide justification and limited disclosure plan.

## 4. Evidence Record
Generate `kreach-registration-record.json` with substance ID, registration number, tonnage, conditions, expiry/renewal date.

## 5. Threshold Reference
| Tonnage | K-REACH Path |
|---------|--------------|
| <1 ton/year existing | Article 10 annual report only |
| ≥1 ton/year existing | Article 10 + risk assessment if designated |
| New chemical (any tonnage) | Article 11 pre-registration (90 days) |
| Hazardous Concern Substance | Article 14 enhanced management |

## 6. KPI
- 100% on-time new chemical registration (90-day lead time)
- 0 unauthorized manufacture/import without registration

## 7. Legal Disclaimer
> Workflow automation assistance only. Final K-REACH submissions require qualified regulatory affairs and legal professional review.
