---
name: gmp-qrm
owner: gmp-agent
scope: workspace
status: active
description: ICH Q9 Quality Risk Management (품질 위해 관리) skill for pharmaceutical manufacturing. Cross-cutting methodology applied to all GMP workflows. Scope limited to product quality + patient safety risks.
version: "1.0.0"
created: 2026-06-17
last_updated: 2026-07-09
metadata:
  type: domain
  triggers:
    - quality risk management
    - qrm
    - fmea
    - risk assessment
    - 품질위해관리
    - 위해관리
  legal_basis:
    - 의약품 등의 안전에 관한 규칙 별표 1 제7호 (품질관리)
    - ICH Q9 (Quality Risk Management)
    - 약사법 Article 37 (의약품등의 제조 관리의무)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# GMP Quality Risk Management (ICH Q9) Skill

## Overview
This skill provides ICH Q9 Quality Risk Management (QRM) methodology for pharmaceutical manufacturing. It is a **cross-cutting skill** referenced by all GMP workflows when risk assessment is required. It supports the `qrm_assessment` common field in all `gmp-*.json` evidence models.

## Scope (Critical Role Separation)
> **Scope limited to product quality and patient safety risks**.
>
> - **EHS risks** (worker safety, occupational health, environmental) → `risk-assessment-agent`
> - **Process safety risks** (chemical, reactive hazards) → `psm-agent`
> - **Product quality risks** (this skill) → `gmp-qrm`
>
> Role separation enforced by `safety-audit.ts` per meeting decision 2026-06-17.

## ICH Q9 Methodology Matrix

| Methodology | Full Name | Best Suited For | Output |
|-------------|-----------|-----------------|--------|
| **FMEA** | Failure Mode and Effects Analysis | Process failure modes, equipment qualification impact | Risk Priority Number (RPN) |
| **HACCP** | Hazard Analysis and Critical Control Points | Raw material hazards, biological contamination | Critical Control Points (CCPs) |
| **FTA** | Fault Tree Analysis | Root cause investigation, complex failure scenarios | Fault tree diagram, minimal cut sets |
| **cQRM-HAZOP** | Quality-focused HAZOP | Quality deviations from process parameters | Quality deviation analysis |
| **PHA** | Preliminary Hazard Analysis | Initial screening, early process development | Hazard list with risk rankings |

## Methodology Selection Guide

| Trigger | Recommended Methodology |
|---------|------------------------|
| Change control impact assessment | FMEA |
| Deviation investigation (simple) | 5-Whys (via gmp-deviation-capa) |
| Deviation investigation (complex) | FTA |
| Cleaning validation risk assessment | FMEA |
| Supplier qualification risk | HACCP or FMEA |
| Stability program design | PHA |
| New product introduction | PHA → FMEA progression |
| Process validation risk | cQRM-HAZOP + FMEA |
| CSV risk categorization | FMEA (per GAMP 5) |

## Operational Steps
1. **Identify Risk Question**: Define what risk is being assessed (e.g., "What is the risk of cross-contamination from shared equipment?").
2. **Select Methodology**: Use the selection guide above.
3. **Assemble Cross-Functional Team**: QA, Production, Engineering, Technical, SMEs as needed.
4. **Conduct Assessment**: Apply methodology per ICH Q9 guidelines.
5. **Document Output**: Generate `gmp-qrm-{id}` assessment record.
6. **Risk Classification**: low / medium / high / critical.
7. **Mitigation Plan**: For medium/high/critical risks, define mitigation actions.
8. **Reference from Workflow**: Update the calling workflow's `qrm_assessment` field with:
   - `methodology`
   - `risk_level`
   - `assessment_ref` (the gmp-qrm-{id})
   - `mitigation_status`

## Common Field (qrm_assessment)
Used in all `gmp-*.json` evidence models via `$ref` to `_shared/base/common.schema.json#/definitions/qrm_assessment`:

```json
"qrm_assessment": {
  "methodology": "FMEA | HACCP | FTA | cQRM-HAZOP | PHA",
  "risk_level": "low | medium | high | critical",
  "assessment_ref": "gmp-qrm-{id}",
  "mitigation_status": "open | closed | monitoring"
}
```

## Risk Level Definitions
- **low**: Acceptable with current controls; routine monitoring
- **medium**: Acceptable with additional controls; periodic review
- **high**: Reduction required; senior management review
- **critical**: Unacceptable; immediate action required; RP notification

## Documentation Storage
QRM assessment records stored in `memory/qrm/` with naming `gmp-qrm-{YYYY-MM-DD}-{id}.md`.

## Training Requirement
All personnel applying QRM methodology must complete ICH Q9 training. Training records tracked via `training-agent` (when invoked).

## Legal Disclaimer
> Workflow automation assistance only. QRM outputs support but do not replace professional judgment. Final risk acceptance decisions require qualified QA management and (for critical risks) the Responsible Person per KP-GMP requirements.
