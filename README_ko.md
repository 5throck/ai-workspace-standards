# AI 워크스페이스 표준 (AI Workspace Standards)

> **모든 AI 코딩 도구를 아우르는 Vibe Coding 및 Harness Engineering 마스터 구성입니다.**

이 저장소는 워크스페이스 루트 아래의 모든 프로젝트에서 공유되는 표준을 정의합니다. 워크스페이스 루트(Windows의 경우 `C:\git`, macOS/Linux의 경우 `~/git`)로 직접 클론하여 모든 프로젝트가 동일한 AI 행동 지침, 워크플로 및 품질 규칙을 자동으로 상속받도록 설계되었습니다.

---

## 이게 무엇인가요?

현대적인 AI 지원 개발에는 프롬프트 이상의 것이 필요합니다. 모든 프로젝트에 걸쳐 모든 AI 도구가 따르는 **일관되고 강제된 행동 규약(contract)**이 필요합니다. 이 저장소는 다음을 제공합니다:

| 관심사 | 파일 | 대상 |
|---------|------|----------|
| 공유 워크스페이스 표준 | [`CONSTITUTION.md`](CONSTITUTION.md) | 모든 AI 도구 |
| Claude Code 행동 지침 | [`CLAUDE.md`](CLAUDE.md) | Claude Code (CLI + Desktop) |
| Gemini / Antigravity 행동 지침 | [`GEMINI.md`](GEMINI.md) | Gemini CLI + Antigravity 엔진 |
| 변경 이력 | [`CHANGELOG.md`](CHANGELOG.md) | 전체 |

### 두 가지 철학, 하나의 표준

**Vibe Coding (바이브 코딩)** — AI가 주도합니다. 개발자가 의도를 설명하면 AI 에이전트(PM → Architect → Designer → Code Writer → Test Runner)가 자율적으로 전체 워크플로를 실행합니다. 이 표준은 자율적인 실행을 안전하고 감사(audit) 가능하게 유지하는 가드레일을 정의합니다.

**Harness Engineering (하네스 엔지니어링)** — 개발자가 프로세스에 참여합니다. AI 도구는 정밀 도구로서 작동합니다: 외과적 편집, 명시적 계획, 필수 리뷰 게이트. 이 표준은 AI의 결과물을 예측 가능하고 리뷰할 수 있도록 유지하는 하네스를 정의합니다.

---

## 빠른 시작 (Quick Start)

### 1. 워크스페이스 루트로 클론

```bash
# Windows
git clone https://github.com/5throck/ai-workspace-standards.git C:\git

# macOS / Linux
git clone https://github.com/5throck/ai-workspace-standards.git ~/git
```

### 2. 로컬 Git Hooks 활성화

```bash
git config core.hooksPath .githooks
```

### 3. 첫 번째 프로젝트 생성

```bash
# macOS / Linux / Windows (Git Bash)
bash scripts/new-project.sh "my-project-name"

# Windows — 명령 프롬프트 또는 PowerShell
.\scripts\new-project.cmd "my-project-name"
```

> **AI 도구 단축키**: Claude Code에서는 스크립트를 직접 실행하는 대신 `/new-project "my-project-name"` 을 사용할 수 있습니다.

각각의 새로운 프로젝트는 `docs/context.md`, `AGENTS.md`, `agents/pm.md` 및 모든 필수 설정 파일들과 함께 자동으로 스캐폴딩(scaffold)됩니다.

### 4. 새 프로젝트로 이동 및 킥오프 시작

**중요 (CRITICAL)**: 프로젝트 생성이 완료되면 반드시 현재 AI 세션을 종료하고, 방금 생성한 프로젝트 폴더 내부로 이동하여 새로운 AI 세션을 시작해야 합니다. 루트 폴더(최상단)에 계속 머물러 있으면, AI가 프로젝트 전용 환경 설정 파일을 읽지 못해 PM 킥오프 미팅이 생략됩니다.

```bash
# 1. 실행 중인 AI 세션 종료
# 2. 새로 생성된 프로젝트 폴더로 이동
cd "my-project-name"

# 3. 새로운 AI 세션을 시작하여 프로젝트 컨텍스트를 로드
claude
# 또는
agy

# 4. AI에게 PM 킥오프 미팅 시작을 요청
> "PM 에이전트 지침에 맞춰 프로젝트 킥오프 미팅 진행해 줘."
```

---

## 저장소 구조 (Repository Structure)

```
C:\git\ (워크스페이스 루트 — 현재 저장소)
├── CONSTITUTION.md          # 마스터 표준 — 모든 세션에서 가장 먼저 읽어야 함
├── CLAUDE.md                # Claude Code 워크스페이스 동작 설정
├── GEMINI.md                # Gemini CLI / Antigravity 워크스페이스 동작 설정
├── SECURITY.md              # 표준 GitHub 취약점 보고 정책
├── CHANGELOG.md             # 워크스페이스 레벨 변경 이력
├── README.md                # 영문 README
├── README_ko.md             # 본 파일 (국문)
├── .gitleaks.toml           # 시크릿 스캔 설정 (상위 기본값 확장)
├── memory/                  # 워크스페이스 레벨 메모리 로그
├── templates/               # 공식 스캐폴드 — new-project.sh가 이 구조를 복사함
│   ├── agents/              # pm.md, architect.md, designer.md, code-writer.md, test-runner.md, security-monitor.md
│   ├── docs/                  
│   │   ├── context.md       # 전체 10개 섹션의 프로젝트 컨텍스트 템플릿
│   │   └── security.md      # 내부 데이터 삭제(Sanitization) 가이드라인
│   ├── scripts/             # dev-sync.sh/.cmd, sync-md.sh/.cmd, audit.sh/.cmd
│   ├── .claude/             # settings.json ({}), commands/changelog.md, sync.md, 등
│   ├── .gemini/             # settings.json ({}), commands/changelog.md, sync.md, 등
│   ├── .githooks/           # pre-commit (스마트 조건부 검사), pre-push
│   ├── .github/             # GitHub 템플릿 (CODEOWNERS, workflows, dependabot)
│   ├── SECURITY.md          # GitHub 보안 정책 템플릿
│   └── _examples/           # 참고용 ADR, analyst 에이전트, 세션 로그, 스킬
├── scripts/
│   ├── audit.sh / .cmd      # 문서 감사 (## Coding Guidelines, CHANGELOG 등 검사)
│   ├── dev-sync.sh / .cmd   # 전체 파이프라인: memlog → sync-md → changelog → audit → commit → PR
│   ├── sync-md.sh / .cmd    # MEMORY.md 인덱스 업데이트
│   └── new-project.sh / .cmd # 새 프로젝트 스캐폴딩 (templates/ 복사)
├── .githooks/
│   ├── pre-commit           # 스마트 조건부 감사 (memory/ 파일 예외 처리)
│   └── pre-push             # main 브랜치로의 직접 push 차단
├── .claude/
│   ├── settings.json        # {} (훅 비활성화됨; pre-commit + dev-sync를 통해 강제 적용)
│   └── commands/            # 커스텀 슬래시 명령어 (/sync, /changelog, /memlog 등)
└── .gemini/
    └── settings.json        # Gemini CLI 프로젝트 설정
```

각 하위 프로젝트는 자체 디렉토리 및 개별 Git 저장소로 관리됩니다:

```
C:\git\
├── my-project\              # 독립적인 git 저장소
│   ├── docs/context.md      # 프로젝트 지식 (모든 AI 도구 공통)
│   ├── AGENTS.md            # 에이전트 인덱스
│   ├── CLAUDE.md            # 프로젝트 레벨 Claude Code 오버라이드
│   └── GEMINI.md            # 프로젝트 레벨 Gemini 오버라이드
└── another-project\         # 또 다른 독립적인 git 저장소
```

---

## 세션 시작 체크리스트 (Session Start Checklist)

모든 AI 세션은 다음 체크리스트를 실행하며 시작됩니다 (`CONSTITUTION.md`에 정의됨):

0. `git config core.hooksPath .githooks`
1. `CONSTITUTION.md` (워크스페이스 표준) 읽기
2. 프로젝트의 `docs/context.md` 읽기
3. `AGENTS.md` (공식 에이전트 명단) 읽기
4. 최근 변경 사항 파악을 위해 `memory/MEMORY.md` 확인
5. `docs/context.md ## Session Start Skills`에서 스킬 로드

---

## 멀티 에이전트 워크플로 (Multi-Agent Workflow)

프로젝트는 6단계 거버넌스 단계에 걸쳐 5역할 에이전트 모델을 사용합니다:

```
PM Orchestrator (PM 오케스트레이터)
  │
  ├── Phase 1-2: Analysis agents (병렬 분석)  → 분석 결과 + 수용 조건 (Acceptance criteria)
  ├── Phase 3:   Architect + Designer       → 구현 계획 + 디자인 스펙 (사용자 승인 필수)
  ├── Phase 4:   Code Writer + Test Runner  → 구현 + 검증
  ├── Phase 5:   QA gate                    → audit.sh 실행 및 테스트 통과 확인
  └── Phase 6:   Finalization (마무리)       → memlog → sync → PR 생성
```

모든 역할에 대한 에이전트 스캐폴드 템플릿은 `templates/agents/`에 존재합니다.

---

## 설계 원칙 (Design Principles)

- **`docs/context.md`는 모든 프로젝트의 단일 진실 공급원(SSOT)**입니다 — 모든 AI 도구가 이를 공유합니다.
- **`CLAUDE.md` / `GEMINI.md` (프로젝트 레벨)는 플랫폼 특화 오버라이드만 포함합니다.**
- **PR 전용 워크플로** — 모든 변경 사항은 Pull Request를 통해 `main` 브랜치에 도달합니다. 직접 push는 `.githooks/pre-push`에 의해 차단됩니다.
- **Conventional Commits** — `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `test:` / `perf:` / `ci:` / `style:` / `revert:`
- **크로스 플랫폼 스크립트** — 모든 `.sh` 파일은 동일한 동작을 하는 `.cmd`/`.ps1` 파일과 짝을 이룹니다.
- **코딩 가이드라인 감사** — `docs/context.md`에 `## Coding Guidelines`이 누락된 경우 `audit.sh`가 빌드를 실패 처리합니다.
- **보안 중심 스캐폴드** — 프로젝트에는 자격 증명 유출을 방지하기 위한 시크릿 탐지(`.gitleaks.toml`), `SECURITY.md`, 그리고 안전한 pre-commit 훅이 자동으로 장착됩니다.

---

## 기여하기 (Contributing)

이 저장소는 **공개 저장소(Public Repository)**입니다. 누구나 Pull Request를 통해 기여할 수 있습니다.

1. `pr/<YYYYMMDD-HHmmss>-<slug>` 네이밍 규칙을 사용하여 `main`에서 브랜치를 땁니다.
2. 모든 PR은 `bash scripts/audit.sh`를 통과해야 합니다.
3. 병합(merge)하기 전에 `[Unreleased]` 아래에 `CHANGELOG.md` 항목을 추가합니다.
4. `CONSTITUTION.md §8 — Coding Behavior Guidelines`를 준수합니다.
5. 병합하기 전에 최소 **1명의 승인 리뷰(approving review)**가 필요합니다.

---

## 라이선스 (License)

AGPL-3.0 — [LICENSE](LICENSE) 파일 참조

---

*Maintained by [@5throck](https://github.com/5throck)*
