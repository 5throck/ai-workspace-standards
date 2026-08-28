# MSDS 접수 및 파싱 (MSDS Intake and Parsing) Workflow

## 1. Objective
Receive, validate, and parse MSDS/SDS documents from chemical suppliers into structured GHS 16-section records, per OSHA-KR Article 110 (MSDS preparation/submission duty) and 산업안전보건법 시행규칙 제156조 (delegated format and content requirements — GHS 16 sections).

## 2. Applicability
All new and updated MSDS documents received from chemical suppliers for substances handled at any site under the `chemical-handling` profile.

## 3. Workflow Steps

### Step 1: Document Receipt
- Receive MSDS from supplier (PDF, HTML, or structured file).
- Record supplier ID, product code, version date.

### Step 2: Format Detection
- Identify supplier (top 5 Korean chemical majors have predefined rule templates).
- Detect document format (PDF text-extractable vs scanned).

### Step 3: Parsing (Hybrid Mode)
- **Mode 1 (rule-based, default)**: Match against `skills/domains/functional/msds/msds-parser/rules/<supplier>.yaml`.
- **Mode 2 (ML fallback, auto when Mode 1 confidence <80%)**: External LLM API call with 16-section extraction prompt.
- **Manual review**: Required if Mode 2 confidence <90%.

### Step 4: GHS 16 Sections Validation
- Verify all 16 GHS sections present with non-empty content.
- Required sections per 산업안전보건법 시행규칙 제156조 (delegated under OSHA-KR Article 110):
  1. Identification
  2. Hazard identification (GHS classification, H/P-Statements)
  3. Composition/information on ingredients
  4. First-aid measures
  5. Fire-fighting measures
  6. Accidental release measures
  7. Handling and storage
  8. Exposure controls / PPE (OEL, PEL, TLV)
  9. Physical and chemical properties
  10. Stability and reactivity
  11. Toxicological information
  12. Ecological information
  13. Disposal considerations
  14. Transport information
  15. Regulatory information
  16. Other information

### Step 5: Record Generation
- Create `msds-record.json` with `ghs_version: "rev9"` and full 16-section data.
- Include audit_trail, e_signature, nomenclature, multi-source legal_basis.

### Step 6: Posting and Notification
- Post MSDS to required locations per OSHA-KR Article 114 (게시).
- Notify affected workers of new/updated chemical (right-to-know).
- Trigger `ghs-classification` workflow to formalize classification.

## 4. Evidence Record
Generate `msds-record.json` to `memory/` with GHS 16 sections, `ghs_version`, and common fields.

## 5. Quality Gates
- All 16 sections present (reject if missing)
- GHS classification extracted (Section 2)
- Korean OEL values present where applicable (Section 8)
- Supplier authorization verified (trade secrets/CBI check)

## 6. Legal Disclaimer
> Workflow automation assistance only. Final MSDS acceptance and worker notification require qualified EHS professionals.
