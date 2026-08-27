# 현장 EHS 실무 운영 가이드 (Field EHS Operational Guide)

> **문서 유형**: Layer C — 한국어 실무 가이드  
> **관련 에이전트**: [safety-workflow-manager](file:///c:/git/ai_workspace/Projects/safety_os/agents/_core/safety-workflow-manager.md), [risk-assessment-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/_shared/risk-assessment-agent.md), [psm-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/functional/psm/psm-agent.md)  
> **법적 근거**: 산업안전보건법 제15조, 제29조, 제36조, 제38조, 제92조, 중대재해처벌법 시행령 제4조

---

## 1. 개요 (Overview)

본 가이드는 제조, 화학, 건설, 가스, 발전, 반도체, 배터리, 조선, 철강, 데이터센터, 식품, 화장품 등 사업장 현장에서 EHS(환경·보건·안전) 관리자와 작업자가 일상 안전보건 활동을 체계적으로 이행하고 법적 준수성(Compliance)을 확보할 수 있도록 표준 절차를 제공합니다.

---

## 2. 일상 안전보건 4대 핵심 절차

### 2.1 TBM (Tool Box Meeting, 작업 전 안전점검 회의)
- **이행 시점**: 매일 작업 개시 전 (10~15분)
- **법적 근거**: 산업안전보건법 제15조(안전관리자 등) 및 제29조(안전보건교육)
- **실무 절차**:
  1. **당일 작업 내용 공유**: 금일 수행할 작업 범위 및 유해·위험요인 확인
  2. **개인보호구(PPE) 점검**: 보호구(안전모, 안전화, 보안경, 안전대 등) 착용 상태 점검
  3. **위험요인 및 대책 교육**: 당일 주요 위험포인트(추락, 끼임, 감전, 화재 등) 교대 점검
  4. **작업자 건강상태 확인**: 음주, 피로도, 당일 신체 이상 유무 확인 및 기록

### 2.2 위험성평가 (Risk Assessment)
- **이행 시점**: 정기(연 1회), 수시(작업 변경/사고 발생 시), 상시(매일/매주)
- **법적 근거**: 산업안전보건법 제36조(위험성평가)
- **실무 절차**:
  1. **위험요인 파악 (Hazard ID)**: 4M (Man, Machine, Material, Method) 관점의 유해위험요인 도출
  2. **위험성 추정 및 결정**: 빈도(Frequency) × 강도(Severity) 매트릭스 산정
  3. **위험성 감소대책 수립**: 본질적 안전 → 공학적 대책 → 관리적 대책 → 개인보호구
  4. **이행 및 근로자 공유**: 대책 적용 후 근로자 교육 및 사업장 게시판 게시

### 2.3 안전작업허가제 (Permit to Work, PTW)
- **이행 시점**: 화기, 화황, 고소, 밀폐공간, 정전 등 화재·폭발 위험작업 수행 전
- **법적 근거**: 산업안전보건법 제38조(안전조치) 및 PSM 고시
- **실무 절차**:
  1. **허가서 신청**: 작업 담당자가 위험작업 24시간 전 신청서 작성 및 위험성평가 첨부
  2. **현장 가스 측정 및 안전점검**: 산소, 가연성가스, 독성가스 농도 측정 (기준치 이내 확인)
  3. **안전조치 이행 확인**: 화재감시자 배치, 소화기 비치, 밸브 차단 및 퍼지 점검
  4. **허가서 승인 및 현장 게시**: EHS 관리자 승인 후 현장 교대 근무 조에 게시 및 작업 착수

### 2.4 Lockout / Tagout (LOTO, 잠금장치 및 표지)
- **이행 시점**: 설비 정비, 청소, 급유, 검사 작업 시 (에너지원 차단)
- **법적 근거**: 산업안전보건기준에 관한 규칙 제92조(정비 등의 작업 시의 운전정지 등), KOSHA GUIDE Z-40-2022
- **실무 절차**:
  1. **작업 통보 및 설비 정지**: 해당 설비 운전원에게 정지 사실 통보 및 정상 정지 절차 수행
  2. **에너지원 격리**: 전원 차단기(MCC Off), 밸브 차단, 유압/공압 드레인
  3. **LOTO 장치 설치**: 개인 잠금장치(Padlock) 및 작업표지판(Tag) 부착
  4. **잔여 에너지 제로 확인 (Zero Energy State)**: 잔여 압력, 잔여 전압, 관성 회전 0 확인 후 작업 개시

---

## 3. PSM(공정안전관리) 12대 요소 운용 체크리스트

| # | PSM 요소 | 주요 실무 점검 항목 |
|---|----------|------------------|
| 1 | 공정안전자료 | P&ID, PFD, MSDS, 동력계통도 최신 버전 관리 |
| 2 | 공정위험성평가 | HAZOP / K-PSR 4년 주기 정기 재평가 수행 |
| 3 | 안전운전지침서 | 표준작업절차서(SOP) 현치 비치 및 준수 여부 |
| 4 | 설비의 유지관리 | 명음설비 예방보전(PM) 및 비파괴검사 이력 관리 |
| 5 | 안전작업허가 | 화기/밀폐/고소 PTW 발급 및 가스측정 기록 보관 |
| 6 | 도급업체 안전관리 | 수급업체 평가, 안전보건협의체 회의, 현장 순찰 |
| 7 | 근로자 교육 | PSM 이행교육, 신규/정기 교육 이수 및 평가 |
| 8 | 가동전안전점검 (PSSR) | 변경설비 시운전 전 PSSR 체크리스트 완료 |
| 9 | 변경요소관리 (MOC) | 기술/설비/절차 변경 시 MOC 승인 절차 이행 |
| 10| 자체감사 | 연 1회 이상 PSM 자체감사 수행 및 시정조치 |
| 11| 사고조사 | Near-Miss 포함 사고 조사, 5-Why 원인분석 및 CAPA 수립 |
| 12| 비상조치계획 | 시나리오별 비상대응 훈련 (반기 1회 이상) |

---

## 4. 특수 산업군 현장 안전보건 수칙 (신규 확장 12대 산업)

| 산업군 | 핵심 관리 공정 | 현장 필수 준수 수칙 (Operational Rules) | 담당 에이전트 |
|-------|--------------|--------------------------------------|--------------|
| **반도체/디스플레이** | 특수가스 캐비닛 & 클린룸 화학물질 | • SiH4/NF3 가스 누출 감지기 및 연동 인터록 매일 점검<br>• 불산(HF) 취급 시 전용 내화학 보호구 및 세안/세척설비 비치 | [semicon-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/semicon/semicon-agent.md) |
| **이차전지/배터리** | 배터리 셀 제조 & 폐배터리 리사이클링 | • Formation/충방전 공정 열화상 모니터링 및 열폭주 인터록<br>• NMP 유기용제 회수 설비 배기 점검 및 폐배터리 침전조 무산소 점검 | [battery-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/battery/battery-agent.md) |
| **조선/해양플랜트** | 선박 탱크 밀폐공간 & 골리앗 크레인 | • 선박 보이드 탱크 작업 전 산소/가스 농도 3위치 측정 및 감시자 배치<br>• 대형 크레인 인양 작업 신호수 지정 및 신호체계 모니터링 | [shipbuilding-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/shipbuilding/shipbuilding-agent.md) |
| **철강/금속제련** | 용광로/전기로 & 부생가스 배관 | • 전기로/가열로 정비 시 Zero Energy LOTO 및 습기 투입 방지<br>• 부생가스(CO/N2) 배관 가스검지기 및 차단 밸브 주간 정밀 점검 | [steelmaking-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/steelmaking/steelmaking-agent.md) |
| **데이터센터** | 리튬이온 UPS & 고전압 수전 설비 | • UPS 배터리 룸 온습도 모니터링 및 가스계 소화설비 수동 차단기 점검<br>• 고전압 변전실 작업 시 Arc Flash PPE 등급 준수 및 LOTO 부착 | [datacenter-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/datacenter/datacenter-agent.md) |
| **식품 (HACCP)** | CCP 공정 & 교반기/혼합기 정비 | • HACCP CCP 한계기준(온도/시간) 이탈 시 자동 CAPA 및 가열 처리<br>• 식품 교반기/혼합기 세척 및 정비 시 전원 2중 차단 LOTO 적용 | [food-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/food/food-agent.md) |
| **화장품 (CGMP)** | 배치 출하 & 유기용제/원료 혼합 | • CGMP 배치 출하 전 미생물/중금속 시험 적합 검수 기록 보관<br>• 향료/알코올 혼합 정조 작업 시 국소배기장치 및 방폭 설비 가동 | [cosmetics-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/cosmetics/cosmetics-agent.md) |
| **항만 물류** | 항만 크레인 인양 & 냉동창고 | • 항만 갠트리 크레인 작업 전 와이어로프/신호수 점검 및 AGV 센서 연동<br>• 냉동창고 암모니아 냉매가스 누출 감지기 및 비상 탈출 장치 매일 점검 | [logistics-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/logistics/logistics-agent.md) |
| **철도/교통** | 25kV 전차선 & 야간 선로 정비 | • 전차선 정비 전 전원 단전 확인 및 이동식 단축 접지봉 즉시 부착<br>• 야간 선로 정비 작업 전 감시인 배치 및 열차 통과 지연 인터록 확인 | [railway-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/railway/railway-agent.md) |
| **폐기물/수자원** | 하수조 밀폐공간 & 소각 파쇄기 | • 하수조/맨홀 진입 전 O2(>=18%) 및 H2S(<=10ppm) 측정 및 강제 환기<br>• 폐기물 소각 호퍼 및 파쇄기 정비 전 전원 완전 차단 LOTO 적용 | [waste-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/waste/waste-agent.md) |
| **방위산업** | 화약 추진제 & 극저온 가스 | • 화약 추진제 혼합실 정전기 방지 접지 resistance 및 제습 점검<br>• 유도무기 극저온 액체연료(LN2/LOX) 충전 잔여 압력 확인 | [defense-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/defense/defense-agent.md) |
| **바이오 CDMO** | Bioreactor SIP & LMO 생물안전 | • Bioreactor SIP 멸균 작업 전 패킹 누출 및 안전 릴리프 밸브 점검<br>• LMO 2~3등급 시설 HEPA 필터 차압 유지 및 H2O2 훈증 소독 점검 | [biotech-agent](file:///c:/git/ai_workspace/Projects/safety_os/agents/domains/industry/biotech/biotech-agent.md) |

---

## 5. 증적 관리 및 오딧 대응 (Audit Trail)

모든 현장 안전 보건 활동은 규제 기관(고용노동부, 한국산업안전보건공단, 소방서, 식품의약품안전처 등) 서면 및 현장 감사 시 증빙자료로 제출되어야 합니다.

- **서류 보관 기간**:
  - 위험성평가 서류: 3년 보관
  - 안전작업허가서(PTW): 1년 보관
  - 안전보건교육 일지: 3년 보관
  - LOTO 이행 기록: 1년 보관
  - HACCP / CGMP / GxP 제조기록서: 3~5년 보관
- **시스템 동기화**:
  - 모든 증적 데이터는 [`evidence-models/`](file:///c:/git/ai_workspace/Projects/safety_os/evidence-models/) 표준 JSON 스키마 구조와 부합하게 기록되어야 합니다.
