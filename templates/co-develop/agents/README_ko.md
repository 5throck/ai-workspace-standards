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
| 아키텍트 | `architect.md` | 구현 계획 및 ADR 작성 |
| 디자이너 | `designer.md` | UI/UX 사양 및 와이어프레임 작성 |
| 코드 작성자 | `code-writer.md` | 승인된 계획 구현 |
| 테스트 실행자 | `test-runner.md` | 수락 기준 확인 |
| 보안 모니터 | `security-monitor.md` | 보안 정책 시행 |
| 스택 설정 | `stack-setup.md` | 알 수 없는 스택 식별 및 설정 |

## 새 에이전트 생성

### 방법 1: CLI (권장)

```bash
bun run agent:create <name> --role "표시 이름" --group <group>

# 예시:
bun run agent:create data-analyst --role "데이터 분석가" --group Technical
bun run agent:create ui-reviewer --group Design
```

### 방법 2: 수동

1. `_examples/agents/analyst-example.md` 템플릿을 복사
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

`AGENTS.md`를 업데이트하여:
1. 에이전트 로스터 테이블에 에이전트 추가/제거
2. 서브에이전트 로스터 테이블에 에이전트 추가/제거
3. `docs/context.md § Agents`를 일치하도록 업데이트

## 에이전트 그룹

- **오케스트레이션/감사** - PM, 보안 모니터
- **디자인** - 아키텍트, 디자이너
- **실행** - 코드 작성자, 테스트 실행자
- **보안/설정** - 스택 설정

전체 워크플로우와 디스패치 프로토콜은 `AGENTS.md`를 참조하세요.

---

*프로젝트 템플릿 - 필요에 따라 사용자 정의하세요*
