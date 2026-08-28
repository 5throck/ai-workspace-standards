# Railway Industry — Bridge/Viaduct Fall Prevention Workflow

> **Status**: This README was finalized in Phase 2 Group C and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent via MCP `kr_safety` + `legalize_kr`). However, the `signature_hazard` extension in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent high-elevation falls, water/gorge rescue hazards, weather/wind-driven work stoppage, and dropped-object (tool/component) struck-by incidents during inspection and maintenance of railway bridges and viaducts by applying the hierarchy of controls. Railway bridge/viaduct work differs from generic building high-work because the structure spans **rivers, gorges, or live railway tracks**, making water-rescue contingency and wind/weather work limits the defining control elements. Korea's major railway bridges (Han-river railway bridge, Yeongsan-river bridge) and mountain viaducts (Jungang/Jeolla-line alpine sections) are representative high-risk height-work assets. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — a railway-industry-specific bridge/viaduct fall-prevention procedure that does not duplicate any shared high-work workflow under `workflows/_shared/`. It is distinct from track/tunnel confined-space (`rail-track-confined-maintenance`) and depot maintenance (`railway-rolling-stock-maintenance-loto`).

## 2. Scope
- **Industry**: Railway (code: `railway`, passenger/freight railway operation and track/structure maintenance)
- **Work covered**: Steel/concrete bridge inspection and maintenance, viaduct deck/side/underside work, pier inspection, signal/communication cable height work, cleaning/painting/NDT inspection, work over rivers/gorges
- **Trigger points**: Periodic structure inspection cycles, post-event (earthquake/flood/lightning-strike) inspection, bridge repair construction, weather/wind work-stoppage decisions

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads height-work risk assessment, operates the safe-work-permit (PTW) system, sets weather-monitoring and work-stoppage criteria, formulates water-rescue contingency plans |
| Bridge Maintenance Supervisor | Verifies bridge/viaduct structural safety before work, directs installation of safety harnesses and fall-arrest nets, performs cross-checks before entry, halts work on weather deterioration |
| Height Worker | Wears full-body harness, hard hat, and fall-protection equipment; verifies anchor-point adequacy; complies with permit conditions |
| Structural Engineer | Assesses bridge/viaduct structural integrity, interprets crack/corrosion NDT results, designs repair scope |
| Water Rescue Team | Stands by with rescue equipment during over-water/gorge work, initiates immediate rescue on fall |
| Industrial Health & Safety Committee | Reviews height-work incidents and near-misses, improves protective measures |

## 4. Procedure
1. **Risk assessment**: Identify bridge/viaduct work height, river/gorge water depth and current, lower-level train operations, wind/weather forecast, structural deterioration and cracking, and night-visibility constraints. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: Install permanent inspection facilities (walkways, inspection vehicles) at the design stage; evaluate whether height work can be replaced by ground-level or vehicle-mounted work.
   2. **Passive protection**: Fall-arrest nets, scaffolds, handrails, anchor rails/lifelines for harness attachment.
   3. **Active protection**: Wind-speed monitoring alarms, dropped-object protective covers, train-approach warning systems.
   4. **Administrative**: Safe-work permit (height), weather work-stoppage criteria (wind/precipitation/lightning), shift-change TBM, work-zone control.
   5. **PPE**: Full-body harness, hard hat, shock-absorbing double lanyard, slip-resistant footwear.
3. **Fall prevention**: Verify anchor-point adequacy (safety hook/rail) before work; install fall-arrest nets; maintain continuous harness attachment for work at or above 2 m. Aligns with 산업안전보건법 (OSHA-KR) Article 38 (safety measures — fall prevention for bridges/viaducts).
4. **Weather/wind work limits**: Halt all height work at wind speeds ≥10 m/s, during rain/lightning, or on visibility degradation. Operate a weather-monitoring system and pre-define work-stoppage authority.
5. **Water rescue contingency**: Stand by with lifejackets/rescue boats during over-water/gorge work; pre-notify the water-rescue team; pre-establish immediate rescue procedures on fall.
6. **Train approach control**: Adjust work windows around lower-level train operations, activate train-approach warning systems, and apply dropped-object controls. Aligns with 철도안전법 (RSA) Article 45 (railway-protection-zone restrictions — bridge structures).
7. **Dropped-object prevention**: Secure tools/components with retention straps, keep work platforms tidy, and define exclusion zones below.
8. **Emergency response**: Pre-establish procedures for immediate work stoppage, evacuation, and rescue/ambulance/fire callout on fall, water rescue, lightning strike, or structural collapse.
9. **Recordkeeping & audit**: Generate the evidence record (§5); retain permits, weather-monitoring logs, inspection sheets, and structural NDT results.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/railway/railway-railway-bridge-viaduct-fall-prevention-record.json`](../../../../../evidence-models/domains/industry/railway/railway-railway-bridge-viaduct-fall-prevention-record.json) (skeleton, `status: draft`)

- **Record ID format**: `RAILWAY-BRIDGE-VIADUCT-FALL-PREVENTION-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as work height, anchor-point type, wind/weather records, water-rescue standby status, and structural crack/NDT results.

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
No single dedicated statute governs railway bridge/viaduct inspection and maintenance. Composite anchor: 철도안전법 (RSA — railway-protection-zone restrictions Article 45 covering bridge structures, railway protection and order maintenance Article 48) as the baseline, overlaid with 산업안전보건법 (OSHA-KR — fall/electrical safety measures Article 38 with OSHSR technical standards, inspection-work safety Article 57). 중대재해처벌법 (SAPA) Articles 4–7 supply the general employer safety-assurance duty. The defining feature of this workflow is the **height + water-rescue + weather** composite hazard profile, distinct from generic building height work (which also cites OSHA-KR Article 38). Depot maintenance (`railway-rolling-stock-maintenance-loto`) centers on vehicle LOTO; track/tunnel work (`rail-track-confined-maintenance`) centers on confined-space and train-approach hazards — this workflow is purpose-built for the **open-air height + water** profile unique to railway bridges/viaducts.

## 8. Outsourcing Note
Railway bridge/viaduct repair construction and height-inspection services are heavily outsourced, making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) especially relevant. The operator (railway corporation or facility-management authority) must ensure this workflow's fall-prevention, weather-stoppage, and water-rescue controls are applied by repair contractors and inspection-service subcontractors down the contracting chain. In particular, the commissioning client must verify the contractor's height-work license, safety-officer appointment, and water-rescue notification procedures before work begins.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
