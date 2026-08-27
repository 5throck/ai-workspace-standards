---
name: gmp-change-control
owner: gmp-agent
scope: workspace
status: active
description: Manage GMP Change Control (변경관리) workflows per 총리령 「의약품 등의 안전에 관한 규칙」 별표 1 제12호 (변경관리) + ICH Q10. Pattern reused from psm-moc with quality impact assessment extension.
version: "1.0"
created: 2026-06-17
last_updated: 2026-08-26
metadata:
  type: domain
  triggers:
    - gmp change control
    - change control
    - 변경관리
    - 품질변경
    - gmp change
  legal_basis:
    - 의약품 등의 안전에 관한 규칙 별표 1 제12호 (변경관리)
    - ICH Q10 Section 3 (Quality Management System - Change Management)
    - 약사법 Article 37 (의약품등의 제조 관리의무)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# GMP Change Control (변경관리) Skill

## Overview
This skill oversees the GMP Change Control process to ensure that changes to facilities, equipment, processes, materials, documentation, or organization are properly evaluated, approved, implemented, and documented before execution. It reuses the pattern from `skills/domains/functional/psm/moc/` with extensions for quality impact assessment per ICH Q10.

## Scope
- **In scope**: GMP-regulated changes under `pharma-general` profile
- **Out of scope**: PSM-regulated changes (use `skills/domains/functional/psm/moc/` instead)
- **Overlap**: For changes affecting both process safety AND product quality, dispatch BOTH skills in parallel

## Operational Steps
1. **Initiate Change Request**: Document change description, rationale, technical basis, and classification (minor/major/critical).
2. **Quality Impact Assessment**: Apply ICH Q9 methodology (typically FMEA) via `skills/domains/industry/gmp/qrm/` to evaluate impact on:
   - Product quality
   - Validated state (equipment, process, cleaning, CSV)
   - Regulatory filings
   - Stability commitments
   - Supplier qualification status
3. **Multi-Disciplinary Review**: Route to QA, Production, Engineering, Regulatory, Medical (if applicable).
4. **Approval**: For critical changes, obtain QA Manager and RP (Responsible Person) approval.
5. **Implementation Planning**: Define training, dependent actions (re-validation, re-qualification, stability).
6. **Pre-Implementation Verification**: Confirm prerequisites met.
7. **Implementation & Effectiveness Check**: Execute change, define effectiveness check criteria (typically 30-90 days).
8. **Closure**: Verify effectiveness, archive evidence with multi-source `legal_basis`.

## Evidence Generation
Generate evidence to `memory/` using `evidence-models/domains/industry/gmp/gmp-change-control-record.json`. Required common fields:
- `legal_basis`: array with min 3 sources (universal DEFAULT_MIN_LEGAL_BASIS, `scripts/domain-config.ts`; Korean statutory + international)
- `e_signature`: schema-only in v1 (cryptographic_hash: null)
- `qrm_assessment`: link to gmp-qrm assessment
- `nomenclature`: multilingual declaration
- `audit_trail`: ALCOA+ metadata

## PSM Pattern Reuse
90% pattern reuse from `skills/domains/functional/psm/moc/`. Key extensions:
- Quality impact assessment (in addition to safety impact)
- Multi-source `legal_basis` with quality-domain citations (PSM MOC also uses multi-source `legal_basis` — 4 sources: OSHA-KR Art 44, PSM고시 제4항, SAPA Art 4, OSHA 1910.119(l); the delta is the citation set, not the source count)
- ALCOA+ data integrity enforcement
- Effectiveness check (typically not in PSM MOC)

## KPI Tracking
- Change closure cycle time (target: <90 days for major changes)
- Effectiveness check pass rate (target: >95%)
- Changes requiring re-validation (trend metric)

## Legal Disclaimer
> Workflow automation assistance only. Final change approval and regulatory filing decisions require qualified QA and Regulatory Affairs professionals per KP-GMP requirements.
