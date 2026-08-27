---
name: emergency-response
description: Trigger emergency response protocol on incident, fire, spill, or injury report
owner: emergency-agent
status: active
version: 1.0.1
metadata:
  triggers:
    - 비상사태
    - emergency
    - 사고 발생
    - 화재
    - 폭발
    - 누출
    - 중대재해
    - serious accident
    - explosion
  agents:
    - emergency-agent
  legal_basis:
    - 산업안전보건법 제54조 (중대재해 발생 시 조치)
    - 중대재해처벌법 제3조 (중대재해 처리 기준)
    - 산업안전보건법 제38조 (안전조치)
scope: workspace
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Emergency Response

## When to Use

Invoke this skill immediately upon any report of an emergency event including: fire, explosion, chemical spill or release, structural collapse, serious injury or fatality, or any condition requiring immediate evacuation. This skill bypasses normal safety-workflow-manager routing and dispatches the emergency-agent directly via PM.

> **Dispatch note**: emergency-agent is dispatched directly by PM — safety-workflow-manager is NOT in the chain for emergency response. Speed of response is paramount.

## Steps

1. **Emergency Classification** — Identify the emergency type from the following categories:
   - Type A: Fire / Explosion
   - Type B: Chemical Spill / Toxic Release
   - Type C: Structural Collapse / Entrapment
   - Type D: Serious Injury / Fatality
   - Type E: Other (specify)
   - Note whether this qualifies as a 중대재해 (serious industrial accident) under 중대재해처벌법

   **Taxonomy Mapping** — the `incident_type` field in the output record MUST be an exact enum value from the matching evidence schema (`evidence-models/emergency/*.json`); record the human-readable Type label separately in `type_label`:

   | Skill Type | E-code | Evidence Schema | Valid `incident_type` Values |
   |---|---|---|---|
   | A — Fire | E-01 | emergency-fire-response-record.json | structural_fire, equipment_fire, chemical_fire, electrical_fire, wildland_fire, other |
   | A — Explosion (gas/vessel/dust) | E-09 | emergency-explosion-gas-record.json | gas_leak, explosion, pressure_vessel_failure, dust_explosion, chemical_explosion |
   | B — Chemical Spill / Toxic Release | E-03 | emergency-chemical-release-record.json | gas_leak, liquid_spill, dust_release, vapor_release, explosive_release |
   | C — Structural Collapse / Entrapment | E-05 / E-06 | emergency-rescue-record.json | confined_space_rescue, high_angle_rescue, trench_rescue, structural_collapse_rescue, water_rescue |
   | D — Serious Injury / Fatality | E-02 overlay (+E-10 if medical response) | emergency-medical-record.json | cardiac_arrest, anaphylaxis, severe_burn, severe_laceration, heat_stroke, hypothermia, chemical_poisoning, stroke, other |
   | E — Other | nearest applicable code below | corresponding schema below | value from that schema |

   Codes not covered by Types A–E: E-04 → emergency-disaster-record.json (typhoon, flood, earthquake, heavy_snow, landslide, wind_storm, extreme_heat, extreme_cold); E-07 → emergency-electrical-record.json (electric_shock, electrocution, arc_flash, electrical_fire, power_outage_critical); E-08 → emergency-mechanical-record.json (caught_in, crush_injury, severe_laceration, amputation, rotary_entanglement, falling_object).

2. **Response Protocol Activation** — Activate the site-specific emergency response plan (ERP). Initiate evacuation if required. Secure the incident area and establish a command post.

3. **Notification** — Notify in the following order:
   - Immediate: Site emergency team, first aiders
   - Within 1 hour: CSO (Chief Safety Officer) / site manager
   - Regulatory: If a 중대재해 (fatality, 3+ simultaneous injuries, or occupational disease requiring 1+ year recovery), notify 고용노동부 (Ministry of Employment and Labor) immediately per 산업안전보건법 제54조
   - SAPA reporting: If qualifying under 중대재해처벌법, notify authorities within the legally prescribed timeframe.

4. **Evidence Preservation** — Do not alter the incident scene except to provide emergency care or prevent further harm. Document: photographs, witness statements, equipment state, environmental conditions, timeline of events.

5. **Post-Incident Report** — Within 24 hours of stabilization, create a preliminary incident record. Once `response_status` reaches `contained`/`resolved`, hand off to `incident-investigation-agent` (per `agents/_shared/emergency-agent.md` §Handoff Protocols) — root cause analysis and the 30-day full investigation report are that agent's responsibility, not emergency-agent's.

## Output Format

Save incident record to `memory/incidents/incident-YYYY-MM-DD-<type>-NNN.md`:

```markdown
# Incident Record
incident_number: INC-YYYY-MM-DD-NNN
incident_type: <enum value from Taxonomy Mapping above>
type_label: <Type A-E>
date_time: YYYY-MM-DD HH:MM
location: <area>
injured_persons: <number and names if applicable>
legal_basis: 산업안전보건법 제54조, 중대재해처벌법 제3조
sapa_qualifying: true | false
status: open | under_investigation | closed

## Initial Report
<narrative description of the emergency>

## Notifications Made
| Recipient | Method | Time | Name |
|-----------|--------|------|------|
| CSO       | Phone  | HH:MM | ... |
| MOEL      | Form   | HH:MM | ... |

## Evidence Log
- [ ] Scene photographs taken
- [ ] Witness statements collected
- [ ] Equipment state documented
- [ ] Environmental conditions recorded

## Corrective Actions
| # | Action | Owner | Due | Status |
|---|--------|-------|-----|--------|

## Investigation Report
Due: YYYY-MM-DD
Completed: YYYY-MM-DD
Root Cause: <RCA summary>
```

## Legal Notes

- 산업안전보건법 제54조 requires employers to immediately halt work and take protective measures upon a serious industrial accident, and to report to the Ministry of Employment and Labor without delay.
- 산업안전보건법 제38조 requires employers to take safety measures (안전조치) against hazards in the workplace — during an emergency this anchors the immediate protective actions taken to prevent harm to workers.
- 중대재해처벌법 제3조 imposes criminal liability on business owners and responsible managers for serious industrial accidents resulting from failure to fulfill safety management obligations.
- Failure to report a qualifying 중대재해 is itself a legal violation independent of the underlying accident.
- This skill provides workflow assistance only and does not constitute legal advice. In a real emergency, prioritize human safety over documentation.
