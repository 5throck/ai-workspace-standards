# 에이전트 디렉토리

이 디렉토리에는 co-work 협업 워크플로우에서 사용되는 에이전트 정의 파일이 포함되어 있습니다.

## 사용 가능한 에이전트

| 에이전트 | 파일 | 역할 |
|---------|------|------|
| 협업 PM | `pm.md` | 리서치 워크플로우, 문서화 전략, 이해관계자 조율 |
| 분석가 | `analyst.md` | 리서치 종합, 데이터 분석, 근거 수집 |
| 콘텐츠 라이터 | `content-writer.md` | 보고서, 아티클, 구조화된 콘텐츠 초안 작성 |
| MS365 전문가 | `ms365-expert.md` | Microsoft 365 도구, SharePoint, Teams 연동 |
| 프로젝트 코디네이터 | `project-coordinator.md` | 태스크 추적, 일정 관리, 회의 진행 |
| 스토리텔러 | `storyteller.md` | 내러티브 구조, 대상 독자별 커뮤니케이션 |
| 테크니컬 라이터 | `technical-writer.md` | 기술 문서, API 문서, 프로세스 가이드 |

## 에이전트 생성

```bash
bun run agent:create <name> --role "표시 이름" --group <그룹>

# 예시:
bun run agent:create data-analyst --role "Data Analyst" --group Research
bun run agent:create ux-writer --role "UX Writer" --group Content
```

에이전트 생성 후 `AGENTS.md`와 `docs/co-work.context.md § Agents`를 업데이트하세요.

## 에이전트 목록 조회

```bash
bun run agent:list
bun run agent:list --group Research
```

## 에이전트 삭제

```bash
bun run agent:delete <name>
```

전체 워크플로우 및 디스패치 프로토콜은 `AGENTS.md`를 참고하세요.
