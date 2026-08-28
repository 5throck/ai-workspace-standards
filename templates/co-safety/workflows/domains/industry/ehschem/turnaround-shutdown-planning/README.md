# 정기보수·가동중지 계획 (Turnaround and Shutdown Planning) Workflow

## 매트릭스 위치
산업별 특화 워크플로우. 공통 관심사에 대해서는 기능 서비스(PSM, MSDS, Emergency)를 참조한다.

## 1. 목적
화학공장 운영에 있어 정기보수 및 가동중지 계획을 수립한다.

## 2. TAR 계획 단계별 연계 (Cross-Agent Handoff Sequence)

대정비(Turnaround, TAR) 계획 수립 과정에서 다음 순서로 타 에이전트와 연계한다:

1. **계약자 인원 확정 → contractor-safety-agent**: TAR 투입 계약자 총 인원(headcount)이 확정되면 contractor-safety-agent에 통보하여 `tar-contractor-surge-management` 워크플로우를 통한 대량 사전자격심사(bulk prequalification)를 트리거한다.
2. **계약자 명단 → occupational-health-agent**: 확정된 계약자 인력 명단을 occupational-health-agent에 전달하여 `tar-health-screening` 워크플로우를 통한 TAR 투입 전 건강검진(특수건강진단, 고열/밀폐공간 노출 확인 등)을 진행한다.
3. **비-PSM 설비 식별 → asset-integrity-agent**: PSM 적용 대상이 아닌 설비 목록("non-PSM equipment list")을 식별하여 asset-integrity-agent에 handoff하고, 해당 설비의 TAR 기간 중 점검 일정을 수립하도록 한다.
4. **격리 지점별 LOTO 허가 → functional/psm-agent**: 격리 지점(isolation point)별로 psm-agent의 `loto-lockout-tagout` 워크플로우를 통해 LOTO 허가를 발급하며, 각 허가 기록은 `loto_records_ref`로 추적한다.

이 네 단계의 상호 참조 관계는 `ehschem-turnaround-record.json`의 `contractor_surge_ref`, `health_screening_ref`, `non_psm_equipment_handoff_ref`, `loto_records_ref` 필드에 기록된다.

## 3. 향후 설계 방향 — TAR 기간 중 일일 추적 (Forward-Looking, Not Yet Implemented)

> **주의**: 아래는 향후 구축 예정인 설계 의도(design intent)이며, 현재 구현된 기능이 아니다.

이 워크플로우가 향후 완전히 구축되면, `planned_start_date`부터 `planned_end_date`까지의 기간 동안 `workflows/daily/chemical/`(현재 Pending 상태의 placeholder — 해당 파일 참조)을 활성화하여 계약자 현장 출입, PTW(Permit to Work) 갱신, 일일 안전 순찰 등을 일 단위로 추적하는 것을 의도하고 있다. 이는 설계 방향에 대한 기록일 뿐, 현재 시점에 구현이 완료되었다는 의미가 아니다.

## 4. 증거 기록
`ehschem-turnaround-record.json`을 생성한다.
