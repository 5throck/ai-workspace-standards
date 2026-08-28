# 완성검사 (Completion Inspection) Workflow

## 1. 목적
본 워크플로우는 한국 가스안전 관련 법령(고압가스 안전 관리 및 사업법 (High-Pressure Gas Safety Control and Business Act) 제22조의2·제13조, 액화석유가스의 안전관리 및 사업법 (LPG Safety Control and Business Act) 제37조·제45조, 도시가스사업법 (City Gas Business Act) 제17조의5)에 따른 KGS 입회 완성검사를 관리한다. 전체 공사 완료 후 종합 검사를 수행하고, 합격 시 지자체 허가증 발급 및 운영 개시 절차를 포함한다.

## 2. 전제 조건
- 중간검사(Phase 2) 합격 완료증이 필수

## 3. 워크플로우 단계
1. 완성검사 신청 — 전체 공사 완료 후 KGS에 신청
2. 사전 점검 — 가스누출 시험, 압력시험, 전기식 안전장치 점검
3. KGS 입회 완성검사 — 전체 시설 종합 검사
4. 시정 조치 (필요시) — 부적합 항목 시정 및 재검사
5. 지자체 허가증 발급 — KGS 합격 결과 → 지자체 변경허가 완료
6. 운영 개시 — 안전관리자 선임 확인, 정기검사 주기 설정

## 4. 증거 기록
다중 출처의 `legal_basis`를 포함하여 `gasterm-completion-inspection-record.json`을 생성한다.

## 5. 법적 근거 (Legal Basis)
출처: 본 워크플로우 `schema.yaml`의 `legal_basis`. 아래 인용 문자열은 `schema.yaml`과 정확히 일치(VERBATIM)한다.

- 고압가스 안전 관리 및 사업법 Article 22-2
- 고압가스 안전 관리 및 사업법 Article 13
- 액화석유가스의 안전관리 및 사업법 Article 37
- 액화석유가스의 안전관리 및 사업법 Article 45
- 도시가스사업법 Article 17-5

## 6. 규제 참고사항 (Regulatory Notes)
HPGSCA 인용은 compliance-agent가 실시간 MCP legalize_kr 검증을 거친 remediated 조문(Art 11/13/15/24/26)이다 — kr_safety 카탈로그는 HPGSCA에 대해 stale(삭제된 Art 14 인덱싱)하므로 k-law 스킬(법제처 Open API)을 우선한다.

## 7. 법적 면책 고지
> 본 시스템은 워크플로우 자동화 지원만 제공하며, 최종 판단은 자격을 갖춘 가스안전관리자 및 한국가스안전공사(KGS) 검사관의 검토가 필요합니다. 공사인허가는 지자체의 권한입니다.
