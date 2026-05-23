# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

## 프로젝트 특징 (Characteristics)

{{PROJECT_CHARACTERISTICS}}

## 프로젝트 사용법

1. **설정 검토**: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`를 열고 새 프로젝트의 구체적인 역할과 목표에 맞게 수정합니다.
2. **스크립트 수정**: `scripts/` 디렉토리 내의 파일들(예: `dev-sync.ps1`, `audit.ps1`)을 검토하고, 프로젝트의 요구사항에 맞추어 주석이나 하드코딩된 예시 텍스트를 수정합니다.
3. **메모리 초기화**: 새 프로젝트에 맞는 `memory/MEMORY.md` 인덱스를 시작합니다.

## 빠른 시작

```bash
# 1. 훅(hooks) 활성화
git config core.hooksPath .githooks

# 2. 환경 설정
cp .env.sample .env   # 환경 변수 값 입력

# 3. 의존성 설치
# Python:  python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
# Node.js: npm install

# 4. 멀티에이전트 킥오프 회의 (권장)
# 코드를 작성하기 전에 AI에게 다음 명령을 내려 PM 에이전트 주관의 기획 회의를 시작하세요:
# "이 프로젝트를 위한 PM 에이전트 킥오프 회의를 시작해 줘."
```

## 핵심 문서

- **프로젝트 컨텍스트 & 아키텍처** → [`docs/context.md`](docs/context.md)
- **에이전트 인덱스** → [`AGENTS.md`](AGENTS.md)
- **변경 이력** → [`CHANGELOG.md`](CHANGELOG.md)
- **워크스페이스 표준** → [`../CONSTITUTION.md`](../CONSTITUTION.md)
- **Claude Code 설정** → [`CLAUDE.md`](CLAUDE.md)
- **Gemini CLI 설정** → [`GEMINI.md`](GEMINI.md)

## 기여하기

[기여 방법을 설명하세요 — 프라이빗/내부 프로젝트인 경우 이 섹션을 삭제하세요.]

## 라이선스

[라이선스 이름] — [LICENSE](LICENSE) 파일 참조
