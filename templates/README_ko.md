# AI 워크스페이스 템플릿

![Template Version](https://img.shields.io/badge/version-0.5.0-blue)

이 디렉토리에는 AI 보조 프로젝트를 스캐폴딩하기 위한 템플릿 variant가 포함되어 있습니다.
`bash scripts/new-project.sh <name> --variant <variant>` 실행 시 variant를 선택합니다.

## 템플릿 구조

```
templates/
├── common/              # 공유 인프라 (모든 variant 공통)
│   ├── .githooks/       # Git hooks
│   ├── .github/         # GitHub 연동 (CI/CD, dependabot)
│   ├── scripts/         # 자동화 스크립트
│   └── docs/_examples/  # 참조 문서
├── co-develop/          # 소프트웨어 개발 variant
├── co-design/           # 디자인 워크플로우 variant
├── co-work/             # 협업 워크플로우 variant
└── co-security/         # 보안 점검 variant
```

**동작 방식:** 새 프로젝트를 스캐폴딩할 때, 스크립트는 먼저 `templates/common/`(공유 인프라)을 복사한 다음 선택된 variant를 덮어씁니다(variant 전용 파일이 공통 파일을 재정의).

## 사용 가능한 Variant

| Variant | 상태 | 설명 |
|---------|------|------|
| [`co-develop`](co-develop/) | ✅ Stable | 7개 에이전트(pm, architect, code-writer 등)를 갖춘 소프트웨어 개발 워크플로우 |
| [`co-design`](co-design/) | ✅ Stable | 5개 에이전트(design pm, design-lead, ux-researcher, visual-designer, prototype-engineer)를 갖춘 UI/UX 디자인 워크플로우 |
| [`co-work`](co-work/) | ✅ Stable | 4개 에이전트(collaboration pm, analyst, content-writer, project-coordinator)를 갖춘 일반 협업 워크플로우 |
| [`co-security`](co-security/) | 🔶 Beta | 6개 에이전트(pm, red-team-lead, pentester, threat-modeler, patch-engineer, report-writer)를 갖춘 보안 점검 워크플로우 |

## 사용법

```bash
# 기본값 (co-develop)
bash scripts/new-project.sh my-project

# variant 명시
bash scripts/new-project.sh my-project --variant co-develop
```

## 공유 파일 동기화 규칙

일부 파일은 워크스페이스와 템플릿 간에 공유됩니다:
- `.claude/commands/meeting.md` ↔ `templates/co-develop/.claude/commands/meeting.md`

워크스페이스 버전이 변경되면 템플릿 variant에 수동으로 동기화합니다:
```bash
cp .claude/commands/meeting.md templates/co-develop/.claude/commands/meeting.md
bash scripts/validate-templates.sh  # 드리프트 없음 확인
```

## 버전 정책

전체 이력은 [CHANGELOG.md](CHANGELOG.md)를 참조하세요.

- **Major** 범프: 에이전트 디스패치 모델 변경
- **Minor** 범프: 신규 에이전트, 신규 variant stable 승격, 구조적 섹션 변경
- **Patch** 범프: 문서 및 설명 업데이트

*Last Updated: 2026-05-28*
