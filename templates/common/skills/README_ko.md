# Skills 디렉토리

재사용 가능한 워크플로우 지식을 **스킬**로 정의합니다.

## 스킬이란?

- **에이전트**는 **역할**입니다 (누구인지)
- **스킬**은 **능력**입니다 (무엇을 하는지)

## 구조

각 스킬은 `SKILL.md` 파일이 있는 디렉토리입니다:

```
skills/
├── <skill-name>/
│   └── SKILL.md
└── example-skill/
    └── SKILL.md
```

## 스킬 파일 형식

모든 `SKILL.md`에는 프론트매터가 있어야 합니다:

```yaml
---
name: skill-name
description: 이 스킬이 하는 일에 대한 간단한 설명
metadata:
  type: process | implementation | domain
  triggers:
    - keyword1
    - keyword2
---
```

### 메타데이터 유형

| 유형 | 목적 | 예시 |
|------|------|------|
| `process` | 워크플로우 및 방법론 | debugging, brainstorming, testing |
| `implementation` | 기술적 구현 | frontend-design, api-integration |
| `domain` | 도메인별 지식 | abap-dev, sap-fi, i18n |

## 새 스킬 생성

1. `_examples/skills/example-skill/` 예제 복사
2. `skills/<skill-name>/SKILL.md` 생성
3. 이름, 설명, 유형이 포함된 프론트매터 추가
4. `AGENTS.md § Skills`와 `docs/context.md § Skills` 업데이트
5. `bun run verify-skills` 실행하여 검증

## 스킬 활성화

스킬은 두 가지 방법으로 활성화됩니다:

### Claude Code
- **슬래시 명령**: `.claude/commands/<name>.md`가 스킬로 자동 등록됨
- **수동**: 스킬 이름과 함께 `Skill` 도구로 호출

### Gemini CLI
- **수동**: 스킬 내용을 직접 읽고 따름
- **서브에이전트**: 서브에이전트 프롬프트에 스킬 내용 전달

## 사용 가능한 스킬

이 프로젝트의 모든 스킬 목록은 `AGENTS.md § Skills`를 참조하세요.

## 팁

- 스킬을 단일 기능에 집중하게 유지하세요
- 메타데이터에 명확한 트리거 키워드를 사용하세요
- 예상되는 입력과 출력을 문서화하세요
- 도움이 되는 경우 예시를 포함하세요

---

*스킬 템플릿 - 필요에 따라 사용자 정의하세요*
