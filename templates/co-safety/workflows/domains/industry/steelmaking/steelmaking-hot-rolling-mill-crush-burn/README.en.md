# Steelmaking Industry — Hot-Rolling-Mill Crush / Burn / Coil-Collapse Workflow

> **Status**: This README was finalized in Phase 2 Group C and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent via MCP `kr_safety` + `legalize_kr`). However, `signature_hazard` refinement in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent (a) roll crush / amputation / entanglement, (b) hot-slab and hot-coil contact burn, (c) scale-fly projectile impact, and (d) coil-stack collapse on the hot-rolling-mill line — roughing mill, finishing mill, run-out table (ROT), coiler, and coil yard — of an integrated steelmill, by applying the hierarchy of controls. The hot-rolling line is a representative high-density serious-accident area in Korea's integrated mills (POSCO Pohang/Gwangyang, Hyundai Steel Dangjin, etc.), where rotating-roll nip points, falling objects, hot contact, and heavy coils (large-mass loads) coexist. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — a steelmaking-specific mechanical and burn-safety procedure that does not duplicate any workflow under `workflows/_shared/`. Byproduct-gas leak detection is covered by `byproduct-gas-leak-prevent`; furnace and molten-metal repair LOTO is covered by `molten-metal-loto` (this workflow addresses the downstream rolling-line mechanical hazards).

## 2. Scope
- **Industry**: Steelmaking (code: `steelmaking`, integrated steel mills)
- **Work covered**: Roll change / grinding / greasing, slab scale removal and conveyor-line inspection, coiler and ROT maintenance, coil stacking / strapping / transport, roll-stand internal maintenance and guard inspection
- **Trigger points**: In-service periodic inspection, roll-change work, shift handover, coil-yard rearrangement, response to abnormal vibration/temperature alarm, and pilot rolling of a new steel grade

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads rolling-line risk assessment, formulates mechanical/burn control plans, operates the safe-work-permit system (mechanical/burn), formulates emergency response plans |
| Mechanical Safety Manager | Verifies adequacy of roll-stand guards and safety devices, applies LOTO during roll change / greasing, plans heavy-lift operations |
| Supervisor | Approves safe-work permits, performs cross-checks before roll-stand / coil-yard entry, halts work on anomaly |
| Worker | Does not defeat guards, wears burn-protection clothing and cut-resistant gloves, keeps clear of rotating parts, stops work and reports on anomaly |
| Facility Engineer | Inspects emergency-stop / light-curtain / perimeter-guard operation, scale-flush and removal equipment, coil-chaser and shock-chock safety devices |
| Yard Manager | Enforces coil-stacking height / spacing / strapping rules, monitors yard for collapse risk |
| Industrial Health & Safety Committee | Post-incident review of crush / burn / collapse incidents and near-misses, improves protective measures |

## 4. Procedure
1. **Risk assessment**: Identify nip points, rotating parts, hot surfaces, falling objects, and heavy-load stack-collapse hazards at each roll stand, ROT, coiler, and coil yard. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk assessment) and Article 38 (mechanical/equipment safety measures and permit-to-work basis).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: Introduce automated roll-changers and robotic greasing, unmanned scale removal and surface-defect inspection, and automated coil strapping/transport.
   2. **Engineering**: Fixed roll-stand guards, light curtains, and full-line emergency-stop pull-cords; ROT covers and scale-flush recovery; coil anti-collision shock chocks and chasers; coil-yard stacking saddles with height limits.
   3. **Administrative**: Safe-work permit (mechanical/burn/heavy load), LOTO during roll change and greasing (산업안전보건법 Article 38), shift-change TBM, coil-yard stacking-height and spacing rules, access control to burn-hazard zones.
   4. **PPE**: Heat-resistant and burn-protection clothing, cut-resistant gloves, face shield and safety glasses, safety footwear and hearing protection (last resort).
3. **Mechanical crush / entanglement control**: During roll-stand and coiler maintenance, apply LOTO, prohibit guard removal, and keep clear of pinch rolls during cleaning and greasing. Aligns with 산업안전보건기준에관한규칙 Ch.6 §2 (collapse prevention — coil stacks) and OSHA-KR Article 38.
4. **Hot-contact and scale-fly control**: Confirm slab/coil temperature before approach, mandatorily wear face protection in scale-flush zones, and observe cooling wait-times to prevent contact with hot surfaces. Field application of the risk-assessment duty (Art 36) and safety-measures duty (Art 38).
5. **Coil-stack collapse control**: Stack coils in stable trapezoidal patterns within the maximum height, mandatorily apply strapping, and re-inspect after earthquake or crane-impact events. Aligns with 산업안전보건기준에관한규칙 Ch.6 §2 (collapse prevention).
6. **Emergency response**: On crush entanglement, do not reverse the roll; apply LOTO and execute heavy-lift rescue. On burn, immediately cool and call first aid. On coil collapse, secure against secondary collapse before approach.
7. **Recordkeeping & audit**: Generate the evidence record (§5); retain safe-work permits, LOTO records, guard-inspection sheets, coil-yard stacking inspection logs, and incident / near-miss records.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/steelmaking/steelmaking-steelmaking-hot-rolling-mill-crush-burn-record.json`](../../../../../evidence-models/domains/industry/steelmaking/steelmaking-steelmaking-hot-rolling-mill-crush-burn-record.json) (skeleton, `status: draft`)

- **Record ID format**: `STEELMAKING-HOT-ROLLING-MILL-CRUSH-BURN-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as line ID, roll-stand number, slab/coil temperature, coil-stacking height, guard/light-curtain inspection history, crush/burn incident history.

## 6. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated).

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 산업안전보건법 Article 38 (추락 등 위해 방지 안전조치)
- 안전보건기준에관한규칙 제6장 제2절 (붕괴 등에 의한 위험 방지)
- 안전보건기준에관한규칙 (감전 등 전기 재해 방지 기준)
- 고압가스 안전관리 및 사업법 Article 11
- 고압가스 안전관리 및 사업법 Article 13
- 고압가스 안전관리 및 사업법 Article 15
- 고압가스 안전관리 및 사업법 Article 24
- 고압가스 안전관리 및 사업법 Article 26
- 위험물안전관리법 Article 5
- 위험물안전관리법 Article 27

### Gloss
| Korean | Abbreviation | English |
|--------|--------------|---------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 고압가스 안전관리 및 사업법 | HPGSCA | High-Pressure Gas Safety Control and Business Act |
| 위험물안전관리법 | DSSMA | Dangerous Substances Safety Management Act |

## 7. Regulatory Notes
No single dedicated statute governs steelmaking. Composite anchor: 산업안전보건법 (OSHA-KR — risk assessment (Art 36), incident recording and reporting (Art 57), fall/collapse/electrical safety measures (Art 38 with OSHSR Ch.6 — the natural anchor for coil-stack collapse), and mechanical/equipment permit-to-work practice (Art 38 + KOSHA guidance)), 고압가스 안전관리 및 사업법 (HPGSCA — safety-management regulations (Art 11), facility/container safety maintenance (Art 13), Safety Manager appointment (Art 15), corrective measures (Art 24), and accident notification (Art 26) for the high-pressure-gas and hydraulic systems accompanying the rolling line), and 위험물안전관리법 (DSSMA — storage and handling standards (Art 5) and emergency measures (Art 27) for rolling-oil and lubricant dangerous goods). This workflow's `schema.yaml` legal_basis uses the composite auto-filled anchor set listed above.

## 8. Outsourcing Note
Roll change, greasing, and equipment maintenance on the rolling line are heavily outsourced to specialty equipment-maintenance contractors, making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) especially relevant. The commissioning client (the steel mill) must ensure equipment-maintenance, coil-transport, and yard-management subcontractors apply this workflow's controls (LOTO, guard inspection, coil-stacking rules, burn-protection clothing) down the contracting chain.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
