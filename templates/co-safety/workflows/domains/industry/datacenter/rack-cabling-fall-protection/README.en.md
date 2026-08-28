# Datacenter Industry — Rack & Cabling Fall Protection Workflow

> **Status**: This README was finalized in Task 12. However, `signature_hazard` in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review (`status: draft`). Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent fall hazards during server rack installation, upper cable-tray wiring, and elevated-platform access work in datacenters, by applying the hierarchy of controls. Falls are a leading cause of serious accidents during datacenter construction, expansion, and maintenance. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — a datacenter-specific fall-protection procedure that does not duplicate any workflow under `workflows/_shared/`.

## 2. Scope
- **Industry**: Datacenter (code: `datacenter`)
- **Work covered**: Rack setup/relocation, upper cable routing/re-cabling, ladder/elevated-platform work, ceiling work, lighting/UPS top-side inspection
- **Trigger points**: New build-out (Move-in/Build-out), equipment cutover, recurring maintenance

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads fall risk assessment, verifies adequacy of protective measures, operates the work-at-height permit system |
| Supervisor / Work Lead | Approves work permits, performs pre-use equipment inspection, confirms worker competency, halts work on anomaly |
| Worker | Uses fall-protection equipment, complies with permit conditions, performs pre-use checks, reports abnormal signs |
| Electrical Safety Manager | Confirms de-energization/insulation of adjacent live parts (controls combined fall+electrocution risk) |
| Industrial Health & Safety Committee | Reviews falls and near-misses, improves protective measures |

## 4. Procedure
1. **Fall risk assessment**: Identify work height, frequency, number of workers, platform/access method, and below obstacles. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: Remove the elevated work itself via design change (pre-assembly, modularization).
   2. **Passive protection**: Platform guardrails, solid footing, safety nets.
   3. **Active protection**: Harness, lanyard/retractable fall arrester.
   4. **Administrative**: Work-at-height permit, pre-task TBM.
   5. **PPE**: Hard hat, safety footwear (last resort).
3. **Equipment inspection**: Pre-use inspection of harness/lifeline/anchorage/platform; immediately remove defective equipment from service.
4. **Permit & training**: Issue the work-at-height permit; train workers on fall-protection equipment; conduct rescue drills.
5. **Electrical hazard control**: Pre-emptively de-energize, insulate, and Lockout/Tagout adjacent live parts — controls the combined electrocution risk during a fall.
6. **Rescue plan**: Rapid rescue procedure (prevents suspension/harness trauma syndrome).
7. **Recordkeeping & audit**: Generate the evidence record (§6); retain permits, inspection sheets, and near-miss reports.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/datacenter/datacenter-rack-cabling-fall-protection-record.json`](../../../../../evidence-models/domains/industry/datacenter/datacenter-rack-cabling-fall-protection-record.json) (skeleton, `status: draft`)

- **Record ID format**: `DATACENTER-RACK-CABLING-FALL-PROTECTION-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as work height, protection tier applied, permit number, and pre-use inspection result.

## 6. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated).

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 전기안전관리법 Article 16
- 전기안전관리법 Article 22
- 위험물안전관리법 Article 5
- 위험물안전관리법 Article 27
- 소방기본법 Article 16

### Gloss
| Korean | Abbreviation | English |
|--------|--------------|---------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 전기안전관리법 | ESCA | Electrical Safety Control Act |
| 위험물안전관리법 | DSSMA | Act on the Safety Control of Dangerous Goods |
| 소방기본법 | BFS | Basic Act on Fire Services |

## 7. Regulatory Notes
No dedicated datacenter statute exists. Composite anchor: 전기안전관리법 (ESCA — high-voltage safety for UPS, switchgear, transformers), 위험물안전관리법 (DSSMA — diesel fuel for backup generators, lead-acid/lithium UPS batteries), 소방기본법 (BFS — fire suppression and smoke management). Also relevant: OSHA-KR Article 101 (electrical hazard) and Article 99 (fall prevention during racking/cabling) — note, however, that this workflow's `schema.yaml` legal_basis uses the composite auto-filled anchor set listed above.

## 8. Outsourcing Note
Datacenter construction and expansion are heavily outsourced, making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) especially relevant. The commissioning client must ensure this workflow's controls are applied by subcontractors down the contracting chain.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
