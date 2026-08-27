---
name: temperature-excursion-analyzer
owner: gdp-agent
scope: workspace
status: active
description: Analyze temperature excursion events in cold chain pharmaceutical distribution. Determines product quality impact per Stability + GDP guidelines.
version: "1.0"
created: 2026-06-17
last_updated: 2026-06-17
metadata:
  triggers:
    - 온도이탈
    - temperature excursion
    - 콜드체인
    - cold chain
    - GDP 온도관리
    - 냉장유통
    - excursion event
    - 안정성 데이터 검토
  legal_basis:
    - "약사법 제47조 (의약품등의 판매 질서 — 유통품질관리기준 준수)"
    - "약사법 제39조 (위해의약품등의 회수)"
    - "의약품 유통관리 기준 (MFDS 고시 — 온도·콜드체인 보관 및 운송 기준)"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Temperature Excursion Analyzer Skill

## Overview
Analyzes time-series temperature data to detect excursions, characterize severity, and assess product quality impact per KGDP cold chain requirements.

## Scope
- **In scope**: Pharmaceutical products with defined storage temperature specifications
- **Out of scope**: Active pharmaceutical ingredient (API) stability (handled by GMP stability workflow)

## Analysis Steps

### Step 1: Excursion Detection
- Input: time-series temperature data from `gdp-temperature-monitoring-record.json`
- Compare each reading against spec range (min/max)
- Identify continuous excursion events (consecutive out-of-spec readings)
- Output: list of excursion events with start/end timestamps

### Step 2: Excursion Characterization
For each excursion event:
- **Peak deviation**: max distance beyond spec (°C)
- **Duration**: total time out of spec (minutes)
- **Cumulative thermal stress**: integral of (temp - spec_limit) over time
- **Time above/below spec**: separate calculations for hot vs cold excursions

### Step 3: Product Impact Assessment
- Lookup product stability profile (from manufacturer specifications)
- Compare excursion against:
  - **Allowed short-term excursion** (e.g., 25°C for 24 hours for cold chain products)
  - **Stability data** for the specific product formulation
- Determine impact:
  - **No impact**: Within allowed excursion window
  - **Use-as-is**: Outside window but stability data supports quality
  - **Quarantine pending testing**: Requires quality lab verification
  - **Destroy**: Stability data does not support use

### Step 4: Documentation
- Generate excursion analysis report
- Attach to `gdp-temperature-monitoring-record.json.excursion_events[]`
- Recommend CAPA (root cause: equipment failure / process error / etc.)

## Temperature Zones Reference

| Zone | Spec Range | Typical Allowed Excursion |
|------|------------|---------------------------|
| Cold chain 2-8°C | 2-8°C | 8-25°C for ≤24 hours (product-specific) |
| Frozen ≤-15°C | ≤-15°C | No excursion allowed |
| Controlled room 15-25°C | 15-25°C | 25-30°C for ≤24 hours |
| Ambient ≤30°C | ≤30°C | 30-35°C for ≤24 hours |

## Output

Returns excursion analysis JSON:
```json
{
  "excursion_events": [
    {
      "start": "2026-06-17T10:30:00Z",
      "end": "2026-06-17T11:15:00Z",
      "duration_minutes": 45,
      "peak_deviation_c": 2.5,
      "cumulative_thermal_stress": 67.5,
      "impact_assessment": "use_as_is",
      "rationale": "Within allowed 25°C excursion for ≤24h per manufacturer spec"
    }
  ],
  "overall_decision": "use_as_is",
  "capa_recommended": "investigate_door_alarm"
}
```

## Integration Points

- **Input from**: `gdp-temperature-monitoring-record.json` (time_series_data field)
- **Output to**: Updates `gdp-temperature-monitoring-record.json.excursion_events[]`
- **Escalation**: If `overall_decision: destroy`, triggers GMP deviation-capa workflow

## v2 Roadmap
- ML-based product stability prediction (replace lookup tables)
- Real-time excursion alerting (IoT sensor integration)
- Cumulative thermal stress tracking across distribution chain

## Legal Disclaimer
> Skill automation only. Final disposition decisions require qualified pharmaceutical quality professional verification per KGDP.
