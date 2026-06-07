---
translated_from_hash: PLACEHOLDER
sync_version: 1
---

# [Project Name]

[Project Description]

## 프로젝트 특성 (Project Characteristics)

[Project Characteristics]

## 이 프로젝트 사용 방법

1. **설정 검토**: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`를 참고하여 프로젝트의 역할과 목표에 맞게 업데이트합니다.
2. **스크립트 업데이트**: `scripts/` 내의 스크립트(예: `dev-sync.sh`, `audit.sh`)를 검토하고, 플레이스홀더 로직을 프로젝트 전용 요구사항으로 교체합니다.
3. **메모리 초기화**: `memory/MEMORY.md` 인덱스 파일을 생성하여 세션 이력 관리를 시작합니다.

## 빠른 시작 (Quick Start)

```bash
# 1. Git Hooks 활성화
git config core.hooksPath .githooks

# 2. 설정 실행 (.env 생성, 의존성 설치, 초기 커밋)
#    macOS / Linux / Windows Git Bash
bash scripts/setup.sh

#    Windows - PowerShell
.\scripts\setup.ps1
```

> `setup.sh`는 스택(Node.js, Python, Ruby, .NET, Java, Go, Rust)을 자동 감지하여 의존성을 설치합니다. `--skip-install` 또는 `--skip-commit` 옵션으로 동작을 제어할 수 있습니다.

## 문서 (Documentation)

- **프로젝트 컨텍스트 & 아키텍처** → [`docs/context.md`](docs/context.md)
- **에이전트 인덱스** → [`AGENTS.md`](AGENTS.md)
- **변경 이력** → [`CHANGELOG.md`](CHANGELOG.md)
- **워크스페이스 표준** → [`workspace standards`](../workspace standards)
- **Claude Code 설정** → [`CLAUDE.md`](CLAUDE.md)
- **Gemini CLI 설정** → [`GEMINI.md`](GEMINI.md)

## 기여하기 (Contributing)

[기여 방법을 설명하거나 - 프로젝트가 비공개/사내용인 경우 이 섹션을 삭제하세요.]

## 라이선스 (License)

[라이선스 이름] - [LICENSE](LICENSE) 파일 참조
