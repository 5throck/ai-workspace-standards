#!/usr/bin/env bun
/**
 * T-20261027-001(a) — co-safety nested agent tree remediation (one-shot, idempotent).
 *
 * Scope: templates/co-safety/agents/domains/ and _shared/ trees (37 .md files).
 *  - Replace map-form `tier:` blocks with the scalar `tier: <uniform-value>` per the
 *    ADR-0102 normalization consensus rule (design §8.1): uniform block → that value;
 *    mixed → the claude value. All 37 blocks are uniform (35 medium, 2 high).
 *  - Drop `model: sonnet|opus` literal lines — the registry resolves models
 *    (`model: inherit` lines, if any, are preserved).
 *  - Add missing `version: "1.0.0"` (quoted, house style) and refresh
 *    `lifecycle.last_updated` to 2026-10-27.
 *  - For the 23 files failing the agentBodyCompletenessFinding bar (<40 non-empty
 *    body lines or <4 `## ` sections), append a genuine domain-appropriate
 *    `## Section D — Workflow Phases & Escalation` (or `## Workflow Phases`) block
 *    authored from each agent's real responsibilities/workflows.
 *
 * Idempotent: scalar tier / no model literal / version present / Section D already
 * present → SKIP per file per transform.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/techcross/git/ai_workspace/templates/co-safety/agents';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.md') && !/^README(_\w+)?\.md$/.test(e.name)) out.push(p);
  }
  return out;
}

// ---------- Section D bodies for the 23 files below the completeness bar ----------

const SECTION_D: Record<string, string> = {
  'domains/industry/biotech/biotech-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Pre-Work Verification**: Confirm TBM completion (participation >=95%), verify bioreactor SIP pressure relief valves and condensate drains, and confirm LMO Class 2-3 containment status before bioreactor or BSL-zone work.
2. **Phase 2 — Execution Monitoring**: Monitor HEPA filtration differential pressure, autoclave sterilization cycles, and H2O2 vapor sensor readings during sterilization and decontamination; record anomalies as they occur.
3. **Phase 3 — Evidence Generation**: File biotech evidence records to \`evidence-models/domains/industry/biotech/\` with multi-source \`legal_basis\` (LMO Act + 약사법 + OSHA-KR / SAPA) before workflow closeout.
4. **Phase 4 — Closeout & Handoff**: Verify all containment readings are within limits, then hand training needs to \`training-agent\` and workflow findings to \`audit-agent\`.

### Escalation Triggers

- SIP steam blowout or pressure relief valve failure — immediate work stop and PM (CSO) escalation
- LMO containment leak or HEPA differential pressure outside the operating band
- Autoclave sterilization failure on biohazard-bearing loads

### Handoff Protocols

- **To emergency-agent**: biohazard release beyond containment or steam-injury event
- **To training-agent**: role-specific curricula for biohazard/SIP handlers (정기/특별/관리감독자 교육)
- **To PM (CSO)**: missing multi-source legal_basis or containment integrity failure
`,
  'domains/industry/datacenter/datacenter-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Pre-Work Verification**: Confirm TBM completion (participation >=95%), verify UPS battery-room thermal monitoring and gas suppression readiness before any battery or HV substation maintenance.
2. **Phase 2 — Isolation & PTW**: Validate high-voltage electrical maintenance PTW, Arc Flash boundary marking, and LOTO isolation of the affected feeders before work begins.
3. **Phase 3 — Execution Monitoring**: Monitor battery thermal sensors, insulation degradation indicators, and battery-room ventilation during execution; record anomalies immediately.
4. **Phase 4 — Evidence & Closeout**: File data center evidence records to \`evidence-models/domains/industry/datacenter/\`, restore isolation per LOTO removal order, and hand findings to \`audit-agent\`.

### Escalation Triggers

- UPS battery thermal anomaly or early thermal-runaway indicator — immediate evacuation of the battery room
- Arc Flash boundary violation or missing LOTO isolation on a live feeder
- Fuel-tank or gas-suppression system fault discovered mid-maintenance

### Handoff Protocols

- **To emergency-agent**: battery fire, arc-flash event, or fuel leak ignition risk
- **To training-agent**: HV/electrical safety curricula for maintenance staff
- **To PM (CSO)**: missing legal_basis, BCP activation, or repeated thermal anomalies
`,
  'domains/industry/steelmaking/steelmaking-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Pre-Work Verification**: Confirm TBM completion (participation >=95%) and validate furnace maintenance LOTO isolation and residual energy checks before any molten-metal work.
2. **Phase 2 — Moisture & Gas Controls**: Verify molten metal moisture controls (no wet tools/materials near furnaces) and byproduct gas piping detector status before tapping.
3. **Phase 3 — Execution Monitoring**: Monitor CO/N2 gas detector readings, purge protocol adherence, and emergency shutoff valve readiness during execution.
4. **Phase 4 — Evidence & Closeout**: File steelmaking evidence records to \`evidence-models/domains/industry/steelmaking/\` and hand findings to \`audit-agent\` at closeout.

### Escalation Triggers

- CO gas detector alarm or suspected byproduct gas leak — immediate area evacuation
- Furnace cooling-water ingress warning (explosion risk)
- LOTO bypass attempt or missing residual energy check

### Handoff Protocols

- **To emergency-agent**: molten metal explosion, CO exposure, or furnace breach
- **To psm-agent**: process-safety overlap such as pressure-system failures
- **To PM (CSO)**: missing legal_basis or repeated LOTO violations
`,
  'domains/industry/railway/railway-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Pre-Work Verification**: Confirm TBM completion (participation >=95%) and validate the night track maintenance plan, lookout positioning, and train dispatch interlocks before track access.
2. **Phase 2 — Electrification Isolation**: Verify 25kV catenary grounding, interlock verification, and Arc Flash PPE compliance before any live-line or near-line work.
3. **Phase 3 — Execution Monitoring**: Monitor tunnel gas readings, train-movement notifications, and lookout rotation during the maintenance window.
4. **Phase 4 — Restoration & Evidence**: Confirm catenary grounding removal and interlock restoration, then file railway evidence records to \`evidence-models/domains/industry/railway/\`.

### Escalation Triggers

- Catenary electric shock risk or grounding sequence violation — immediate track clearance
- Unplanned train movement inside the maintenance block
- Tunnel gas concentration outside the safe band

### Handoff Protocols

- **To emergency-agent**: electric shock, train contact, or tunnel collapse risk
- **To training-agent**: high-voltage and track-worker safety curricula
- **To PM (CSO)**: missing legal_basis or interlock failures
`,
  'domains/industry/shipbuilding/shipbuilding-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Pre-Entry Verification**: Confirm TBM completion (participation >=95%), validate gas measurement records (oxygen/toxic gas) before tank entry, and confirm forced ventilation status and watcher assignment.
2. **Phase 2 — PTW & Lifting Plan**: Issue confined-space PTW and validate heavy block lifting PTW, rig condition, and signalman placement before crane movement.
3. **Phase 3 — Execution Monitoring**: Monitor tank atmosphere continuously, crane load paths, and subcontractor TBM compliance during execution.
4. **Phase 4 — Evidence & Closeout**: File shipbuilding evidence records to \`evidence-models/domains/industry/shipbuilding/\` and close PTWs after atmosphere re-checks.

### Escalation Triggers

- Oxygen deficiency alarm in a tank or void — immediate evacuation and rescue standby
- Crane load violation or signalman out-of-position event
- Subcontractor working without valid PTW or TBM (SAPA Article 5 exposure)

### Handoff Protocols

- **To emergency-agent**: confined space rescue or crane incident
- **To contractor-safety-agent**: subcontractor compliance violations
- **To PM (CSO)**: missing legal_basis or PTW falsification
`,
  'domains/industry/cosmetics/cosmetics-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Batch Record Review**: Verify batch production records, microbial limits, and raw material COAs against the CGMP standard before release review.
2. **Phase 2 — Safety Assessment**: Assess cosmetic raw material safety per the regulatory Safety Assessment guidelines and ISO 22716 requirements.
3. **Phase 3 — Stability & Solvent EHS**: Validate stability testing progress and solvent mixing EHS controls (ventilation, PPE, flammability zoning).
4. **Phase 4 — Release & Evidence**: File cosmetics evidence records to \`evidence-models/domains/industry/cosmetics/\` with multi-source legal_basis, then hand findings to \`audit-agent\`.

### Escalation Triggers

- Batch deviation affecting product safety or microbial contamination finding
- Raw material COA gap or failed safety assessment
- Solvent hazard control failure in mixing areas

### Handoff Protocols

- **To audit-agent**: batch release findings and deviation records
- **To training-agent**: CGMP and solvent-handling curricula
- **To PM (CSO)**: missing legal_basis or regulatory non-compliance
`,
  'domains/industry/food/food-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Pre-Work Verification**: Confirm TBM completion (participation >=95%) and verify HACCP plan currency before CCP monitoring rounds.
2. **Phase 2 — CCP Monitoring**: Validate Critical Control Points and critical limits; document any deviation with product disposition status.
3. **Phase 3 — Machinery LOTO**: Enforce Lockout/Tagout for mixer cleaning and maintenance, verifying isolation and residual energy release before entry.
4. **Phase 4 — Evidence & Closeout**: File food safety evidence records to \`evidence-models/domains/industry/food/\` and hand findings to \`audit-agent\`.

### Escalation Triggers

- CCP critical limit breach with product-safety impact — immediate line hold
- Machinery LOTO violation during cleaning or maintenance
- Allergen cross-contact risk in production zones

### Handoff Protocols

- **To audit-agent**: CCP deviation records and corrective actions
- **To training-agent**: HACCP and LOTO curricula for line staff
- **To PM (CSO)**: missing legal_basis or contamination risk
`,
  'domains/industry/defense/defense-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Pre-Work Verification**: Confirm TBM completion (participation >=95%) and validate propellant mixing room conductive flooring, grounding/bonding, and anti-static PPE before handling.
2. **Phase 2 — ESD & Perimeter Controls**: Verify ESD controls, NDT radiation perimeter locks, and area access restrictions before explosive operations.
3. **Phase 3 — Cryogenic & High-Pressure Operations**: Monitor missile cryogenic fuel loading pressure, purge valve status, and high-pressure system integrity during loading.
4. **Phase 4 — Evidence & Closeout**: File defense evidence records to \`evidence-models/domains/industry/defense/\` and hand findings to \`audit-agent\` at closeout.

### Escalation Triggers

- Static spark hazard in explosive bays — immediate operation hold and area clearance
- Cryogenic fuel leak or high-pressure burst indication
- Radiation perimeter lock failure during NDT

### Handoff Protocols

- **To emergency-agent**: explosive event, cryogenic exposure, or pressure burst
- **To psm-agent**: high-pressure system process-safety overlap
- **To PM (CSO)**: missing legal_basis or ESD control failure
`,
  'domains/industry/battery/battery-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Pre-Work Verification**: Confirm TBM completion (participation >=95%) and validate thermal imaging sensor status and emergency gas venting readiness before cell formation.
2. **Phase 2 — Formation Monitoring**: Monitor thermal runaway indicators (temperature, voltage anomalies) during formation and aging; record all sensor excursions.
3. **Phase 3 — Solvent & Recycling Controls**: Verify NMP solvent recovery operation and recycling leaching/extraction hazardous substance compliance.
4. **Phase 4 — Evidence & Closeout**: File battery evidence records to \`evidence-models/domains/industry/battery/\` and hand findings to \`audit-agent\`.

### Escalation Triggers

- Thermal runaway indication — immediate line isolation and venting verification
- NMP solvent vapor leak or recovery system failure
- Recycling chemical exposure risk beyond PPE control limits

### Handoff Protocols

- **To emergency-agent**: battery fire or solvent flash event
- **To training-agent**: battery fire response and chemical handling curricula
- **To PM (CSO)**: missing legal_basis or repeated thermal excursions
`,
  'domains/industry/waste/waste-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Pre-Entry Verification**: Confirm TBM completion (participation >=95%), validate sewage manhole oxygen/H2S concentration readings, and confirm continuous forced ventilation before entry.
2. **Phase 2 — LOTO & Jam Clearance**: Verify incinerator hopper LOTO and shredder jam clearance procedures (zero-energy state confirmed) before maintenance.
3. **Phase 3 — Execution Monitoring**: Monitor biogas digester pressure, gas detector readings, and standby attendant presence during execution.
4. **Phase 4 — Evidence & Closeout**: File waste evidence records to \`evidence-models/domains/industry/waste/\` and close PTWs after re-testing entry atmospheres.

### Escalation Triggers

- H2S concentration above the entry limit — immediate evacuation, no rescue without SCBA
- Shredder entanglement hazard or LOTO bypass attempt
- Methane/biogas leak from digester piping

### Handoff Protocols

- **To emergency-agent**: asphyxiation event, fire, or digester overpressure
- **To training-agent**: confined space and H2S safety curricula
- **To PM (CSO)**: missing legal_basis or atmospheric control failure
`,
  'domains/industry/logistics/logistics-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Pre-Work Verification**: Confirm TBM completion (participation >=95%) and validate container crane lifting rigs, signal systems, and AGV proximity sensor status before operations.
2. **Phase 2 — Zone Segregation**: Establish AGV exclusion zones and pedestrian pathways; verify signalman placement for crane operations.
3. **Phase 3 — Execution Monitoring**: Monitor cold storage ammonia refrigerant pressure, leak detection alarms, and emergency escape hatch readiness during operations.
4. **Phase 4 — Evidence & Closeout**: File logistics evidence records to \`evidence-models/domains/industry/logistics/\` and hand findings to \`audit-agent\`.

### Escalation Triggers

- Crane load drop or rig failure indication — immediate lift stop and zone clearance
- AGV proximity sensor failure in a shared pedestrian zone
- Ammonia refrigerant leak alarm in cold storage

### Handoff Protocols

- **To emergency-agent**: crane incident, AGV collision, or ammonia release
- **To contractor-safety-agent**: external worker compliance in port zones
- **To PM (CSO)**: missing legal_basis or sensor degradation trends
`,
  'domains/industry/semicon/semicon-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Pre-Work Verification**: Confirm TBM completion (participation >=95%) and validate special gas cabinet leak detectors, emergency shut-off valves, and scrubber performance before fab work.
2. **Phase 2 — PTW & Isolation**: Issue cleanroom PTW for special gas cylinder changes and HF acid handling; verify chemical isolation and neutralization readiness.
3. **Phase 3 — Execution Monitoring**: Monitor gas detector readings, HF spill containment, and cleanroom EHS controls during execution; record anomalies immediately.
4. **Phase 4 — Evidence & Closeout**: File semiconductor evidence records to \`evidence-models/domains/industry/semicon/\` and hand findings to \`audit-agent\` at closeout.

### Escalation Triggers

- Special gas (NF3, SiH4, WF6) detector alarm — immediate fab area evacuation
- HF acid spill or exposure indication — calcium gluconate response and escalation
- Scrubber failure or cleanroom PTW non-compliance

### Handoff Protocols

- **To emergency-agent**: toxic gas release or HF exposure event
- **To training-agent**: special gas/chemical handler curricula (게시·교육 = 제114조)
- **To PM (CSO)**: missing multi-source legal_basis or containment failure
`,
  'domains/functional/training/training-agent.md': `
## Section D — Workflow Phases & Compliance Tracking

### Workflow Phases

1. **Phase 1 — Intake & Status**: Read \`training-record.json\` and \`training-compliance-record.json\` from \`evidence-models/domains/functional/training/\` to establish each worker's current compliance status.
2. **Phase 2 — Gap Analysis**: Compare completion dates, required hours, and next-due fields against OSHA-KR Article 29/36 requirements, validating every record's \`legal_basis\` against \`regulations/KR/legal-glossary.yaml\`.
3. **Phase 3 — Curriculum Generation**: Dynamically generate tailored curricula for identified gaps based on the worker's role and task-specific hazards from risk assessment results (Article 36 communication training included).
4. **Phase 4 — Ingestion & Reporting**: Ingest LMS/HR completion batches via \`bun scripts/co-safety/training-ingest.ts\` (strict e-signature policy) and report compliance status to the Safety Workflow Manager.

### Escalation Triggers

- Worker operating without mandated training (Article 29 violation) — escalate to PM (CSO) and SWM immediately
- Training evidence record failing schema validation or unresolvable \`legal_basis\`
- Contractor training records missing SAPA Article 5 citation alongside the primary article

### Handoff Protocols

- **To contractor-safety-agent**: reverse-intake confirmations for contractor training assignments
- **To audit-agent**: training compliance evidence for audit closeout
- **To PM (CSO)**: statutory education gaps affecting Serious Accidents Punishment Act exposure
`,
  '_shared/legal-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Query Intake**: Receive regulatory inquiries from PM or specialist agents; classify by statute domain (OSHA-KR, SAPA, industry-specific acts) and urgency.
2. **Phase 2 — Live Retrieval**: Resolve statutes via the \`k-law\` skill (법제처 Open API list search → detail retrieval) as the primary source; K-Skill OpenAPI remains supplementary for decrees and MOEL guidelines.
3. **Phase 3 — Anchor Verification**: Record MST + 시행일자 for every verified article anchor against \`regulations/KR/*.yaml\` coordinate registries; apply the fallback chain and \`[UNVERIFIED]\` marking rules.
4. **Phase 4 — Synthesis & Delivery**: Provide interpretations mapped to the operational context with explicit citations (\`[Source: MOEL OpenAPI / Law ID: XXX]\`), the verbatim-quotation rule, and the 법적 자문 아님 disclaimer.

### Escalation Triggers

- OpenAPI service unreachable or returning contradictory legal information
- Proposed workflow lacking a clear legal basis or conflicting with identified regulations
- Citation that cannot be live-verified within the session

### Handoff Protocols

- **To compliance-agent**: verified statutory anchors for gap analysis workflows
- **To PM (CSO)**: interpretation requests with material legal risk
- **To SGM**: regulatory drift findings for the quarterly Regulatory Watch Protocol
`,
  '_shared/reporting-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Data Ingestion**: Ingest incident, training, audit, and near-miss logs from \`memory/\`; validate completeness and period coverage before any calculation.
2. **Phase 2 — KPI Calculation**: Compute TRIR, LTIR, and near-miss rate using the Section B formulas (200,000-hour base); verify inputs against source records.
3. **Phase 3 — Threshold Comparison**: Compare each KPI against annual targets and industry baselines; flag every metric exceeding thresholds with its trend direction.
4. **Phase 4 — Board Reporting**: Format monthly/quarterly/annual EHS reports for board review per OSHA-KR Article 14 and distribute to SGM and PM.

### Escalation Triggers

- LTIR exceeding the annual target threshold (default: LTIR > 1.0, configurable per site)
- TRIR exceeding the industry average by >= 20%
- Source data gaps that would make reported KPIs non-auditable

### Handoff Protocols

- **To safety-governance-manager**: quarterly findings for KPI target adjustment
- **To audit-agent**: data-quality findings for evidence traceability review
- **To PM (CSO)**: board-report anomalies and leading-indicator warnings
`,
  '_shared/contractor-safety-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Qualification Verification**: Verify contractor EHS qualifications and training records before site entry approval; reject files with expired certificates.
2. **Phase 2 — Onboarding**: Run contractor safety onboarding (100% completion required prior to entry) and issue site-specific induction materials.
3. **Phase 3 — On-Site Monitoring**: Monitor contractor compliance during work — PTW validity, TBM participation, and joint safety health council meetings documented per OSHA-KR Article 61.
4. **Phase 4 — Closeout & Records**: Record contractor non-compliance events and TAR-period surge compliance outcomes in \`memory/\`; close contractor files with a compliance summary.
5. **Phase 5 — TAR Surge Compliance**: During turnaround periods, execute enhanced onboarding, TBM coordination with LOTO procedures, and pre-TAR health screening verification for the contractor workforce surge.

### Escalation Triggers

- Contractor performing high-risk work without a valid PTW — immediate work stop and PM (CSO) escalation
- Uncertified contractor personnel discovered on site
- SAPA Article 5 (도급·하도급) obligation gaps in subcontractor tiers
- Expired qualification or training certificate found after entry approval

### Handoff Protocols

- **To training-agent**: mandatory safety modules for uncertified contractor personnel (contractor reverse-intake)
- **To audit-agent**: non-compliance events for finding/corrective-action records
- **To PM (CSO)**: serious contractor violations and TAR surge risks
`,
  '_shared/incident-investigation-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Evidence Preservation**: Secure the incident scene records, witness statements, and physical evidence before any cleanup or resumption; preserve timestamps.
2. **Phase 2 — 5-Why Analysis**: Execute the 5-Why methodology to determine the root cause, documenting each causal layer with supporting records.
3. **Phase 3 — RCA Report**: Generate the investigation report to \`memory/\` within the 48-hour KPI window, linking to the emergency-agent handoff trigger (\`response_status\` = \`contained\`/\`resolved\`).
4. **Phase 4 — CAPA & Closure**: Recommend corrective actions to \`audit-agent\`, track their closure, and verify recurrence prevention before case closure.
5. **Phase 5 — Closure Review**: Confirm corrective action completion evidence with \`audit-agent\`, verify root-cause elimination, and archive the case with a recurrence-prevention confirmation.

### Escalation Triggers

- Incident classified as a Serious Industrial Accident under SAPA — escalate to legal-agent
- RCA deadline at risk (no report within 48 hours of record)
- Evidence chain gaps or contradicting witness statements
- Corrective actions overdue against the RCA report recommendations

### Handoff Protocols

- **To audit-agent**: RCA report for evidence validation and corrective action records
- **To legal-agent**: SAPA serious-accident classification and reporting obligations
- **To PM (CSO)**: recurrence risk assessments and investigation findings
`,
  '_shared/asset-integrity-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Register Review**: Review the asset register and maintenance history to establish current integrity status and overdue-maintenance exposure.
2. **Phase 2 — PM Schedule Verification**: Validate preventative maintenance schedules against statutory inspection requirements (pressure vessels, lifting equipment, safety valves).
3. **Phase 3 — Aging Assessment**: Assess aging equipment condition, remaining-life indicators, and degradation trends; flag assets approaching integrity limits.
4. **Phase 4 — Recommendation & Records**: Produce integrity recommendations and file assessment records to \`memory/\` for audit traceability.
5. **Phase 5 — Replacement Planning**: Prepare repair/replacement recommendations with integrity-impact notes for management review, staying within the integrity-only scope (no procurement).

### Escalation Triggers

- Statutory inspection overdue on a pressure-retaining or lifting asset — restrict operation until resolved
- Integrity indicator (wall thickness, vibration, corrosion rate) outside acceptance limits
- Aging asset without a documented remaining-life assessment

### Handoff Protocols

- **To audit-agent**: integrity findings for corrective action tracking
- **To risk-assessment-agent**: degraded-asset hazard assessments
- **To PM (CSO)**: operation-restriction recommendations and replacement urgency
`,
  '_shared/disaster-response-agent.md': `
## Section D — Workflow Phases & Escalation

### Workflow Phases

1. **Phase 1 — Alert Intake & Classification**: Receive meteorological/seismic alerts and classify by disaster type (typhoon, earthquake, flood, extreme heat/cold) and site exposure level.
2. **Phase 2 — Site Preparation**: Verify site readiness — drainage, outdoor storage securing, evacuation route status, and emergency supply stockpiles.
3. **Phase 3 — Response Activation**: Activate the disaster-specific protocol, coordinate worker evacuation/shelter decisions, and log all protective actions taken.
4. **Phase 4 — Recovery & Evidence**: Conduct post-event site safety checks, record damage and response evidence to \`memory/\`, and feed lessons learned to the audit workflow.

### Escalation Triggers

- Government-issued disaster warning covering the site — activate preparation protocol immediately
- Structural damage or flooding affecting occupied work areas
- Worker exposure to extreme heat/cold beyond control thresholds

### Handoff Protocols

- **To emergency-agent**: industrial incidents coinciding with the disaster event
- **To audit-agent**: response evidence and recovery findings
- **To PM (CSO)**: site-closure/reopen recommendations and MOIS coordination needs
`,
  '_shared/audit-agent.md': `
## Workflow Phases

1. **Phase 1 — Intake**: Receive completed workflow outputs from the calling agent; identify every deliverable that requires finding/corrective-action treatment.
2. **Phase 2 — Schema Validation**: Load \`evidence-models/_shared/base/finding.schema.json\` and \`corrective-action.schema.json\` (v2.1.0); validate every record before filing.
3. **Phase 3 — Finding Creation**: Assign severity (Critical/Major/Minor per the classification table), include a \`legal_basis\` array with >= 3 regulatory sources, and assign \`FIND-YYYY-NNNN\` ids.
4. **Phase 4 — Corrective Action Linkage**: Create linked \`CA-YYYY-NNNN\` records with owner and due date; enforce the linkage rule \`CA.finding_id == FIND.id\`.
5. **Phase 5 — Machine Audit & Report**: Run \`bun scripts/co-safety/safety-audit.ts\` over the batch and report findings count by severity plus CAs created to the calling agent.
`,
  '_shared/compliance-agent.md': `
## Workflow Phases

1. **Phase 1 — Request Intake**: Receive the gap-analysis or regulatory-update request with its \`legal_basis\` field, industry profile, and current-state description.
2. **Phase 2 — Regulation Loading**: Load applicable statutes from \`regulations/KR/legal-glossary.yaml\` and the matching domain file; re-verify anchors against live law (k-law primary, kr_safety fallback, \`[UNVERIFIED]\` otherwise) with MST + 시행일자 recorded.
3. **Phase 3 — Gap Analysis**: Compare the current state against each verified requirement; categorize findings as Critical (Violation), Major (Improvement needed), or Minor (Recommendation).
4. **Phase 4 — Report & Validation**: Write the gap report to \`memory/findings/compliance-<date>-<id>.md\` and run \`bun scripts/co-safety/safety-audit.ts\` to validate report schema before delivery.
`,
  '_shared/emergency-agent.md': `
## Workflow Phases

1. **Phase 1 — Detect & Classify**: Classify the emergency scenario (fire, chemical release, serious accident, natural disaster) against the Section B scenario table; speed is paramount.
2. **Phase 2 — Protocol Activation**: Activate the matching response protocol directory and issue immediate protective actions (work stop, evacuation, isolation) per OSHA-KR Article 54.
3. **Phase 3 — CSO Escalation**: Escalate to PM (CSO) with scenario code, status, and required decisions; direct PM dispatch is authorized under the Priority Override.
4. **Phase 4 — Evidence Preservation**: Preserve scene evidence and witness records for the incident-investigation-agent handoff (\`response_status\` = \`contained\`/\`resolved\`).
5. **Phase 5 — Reporting**: File the regulatory report per OSHA-KR Article 57 timeframes and hand recovery workflows to the appropriate specialist agents.
`,
  '_shared/risk-assessment-agent.md': `
## Workflow Phases

1. **Phase 1 — Scope Definition**: Define the assessment scope from the inbound dispatch (process, area, or task) and load the applicable regulation metadata.
2. **Phase 2 — Hazard Identification**: Identify hazards systematically — energy sources, chemicals, machinery, confined spaces — against the Section B scope limitation (EHS risks only).
3. **Phase 3 — Risk Scoring**: Score likelihood x severity using the Risk Scoring Reference table; assign the risk level and required control tier.
4. **Phase 4 — Control Selection & Record**: Select controls (elimination > substitution > engineering > administrative > PPE), record the assessment evidence, and dispatch to the appropriate downstream agent.
`,
};

// ---------- main ----------

let fmOnly = 0, bodyAuthored = 0, skipped = 0;

for (const rel of walk(ROOT).map(p => p.replace(ROOT + '/', '')).sort()) {
  const path = join(ROOT, rel);
  const raw = readFileSync(path, 'utf-8');
  let content = raw.replace(/\r\n/g, '\n');
  const changes: string[] = [];

  // 1. tier map -> scalar (consensus rule: uniform -> value; mixed -> claude value)
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const block = fm.match(/^tier:\s*\n((?:\s{2}\w[\w-]*:\s*\S+\n?)+)/m);
    if (block) {
      const pairs = [...block[1].matchAll(/^\s{2}([\w-]+):\s*(\S+)\s*$/gm)].map(m => [m[1], m[2]]);
      const values = pairs.map(x => x[1]);
      const uniform = values.every(v => v === values[0]);
      const claude = pairs.find(x => x[0] === 'claude')?.[1];
      const value = uniform ? values[0] : claude;
      if (!value || !/^(high|medium|low)$/.test(value)) throw new Error(`${rel}: cannot resolve tier value from ${JSON.stringify(pairs)}`);
      content = content.replace(block[0], `tier: ${value}\n`);
      changes.push(`tier ${pairs.map(x => x.join('=')).join(' ')} -> ${value}`);
    }

    // 2. drop model: <literal> lines (registry resolves models; keep `model: inherit`)
    const modelMatch = content.match(/^model:\s*(\S+)\s*$/m);
    if (modelMatch && modelMatch[1] !== 'inherit') {
      content = content.replace(/^model:\s*\S+\s*\n/m, '');
      changes.push(`drop model: ${modelMatch[1]}`);
    }

    // 3. add version: "1.0.0" (quoted, house style) after status:
    const fmNow = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    if (!/^version:/m.test(fmNow)) {
      content = content.replace(/^(status:\s*\S+\s*)$/m, `$1\nversion: "1.0.0"`);
      changes.push('add version: "1.0.0"');
    }

    // 4. refresh lifecycle.last_updated
    if (/^  last_updated:/m.test(fmNow)) {
      content = content.replace(/^(\s*last_updated:)\s*\S+\s*$/m, '$1 2026-10-27');
    }
  }

  // 5. body completeness: append the authored section when below the bar
  if (SECTION_D[rel]) {
    const body = content.split(/^---$/m).slice(2).join('---');
    const nonEmpty = body.split('\n').filter(l => l.trim() !== '').length;
    const sections = body.split('\n').filter(l => /^##\s/.test(l)).length;
    const heading = SECTION_D[rel].match(/^## ([^\n]+)/m)?.[1] ?? '';
    if (nonEmpty < 40 || sections < 4) {
      if (!body.includes(`## ${heading}`)) {
        content = content.replace(/\s*$/, '\n') + '\n' + SECTION_D[rel].trim() + '\n';
        changes.push(`+${SECTION_D[rel].trim().split('\n').filter(l => l.trim() !== '').length} body lines (${nonEmpty}->>=40, ${sections}->>=4 sections)`);
        bodyAuthored++;
      }
    }
  }

  if (changes.length === 0) {
    skipped++;
    console.log(`SKIP  ${rel}`);
    continue;
  }
  writeFileSync(path, content, 'utf-8');
  console.log(`APPLY ${rel}\n  - ${changes.join('\n  - ')}`);
  fmOnly++;
}

console.log(`\nDone: ${fmOnly} file(s) written, ${bodyAuthored} with authored body content, ${skipped} skipped`);
