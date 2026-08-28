# 컴퓨터 시스템 적합성평가 (Computer System Validation) Workflow

## 1. Objective
Establish and maintain documented evidence that computerized systems used in GMP-regulated activities are fit for intended use, with appropriate controls for data integrity, audit trails, and electronic signatures, per 의약품 등의 안전에 관한 규칙 별표 1 제6호 (컴퓨터시스템 밸리데이션), 21 CFR Part 11, and GAMP 5.

## 2. Applicability
This workflow applies to all GxP-regulated computerized systems under the `pharma-general` profile:
- Manufacturing execution systems (MES)
- Laboratory information management systems (LIMS)
- Quality management systems (QMS)
- Building management systems (BMS) for GMP areas
- Electronic batch record (EBR) systems

## 3. Workflow Steps

### Step 1: System Risk Assessment (GxP Categorization)
- Determine GxP impact: GxP-critical / GxP-indirect / no impact.
- Apply ICH Q9 + GAMP 5 risk-based categorization.

### Step 2: System Categorization (GAMP 5)
- Category 1: Infrastructure (operating systems, databases)
- Category 2: Cannot be validated (N/A in modern context)
- Category 3: Non-configured commercial software
- Category 4: Configured products
- Category 5: Custom applications

### Step 3: User Requirements Specification (URS)
- Define intended use, functional requirements, regulatory requirements.

### Step 4: Validation Approach Based on Category
- Categories 1/3: supplier audit + installation verification
- Categories 4/5: full validation (DQ/IQ/OQ/PQ)

### Step 5: Data Integrity Assessment (ALCOA+)
- Verify electronic records compliance: attributable, legible, contemporaneous, original, accurate.
- Audit trail: enable, review, secure.
- Access controls: role-based, unique user IDs, password policy.

### Step 6: Electronic Signature Implementation
- Per 21 CFR Part 11 (v1: schema-only; cryptographic implementation in v2).
- Link signatures to records.
- Record signature manifestation (meaning, timestamp, signer).

### Step 7: Testing (IQ / OQ / PQ)
- Test installation, operation, and performance per category.
- Verify audit trails, access controls, data backup/restore.

### Step 8: Periodic Review
- Annual system review: incidents, change control status, CAPA status, data integrity metrics.

### Step 9: Decommissioning
- Data migration / retention plan when system retired.

## 4. Evidence Record
Generate `gmp-csv-record.json` with system ID, GxP category, validation level, audit trail review, and common fields.

## 5. Note on v1 Scope
Per meeting decision 2026-06-17 (Q1), v1 includes e-signature **schema** only; cryptographic implementation (PKI/HSM) deferred to v2.

## 6. Legal Disclaimer
> Workflow automation assistance only. Final CSV approval requires qualified IT, QA, and the System Owner per GAMP 5 requirements.
