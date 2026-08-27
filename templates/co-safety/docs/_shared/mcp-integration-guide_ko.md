# MCP 통합 가이드

> **목적**: Safety OS가 규제 인덱스 데이터를 위해 한국 규제 MCP 서버와 어떻게 연결되는지 설명합니다.
>
> **2026-08-26**: `legalize_kr` 및 `mcp_kr_legislation` MCP 서버는 제거되었습니다 (`k-law` 스킬이 대체 — 법제처 Open API가 유일한 실시간 법령 원문 소스). MCP 서버는 `kr_safety`만 유지됩니다.

## 1. 사용 가능한 MCP 서버

Safety OS는 1개의 한국 규제 MCP 서버를 포함합니다:

| 서버 | 위치 | 도구 | 목적 |
|--------|----------|-------|---------|
| `kr_safety` | `mcp/kr-safety-regs/` | 5개 도구 | 한국 안전 규제 검색 (OSHA-KR, SAPA, CCA), 컴플라이언스 갭 분석 |

법령 원문(법령 텍스트, 조문 구조, 개정 이력)은 MCP가 아닌 **`k-law` 스킬**(법제처 Open API)을 통해 실시간 조회됩니다.

## 2. 설정

MCP 서버는 `.mcp.json`에 설정됩니다:

```json
{
  "mcpServers": {
    "kr_safety": {
      "command": "bun",
      "args": ["run", "--env-file", ".env", "./mcp/kr-safety-regs/index.ts"]
    }
  }
}
```

## 3. 도메인 통합 지점

### PSM 도메인
- `regulations/KR/OSHA-KR-*.yaml` — 좌표 레지스트리; 조문 원문은 k-law 스킬로 실시간 조회

### MSDS 도메인
- `regulations/KR/OSHA-KR-MSDS.yaml` — 좌표 레지스트리
- `regulations/KR/K-REACH.yaml` — 좌표 레지스트리
- 컴플라이언스 갭 분석을 위한 kr_safety 도구 (OSHA-KR, SAPA 조항)

### 컴플라이언스 에이전트 (도메인 공통)
`agents/_shared/compliance-agent.md` (2026-07-11 갱신)는 실시간 법령 검증을 임시 활동이 아닌 표준 절차로 명문화했습니다:
- `mcp__kr_safety__search_osha_regulations`, `mcp__kr_safety__check_compliance_gaps` — 실시간 OSHA-KR 규정 조회 및 갭 체크
- `k-law` 스킬 — 실시간 한국 법령 검증 (조문 번호, 개정 이력)
- `legal_basis` 필드에 인용하기 전 조문 번호 정확성을 검증하는 데 사용됨 — 이 프로젝트는 오인용 이력이 문서화되어 있으며(`memory/findings/compliance-gap-2026-07-05-all-domains.md` 참조), 실시간 검증이 이를 방지합니다.

### GMP 도메인
- `regulations/KR/MFDS-GDP.yaml` — 좌표 레지스트리

### 모든 도메인
- v2 좌표 레지스트리는 `source_verification` (method + checked_at) 보유; 레거시 `source_mcp` 필드는 더 이상 강제하지 않음
- 감사 스크립트가 좌표 모드 파일의 `source_verification`을 검증

## 4. 워크플로우 내 활용

에이전트는 워크플로우 실행 중 규제 데이터를 조회할 수 있습니다:

```
1. 에이전트가 작업 수신
2. 에이전트가 현행 법령 원문을 k-law 스킬로 조회 (OSHA-KR/SAPA 인덱스는 kr_safety)
3. 에이전트가 현행 법령 대비 워크플로우 legal_basis 검증
4. 에이전트가 검증된 법령 참조를 포함한 증거 기록 생성
```

## 5. 환경 설정

```bash
# .env 파일
LAW_API_OC=...                 # 법제처 Open API OC 키 — k-law 스킬에 필수
# kr-safety-regs은 캐시된 데이터 + 실시간 API 사용 (토큰 불필요)
```

## 6. 향후 통합 (v2)

- 실시간 법령 개정 알림
- 규제 변경 시 legal_basis 자동 갱신
- ML 기반 규제 해석
- 실제 법령 텍스트 대비 교차 참조 검증
