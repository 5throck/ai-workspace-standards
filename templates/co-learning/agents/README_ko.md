# 에이전트 디렉토리 (Agents Directory)

이 디렉토리에는 멀티 에이전트 워크플로우에서 사용되는 에이전트 정의 파일이 있습니다.

## 에이전트 파일

각 에이전트는 마크다운 파일(`<name>.md`)로 정의되며 다음을 포함합니다:

- **역할 설명** - 에이전트가 수행하는 작업
- **책임** - 에이전트가 처리하는 주요 작업
- **제약 조건** - 에이전트가 할 수 있는 작업의 제한
- **출력 형식** - 예상되는 출력 구조
- **핸드오프 규칙** - 어떤 에이전트에서 받고 어떤 에이전트로 전달하는지

## 사용 가능한 에이전트

| 에이전트 | 파일 | 역할 |
|---------|------|------|
| PM 오케스트레이터 | `pm.md` | 워크플로우 소유, 병렬 작업 디스패치 |
| 시험 문항 관리자 | `exam-bank-steward.md` | 문항 은행 큐레이션(작성 품질, 답안 길이 편향 검토, 개선 워크플로) 및 시험 운영(기수, 응시 창, 활성화, 통계 모니터링) |
| I18N 스페셜리스트 | `i18n-specialist.md` | 로캘 문서 및 로캘 미러 번역 동기화 (common extends-stub; 필요 시 투입) |

## 새 에이전트 생성

### 방법 1: CLI (권장)

```bash
bun run agent:create <name> --role "표시 이름" --group <group>

# 예시:
bun run agent:create data-analyst --role "데이터 분석가" --group Technical
bun run agent:create ui-reviewer --role "UI 리뷰어" --group Design
```

### 방법 2: 수동

1. `docs/_examples/agents/analyst-example.md` 템플릿을 복사 (프로젝트 생성 시 `templates/common`에서 전달됨)
2. 이 디렉토리에 `<name>.md` 파일 생성
3. 템플릿 구조를 따라 에이전트 정의 작성

## 에이전트 목록

```bash
bun run agent:list
bun run agent:list --group Technical
bun run agent:list --verbose
```

## 에이전트 삭제

```bash
bun run agent:delete <name>
bun run agent:delete <name> --force  # 확인 건너뛰기
```

## 에이전트 생성/후 작업

`AGENTS.md`를 갱신하여:
1. 에이전트 로스터 테이블에 에이전트 추가/제거
2. 서브에이전트 로스터 테이블에 에이전트 추가/제거
3. `docs/context.md § Agents`를 일치하도록 갱신

## 에이전트 그룹

- **오케스트레이션** - PM
- **학습/제공** - 시험 문항 관리자
- **현지화** - I18N 스페셜리스트

전체 워크플로우와 디스패치 프로토콜은 `AGENTS.md`를 참조하세요.

## 핸드오프 명세

에이전트 간 JSON 기반 핸드오프 형식은 [`handoff-spec.md`](../docs/handoff-spec_ko.md)를 참고하세요.

---

*프로젝트 템플릿 - 필요에 따라 사용자 정의하세요*
