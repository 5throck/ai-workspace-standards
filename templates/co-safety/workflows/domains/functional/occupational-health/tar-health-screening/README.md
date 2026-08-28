
# TAR 건강검진 관리 (TAR Health Screening) Workflow

## 1. 목적
대정비 (Major Turnaround, TAR) 기간 중 다수의 외부 임시 인력이 유해화학물질, 밀폐공간, 고열 등
TAR 특유의 유해 구역에 단기간 집중적으로 노출되는 상황에 대응하기 위한 건강검진 관리 워크플로우.
TAR은 occupational-health-agent의 업무 부하가 가장 급증하는 시점이며, 본 워크플로우는
occupational-health-agent의 최초 워크플로우/증거모델로서 신설된다.

## 2. 트리거 조건
- C-02의 `tar-contractor-surge-management` 워크플로우와 동시에 트리거된다. 계약자 급증 관리와
  건강검진 관리는 동일한 TAR 인력 명부를 공유하므로 함께 설계되었다.
- msds-agent가 이미 문서화한 "특수건강진단 대상자 통보" 시나리오 (`docs/_shared/user-scenarios_ko.md`)의
  수신측 역할도 본 워크플로우가 수행한다.

## 3. 워크플로우 단계 (Workflow Steps)
1. **TAR 유해구역 대상자 확정**: TAR 현장의 고열, 밀폐공간, 화학물질 노출 구역에 투입 예정인
   작업자 명단을 확인한다.
2. **특수건강진단 이수율 검증**: 대상 인력 전체에 대한 특수건강진단 이수율
   (`special_health_exam_completion_rate`)을 확인하고, 미이수자는 현장 출입 전 완료하도록 조치한다.
3. **고열 노출 모니터링**: TAR 기간 중 고열 작업구역 노출 모니터링 체계 가동 여부
   (`heat_exposure_monitoring`)를 기록한다.
4. **밀폐공간 출입 허가**: 밀폐공간 작업 대상자의 사전 건강 적합성 확인 및 출입 허가 여부
   (`confined_space_clearance`)를 기록한다.
5. **출입 허가 판정**: 위 항목이 모두 충족된 작업자만 TAR 현장 출입이 허가된다. 미충족 시
   safety-workflow-manager에 에스컬레이션한다.

## 4. 상호 참조 (Cross-Reference)
본 워크플로우는 contractor-safety-agent의 `tar-contractor-surge-management` 워크플로우와 양방향으로
상호 참조한다. `contractor_surge_ref`는 contractor-safety-agent가 생성하는
`contractor-tar-surge-record.json`의 `record_id`를 가리키며, 동일 `tar_id`를 기준으로
`special_health_exam_completion_rate`와 contractor-safety-agent의 `surge_headcount`를 교차 대조하여
TAR 개시 전 준비 상태 (pre-TAR readiness)를 즉시 점검할 수 있다.

## 5. 증거 기록 (Evidence Record)
`oh-tar-health-record.json` 생성.
