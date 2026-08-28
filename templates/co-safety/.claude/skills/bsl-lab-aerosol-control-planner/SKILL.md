---
name: bsl-lab-aerosol-control-planner
owner: biotech-agent
scope: workspace
status: active
description: Plan bioaerosol and sharps-injury control for BSL-2/3 laboratory handling of biohazardous agents — inoculation, centrifugation, pipetting, biological safety cabinet (BSC) operation. BSC selection/certification, sealed centrifuge cups, engineered sharps, PI/IRB governance per BSA Art 13 [UNVERIFIED-flagged], exposure medical surveillance.
version: "1.0.0"
created: "2026-08-07"
last_updated: "2026-08-07"
metadata:
  triggers:
    - BSL-2 BSL-3 실험실 에어로졸
    - bsl lab bioaerosol control
    - 생물안전캐비닛 BSC 작업
    - biological safety cabinet certification
    - 원심분리 에어로졸 밀폐
    - centrifuge sealed cup aerosol
    - 샤프스 재해 예방
    - sharps injury prevention needlestick
    - BSA Article 13 IRB 심의
    - LMO법 Article 22 밀폐관리
    - 생물유해인자 취급 작업
    - biohazard agent lab practice
  legal_basis:
    - 산업안전보건법 제39조
    - 산업안전보건법 제38조
    - 중대재해처벌법 제4조
    - 생물안전법 제13조 [UNVERIFIED]
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# BSL Lab Aerosol Control Planner Skill

## Overview

Bioaerosol and sharps-injury control planner for BSL-2/3 laboratory work-
practices — the WORK-PRACTICE-LEVEL discipline at the lab bench, distinct
from the FACILITY-LEVEL containment integrity covered by `lmo-biohazard-
containment` (which governs the LMO-Act Art 22 밀폐관리 facility shell for
genetically-modified organisms).

The biotech industry anchor
(`regulations/KR/industry-regulatory-anchors.yaml` lines 185-228) names
**생명윤리 및 안전에 관한 법률 (BSA) Article 13 (기관생명윤리위원회 IRB 심의)**
and **BSA Article 16 (연구대상자 동의)** as primary-statute articles — cited
by ZERO existing biotech workflows prior to the `biotech-bsl-lab-aerosol-
control` workflow (Task 21, 2026-08-07). The anchor also names **LMO-Act
Article 22 (밀폐관리)** and OSHA-KR Article 38.

> **[UNVERIFIED] flag**: BSA Art 13/16 and LMO-Act Art 22/24 are flagged
> `[UNVERIFIED-via-legalize-kr]` in the biotech anchor (legalize_kr index
> gap). Article numbers are sourced from `Bioethics-and-Safety-Act.yaml`
> and `LMO-Transboundary-Movement.yaml` (originally from mcp-kr-legislation)
> and are stable, but cannot be re-verified live via `legalize_kr.parse_law_structure`
> this session. Compliance-agent must pre-screen before sign-off.

## Korean Biotech Lab Context

### Why BSL-2/3 lab work-practice is distinct

| Factor | Facility containment (LMO WF) | Lab bench work-practice (this skill) |
|--------|-------------------------------|--------------------------------------|
| Scope | Building shell, HVAC, pressure | Operator technique, BSC, sharps |
| Reg anchor | LMO-Act Art 22 (밀폐관리) | BSA Art 13 (IRB governance) + OSHA-KR Art 38 |
| Failure mode | Slow facility drift | Acute inoculation / aerosol event |
| Frequency | Commissioning + annual | Every single procedure |
| Fix | Engineer rebuild | Train + enforce + certify |

Facility integrity is necessary but NOT sufficient. The same BSL-3 suite
that passes annual pressure-decay testing can produce a fatal sharps injury
in a worker who recaps a needle. Work-practice discipline is the daily
defense; facility integrity is the backdrop.

### Hazard profile (from biotech regulatory anchor)

- **BSA Art 13** (UNCITED by existing WFs, [UNVERIFIED-flagged]) — IRB 심의:
  Institutional Review Board must review protocols involving biohazardous
  agents before work begins
- **LMO-Act Art 22** ([UNVERIFIED-flagged]) — 밀폐관리: facility containment
  (referenced as the backdrop this skill operates within)
- **OSHA-KR Art 38** — 유해물·위험물 취급: hazardous-substance handling
- **OSHA-KR Art 36** — 위험성평가: mandatory risk assessment for the lab

## Hazard Scenarios Covered

### 1. BSC aerosol generation during inoculation / looping

- Loop inoculation of agar plates — micro-droplet release
- Pipetting against the vessel wall — droplet + aerosol
- Lyophilized culture reconstitution — significant aerosol pulse
- Sonication of cultures outside BSC — **prohibited** (use sealed cup
  sonicator inside BSC)

### 2. Centrifugation tube rupture

- High-speed centrifuge tube failure — massive aerosol release inside rotor
- Opening a rotor that contained a ruptured tube without first waiting for
  aerosol settling
- Sealed safety-cup interlock failure — cup opens under rotation

### 3. Sharps injury

- Needle recapping — **prohibited** (use one-handed scoop or engineered
  retractable needle)
- Scalpel blade removal by hand — use forceps + puncture container
- Broken glass cleanup — use mechanical pickup, never bare hands
- Pasteur pipette breakage during inoculation

### 4. Spill outside the BSC

- Culture spilled on bench / floor — aerosol + contact hazard
- Drop event at the BSC sash — droplet spread beyond BSC air curtain

### 5. BSL-3 increment (additive to BSL-2)

- Gas-tight suit or half-mask respirator for entry
- Double-door autoclave for waste egress
- Directional airflow (negative pressure cascade) verification before each
  entry

## Bioaerosol / Sharps Control Hierarchy (BSL-specific)

### 1. Elimination

- Substitute non-infectious surrogate (attenuated strain, killed vaccine)
  whenever scientifically valid
- Recombinant expression instead of native pathogen culture
- Centrifuge whole-unit sealed cups to make rupture-recovery deterministic

### 2. Engineering controls (preferred over PPE)

- **Biological Safety Cabinet (BSC)** — Class II A2 for BSL-2, Class II B2
  or III for BSL-3 (per NSF/ANSI 49 or equivalent KOSHA guidance)
- **Sealed centrifuge safety cups** for any agent requiring BSL-2+
- **Engineered sharps devices** — retractable needles, self-sheathing
  scalpels, needleless transfer ports
- **Puncture-resistant sharps containers** at every BSC exit point
- **BSC annual certification** (HEPA integrity, inflow velocity, downflow
  velocity) by a qualified certifier — and after any move

### 3. Administrative controls

- **IRB review per BSA Art 13 [UNVERIFIED-flagged]** — protocol must be
  approved before agent handling begins
- **PI (Principal Investigator) sign-off** on every new procedure + agent
- **Risk assessment per OSHA-KR Art 36** — documented before introducing a
  new agent
- **Buddy system** for BSL-3 entry; two-person rule for high-consequence
  pathogens
- **Exposure medical surveillance** — hep B vaccination for BSL-2 workers
  handling bloodborne agents; post-exposure prophylaxis (PEP) protocol
- **Respirator fit-test** annual for half-mask / PAPR users
- **TBM** before each shift — see shared TBM workflow

### 4. PPE

- Solid-front gown (tie-back), dedicated to the BSC zone, discarded at exit
- Nitrile gloves (double-glove for sharps procedures)
- Eye protection (safety glasses / goggles) for splash risk
- N95 / PAPR for BSL-3 aerosol-prone procedures outside BSC (rare; most
  work stays inside BSC)

## Planning Workflow

1. **Agent characterization** — BSL level, route of transmission, infectious
   dose, availability of vaccine / PEP
2. **IRB / PI governance per BSA Art 13 [UNVERIFIED-flagged]** — protocol
   approved before work begins
3. **Risk assessment per OSHA-KR Art 36** — documented hazard assessment
   for the specific procedure
4. **BSC selection + certification verification** — class match to BSL,
   annual cert valid, inflow velocity within spec on the day of work
5. **Centrifuge sealed-cup verification** — cup seal tested, rotor inspected
   for cracks, load balanced
6. **Sharps protocol** — engineered devices selected, no-recapping rule
   posted, puncture containers within arm's reach
7. **Spill kit staging** — fresh 1:10 bleach, absorbent, tongs, biohazard
   bag, posted spill procedure
8. **Medical surveillance** — vaccination status verified, PEP pathway
   confirmed with occupational-health clinic
9. **Execution + PI oversight** — PI or designate observes first run of any
   new procedure
10. **Decontamination + waste** — autoclave cycle validated, waste
    manifested to biohazard disposal stream
11. **Post-procedure exposure check** — any needlestick or splash triggers
    immediate PEP pathway + OSHA-KR Art 57 incident recording

## Output

```json
{
  "plan_id": "bio-bslcp-2026-08-07-001",
  "lab": "BSL-3 Suite 4 Room 207",
  "agent": "Mycobacterium tuberculosis H37Rv",
  "bsl_level": 3,
  "procedure_type": "aerosol_challenge_centrifugation",
  "workers_exposed": 2,
  "governance": {
    "irb_approved_per_bsa_art13": true,
    "irb_protocol_id": "IRB-2026-0147",
    "pi_signoff": "김연구 PI",
    "risk_assessment_per_osha_art36": "RA-2026-08-07-088",
    "bsa_art13_verification_flag": "[UNVERIFIED-via-legalize-kr] — statute-file sourced from Bioethics-and-Safety-Act.yaml; compliance-agent must pre-screen"
  },
  "engineering_controls": {
    "bsc_class": "II_B2",
    "bsc_certification_date": "2026-06-15",
    "bsc_cert_valid_days": 365,
    "centrifuge_sealed_cup": true,
    "rotor_inspection_date": "2026-08-06",
    "engineered_sharps": "retractable_needle_retraction_syringe"
  },
  "medical_surveillance": {
    "hep_b_vaccination_current": true,
    "pep_pathway_confirmed": "occupational_health_clinic_3f",
    "respirator_fit_test_current": true
  },
  "spill_kit_staged": true,
  "regulatory_basis": [
    "생명윤리 및 안전에 관한 법률 (BSA) Article 13 — 기관생명윤리위원회 IRB 심의 [UNVERIFIED-via-legalize-kr]",
    "유전자변형생물체의 국가간 이동 등에 관한 법률 (LMO-Act) Article 22 — 밀폐관리 [UNVERIFIED-via-legalize-kr]",
    "산업안전보건법 (OSHA-KR) Article 38 — 유해물·위험물 취급",
    "산업안전보건법 (OSHA-KR) Article 36 — 위험성평가",
    "중대재해처벌법 (SAPA) Article 4 — 사업주 안전보장 의무"
  ],
  "acceptance_status": "ready_to_execute"
}
```

## Korean-Specific Standards

- **생명윤리 및 안전에 관한 법률 (BSA) Article 13** — 기관생명윤리위원회 (IRB)
  심의 [UNVERIFIED-flagged in anchor; compliance pre-screen required]. No
  biohazardous-agent protocol may proceed without IRB approval.
- **LMO-Act Article 22** — 밀폐관리 (containment) [UNVERIFIED-flagged]. This
  skill operates WITHIN a facility that has already satisfied Art 22; it
  does NOT re-verify facility integrity (that is the `lmo-biohazard-
  containment` WF scope).
- **OSHA-KR Article 38** — 유해물·위험물 취급 (hazardous-substance handling)
- **OSHA-KR Article 36** — 위험성평가 (risk assessment)
- **KOSHA guidance** — BSC certification frequency (annual + post-move) and
  performance envelope follow NSF/ANSI 49 by convention
- **Biotech-specific**: Korean IRB review cycle for BSL-3 protocols
  typically runs 4–8 weeks; plan protocol submission lead-time accordingly

## Integration

- **Input from**: biotech protocol, agent spec sheet, BSC certification
  report, IRB protocol approval letter
- **Output to**: `biotech-bsl-lab-aerosol-control-record.json` (the evidence
  model for the `biotech-bsl-lab-aerosol-control` workflow)
- **Coordinated skills**:
  - `lmo-biohazard-containment` (existing biotech WF) — FACILITY-LEVEL
    containment integrity under LMO-Act Art 22; this skill assumes that
    facility is already certified
  - `biotech-biological-spill-response` (newly-generated biotech WF) — the
    RESPONSE-phase counterpart to this PREVENTIVE skill
  - `permit-to-work` (daily) — generic permit issuance
  - `tool-box-meeting` (TBM) — pre-work briefing record
- **Escalation**: If BSC certification is expired OR a sealed centrifuge
  cup is unavailable OR PEP pathway is not confirmed, halt work and
  escalate to PI + lab safety officer before any agent handling begins.

## Non-Duplication Justification

vs. `lmo-biohazard-containment` (existing biotech WF): that addresses
FACILITY-LEVEL containment integrity under LMO-Act Art 22 밀폐관리 for
genetically-modified organisms (the building shell, HVAC, pressure cascade).
This skill addresses WORK-PRACTICE-LEVEL aerosol and sharps control at the
lab bench for the broader BSL-2/3 agent class (including native pathogens
that are not GMOs), citing BSA Art 13 IRB governance which the existing WF
does NOT cite.

vs. `bioreactor-sterilization-safety` (existing biotech WF): that addresses
pressure/thermal hazards during steam-in-place (SIP) sterilization of the
bioreactor vessel — entirely different hazard class (pressure/thermal vs.
bioaerosol/sharps).

vs. `biotech-biological-spill-response` (newly-generated biotech WF): that
is the RESPONSE-phase counterpart for active spill incidents. This skill is
the PREVENTIVE-phase planner. Same preventive-vs-response split as the
Group A semicon `silane-gas-leak-response` pattern.

## Legal Disclaimer

> 자동화 계획 보조. 최종 생물안전 조치 결정은 PI + 기관생명윤리위원회 (IRB) +
> 안전관리자 권한 per 생명윤리 및 안전에 관한 법률 (BSA) Article 13
> [UNVERIFIED-flagged] and 산업안전보건법 (OSHA-KR) Article 38. BSC
> certification and BSL-3 facility integrity MUST be verified by a qualified
> biosafety officer before any agent handling begins.
