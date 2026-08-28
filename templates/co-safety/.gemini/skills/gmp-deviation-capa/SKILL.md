---
name: gmp-deviation-capa
owner: gmp-agent
scope: workspace
status: active
description: Manage GMP Deviation (이상관리) and CAPA (시정예방조치) workflows per 총리령 「의약품 등의 안전에 관한 규칙」 별표 1 제7.3호 + ICH Q10.
version: "1.0.0"
created: 2026-06-17
last_updated: 2026-08-26
metadata:
  type: domain
  triggers:
    - gmp deviation
    - gmp capa
    - deviation
    - 이상관리
    - 시정예방조치
    - oos
    - out of specification
  legal_basis:
    - 의약품 등의 안전에 관한 규칙 별표 1 제7.3호 (이상 및 시정예방조치)
    - ICH Q10 Section 2 (Quality System - Corrective and Preventive Action)
    - 약사법 Article 37 (의약품등의 제조 관리의무)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# GMP Deviation & CAPA (이상관리 및 시정예방조치) Skill

## Overview
This skill manages the end-to-end lifecycle of GMP deviations and corresponding CAPAs. It applies ICH Q9 Quality Risk Management methodology for investigation and ensures ALCOA+ data integrity throughout the process.

## Scope
- **In scope**: All GMP-regulated deviations (planned/unplanned/OOS/OOT/audit findings)
- **Out of scope**: PSM incidents (handled by `incident-investigation-agent`); EHS near-misses (handled by `risk-assessment-agent`)
- **Distinction**: This skill handles **product quality** deviations only

## Deviation Lifecycle Steps
1. **Identification**: Detect deviation via batch record review, IPC failure, OOS result, or self-inspection.
2. **Classification**: minor / major / critical (based on patient safety + product quality impact).
3. **Immediate Containment** (critical/major): Quarantine affected batches, halt production if needed.
4. **Documentation**: Generate `gmp-deviation-record.json` within 24 hours.
5. **Investigation**: Apply ICH Q9 methodology (5-Whys for simple, FMEA/FTA for complex) via `skills/domains/industry/gmp/qrm/`.
6. **Root Cause Identification**: Distinguish root cause from contributing causes.
7. **CAPA Development**: Define corrective (eliminate current cause) + preventive (prevent recurrence) actions.
8. **CAPA Implementation**: Track via `gmp-capa-record.json` with owner, target date.
9. **Effectiveness Check**: Verify CAPA effectiveness (30-90 days post-implementation).
10. **Closure**: Critical deviations require RP approval for closure.

## CAPA Distinction
- **Corrective Action**: Eliminates the root cause of an **existing** non-conformity
- **Preventive Action**: Prevents the occurrence of a **potential** non-conformity (proactive)
- Both are tracked separately even when applied to the same root cause

## Evidence Generation
- `gmp-deviation-record.json` — one per deviation event
- `gmp-capa-record.json` — one per CAPA (a deviation may have multiple CAPAs)

Common fields required:
- `legal_basis`: array with min 3 sources (universal DEFAULT_MIN_LEGAL_BASIS, `scripts/co-safety/domain-config.ts`) — e.g., 총리령 「의약품 등의 안전에 관한 규칙」 별표 1 제7.3호 + ICH Q10 + 약사법 Article 37
- `e_signature`, `qrm_assessment`, `nomenclature`, `audit_trail`

## Integration Points
- **From**: `batch-mfg` workflow (IPC failures, OOS), `self-inspection` workflow (findings), `cleaning-validation` (failures)
- **To**: `change-control` workflow (when CAPA requires permanent change), `equipment-qualification` (re-qualification triggers)

## KPI Tracking
- Deviation rate per 100 batches (target: <2%)
- Mean time to investigation (target: critical <7 days, major <14 days)
- CAPA closure cycle time (target: 0 overdue >90 days)
- Effectiveness check pass rate (target: >95%)

## Escalation Triggers
- Critical deviation with patient safety impact → immediate escalation to PM/CSO + RP
- Pattern of recurring deviations → trigger PQR review
- Data integrity violation → regulatory escalation path

## Legal Disclaimer
> Workflow automation assistance only. Final deviation disposition and CAPA acceptance require qualified QA management and RP per KP-GMP requirements.
