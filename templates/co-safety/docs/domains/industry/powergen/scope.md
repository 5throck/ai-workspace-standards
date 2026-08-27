# powergen (Power Generation) Domain v1 — Scope

> **Domain**: `powergen` (발전설비 안전 / Power Generation Safety)
> **Tier**: Industry (matrix coordinator)
> **Scope**: 화력 (석탄/LNG/오일) + 신재생 (풍력/태양광/수력/ESS). **원자력 제외**.

## 1. Matrix Position

```
                 Power Generation
Functional ←→    ┌──────────────────────────────┐
PSM              │ powergen dispatches to PSM   │
MSDS             │   for boiler/gas processes   │
Emergency        │ powergen dispatches to       │
                 │   Emergency for incidents    │
                 │                              │
Industry →       │ powergen OWNS:               │
powergen         │ - boiler/steam systems       │
                 │ - turbine/generator          │
                 │ - high-voltage electrical    │
                 │ - renewable (wind/solar/ESS) │
                 │ - fuel handling              │
                 │ - ash/chemical waste         │
                 │ - plant inspection           │
                 └──────────────────────────────┘
```

## 2. Workflows (8)

| # | Workflow | Type | Key Topic |
|---|----------|------|-----------|
| 1 | boiler-steam-system-safety | core | 보일러/증기 (고온·고압) |
| 2 | turbine-generator-maintenance | core | 터빈/발전기 회전체 |
| 3 | high-voltage-electrical-safety | core | 송전/변전 고압 전기 |
| 4 | renewable-energy-facility-safety | core | 풍력/태양광/ESS |
| 5 | fuel-handling-safety | core | 석탄/LNG/오일 연료 취급 |
| 6 | ash-chemical-waste-management | core | 석탄재/화학폐수 |
| 7 | power-plant-inspection | core | 정기 안전점검 (KESCO) |
| 8 | electrical-major-incident-reference | reference | 대형 전기사고 → emergency-agent |

## 3. Plant Types Covered

### 화력 발전 (Thermal)
| 연료 | 한국 발전사 | 특수 위해 |
|------|------------|-----------|
| 석탄 | 한국남부/중부/동서/서부발전 | 석탄재, 대기오염, 먼지 |
| LNG | 한국동서/서부발전 | 가스 누출, 폭발 (PSM 적용) |
| 오일 | 소규모 | 유증기, 환경오염 |

### 신재생 (Renewable)
| 종류 | 특수 위해 |
|------|-----------|
| 풍력 | 추락 (80-120m), 블레이드 파손, 고소 화재 |
| 태양광 | 감전 (DC 고압), 결함 모듈 화재 |
| 수력 | 홍수, 수압, 수력 터빈 끼임 |
| ESS | 리튬이온 Thermal Runaway (2018-2019 사건 27건) |

### 원자력 — **제외**
원자력안전법 + 방사선방호법 적용 영역. 복잡도로 인해 별도 도메인 검토 (v3+ roadmap).

## 4. Common Fields (all powergen-*.json)

- `plant_type`: thermal_coal / thermal_LNG / thermal_oil / wind / solar / hydro / geothermal / biomass / fuel_cell / ess
- `kesa_inspection_status`: certified / pending / failed / expired (한국전기안전공사)
- `voltage_class`: low (≤400V) / medium (400V-22kV) / high (22-154kV) / extra_high (>154kV)
- `renewable_category`: wind / solar / hydro / geothermal / biomass / fuel_cell / ess / null

Plus standard: `e_signature`, `nomenclature`, `audit_trail`, `legal_basis` (≥3)

## 5. Uses Functional Services

- `functional/psm/` — 대규모 보일러/가스 처리 시설 PSM 적용 (OSHA-KR Art 44)
- `functional/msds/` — 연료/화학 처리 물질 데이터
- `emergency/` — electrical-emergency, explosion-gas-response, disaster-response

## 6. Korean Regulatory Framework

| 법률 | 주관 | 핵심 |
|------|------|------|
| 전기사업법 | MOTIE | 발전설비 설치 허가, 안전관리 |
| 전기안전관리법 | KESCO | 전기설비 안전점검, 전기안전관리자 |
| 신재생에너지법 | MOTIE | 신재생 시설 안전 |
| 산업안전보건법 (PSM) | MOEL | 화력 보일러/대규모 가스 PSM |
| 대기환경보전법 | ME | 대기 배출 기준 |
| 수질환경보전법 | ME | 수질 배출 기준 |

## 7. ESS 화재 특수 대응 (2018-2019 교훈)

한국 ESS 화재 27건 (2018-2019) 이후 강화된 안전 기준:
- MPSL (Medium and Large Secondary Lithium) 안전인증 의무
- 리튬이온 화재 특수 소화 (물 사용 제한)
- Thermal Runaway 조기 감지 (CO/H2 가스 검출)
- Deflagration venting 필수

## 8. Legal Disclaimer

> 발전설비 운영은 법적 안전관리자/시설관리자 책임. 본 시스템은 워크플로우 자동화 지원만 제공.
