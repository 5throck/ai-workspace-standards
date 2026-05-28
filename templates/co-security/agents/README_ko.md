# 에이전트 디렉토리

이 디렉토리에는 co-security 보안 인게이지먼트 워크플로우에서 사용되는 에이전트 정의 파일이 포함되어 있습니다.

## 사용 가능한 에이전트

| 에이전트 | 파일 | 역할 |
|---------|------|------|
| 보안 PM | `pm.md` | 단일 진입점 — 인가, 범위 정의, 인게이지먼트 워크플로우 총괄 |
| 레드팀 리드 | `red-team-lead.md` | 공격 방법론, MITRE ATT&CK TTP 설계, PoC 검토 |
| 펜테스터 | `pentester.md` | 취약점 발견, PoC 개발, 재검증 |
| 위협 모델러 | `threat-modeler.md` | STRIDE 분석, ATT&CK 매핑, 위험 점수 산정 |
| 패치 엔지니어 | `patch-engineer.md` | Ansible 기반 크로스플랫폼 패치 배포 |
| 리포트 라이터 | `report-writer.md` | 펜테스트 보고서, 경영진 요약본 작성 |

## ⚠️ 인가 문서 필수

PM을 제외한 모든 에이전트는 디스패치 전 인가 문서 확인이 필요합니다.
PM은 Phase 1+ 작업 전 `verify-authorization` 스킬을 자동으로 실행합니다.

## 에이전트 생성

```bash
bun run agent:create <name> --role "Display Name" --group Security
```

에이전트 생성 후 `AGENTS.md`와 `docs/co-security.context.md § Agents`를 업데이트하세요.

전체 인게이지먼트 워크플로우(Phase 0–6)는 `AGENTS.md`를 참고하세요.
