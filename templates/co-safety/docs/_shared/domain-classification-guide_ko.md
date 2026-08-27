# Domain Classification Guide

> **Purpose**: Safety OS 도메인의 기능적/산업적 혼재를 명확히 분류하고, 사용자 dispatch 시 적절한 도메인(또는 다중 도메인)을 선택하는 가이드.

## 1. Why This Guide Exists

Safety OS에는 30개 도메인(기능 8개 + 산업 22개)이 활성화되어 있으며, 다음 두 가지 성격이 혼재되어 있었습니다:

- **기능적(Functional) 도메인**: 산업 무관, 방법론이나 데이터 중심 (PSM, MSDS, Training, contractor-safety, occupational-health)
- **산업적(Industry) 도메인**: 특정 산업 운영 중심 (ehsconst, gasterm, powergen, ehschem, meddevice, GxP family — gmp/gdp/glp/gcp/gvp)

혼재의 결과:
- 화학공장 사용자는 psm, msds, ehschem, emergency 중 무엇을 호출해야 할지 혼란
- 동일 산업에서 다부처 규제가 동시 적용되나 어느 도메인이 통합 코디네이터인지 불분명
- LNG 터미널/발전소 등 대규모 시설은 PSM도 적용되나 이를 어디에서 다루는지 모호

본 가이드는 이를 **3-tier 분류 체계**로 정리합니다.

---

## 2. 3-Tier Domain Classification

### Tier 1: Functional Domains (기능 도메인)
**특징**: 산업 무관. 방법론, 데이터, 시스템 관리 중심. 여러 산업 도메인이 참조.

| Domain | 기능 | 적용 산업 예시 |
|--------|------|----------------|
| `psm` | 공정안전 관리 방법론 (PHA, MOC, PSSR, MI, PSI, SOP, LOTO) | 화학, 정유, **LNG/LPG 기지**, 대규모 발전, 반도체 (특수 가스) |
| `msds` | 화학물질 데이터 관리 (16 sections) | 모든 산업 (화학 취급 시) |
| `training` | 안전교육 관리 (OSHA-KR Art 29 — 특별교육=제29조③/31/32/114) | 모든 산업 |
| `contractor-safety` | 계약자 안전관리 (대정비(TAR)/대규모 정비 surge 시나리오) | 화학공장, 가스터미널, 발전소의 정기 대정비 기간 |
| `occupational-health` | 근로자 건강관리 (대정비(TAR)/대규모 정비 건강검진) | 화학공장, 가스터미널, 발전소의 정기 대정비 기간 |
| `risk-assessment` | 작업 위험성평가 방법론 (산업안전보건법 제36조 위험성평가; 일상/변경 위험성평가, 작업안전분석, 위험등록부) | 모든 산업 (의무 기본 항목) |
| `incident-investigation` | 사고 조사 및 근본원인 분석 (5-Why, bow-tie, CAPA, 교훈 전파) | 모든 산업 (사고 발생 후) |
| `asset-integrity` | 설비 무결성 및 점검 방법론 (예방정비, 법정검사 일정, 노후설비 평가, 고장분석) | 설비 집약 산업 (화학, 발전, 반도체, 가스터미널 등) |

### Tier 2: Industry Domains (산업 도메인)
**특징**: 특정 산업 운영 중심. 산업별 다부처 규제 통합 관리.

| Domain | 도메인 | 적용 산업 | 통합 규제 |
|--------|-----------|-----------|-----------|
| `gmp` | 의약품 제조 품질 | 약사법 제37조, PIC/S, ICH Q7/Q9/Q10 |
| `gdp` | 의약품 유통 품질 | 약사법 제47조, KGDP 고시 |
| `glp` | 비임상시험 관리 | 약사법 제34조의3, OECD GLP |
| `gcp` | 임상시험 관리 | 약사법 제34조의2, ICH E6(R3) |
| `gvp` | 시판 후 약물감시 | 약사법 제73조의2/73조의3, KGVP, ICH E2 |
| `ehsconst` | 건설 | 산안법, 중대재해처벌법 (건설업 특례), 건설기술진흥법 |
| `gasterm` | 가스터미널 / 충전소 | 고압가스안전관리법, LPG법, 수소법 |
| `powergen` | 발전설비 (원자력 제외) | 전기사업법, 전기안전관리법, 신재생에너지법 |
| `ehschem` | 화학공장 (정유/석유화학/정밀화학) | 산안법, 화학물질관리법, K-REACH, 위험물안전관리법 |
| `meddevice` | 의료기기 | KGMP-MD, ISO 13485, ISO 14971 |
| `food` | 식품 제조 및 가공 | 식품위생법, MFDS HACCP 고시 |
| `cosmetics` | 화장품 제조 | 화장품법, MFDS CGMP 고시, ISO 22716 |
| `semicon` | 반도체 및 디스플레이 | 고압가스안전관리법, 화학물질관리법, SEMI S2/S8 |
| `battery` | 이차전지 제조 및 리사이클링 | 위험물안전관리법, 화학물질관리법, NFPA 855 |
| `shipbuilding` | 조선 및 해양 플랜트 | 산안법 제38/39/63조, 중대재해처벌법 제5조 |
| `steelmaking` | 철강 및 금속 제련 | 산안법 제92조, 고압가스안전관리법 |
| `datacenter` | 데이터센터 및 IT 인프라 | 전기안전관리법, 전기사업법, NFPA 855 |
| `logistics` | 항만 물류 및 대형 물류센터 | 항만안전특별법, 산안법 제38/63조, 고압가스법 |
| `railway` | 철도 및 도시철도 교통 | 철도안전법, 산안법 제38/39조, 전기안전관리법 |
| `waste` | 폐기물 및 수자원/하수처리 | 폐기물관리법, 하수도법, 산안법 제618조 |
| `defense` | 방위산업 및 총포·화약 | 총포화약법, 방위사업법, 고압가스안전관리법 |
| `biotech` | 바이오 CDMO 및 연구소 | LMO법, 약사법, 산안법 |

### Tier 3: Cross-Cutting Services (공통 서비스)
**특징**: 모든 도메인에서 참조. 비상 대응, 일상 점검 등.

| Service | 역할 |
|---------|------|
| `emergency/` (9 workflows) | 화재, 자연재해, 의료, 화학누출, 폭발, 밀폐/고소 구조, 감전, 기계 사고 |
| `daily/` workflows | 위험성평가, 작업허가서, 안전점검 등 일상 EHS |

---

## 3. Multi-Domain Dispatch 가이드

### 원칙: 산업 도메인이 통합 코디네이터 (Tier 2 주도)

```
사용자 (특정 산업 종사자)
  ↓
Tier 2 산업 도메인 (통합 코디네이터)
  ├── 필요시 Tier 1 기능 도메인 dispatch
  └── 사고 시 Tier 3 emergency dispatch
```

### 예시: LNG 터미널 운영자

```
[일상 운영]
→ gasterm-agent (Tier 2, 통합 코디네이터)
  ├── 가스 저장탱크 점검 (gasterm 자체)
  ├── 화학물질 처리 (MEA/MDEA) 데이터 필요 → msds-agent (Tier 1)
  └── 대규모 시설 위험성평가 → psm-agent (Tier 1)

[비상 사태]
→ emergency-agent (Tier 3)
  ├── explosion-gas-response 직접 실행
  ├── msds Section 6 데이터 필요 → gasterm이나 msds-agent에서 제공
  └── 대피/통제/신고
```

### 예시: 화학공장 운영자

```
[일상 운영]
→ ehschem-agent (Tier 2, 통합 코디네이터, 예정)
  ├── 화학공장 일상 운영 (ehschem 자체)
  ├── 화학물질 취급 → msds-agent (Tier 1)
  ├── 대규모 위해 공정 → psm-agent (Tier 1)
  └── 위험물 저장 → msds + ehschem 협업

[비상 사태]
→ emergency-agent (Tier 3)
  ├── chemical-release 직접 실행
  ├── msds Section 6 데이터 → msds-agent
  └── psm-psi (공정 안전 정보) → psm-agent
```

### 예시: 발전소 (LNG 화력) 운영자

```
[일상 운영]
→ powergen-agent (Tier 2, 통합 코디네이터)
  ├── 발전설비 운영 (powergen 자체)
  ├── LNG 가스 공급 → gasterm-agent (Tier 2, 산업 협업)
  ├── 대규모 가스 공정 (PSM 의무) → psm-agent (Tier 1)
  └── 화학 처리 (NOx 제거용 암모니아 등) → msds-agent (Tier 1)
```

---

## 4. PSM 적용 시나리오 (LNG 터미널 질문 반영)

PSM (산업안전보건법 제44조)은 "covered process"를 가진 시설에 적용. 단순히 화학공장뿐 아니라 다음 시설에도 의무 적용:

| 시설 유형 | PSM 의무 | 담당 산업 도메인 | 인터페이스 |
|-----------|---------|------------------|------------|
| 정유공장 | ✓ | `ehschem` | psm_record_ref 양방향 |
| 석유화학공장 | ✓ | `ehschem` | psm_record_ref 양방향 |
| **LNG 터미널 (대규모)** | ✓ | `gasterm` | `psm_applicable: true` 필드 |
| **LPG 기지 (대규모)** | ✓ | `gasterm` | `psm_applicable: true` 필드 |
| LNG 화력발전소 (대규모 가스) | ✓ | `powergen` | `psm_applicable` 필드 추가 예정 |
| 수소 충전소 (대규모) | 일부 | `gasterm` | psm_applicable 조건부 |
| 반도체 (특수 가스) | 일부 | (semicon 예정) | - |
| 제약 (대규모 화학) | 일부 | `gmp` | gmp와 psm 협업 |

**구현 원칙**:
- `psm-agent`는 기능적 코디네이터 (PSM 방법론 제공)
- 산업 도메인의 evidence model에 `psm_applicable: boolean` 필드로 표시
- `psm_applicable: true` 시 해당 시설은 psm-agent와 병행 협업

### `gasterm`에서 PSM 인터페이스 (이미 구현됨)

```yaml
# gasterm evidence model
psm_applicable: true  # 대규모 LNG/LPG 시설인 경우
psm_record_ref: "PSM-..."  # psm-record ID
```

### `powergen` PSM 인터페이스 (이미 구현됨)

powergen evidence model에 `psm_applicable` 필드가 추가됨 (7개 레코드에 반영):
- LNG 화력발전소 (대규모 가스 처리) — PSM 의무
- 화력 발전 보일러 (대규모 고압) — PSM 의무

---

## 5. Dispatch Decision Tree

```
[사용자 요청]
       ↓
[특정 산업 종사자?]
   ├── Yes → Tier 2 산업 도메인 dispatch
   │   ├── 화학공장 → ehschem-agent
   │   ├── 건설현장 → ehsconst-agent
   │   ├── 가스터미널 → gasterm-agent
   │   ├── 발전소 → powergen-agent
   │   └── 제약 (품질/감시) → gmp/gdp/glp/gcp/gvp-agent (Tier 2 — 제약 산업 도메인)
   │
   └── No → Tier 1 기능 도메인 dispatch
       ├── 공정 위해 (covered process) → psm-agent
       ├── 화학물질 데이터 → msds-agent
       └── 비상 → emergency-agent
```

---

## 6. Implementation Status

### Phase 1 (완료)
- [x] 본 분류 가이드 작성
- [x] Active Domains Registry에 tier 필드 추가
- [x] gasterm에 `psm_applicable` 필드 구현

### Phase 1.1 (완료)
- [x] powergen에 `psm_applicable` 필드 추가 (LNG/화력 대규모 시설 — 7개 evidence model)
- [x] ehschem에 `psm_applicable` 필드 추가 (6개 evidence model)

### Phase 2 (완료)
- [x] 디렉토리 구조 2-Tier 그룹핑 (functional/ vs industry/) — GxP family(gmp/gdp/glp/gcp/gvp) 산업 티어로 재분류
- [ ] dispatch 자동화 (tier 인식)

### Phase 3 (v3+, 사용자 혼란 가중 시)
- [ ] 본격 구조 재편 (Option C — 순수 산업 통합)

---

## 7. Legal Disclaimer

본 가이드는 사용자 dispatch 보조. 최종 도메인 선택은 PM (CSO)의 판단. 다중 도메인 협업 필요시 PM이 조정.
