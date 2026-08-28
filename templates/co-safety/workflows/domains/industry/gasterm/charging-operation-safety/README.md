# 충전 작업 안전 (Charging Operation Safety) Workflow

## 1. 목적
본 워크플로우는 한국 가스안전 관련 법령(액화석유가스의 안전관리 및 사업법 (LPG Safety Control and Business Act) 제29조, 수소경제 육성 및 수소안전관리에 관한 법률 (Hydrogen Economy Promotion and Hydrogen Safety Management Act) 제32조, 고압가스 안전 관리 및 사업법 (High-Pressure Gas Safety Control and Business Act) 제13조)에 따른 가스 충전 작업 안전 관리를 수행한다.

## 2. 워크플로우 단계
1. 사전 작업 점검
2. 실행
3. 작업 후 검증
4. 문서화 및 감사 추적

## 3. 증거 기록
다중 출처의 `legal_basis`를 포함하여 `gasterm-charging-operation-record.json`을 생성한다.

## 4. 법적 근거 (Legal Basis)
출처: 본 워크플로우 `schema.yaml`의 `legal_basis`. 아래 인용 문자열은 `schema.yaml`과 정확히 일치(VERBATIM)한다.

- LPG 안전관리법 Article 29
- 수소법 Article 32
- 고압가스 안전 관리 및 사업법 Article 13

## 5. 규제 참고사항 (Regulatory Notes)
HPGSCA 인용은 compliance-agent가 실시간 MCP legalize_kr 검증을 거친 remediated 조문(Art 11/13/15/24/26)이다 — kr_safety 카탈로그는 HPGSCA에 대해 stale(삭제된 Art 14 인덱싱)하므로 k-law 스킬(법제처 Open API)을 우선한다.

## 6. 법적 면책 고지
> 본 시스템은 워크플로우 자동화 지원만 제공하며, 최종 판단은 자격을 갖춘 가스안전관리자의 검토가 필요하다.
