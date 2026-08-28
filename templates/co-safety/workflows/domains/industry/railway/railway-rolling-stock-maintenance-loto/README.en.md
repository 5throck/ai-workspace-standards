# Railway Industry — Rolling-Stock Depot Maintenance LOTO Workflow

> **Status**: This README was finalized in Phase 2 Group C and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent via MCP `kr_safety` + `legalize_kr`). However, the `signature_hazard` extension in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent moving-vehicle collision/entrapment, bogey/heavy-component lifting incidents, undercarriage (pit) work vehicle-movement hazards, rooftop falls, and energized-part electrocution during electric multiple unit (EMU), passenger coach, and locomotive maintenance at rolling-stock depots by applying the hierarchy of controls. Depot maintenance is fundamentally distinct from fixed-plant Lockout/Tagout: the asset being isolated is a **moving vehicle**, so the primary purpose of LOTO is not equipment energy isolation but **prevention of accidental vehicle movement/runaway** and **control of entry into adjacent live tracks**. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — the only workflow in the codebase that addresses **moving-vehicle (rolling-stock) LOTO**. It is distinct from fixed-plant LOTO (steelmaking `molten-metal-loto`, waste `incinerator-shredder-loto`) and does not duplicate any workflow under `workflows/_shared/`.

## 2. Scope
- **Industry**: Railway (code: `railway`, passenger/freight railway operation and rolling-stock maintenance)
- **Work covered**: EMU/coach/locomotive maintenance and inspection inside depots, bogey disassembly/assembly/lifting, undercarriage pit work, rooftop equipment inspection, detection-maintenance line access, vehicle entry/exit control
- **Trigger points**: Incoming-vehicle safety check, pre-PTW vehicle immobilization and grounding, shift handover, response to abnormal alarms, introduction of a new rolling-stock type

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads depot maintenance risk assessment, operates the safe-work-permit (PTW) system, formulates depot emergency response plans |
| Rolling-Stock Maintenance Supervisor | Verifies vehicle immobilization (wheel chock, hand brake, cut-out), approves PTW, performs cross-checks before entry, halts work on anomaly |
| Electrical Safety Manager | Verifies pantograph/energized-part de-energization and grounding, marks live-track sections, judges adequacy of insulating PPE |
| Worker | Applies wheel chocks/tags, complies with permit conditions, re-confirms immobilization before pit entry, evacuates and reports on anomaly |
| Undercarriage (Pit) Worker | Secures escape routes against accidental vehicle movement, observes lift/jack safe working loads, verifies pit ventilation |
| Industrial Health & Safety Committee | Reviews depot incidents and near-misses, improves protective measures |

## 4. Procedure
1. **Risk assessment**: Identify rolling-stock type (EMU/coach/locomotive), adjacent-track live status, pantograph power state, pit ventilation/lighting, and lift-equipment safe working load. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: De-energize the target track and control movements on adjacent tracks; where feasible, relocate to a detection-maintenance line.
   2. **Passive protection**: Wheel chocks, hand brakes, vehicle cut-out switches, pit covers, lift safety devices.
   3. **Active protection**: Vehicle-movement detection sensors, grounding/discharge interlocks, gas/fire detection.
   4. **Administrative**: Safe-work permit (electrical/mechanical/vehicle), shift-change TBM, keep-out enforcement on adjacent tracks during maintenance.
   5. **PPE**: Insulating gloves/footwear/face shield (electrical), fall-protection harness (rooftop), hard hat/dust mask (pit).
3. **Vehicle immobilization and movement control**: After inbound, apply wheel chocks on both sides of front/rear axles, engage hand brake, open master-controller cut-out, and affix "Maintenance in Progress — Keep Out" Lockout/Tagout devices. Aligns with 철도안전법 (RSA) Article 48 (railway protection and order maintenance).
4. **Catenary/energized parts control**: For rooftop work, de-energize, ground, and Lockout/Tagout the target track; lower the pantograph; verify zero residual energy. Aligns with 산업안전보건법 (OSHA-KR) Article 38 (safety measures — electrical-hazard prevention).
5. **Bogey / heavy-lift safety**: Observe crane/lift rated-capacity markings, inspect lifting-sling adequacy, exclude personnel below the lift, and prevent unbalanced loading.
6. **Undercarriage pit work**: Re-confirm vehicle immobilization before pit entry; secure ventilation, lighting, and emergency escape routes; evacuate immediately if lift support becomes unstable. Aligns with 산업안전보건법 (OSHA-KR) Article 38 (safety measures — fall prevention at pit/rooftop).
7. **Emergency response**: Pre-establish procedures for immediate work stoppage, evacuation, and rescue/ambulance callout on accidental vehicle movement, collision, electrocution, or fall.
8. **Recordkeeping & audit**: Generate the evidence record (§5); retain permits, inspection sheets, and vehicle-immobilization verification logs.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/railway/railway-railway-rolling-stock-maintenance-loto-record.json`](../../../../../evidence-models/domains/industry/railway/railway-railway-rolling-stock-maintenance-loto-record.json) (skeleton, `status: draft`)

- **Record ID format**: `RAILWAY-ROLLING-STOCK-MAINTENANCE-LOTO-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as rolling-stock type (EMU/coach/locomotive), wheel-chock/hand-brake verification, pantograph grounding state, pit ventilation/lighting, and lift safe-working-load.

## 6. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated).

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 철도안전법 Article 45
- 철도안전법 Article 48
- 산업안전보건법 Article 38 (추락 등 위해 방지 안전조치)
- 안전보건기준에관한규칙 (감전 등 전기 재해 방지 기준)

### Gloss
| Korean | Abbreviation | English |
|--------|--------------|---------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 철도안전법 | RSA | Railway Safety Act |

## 7. Regulatory Notes
No single dedicated statute governs rolling-stock depot maintenance. Composite anchor: 철도안전법 (RSA — track/depot operating standards, railway-protection-zone restrictions Article 45, railway protection and order maintenance Article 48) as the baseline, overlaid with 산업안전보건법 (OSHA-KR — maintenance-worker protection, fall/electrical safety measures Article 38 with OSHSR standards). 중대재해처벌법 (SAPA) Articles 4–7 supply the general employer safety-assurance duty. The defining feature of this workflow is **moving-vehicle (rolling-stock) LOTO**, distinct from fixed-plant LOTO (steelmaking molten-metal/furnace, waste incinerator/shredder): the primary purpose of vehicle LOTO is prevention of accidental movement and adjacent-track access control, not equipment energy isolation. Bridge/viaduct work (RSA Art 45) and track/tunnel work (RSA Art 48) are covered by separate workflows (`railway-bridge-viaduct-fall-prevention`, `rail-track-confined-maintenance`).

## 8. Outsourcing Note
Rolling-stock heavy maintenance (overhaul) and depot-facility maintenance are heavily outsourced, making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) especially relevant. The operator (railway corporation or private operator) must ensure this workflow's vehicle-immobilization and Lockout/Tagout controls are applied by maintenance contractors and facility subcontractors down the contracting chain. Where multiple contractors work simultaneously inside the same depot, the scope overlap and adjacent-track access-control responsibilities must be explicitly assigned.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
