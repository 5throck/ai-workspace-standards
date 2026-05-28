---
translated_from_hash: PLACEHOLDER
sync_version: 1
---

# Co-Develop 템플릿

AI 지원 소프트웨어 개발 워크스페이스 템플릿. Claude와 Gemini AI 어시스턴트의 멀티 에이전트 아키텍처를 활용한 협업 코딩에 최적화되어 있습니다.

## 개요

co-develop 템플릿은 여러 AI 어시스턴트를 병렬로 활용하는 소프트웨어 프로젝트를 위한 즉시 사용 가능한 워크스페이스를 제공합니다. Claude Code(`CLAUDE.md`)와 Gemini(`GEMINI.md`)를 구조화된 멀티 에이전트 시스템과 결합하여, 모든 프로젝트에 일관된 커맨드, 에이전트 역할, 품질 게이트를 첫날부터 제공합니다.

주요 특징:

- **듀얼 AI 지원** — Claude와 Gemini 설정이 함께 제공되어, 별도 설정 없이 두 어시스턴트를 모두 사용할 수 있습니다.
- **멀티 에이전트 아키텍처** — 전문화된 에이전트(PM, Architect, Auditor 등)가 작업의 각 단계를 담당하여 단일 세션의 컨텍스트 과부하를 줄입니다.
- **의견이 반영된 워크플로우** — Pre-commit 훅, 감사 스크립트, 동기화 파이프라인이 품질 기준을 자동으로 적용합니다.
- **슬래시 커맨드 기반** — 일상적인 작업을 슬래시 커맨드로 노출하여 일관되고 빠른 작업 흐름을 유지합니다.

## 빠른 시작

```bash
bash scripts/new-project.sh "project-name" --variant co-develop
```

이 명령은 워크스페이스 루트 아래에 새 프로젝트 디렉터리를 스캐폴딩하고, co-develop 템플릿 파일을 모두 복사하며, 초기 변수 치환(프로젝트 이름, 날짜)을 수행합니다.

스캐폴딩 후:

1. 편집기에서 새 프로젝트 디렉터리를 엽니다.
2. `CLAUDE.md` / `GEMINI.md`를 검토하고 프로젝트별 컨텍스트로 업데이트합니다.
3. `/sync "chore: initial scaffold"`를 실행하여 첫 번째 커밋과 PR을 생성합니다.

## 프로젝트 구조

```
<project-name>/
├── CLAUDE.md               # Claude Code 동작 설정
├── GEMINI.md               # Gemini 동작 설정
├── CONSTITUTION.md         # 공유 워크스페이스 표준 (루트에서 심볼릭 링크)
├── AGENTS.md               # 에이전트 목록 및 디스패치 규칙
├── CHANGELOG.md            # 미릴리스 및 버전별 변경 이력
├── agents/                 # 에이전트별 역할 정의 파일
│   ├── pm.md
│   ├── architect.md
│   ├── automation-engineer.md
│   ├── security-expert.md
│   ├── docs-writer.md
│   └── auditor.md
├── docs/                   # 프로젝트 문서
├── memory/                 # 일별 세션 로그 (YYYY-MM-DD.md)
└── scripts/                # 유틸리티 스크립트 (audit.sh, dev-sync.sh 등)
```

## 사용 가능한 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/sync "feat: ..."` | 전체 파이프라인 — memlog → sync-md → changelog → audit → commit → PR |
| `/changelog "..."` | `CHANGELOG.md`의 `[Unreleased]` 섹션에 항목 추가 |
| `/memlog "summary"` | 오늘의 메모리 로그에만 세션 요약 추가 |
| `/meeting` | 구조화된 멀티 에이전트 미팅 진행 (인라인 역할극, 에이전트 스폰 없음) |
| `/new-task "name"` | 오늘의 메모리 로그에 태스크 추적 블록 생성 |

모든 커맨드는 `.claude/commands/`에 정의되어 있으며 Claude Code에 의해 Skills로 자동 등록됩니다.

## 에이전트

co-develop 템플릿에는 여섯 개의 전문화된 에이전트가 포함됩니다. 각 에이전트의 역할 정의는 `agents/<name>.md`에 있습니다.

| 에이전트 | 담당 역할 |
|---------|----------|
| **PM** | 계획 조율, 스펙 작성, 태스크 순서 관리 |
| **Architect** | 시스템 설계, ADR 작성, 의존성 결정 |
| **Automation-Engineer** | 스크립트 작성, CI/CD, 인프라 자동화 |
| **Security-Expert** | 위협 모델링, 의존성 감사, 보안 기본값 검토 |
| **Docs-Writer** | 기술 문서 작성, README 관리, 변경 이력 작성 |
| **Auditor** | 구현 후 검수 기준 검증 |

에이전트는 네이티브 `Agent` 툴을 통해 디스패치합니다. 파일 경로를 참조하는 대신 `agents/<name>.md` 내용을 프롬프트에 직접 포함하세요 — 서브 에이전트는 부모 세션과 파일시스템 컨텍스트를 공유하지 않습니다.

## 설정

### CLAUDE.md

Claude Code 동작을 제어합니다: 자동화 훅, 슬래시 커맨드 정의, plan-mode 규칙, 태스크 추적 규칙, Git/PR 표준. Gemini 워크플로우에 영향을 주지 않고 Claude 전용 동작을 조정하려면 이 파일을 수정하세요.

### GEMINI.md

Gemini CLI를 위한 동작 설정을 미러링합니다. `CLAUDE.md`와 일관된 표현을 유지하면서 Gemini 전용 규칙(`/google-search` 통합, Gemini 모델 티어 등)에 맞게 조정됩니다.

두 파일 모두 `CONSTITUTION.md`에서 공유 표준을 상속받습니다. 모든 AI 어시스턴트에 적용되는 정책을 업데이트할 때는 `CONSTITUTION.md`를 먼저 수정한 후 `CLAUDE.md`와 `GEMINI.md`에 변경 사항을 전파하세요.
