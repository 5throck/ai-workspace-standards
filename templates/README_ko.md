# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

## 프로젝트 특징 (Characteristics)

{{PROJECT_CHARACTERISTICS}}

## 이 템플릿 사용법

이 저장소(`templates`)는 견고한 하네스 엔지니어링(Harness Engineering) 및 AIG 거버넌스 구조를 갖춘 신규 프로젝트를 생성하기 위한 스캐폴딩(Scaffold) 템플릿입니다.
제공된 스크립트를 사용하여 새 프로젝트 폴더를 자동으로 생성하고 프로젝트 세부 정보를 README 파일에 채울 수 있습니다.

**자동 설정 (권장)**
```bash
# PowerShell 사용 시
.\create-project.ps1 -TargetDir "C:\git\my_new_project"

# Bash 사용 시
bash create-project.sh "../my_new_project"
```
스크립트는 프로젝트 이름, 설명 및 특징을 묻는 프롬프트를 표시하고, 새로 생성된 `README.md`와 `README_ko.md`의 플레이스홀더를 자동으로 교체합니다.

**수동 설정**
1. **구조 복사하기**: `scripts/`, `memory/`, `.github/`, `.githooks/`, `.claude/` 디렉토리를 신규 프로젝트로 복사합니다.
2. **설정 검토**: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`를 열고 새 프로젝트의 구체적인 역할과 목표에 맞게 수정합니다.
3. **스크립트 수정**: `scripts/` 디렉토리 내의 파일들(예: `dev-sync.ps1`, `audit.ps1`)을 검토하고, 프로젝트의 요구사항에 맞추어 주석이나 하드코딩된 예시 텍스트를 수정합니다.
4. **메모리 초기화**: 새 프로젝트에 맞는 `memory/MEMORY.md` 인덱스를 시작합니다.

## 빠른 시작

```bash
# 1. 훅(hooks) 활성화
git config core.hooksPath .githooks

# 2. 환경 설정
cp .env.sample .env   # 환경 변수 값 입력

# 3. 의존성 설치
# Python:  python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
# Node.js: npm install
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
