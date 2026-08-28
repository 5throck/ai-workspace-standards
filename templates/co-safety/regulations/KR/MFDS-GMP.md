# KP-GMP Regulatory Reference (Korean Good Manufacturing Practice)

> **Source MCP**: `mcp-kr-legislation` *(historical provenance — server removed 2026-08-26; re-verify via the k-law skill, 법제처 Open API)*
> **Jurisdiction**: Republic of Korea
> **Regulator**: Ministry of Food and Drug Safety (MFDS / 식품의약품안전처)
> **Last Updated**: 2026-08-24

---

## 1. Primary Legal Basis

### 1.1 약사법 (Pharmaceutical Affairs Act) Article 37

의약품등의 제조 관리의무 — pharmaceutical manufacturing managers (제조관리자) must observe the Presidential-Decree-prescribed manufacturing management duties: worker supervision, quality control, and facility management.

- **Korean text reference**: 약사법 제37조 (의약품등의 제조 관리의무)
- **English summary**: Mandatory GMP for pharmaceutical manufacturing
- **Enforcement agency**: MFDS

### 1.2 Delegated Legislation: 총리령 「의약품 등의 안전에 관한 규칙」 별표 1 (Presidential Decree)

The technical GMP requirements are codified in Annex 1 (별표 1) 「의약품 제조 및 품질관리기준」 of Presidential Decree 총리령 「의약품 등의 안전에 관한 규칙」. Operational detail is delegated to MFDS Notice 「의약품 제조 및 품질관리에 관한 규정」 (식품의약품안전처 고시 제2024-87호). This is the operational reference for all GMP workflows in safety-os.

---

## 2. International Harmonization

Korean GMP (KP-GMP) is harmonized with the following international frameworks:

| Framework | Reference Document | Alignment |
|-----------|-------------------|-----------|
| **PIC/S GMP** | PE 009 Annexes | Harmonized (mutual recognition for export) |
| **ICH Q7** | Active Pharmaceutical Ingredients | Adopted |
| **ICH Q9** | Quality Risk Management | Adopted |
| **ICH Q10** | Pharmaceutical Quality System | Adopted |

---

## 3. Key Articles (총리령 「의약품 등의 안전에 관한 규칙」 별표 1)

| Anchor (별표 1) | Topic (Korean) | Topic (English) | Safety-OS Workflow Reference |
|---------|----------------|-----------------|------------------------------|
| 별표 1 제8호 | 제조관리 | Manufacturing Control Standards | All gmp-* workflows |
| 별표 1 제13호 | 자율점검 | Self-Inspection | `workflows/gmp/self-inspection/` |
| 별표 1 제6호 | 적격성평가 | Qualification | `workflows/gmp/equipment-qualification/` |
| 별표 1 제6호 | 밸리데이션 (6.1~6.6) | Validation | `workflows/gmp/cleaning-validation/`, `workflows/gmp/csv-validation/` |
| 별표 1 제12호 | 변경관리 | Change Control | `workflows/gmp/change-control/` |
| 별표 1 제7.3호 | 이상관리 및 시정조치 | Deviation Management and CAPA | `workflows/gmp/deviation-capa/` |
| 별표 1 제7.2호 | 안정성 시험 | Stability Testing | `workflows/gmp/stability/` |

Additional topics covered by KP-GMP that map to GMP workflows:
- Batch Manufacturing Records (BMR) → `workflows/gmp/batch-mfg/`
- Supplier Qualification → `workflows/gmp/supplier-qualification/`
- Product Quality Review (PQR) → `workflows/gmp/pqr/`

---

## 4. GMP Pillars (PQS Framework)

Per ICH Q10, the Pharmaceutical Quality System (PQS) consists of five pillars:

1. **Quality System** — Management responsibility, quality culture, CAPA
2. **Personnel & Hygiene** — Training, qualification, hygiene practices
3. **Premises & Equipment** — Design, qualification (IQ/OQ/PQ), calibration
4. **Documentation & Records** — Data integrity (ALCOA+), electronic records
5. **Self-Inspection** — Internal audit program

---

## 5. Multi-Source Legal Basis Requirement

Unlike PSM (which references OSHA-KR Article 44 as a single source), GMP workflows in safety-os must declare **multi-source legal_basis** per the architecture decision (2026-06-17 meeting). Each workflow must reference at minimum:

- `약사법` Article 37 (Korean statutory basis)
- 「의약품 등의 안전에 관한 규칙」 별표 1 relevant 호 (Korean delegated legislation)
- One or more international alignment sources (PIC/S, ICH Q7/Q9/Q10)

This is enforced by the extended `safety-audit.ts` GMP validation logic.

---

## 6. Disclaimer

> Regulatory interpretation is user responsibility. This document provides workflow automation assistance only, not legal advice. All references to Korean law and ICH guidelines are for workflow documentation purposes. The accuracy and applicability of regulatory references must be verified by a qualified legal or GXO professional before operational use.
