# GDP Domain v1 — Scope Document

> **Domain**: `gdp` (Good Distribution Practice / 의약품 유통관리)
> **Status**: Approved (2026-06-17)

## 1. Purpose

Defines v1 scope of GDP domain in safety-os. GDP manages pharmaceutical supply chain operations from manufacturer handoff through delivery to customers, complementing GMP (manufacturing) and interfacing with emergency-agent (recall execution).

## 2. Domain Boundaries

| Boundary | Interface |
|----------|-----------|
| GMP → GDP | `batch_disposition_approved_ref` (GMP releases batch → GDP receives) |
| GDP → MSDS | Storage of hazardous drugs references `msds-record` |
| GDP → emergency-agent | `product-recall-reference` workflow dispatches recall execution |
| GDP → GMP deviation-capa | `deviation_source` field: manufacturing / distribution / unknown |

## 3. Components

| Component | Count |
|-----------|-------|
| Agent | 1 (`gdp-agent`) |
| Workflows | 8 (7 core + 1 reference) |
| Evidence Models | 7 |
| Skills | 2 |
| Regulations | 2 (MFDS-GDP, DTS) |
| Industry Profile | 1 (`pharma-distribution`) |

## 4. Workflows

| # | Workflow | Type | Legal Basis |
|---|----------|------|-------------|
| 1 | goods-receipt | core | 약사법 Art 43의2 + 유통관리기준 + PIC/S GDP |
| 2 | storage-management | core | 약사법 Art 43의2 + 유통관리기준 + EU GDP |
| 3 | temperature-monitoring | core | 유통관리기준 + PIC/S GDP Ch.3 + EU GDP Ch.7 |
| 4 | transportation | core | 약사법 Art 43의2 + 유통관리기준 + PIC/S GDP Ch.9 |
| 5 | traceability-dts | core | 약사법 Art 43의2 + DTS 고시 + PIC/S GDP Ch.6 |
| 6 | returned-goods | core | 유통관리기준 + PIC/S GDP Ch.10 |
| 7 | gdp-self-inspection | core | 유통관리기준 + PIC/S GDP Ch.8 + EU GDP Ch.8 |
| 8 | product-recall-reference | reference | 약사법 Art 43의3 + PIC/S GDP Ch.5 |

## 5. Korea-Specific

### GDP 인증제 (GDP Certification)
- MFDS certification mandatory for wholesale distributors since 2020
- 3-year renewal cycle
- Tracked via `gdp_certification_status` field in all evidence models

### DTS (Drug Tracking System)
- Mandatory for 17+ drug categories since 2022
- Barcode/RFID tracking at each distribution stage
- MFDS DTS Center real-time reporting
- Separate workflow (`traceability-dts`) and evidence model

## 6. Temperature Zones

| Zone | Range | Use Case |
|------|-------|----------|
| Cold chain | 2-8°C | Biologics, vaccines, insulin |
| Frozen | ≤ -15°C | Some biologics, plasma |
| Controlled room | 15-25°C | Most oral solids |
| Ambient | ≤ 30°C | General storage |

All evidence models include `temperature_condition` field.

## 7. Common Fields (all gdp-*.json)

- `gdp_certification_status`: certified / pending / suspended / expired
- `temperature_condition`: cold_chain_2_8C / frozen / controlled_room / ambient
- `batch_disposition_approved_ref`: GMP batch reference

Plus standard: `e_signature`, `nomenclature`, `audit_trail`, `legal_basis` (≥3)

## 8. Legal Disclaimer

> Regulatory interpretation is user responsibility. GDP domain provides workflow automation only, not legal advice. All regulatory references must be verified by qualified pharma logistics professionals.
