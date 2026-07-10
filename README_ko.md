---
translated_from_hash: PLACEHOLDER
sync_version: 1
---

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

**Vibe Coding (바이브 코딩)** - AI가 주도합니다. 개발자가 의도를 설명하면 AI 에이전트(PM → Architect → Designer → Code Writer → Test Runner)가 자율적으로 전체 워크플로를 실행합니다. 이 표준은 자율적인 실행을 안전하고 감사(audit) 가능하게 유지하는 가드레일을 정의합니다.

**Harness Engineering (하네스 엔지니어링)** - 개발자가 프로세스에 참여합니다. AI 도구는 정밀 도구로서 작동합니다: 외과적 편집, 명시적 계획, 필수 리뷰 게이트. 이 표준은 AI의 결과물을 예측 가능하고 리뷰할 수 있도록 유지하는 하네스를 정의합니다.

---

## 사전 요구 사항 (Prerequisites)

이 워크스페이스를 사용하기 전에 필수 소프트웨어가 설치되어 있는지 확인하세요.

> **📖 상세 가이드**: 전체 설치 지침 및 문제 해결은 [시작 가이드](docs/getting-started.md)를 참조하세요.

### 필수 도구

| 도구 | 버전 | 용도 | 설치 |
|------|------|------|------|
| **Git** | 2.x+ | 버전 관리 및 훅 자동화 | [git-scm.com](https://git-scm.com/downloads) |
| **Bun** ⭐ | 1.x+ | TypeScript 스크립트, 프로젝트 생성 (필수) | `curl -fsSL https://bun.sh/install \| bash` |

**주요 변경사항**: Bun은 이제 프로젝트 생성에 **필수**입니다 (Python/PowerShell 인라인 코드를 대체합니다).

### 선택적 도구

| 도구 | 용도 | 설치 |
|------|------|------|
| **GitHub CLI (gh)** | PR 자동화 | [cli.github.com](https://cli.github.com/) |

### 빠른 확인

```bash
# 필수 도구 확인
git --version    # 2.x.x 이상이어야 합니다
bun --version    # 1.x.x 이상이어야 합니다
gh --version     # 선택 사항: PR 자동화
```

**설치 안내**: 자세한 설치 지침은 [시작 가이드](docs/getting-started.md#-essential-software-must-have)를 참조하세요.

---

## 빠른 시작 (Quick Start)

### 0. 사전 요구 사항 설치 (필요한 경우)

```bash
# Bun 설치 (필수) — https://bun.sh/docs/installation
curl -fsSL https://bun.sh/install | bash   # Unix/Linux/macOS
powershell -c "irm bun.sh/install.ps1 | iex"  # Windows

# 설치 확인
git --version
bun --version
```

> **참고**: `scripts/install-bun.sh` 및 `install-bun.ps1`은 제거되었습니다. 워크스페이스 스크립트를 사용하기 전에 [bun.sh](https://bun.sh)에서 직접 Bun을 설치하세요.

### 1. 워크스페이스 루트로 클론

```bash
# Windows
git clone https://github.com/5throck/ai-workspace-standards.git C:\git

# macOS / Linux
git clone https://github.com/5throck/ai-workspace-standards.git ~/git
```

### 2. Claude Code 열기 (또는 선호하는 AI 도구)

```bash
claude
```

> Git 훅 (`.githooks/`)은 `.claude/settings.json`의 `SessionStart` 훅을 통해 첫 Claude 세션 시작 시 자동으로 구성됩니다 — 별도의 `git config`가 필요하지 않습니다.

### 3. 첫 번째 프로젝트 생성

```bash
# 기본값 (최신 템플릿, co-develop variant) — 모든 플랫폼 동일
bun scripts/new-project.ts "my-project-name"

# variant 지정
bun scripts/new-project.ts "my-project-name" --variant co-develop

# 특정 템플릿 버전 사용 (목록 확인: bun scripts/list-template-versions.ts)
bun scripts/new-project.ts "my-project-name" --version 0.5.0
```

> **[Breaking Change — 2026-06-11]**: `bash scripts/new-project.sh` 및 `.\scripts\new-project.ps1`은 `bun scripts/new-project.ts`로 대체되었습니다 (ADR-0036). 기존 alias나 CI 파이프라인을 업데이트하세요.

> **AI 도구 단축키**: Claude Code에서는 스크립트를 직접 실행하는 대신 `/new-project "my-project-name"`을 사용할 수 있습니다.

각 새 프로젝트는 선택한 template variant를 기반으로 `docs/context.md`, `AGENTS.md`, `agents/pm.md` 및 모든 필수 설정 파일과 함께 생성됩니다. 사용된 템플릿 버전과 variant는 추적 가능성을 위해 `docs/context.md`에 기록됩니다.

### 4. 새 프로젝트로 이동 및 PM 킥오프 시작

**중요 (CRITICAL)**: 프로젝트 생성이 완료되면 반드시 현재 AI 세션을 종료하고, 방금 생성한 프로젝트 폴더 내부로 이동하여 새로운 AI 세션을 시작해야 합니다. 루트 폴더(최상단)에 계속 머물러 있으면, AI가 프로젝트 전용 환경 설정 파일을 읽지 못해 PM 킥오프 미팅이 생략됩니다.

**더 나은 결과를 위한 컨텍스트 제공**

PM 에이전트는 다음 정보를 명확히 제공할 때 가장 잘 작동합니다:
1. **프로젝트 목표** - 무엇을 만들 것인가
2. **에이전트 팀 힌트** (선택 사항) - 제안하는 전문 에이전트
3. **기대 결과물** - 구현 계획, 디자인, 코드

```bash
# 1. 실행 중인 AI 세션 종료
# 2. 새로 생성된 프로젝트 폴더로 이동
cd "my-project-name"

# 3. 새로운 AI 세션을 시작하여 프로젝트 컨텍스트를 로드
claude
# 또는
agy
```

**예시: 테트리스 게임 만들기**

```
> "TypeScript로 테트리스 게임을 만들어 줘. 전문 에이전트 팀을 구성해
> 줘 (game-design은 게임 메카닉, game-logic은 충돌 감지, graphics는
> 렌더링, qa는 테스트 담당). 킥오프 미팅을 시작해서 구현 계획을
> 만들어 줘."
```

이렇게 하면 PM 에이전트가 다음을 명확히 이해할 수 있습니다:
- 요구사항을 분석
- 적절한 에이전트 팀 구성 (기본 또는 커스텀)
- 초점이 맞춰진 킥오프 아젠다 생성
- 승인을 위한 구체적인 계획 제시

---

## 저장소 구조 (Repository Structure)

```
C:\git\ (워크스페이스 루트 - 현재 저장소)
├── CONSTITUTION.md          # 마스터 표준 - 모든 세션에서 가장 먼저 읽어야 함
├── CLAUDE.md                # Claude Code 워크스페이스 동작 설정
├── GEMINI.md                # Gemini CLI / Antigravity 워크스페이스 동작 설정
├── SECURITY.md              # 표준 GitHub 취약점 보고 정책
├── CHANGELOG.md             # 워크스페이스 레벨 변경 이력
├── README.md                # 영문 README
├── README_ko.md             # 본 파일 (국문)
├── memory/                  # 워크스페이스 레벨 메모리 로그
├── agents/                  # Workspace-level specialist agents
├── skills/                  # Workspace-level reusable skills
├── tests/                   # Integration and unit test suites
├── scripts/                 # 공통 자동화, 템플릿 검증 및 문서 감사 스크립트
├── .githooks/               # PR 산출물 강제 및 시크릿 검사를 위한 Git 훅
├── .claude/ & .gemini/      # AI 툴 전역 설정 및 커스텀 슬래시 명령어
└── templates/               # 새 프로젝트 스캐폴딩을 위한 버전 관리 템플릿들
    ├── common/              # 모든 템플릿이 공통으로 사용하는 스크립트/스킬/깃훅
    ├── co-develop/          # ✅ Stable — 종합 소프트웨어 개발 에이전트 팀
    ├── co-design/           # ✅ Stable — 특화된 UI/UX 디자인 에이전트 팀
    ├── co-work/             # ✅ Stable — 범용 협업 및 문서화 에이전트 팀
    ├── co-security/         # ✅ Stable — 레드팀 및 위협 모델링 에이전트 팀
    ├── co-consult/          # ✅ Stable — 전략 컨설팅 및 분석 에이전트 팀
    ├── co-deck/             # 🔶 Beta — 강연 자료 및 프레젠테이션 제작 에이전트 팀
    └── co-game/             # 🔶 Beta — HTML5 Canvas 게임 개발 에이전트 팀
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

이 워크스페이스의 각 템플릿 변형(Variant)은 목적에 맞게 고도로 최적화된 고유의 **다중 에이전트 워크플로와 에이전트 팀**을 제공합니다. 

- **co-develop**: 소프트웨어 개발 및 검증을 위한 6단계 선형 거버넌스 파이프라인
- **co-design**: 빠른 프로토타이핑과 지속적인 사용자 검증에 초점을 맞춘 5단계 반복형(Iterative) 디자인 네이티브 워크플로
- **co-work**: 병렬 작성과 지속적인 이해관계자 리뷰에 초점을 맞춘 6단계 비동기(Asynchronous) 협업 워크플로
- **co-security**: 레드팀 운영, 위협 모델링, Ansible 기반 패치 자동화를 포함하는 6단계 보안 인게이지먼트 워크플로
- **co-consult**: 리서치, 분석, 산출물 작성, 고객 납품을 아우르는 7단계 전략 컨설팅 워크플로
- **co-deck**: 리서치부터 인쇄 가능한 PDF까지의 11단계 강연 자료 제작 워크플로, 5개의 승인 게이트 포함
- **co-game**: Vanilla TypeScript 기반 HTML5 Canvas 게임 개발 워크플로, 게임 설계, 아케이드/퍼즐 장르, 비주얼 아트, 사운드, 엔진 구현, 디버깅, 테스트 전문 에이전트 포함

**💡 Workflow 상세 정보 확인 방법**
구체적인 에이전트 명단(Roster)과 거버넌스 단계는 프로젝트 생성 후 해당 프로젝트 폴더 내의 다음 문서들에서 관리 및 확인할 수 있습니다:
1. `AGENTS.md`: 해당 프로젝트에 투입된 전체 에이전트 역할 및 권한 명세
2. `docs/context.md`: 프로젝트의 목표 및 초기 세션 시작을 위한 워크플로 컨텍스트

---

## Template Variants (템플릿 Variant)

새 프로젝트는 버전 관리된 template variant에서 생성됩니다. 템플릿은 Git에서 `template-vX.Y.Z` 태그로 관리됩니다.

| Variant | 상태 | 설명 |
|---------|------|------|
| `co-develop` | ✅ Stable | 소프트웨어 개발 전용 워크플로 — PM, Architect, Designer, Code Writer, Test Runner, Security Monitor |
| `co-design` | ✅ Stable | UI/UX 디자인 워크플로 — PM, Design Lead, UX Researcher, Visual Designer, Prototype Engineer, Storyteller, Service Designer, Typography Expert |
| `co-work` | ✅ Stable | 범용 협업 워크플로 — PM, Analyst, Technical Writer, Content Writer, Project Coordinator, Storyteller, MS365 Expert |
| `co-security` | ✅ Stable | 보안 인게이지먼트 워크플로 — PM, Red Team Lead, Pentester, Threat Modeler, Patch Engineer, Report Writer |
| `co-consult` | ✅ Stable | 전략 컨설팅 워크플로 — Engagement Leader, Strategy Analyst, Industry Expert, Change Management Partner, Communications Lead, Solutions Architect 등 |
| `co-deck` | 🔶 Beta | 강연 자료 제작 워크플로 — PM, Version, Research, Storyline, Design, Build, Measure, Export |
| `co-game` | 🔶 Beta | HTML5 Canvas 게임 개발 워크플로 — PM, Game Designer, Arcade/Puzzle Designers, Visual Artist, Sound Designer, Game Developer, Game Debugger, Test Runner, Security Monitor |

### 버전 및 Variant 선택

```bash
# 사용 가능한 template 버전 목록 확인
bun scripts/list-template-versions.ts

# 최신 template 사용 (기본값)
bun scripts/new-project.ts my-project

# 특정 버전 지정
bun scripts/new-project.ts my-project --version 0.5.0

# 특정 variant 지정
bun scripts/new-project.ts my-project --variant co-develop
```

### Template 검증

Template 파일을 수정할 때는 라이프사이클 검증기를 실행하여 구조적 문제를 조기에 발견하세요:

```bash
bun scripts/validate-templates.ts
```

검증 항목: 에이전트 frontmatter 완결성, 필수 섹션(`## Meeting Participation`, `## Dispatch Protocol`), AGENTS.md 명단 일치, 공유 파일 동기화 경고. `templates/` 파일이 스테이징될 때 pre-commit을 통해 자동으로 실행됩니다.

---

## 설계 원칙 (Design Principles)

- **`docs/context.md`는 모든 프로젝트의 단일 진실 공급원(SSOT)**입니다 - 모든 AI 도구가 이를 공유합니다.
- **`CLAUDE.md` / `GEMINI.md` (프로젝트 레벨)는 플랫폼 특화 오버라이드만 포함합니다.**
- **PR 전용 워크플로** - 모든 변경 사항은 Pull Request를 통해 `main` 브랜치에 도달합니다. 직접 push는 `.githooks/pre-push`에 의해 차단됩니다.
- **Conventional Commits** - `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `test:` / `perf:` / `ci:` / `style:` / `revert:`
- **TypeScript 전용 스크립트** - 모든 `scripts/`는 `bun`으로 실행되는 `.ts` 파일입니다 (ADR-0036). `.sh/.ps1` 파일 없음.
- **코딩 가이드라인 감사** - `docs/context.md`에 `## Coding Guidelines`이 누락된 경우 `audit.ts`가 빌드를 실패 처리합니다.
- **보안 중심 스캐폴드** - 프로젝트에는 자격 증명 유출을 방지하기 위한 시크릿 탐지(`.gitleaks.toml`), `SECURITY.md`, 그리고 안전한 pre-commit 훅이 자동으로 장착됩니다.

---

## 기여하기 (Contributing)

이 저장소는 **공개 저장소(Public Repository)**입니다. 누구나 Pull Request를 통해 기여할 수 있습니다.

1. `feat/<slug>`, `fix/<slug>`, `docs/<slug>` 네이밍 규칙을 사용하여 `main`에서 브랜치를 생성합니다.
2. 모든 PR은 `bun scripts/audit.ts`를 통과해야 합니다.
3. 병합(merge)하기 전에 `[Unreleased]` 아래에 `CHANGELOG.md` 항목을 추가합니다.
4. `CONSTITUTION.md §8 - Coding Behavior Guidelines`를 준수합니다.
5. 병합하기 전에 최소 **1명의 승인 리뷰(approving review)**가 필요합니다.

---

## 라이선스 (License)

AGPL-3.0 - [LICENSE](LICENSE) 파일 참조

---

*Maintained by [@5throck](https://github.com/5throck) · Last Updated: 2026-07-10*
