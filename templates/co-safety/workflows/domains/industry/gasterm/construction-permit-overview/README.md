# 건설인허가 전체 관리 (Construction Permit Overview) Workflow

## 1. 목적
본 워크플로우는 가스 시설(고압가스, 액화석유가스, 도시가스)의 건설/인허가 전체 라이프사이클을 관리하는 오케스트레이터이다. 가스 3법에 따른 KGS Code 준거 3단계 인허가 절차(사전기술검토 → 중간검사 → 완성검사)를 순차적으로 dispatch하고 상태를 추적한다.

## 2. 관련 법령
- 고압가스 안전 관리 및 사업법 제22조의2, 시행규칙 제7조
- 액화석유가스의 안전관리 및 사업법 제27조의2, 제45조
- 도시가스사업법 제17조의5

## 3. 오케스트레이션 단계
1. **Phase 1** — 사전기술검토 (`pre-construction-technical-review`)
2. **Phase 2** — 중간검사 (`mid-construction-inspection`) — Phase 1 합격 시에만 dispatch
3. **Phase 3** — 완성검사 (`completion-inspection`) — Phase 2 합격 시에만 dispatch
4. **완료** — 지자체 허가증 발급, 정기검사 주기 설정 (운영 단계 인수)

## 4. 상태 추적
각 phase의 상태를 `not_started | in_progress | passed | failed`로 추적하며, `depends_on` 필드가 `passed`일 때만 다음 단계를 dispatch한다.

## 5. 증거 기록
다중 출처의 `legal_basis`를 포함하여 `gasterm-construction-permit-overview-record.json`을 생성한다.

## 6. 법적 면책 고지
> 본 시스템은 워크플로우 자동화 지원만 제공하며, 최종 판단은 자격을 갖춘 가스안전관리자 및 한국가스안전공사(KGS) 검사관의 검토가 필요합니다. 공사인허가는 지자체의 권한이며, KGS 기술검토 결과는 허가 심사의 참고 자료입니다.
