
# TAR 계약자 급증 관리 (TAR Contractor Surge Management) Workflow

## 1. 목적
대정비 (Major Turnaround, TAR) 기간 중 단기간에 다수의 협력업체/재하도급업체 인력이 동시 투입되는
상황에 대응하기 위한 일괄 사전심사 (bulk prequalification) 워크플로우. 단일 계약자 기준으로 설계된
`contractor-onboarding` 스킬 (순차 처리: 접수 → 자격심사 → 교육 → 인증 → 출입허가)은 TAR 규모의
동시다발적 계약자 유입에서 병목이 발생하므로, ehsconst-agent의 `subcontractor-management` 패턴
(contractor_tier, safety_history_score, prequalification_completed)을 차용한 TAR 전용 급증 관리
스키마를 사용한다.

## 2. 트리거 조건
- ehschem-agent의 `turnaround-shutdown-planning` 워크플로우에서 TAR 계획이 확정되고, TAR 투입
  계약자 인원 (headcount)이 확정되는 시점에 트리거된다.
- 트리거 즉시 해당 TAR 기간에 투입될 모든 계약자/재하도급업체에 대한 일괄 사전심사가 개시된다.

## 3. 워크플로우 단계 (Workflow Steps)
1. **TAR 계약자 명부 확정**: ehschem-agent로부터 TAR ID 및 투입 예정 계약자별 인원수
   (`surge_headcount`)를 수신한다.
2. **일괄 사전심사 (Bulk Prequalification)**: 각 계약자의 `contractor_tier`, `safety_history_score`를
   조회하여 TAR 참여 자격을 일괄 검증한다.
3. **대규모 교육/인증 추적**: TAR 투입 전 전 인원의 안전교육 이수 여부
   (`worker_training_completed`)를 계약자 단위가 아닌 개별 작업자 규모로 추적한다.
4. **건강검진 상태 연계**: TAR 현장의 고열/밀폐공간/화학물질 노출 구역에 투입되는 작업자의
   건강검진 상태를 occupational-health-agent가 관리하는 TAR 건강검진 기록과 연계한다
   (`health_screening_ref` 필드를 통해 occupational-health-agent의
   `oh-tar-health-record.json`을 참조).
5. **TAR 종료 후 이력 반영**: TAR 종료 시 계약자별 안전이력 (`safety_history_score`)을 갱신하여
   차후 TAR 및 상시 계약자 심사에 반영한다.

## 4. 상호 참조 (Cross-Reference)
본 워크플로우는 occupational-health-agent의 `tar-health-screening` 워크플로우와 함께 설계되었다.
`health_screening_ref`는 occupational-health-agent가 생성하는 TAR 건강검진 기록의 `record_id`를
가리키며, occupational-health-agent 측 `contractor_surge_ref` 필드가 본 워크플로우의 기록을
역참조함으로써 양방향 상호 참조를 구성한다.

## 5. 증거 기록 (Evidence Record)
`contractor-tar-surge-record.json` 생성.
