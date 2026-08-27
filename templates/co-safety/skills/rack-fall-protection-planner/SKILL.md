---
name: rack-fall-protection-planner
owner: datacenter-agent
scope: workspace
status: active
description: Plan fall protection for datacenter white-space work-at-height — 42U-52U server-rack install, overhead cable trays, top-of-rack switching, raised-floor tile access. Anchor selection, ladder vs. rolling work-platform, restraint vs. arrest systems.
version: "1.0"
created: "2026-08-07"
last_updated: "2026-08-07"
metadata:
  triggers:
    - 데이터센터 추락 방지
    - 서버 랙 설치 작업
    - rack install fall protection
    - overhead cabling work-at-height
    - top-of-rack 작업
    - 제상플로어 접근
    - raised-floor tile handling
    - datacenter work-at-height plan
    - 랙 설치 사다리 선택
    - rack anchor point rating
  legal_basis:
    - "산업안전보건법 제38조 (안전조치 — 추락 위험 방지 포함)"
    - "산업안전보건기준에 관한 규칙 제42조 (추락의 방지 — 난간·추락방호망·안전대)"
    - "전기안전관리법 제16조 (전기재해 예방을 위한 안전조치 — 활선 인접 랙 작업)"
    - "중대재해처벌법 제4조 (사업주 안전보건 확보의무)"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Rack Fall Protection Planner Skill

## Overview

Datacenter white-space work-at-height fall-protection planner. Covers the four
pervasive fall-exposure scenarios unique to datacenter operations — server-rack
installation (42U-52U cabinets ~2 m+), overhead cable-tray work, top-of-rack
(TOR) switching, and raised-floor tile access — none of which are addressed by
generic construction fall-protection skills.

The general construction skill `fall-hazard-assessor` covers building leading
edges, rooftops, and excavation edges. It does NOT cover the datacenter
white-space environment, where (a) there are no permanent anchor points, (b)
the raised floor is a trip-and-collapse hazard rather than a fall-arrest
anchor, (c) hot-aisle / cold-aisle geometry restricts ladder placement, and
(d) rack frames are typically NOT rated as anchor points.

## Korean Datacenter Fall Context

### Hazard profile (from datacenter regulatory anchor)

The datacenter industry anchor
(`regulations/KR/industry-regulatory-anchors.yaml` lines 309-315) names two
OSHA-KR hazards: **Article 38 (추락 방지 포함 안전조치 — fall prevention during racking/cabling)**
and OSHSR electrical standards. Article 38 is the only anchor-cited datacenter hazard
with no corresponding workflow or skill prior to the
`rack-cabling-fall-protection` workflow (Task A-04, 2026-08-07).

### Why datacenter work-at-height is distinct

| Factor | Construction site | Datacenter white-space |
|--------|-------------------|------------------------|
| Anchor points | Building columns, engineered anchors | NONE permanent — rack frames not rated |
| Work surface | Concrete slab / structure | Raised-floor tiles (collapse hazard) |
| Height range | 2-50 m+ | 1-3 m (low-height, high-frequency) |
| Geometry | Open leading edges | Hot/cold aisle constraints, narrow flue gaps |
| Co-located energy | Generally no | Live 208/400 V busway, fiber, water lines |
| Frequency | Project-based | Daily operations (install/maint/upgrade) |

Low fall height (1-3 m) is deceptive — it accounts for the majority of lost-
time datacenter injuries because of awkward posture inside cold aisles and
unplanned descent onto hard slab or rack corners.

## Hazard Scenarios Covered

### 1. Server-rack installation (42U-52U, ~2 m+)

- Unboxing / lifting the rack onto the slab (heavy-load, awkward-grip fall risk)
- Rail extension and server insertion at shoulder-to-overhead height
- Top-of-rack (TOR) switch / patch panel install at maximum reach
- Standing on the rack frame or rack PDUs to reach the top — **prohibited**

### 2. Overhead cable-tray work

- Ladder work along overhead tray runs (typically 2.7-3.3 m AFF)
- Pulling copper/fiber bundles across multiple racks
- Tray-to-rack vertical drop termination

### 3. Raised-floor tile access

- Tile removal for sub-floor cabling / power-whip install
- Reach into the sub-floor plenum (kneeling + leaning = tip-in hazard)
- Tile replacement (finger pinch + dropped-tile laceration)

### 4. Ladder work in aisles

- Step-ladder vs. extension-ladder vs. rolling work-platform selection
- Ladder foot placement on anti-static tile (slip vs. tile-crush)
- Three-point-contact discipline while handling fiber/copper

## Fall-Protection Hierarchy (datacenter-specific)

### 1. Elimination

- Pre-populate top-of-rack hardware at the integration lab before deployment
- Use tool-less hardware that minimizes overhead-reach time
- Pre-terminate sub-floor cabling before floor tiles are re-installed

### 2. Engineering controls (preferred over PPE)

- **Rolling work-platform** with locking casters and guardrail — the default
  elevated-work device for rack install (NOT a step-ladder)
- **Mobile anchor post** on a weighted base — engineered for 22 kN arrest load
- **Powered vertical lift** (scissor lift) for cable-tray runs in co-location
  halls with sufficient slab clearance

### 3. Active fall protection (when engineering controls are infeasible)

- **Restraint system** (preferred over arrest) — lanyard length tuned so the
  worker cannot physically reach the leading edge of the work platform
- **Self-retracting lifeline (SRL)** if arrest is unavoidable
- **Anchor**: NEVER the rack frame (rated for equipment weight, not 22 kN
  arrest load). Use a mobile anchor post or building-engineered anchor only.

### 4. Administrative controls

- **Work-permit (작업허가서)** for any work above 2 m per OSHA-KR Article 38
- **Tool-box talk (TBM)** before each shift — see shared TBM workflow
- **Buddy system** — second worker as spotter + 119 caller
- **De-energize adjacent busway** if work reaches within 1 m of live 208/400 V

### 5. PPE

- Full-body harness certified per KOSHA 안전검사 합격품
- Hard hat with chin strap (overhead cable-tray work — dropped-object hazard)
- Safety footwear (sub-floor debris + dropped-tool protection)
- Anti-fatigue gloves (pinch-point protection at rail / server slides)

## Planning Workflow

1. **Work-zone characterization** — aisle width, slab clearance, busway
   proximity, raised-floor condition
2. **Anchor survey** — confirm no permanent anchor; deploy mobile anchor post
3. **Equipment selection** — rolling work-platform > step-ladder > extension
4. **Restraint vs. arrest decision** — prefer restraint if leading-edge reach
   can be physically prevented
5. **Co-located energy review** — de-energize or guard adjacent busway / water
6. **Permit + TBM** — 작업허가서 issued, TBM conducted and signed
7. **Execution + spotter** — second worker positioned for fall-arrest rescue
8. **Post-work walk-down** — tiles re-seated, hardware torqued, no debris
9. **Rescue plan** — suspension-trauma response within 10 minutes per KOSHA

## Output

```json
{
  "plan_id": "dc-rfpp-2026-08-07-001",
  "site": "DC-1 Hall B Row 12",
  "task_type": "rack_install_top_of_rack",
  "work_height_m": 2.1,
  "workers_exposed": 2,
  "hazard_scenarios": ["server_rack_install_42U", "top_of_rack_switch"],
  "elimination_opportunities": ["pre-populate TOR at integration lab"],
  "engineering_controls": {
    "primary": "rolling_work_platform_with_guardrail",
    "anchor": "mobile_anchor_post_weighted_base",
    "anchor_rating_kN": 22
  },
  "active_protection": {
    "type": "restraint",
    "lanyard_length_m": 1.8,
    "leading_edge_reachable": false,
    "anchor_used": "mobile_anchor_post"
  },
  "co_located_energy": {
    "busway_de_energized": true,
    "water_line_guarded": true
  },
  "administrative": {
    "permit_issued": true,
    "permit_id": "WP-2026-08-07-0142",
    "tbm_conducted": true,
    "spotter_assigned": "worker_2"
  },
  "rescue_plan_ref": "DC-1-ERP-2026-suspension-trauma",
  "regulatory_basis": [
    "산업안전보건법 (OSHA-KR) Article 38 — 추락 등 위해 방지 안전조치",
    "전기안전관리법 (ESCA) Article 16 — 전기재해 예방 안전조치",
    "중대재해처벌법 (SAPA) Article 4 — 사업주 안전보장 의무"
  ],
  "acceptance_status": "ready_to_execute"
}
```

## Korean-Specific Standards

- **산업안전보건법 (OSHA-KR) Article 38** — 작업장 추락 등 안전조치 (mandatory
  fall-prevention measures; 2 m threshold for active protection)
- **KOSHA 안전검사 합격품** — harnesses, lanyards, SRLs must carry the KOSHA
  certification mark
- **119 구조대 연계** — suspension-trauma rescue relies on rapid 119 dispatch
- **Datacenter-specific**: most Korean co-location halls require the tenant's
  작업허가서 to be countersigned by the facility's electrical safety manager
  (전기안전관리자 per ESCA Art 22) before any rack work begins

## Integration

- **Input from**: datacenter work-order, rack-elevation drawing, busway layout
- **Output to**: `datacenter-rack-cabling-fall-protection-record.json` (the
  evidence model for the `rack-cabling-fall-protection` workflow)
- **Coordinated skills**:
  - `fall-hazard-assessor` (ehsconst) — for building/structural fall hazards
    outside the white-space (mechanical-room roof, chiller pad)
  - `tool-box-meeting` (TBM) — pre-work briefing record
- **Escalation**: If no engineered anchor is available AND busway cannot be
  de-energized, halt work and escalate to site 전기안전관리자

## Non-Duplication Justification

vs. `fall-hazard-assessor` (ehsconst): that skill addresses construction-site
leading edges, rooftops, and excavation edges where permanent anchors and
guardrails are the norm. It does NOT cover the datacenter white-space
environment (no permanent anchors, raised-floor tile hazard, hot/cold aisle
constraints, co-located live busway). The work-height regime is also different
(1-3 m low-height high-frequency vs. 2-50 m+ construction).

vs. `permit-to-work` (daily): that skill issues the 작업허가서 generically;
this skill produces the datacenter-specific fall-protection plan that the
permit references.

## Legal Disclaimer

> 자동화 계획 보조. 최종 추락 방지 조치 결정은 안전관리자 + 전기안전관리자 권한
> per 산업안전보건법 (OSHA-KR) Article 38 and 전기안전관리법 (ESCA) Article 16.
> Anchor ratings and busway de-energization status MUST be verified by a
> qualified electrical safety manager before work begins.
