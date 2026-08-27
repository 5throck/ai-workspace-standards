# Safety OS 22대 전 산업 도메인 빠른 참조 카드 (Domain Quick Reference)

> **문서 유형**: Layer C — 한국어 실무 빠른 참조 가이드  
> **목적**: Safety OS 플랫폼에 등록된 22개 전체 기능 및 산업 도메인의 매핑 규제, 담당 에이전트 및 대표 워크플로우 한눈에 보기

---

## 1. 기능 레이어 (Tier 1) — 공통 방법론 및 데이터 서비스 (5개)

| 도메인 ID | 도메인 명칭 | 주관 법령 / 규격 | 담당 에이전트 | 대표 워크플로우 |
|----------|-----------|----------------|--------------|----------------|
| `psm` | 공정안전관리 | 산안법 제44조 (OSHA 14요소) | [psm-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/functional/psm/psm-agent.md) | `loto-lockout-tagout`, `moc-change-management`, `pha-hazard-analysis` |
| `msds` | 화학물질 안전 | 산안법 제110조 (GHS Rev 9) | [msds-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/functional/msds/msds-agent.md) | `msds-parsing`, `ghs-classification`, `chemical-approval` |
| `training` | 안전보건교육 | 산안법 제29조(특별교육=③)/31조, 중재법 제8조 | [training-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/functional/training/training-agent.md) | `regular-safety-training`, `special-safety-training`, `supervisor-training` |
| `contractor-safety` | 계약자 안전 | 산안법 제63조 (TAR Surge) | [contractor-safety-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/_shared/contractor-safety-agent.md) | `tar-contractor-surge-management` |
| `occupational-health` | 근로자 건강 | 산안법 제129/130조 | [occupational-health-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/_shared/occupational-health-agent.md) | `tar-health-screening` |

---

## 2. 산업 레이어 (Tier 2) — 산업 특화 도메인 (17개)

### 2.1 제약 & 바이오 (GxP) 도메인 (5개)
| 도메인 ID | 도메인 명칭 | 주관 법령 / 규격 | 담당 에이전트 | 대표 워크플로우 |
|----------|-----------|----------------|--------------|----------------|
| `gmp` | 의약품 제조 품질 | 약사법 제37조, KP-GMP, PIC/S | [gmp-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/gmp/gmp-agent.md) | `change-control`, `deviation-capa`, `batch-mfg`, `cleaning-validation` |
| `gdp` | 의약품 유통/물류 | 약사법 제43조의2, KGDP | [gdp-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/gdp/gdp-agent.md) | `dts-tracking`, `temperature-excursion`, `product-recall` |
| `glp` | 비임상시험 | 약사법 제34조의3, OECD GLP | [glp-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/glp/glp-agent.md) | `study-protocol`, `data-integrity`, `qau-inspection` |
| `gcp` | 임상시험 관리 | 약사법 제34조, ICH E6(R3) | [gcp-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/gcp/gcp-agent.md) | `protocol-deviation`, `sae-reporting`, `icf-verification` |
| `gvp` | 약물감시 | 약사법 제73조, ICH E2 | [gvp-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/gvp/gvp-agent.md) | `icsr-processing`, `signal-detection`, `pbrer-generation` |

### 2.2 의료기기 & 소비재 (GxP) 도메인 (3개)
| 도메인 ID | 도메인 명칭 | 주관 법령 / 규격 | 담당 에이전트 | 대표 워크플로우 |
|----------|-----------|----------------|--------------|----------------|
| `meddevice` | 의료기기 | 의료기기법 제16조, ISO 13485 | [meddevice-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/meddevice/meddevice-agent.md) | `design-control`, `iso14971-risk`, `device-recall` |
| `food` | 식품 (HACCP) | 식품위생법 제48조, HACCP 고시 | [food-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/food/food-agent.md) | `haccp-ccp-monitoring`, `food-mixer-loto` |
| `cosmetics` | 화장품 (CGMP) | 화장품법 제5조, ISO 22716 | [cosmetics-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/cosmetics/cosmetics-agent.md) | `cgmp-batch-release`, `cosmetics-safety-assessment` |

### 2.3 전통 EHS & 중공업 도메인 (5개)
| 도메인 ID | 도메인 명칭 | 주관 법령 / 규격 | 담당 에이전트 | 대표 워크플로우 |
|----------|-----------|----------------|--------------|----------------|
| `ehsconst` | 건설안전 | 산안법 제63조, 중재법 제12조 | [ehsconst-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/ehsconst/ehsconst-agent.md) | `construction-safety-plan`, `fall-prevention`, `sapa-serious-accident` |
| `ehschem` | 화학공장 | 화관법 제20조, 산안법 제44조 | [ehschem-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/ehschem/ehschem-agent.md) | `turnaround-shutdown-planning`, `plant-operation` |
| `gasterm` | 가스터미널 | 고압가스 안전 관리 및 사업법 (HPGSCA) 제13조·제15조, KGS Code | [gasterm-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/gasterm/gasterm-agent.md) | `tank-storage`, `leak-detection`, `major-gas-incident` |
| `powergen` | 발전설비 | 전기사업법 제65조, 전기안전법 | [powergen-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/powergen/powergen-agent.md) | `boiler-turbine-safety`, `arc-flash-analysis`, `ess-fire-risk` |
| `shipbuilding` | 조선/해양 | 산안법 제38조, 중재법 제5조 | [shipbuilding-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/shipbuilding/shipbuilding-agent.md) | `ship-tank-confined-space`, `heavy-crane-subcontractor-safety` |

### 2.4 첨단 기술 & IT 인프라 도메인 (4개)
| 도메인 ID | 도메인 명칭 | 주관 법령 / 규격 | 담당 에이전트 | 대표 워크플로우 |
|----------|-----------|----------------|--------------|----------------|
| `semicon` | 반도체/디스플레이 | 고압가스 안전 관리 및 사업법 (HPGSCA) 제11조·제13조·제15조·제24조·제26조, 화학물질관리법 (CCA) | [semicon-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/semicon/semicon-agent.md) | `special-gas-handling`, `cleanroom-chemical-safety`, `semicon-scrubber-maintenance` |
| `battery` | 이차전지/리사이클링 | 위험물안전관리법 제5조, 화관법 | [battery-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/battery/battery-agent.md) | `battery-thermal-runaway-prevent`, `battery-recycling-hazard-control` |
| `steelmaking` | 철강/금속제련 | 산안법 제92조, 고압가스법 | [steelmaking-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/steelmaking/steelmaking-agent.md) | `molten-metal-loto`, `byproduct-gas-leak-prevent` |
| `datacenter` | 데이터센터/IT | 전기안전관리법 제16조, NFPA 855 | [datacenter-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/datacenter/datacenter-agent.md) | `datacenter-ups-fire-safety`, `high-voltage-facility-safety`, `datacenter-fuel-tank-safety` |

### 2.5 물류, 교통, 환경, 방산 & 바이오 도메인 (5개)
| 도메인 ID | 도메인 명칭 | 주관 법령 / 규격 | 담당 에이전트 | 대표 워크플로우 |
|----------|-----------|----------------|--------------|----------------|
| `logistics` | 항만 물류/물류센터 | 항만안전특별법 제4조, 산안법 제38조 | [logistics-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/logistics/logistics-agent.md) | `port-crane-agv-safety`, `cold-storage-refrigerant-safety` |
| `railway` | 철도/교통 인프라 | 철도안전법 제45조, 전기안전법 | [railway-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/railway/railway-agent.md) | `catenary-high-voltage-safety`, `rail-track-confined-maintenance` |
| `waste` | 폐기물/수자원 | 폐기물관리법 제13조, 하수도법 제19조 | [waste-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/waste/waste-agent.md) | `sewage-confined-h2s-prevent`, `incinerator-shredder-loto` |
| `defense` | 방위산업/화약 | 총포화약법 제9조, 방위사업법 제18조 | [defense-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/defense/defense-agent.md) | `explosive-propellant-handling`, `missile-cryogenic-high-pressure` |
| `biotech` | 바이오 CDMO | LMO법 제22조, 약사법 제37조 | [biotech-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/biotech/biotech-agent.md) | `bioreactor-sterilization-safety`, `lmo-biohazard-containment` |
