# AI 워크스페이스 템플릿

![Template Version](https://img.shields.io/badge/version-0.5.3-blue)

이 디렉토리에는 AI 보조 프로젝트를 스캐폴딩하기 위한 템플릿 variant가 포함되어 있습니다.
`bun scripts/new-project.ts <name> --variant <variant>` 실행 시 variant를 선택합니다.

## 템플릿 구조

```
templates/
├── common/              # 공유 인프라 (모든 variant 공통)
│   ├── .githooks/       # Git hooks
│   ├── .github/         # GitHub 연동 (CI/CD, dependabot)
│   ├── scripts/         # 자동화 스크립트 (dev-sync, test-runner 등)
│   └── docs/_examples/  # 참조 문서
├── co-develop/          # 소프트웨어 개발 variant
├── co-design/           # 디자인 워크플로우 variant
├── co-work/             # 협업 워크플로우 variant
├── co-security/         # 보안 점검 variant
├── co-consult/          # 전략 컨설팅 variant
├── co-deck/             # 강의/발표 자료 제작 variant (beta)
└── co-game/             # 게임 개발 variant
```

**동작 방식:** 새 프로젝트를 스캐폴딩할 때, 스크립트는 먼저 `templates/common/`(공유 인프라)을 복사한 다음 선택된 variant를 덮어씁니다(variant 전용 파일이 공통 파일을 재정의).

## 사용 가능한 Variant

| Variant | 상태 | 설명 |
|---------|------|------|
| [`co-develop`](co-develop/) | ✅ Stable | 7개 에이전트(pm, architect, code-writer, designer, security-monitor, stack-setup, test-runner)를 갖춘 소프트웨어 개발 워크플로우 |
| [`co-design`](co-design/) | ✅ Stable | 8개 에이전트(design pm, design-lead, prototype-engineer, service-designer 등)를 갖춘 UI/UX 디자인 워크플로우 |
| [`co-work`](co-work/) | ✅ Stable | 7개 에이전트(pm, analyst, content-writer, ms365-expert 등)를 갖춘 일반 협업 워크플로우 |
| [`co-security`](co-security/) | ✅ Stable | 6개 에이전트(pm, red-team-lead, pentester, threat-modeler 등)를 갖춘 보안 점검 워크플로우 |
| [`co-consult`](co-consult/) | ✅ Stable | 11개 에이전트 및 16개 도메인 스킬을 갖춘 전략 컨설팅 워크플로우 |
| [`co-deck`](co-deck/) | 🔶 Beta | 13개 에이전트 및 다중 테마 HTML-to-PDF 파이프라인을 갖춘 강의/발표 자료 제작 워크플로우 |
| [`co-game`](co-game/) | ✅ Stable | Vanilla TypeScript 기반 HTML5 Canvas 게임 개발을 위한 13개 에이전트 워크플로우 |

## Phase 1, 2 & 3 고도화 기능

다음 2026 Q3–Q4 로드맵 고도화 기능들이 템플릿 variant 전반에 통합되었습니다:

- **`generate-ide-rules.ts`**: 스캐폴딩 시 프로젝트 컨텍스트에 맞춰 `.cursorrules` 및 `.clauderules` IDE 규칙 파일을 자동 생성 (`co-develop`).
- **`zod-contract-gate`**: `co-develop`의 내부 API 계약 경계에서 Zod 런타임 스키마 검증 강제.
- **`swe-solve`**: `co-develop`의 자율 4단계 문제 해결 파이프라인 (탐색 & 진단 → 국소화 & 계획 → 코드 수정 & 테스트 → 리뷰 & PR).
- **`compile-tokens.ts`**: `co-design`에서 `tokens.json` 디자인 토큰을 CSS 커스텀 속성 및 TypeScript 타입으로 컴파일.
- **`accessibility-audit`**: `co-design`에서 axe-core 기반 자동화된 WCAG 2.1 AA 접근성 평가.
- **`mece-logic-auditor`**: `co-consult`에서 ME/CE/Logic 스코어카드를 갖춘 구조적 MECE 이슈 트리 감사 스킬.
- **`presenter-mode`**: `co-deck`에서 BroadcastChannel 동기화 기반의 경량 HTML5 이중 창 발표자 모드 제공.
- **`render-pdf-deck.ts`**: `co-deck`에서 CSS `@page` 인쇄 규칙을 준수하는 Playwright 기반 페이징 미디어 PDF 렌더러.
- **`ecs-core.ts`**: `co-game`에서 150줄 분량의 Zero-dependency TypeScript Entity Component System 코어 엔진.
- **`sound-synth`**: `co-game`에서 Web Audio API 및 jsfxr 파라미터 기반 절차적 8-bit 레트로 사운드 이펙트 생성기.
- **`stride-threat-matrix`**: `co-security`에서 DREAD 위험 평가를 포함한 자동화된 STRIDE 위협 모델링 템플릿.
- **`sarif-exporter`**: `co-security`에서 보안 점검 결과를 GitHub PR Check에 즉시 게시할 수 있는 SARIF v2.1.0 리포트 내보내기.
- **`md-to-ooxml.ts`**: `co-work`에서 Markdown 문서를 MS Office OOXML (`.docx` / `.xlsx`) 구조로 컴파일.
- **`standup-synthesizer`**: `co-work`에서 24시간 범위의 일일 스탠드업 다이제스트 자동 합성 스킬.


## 사용법

```bash
# 기본값 (co-develop)
bun scripts/new-project.ts my-project

# variant 명시
bun scripts/new-project.ts my-project --variant co-design

# 플랫폼 및 버전 태그 지정
bun scripts/new-project.ts my-project --variant co-develop --platform both --version 0.5.3
```

### 자동화 및 테스트 스크립트 (templates/common/scripts)

스캐폴딩된 프로젝트는 `templates/common/scripts/`에서 공유 자동화 스크립트를 상속받습니다:

- **`dev-sync.ts` (v1.5.0)**: 전체 개발 동기화 파이프라인 (`bun run dev-sync "feat: msg"` 또는 `--body-file <path>`). 사전 문서 링크 검증 게이트 (`bun scripts/validate-docs-links.ts`), 세션 로깅, MEMORY.md 인덱싱, CHANGELOG 검사, 감사 게이트, 민감 파일 감지, git commit/push 및 GitHub PR 생성을 포함합니다.
- **`test-runner.ts` (v1.1.0)**: 테스트 스위트 실행기 (`bun scripts/test-runner.ts [suite] [flags]`). `unit`, `integration`, `scenarios`, `scripts` 스위트를 지원하며 병렬 실행 (`--parallel`/`--sequential`), 워커 풀 동시성 제어 (`--concurrency <n>`), 테스트별 타임아웃 (`--timeout <ms>`), 격리된 워커 임시 디렉토리 (`TEST_TEMP_DIR`)를 제공합니다.

## 공유 파일 동기화 규칙

일부 파일은 워크스페이스와 템플릿 간에 공유됩니다:
- `.claude/commands/meeting.md` ↔ `templates/co-develop/.claude/commands/meeting.md`

워크스페이스 버전이 변경되면 템플릿 variant에 수동으로 동기화합니다:
```bash
cp .claude/commands/meeting.md templates/co-develop/.claude/commands/meeting.md
bun scripts/validate-templates.ts  # 드리프트 없음 확인
```

## 버전 정책

전체 이력은 [CHANGELOG.md](CHANGELOG.md)를 참조하세요.

- **Major** 범프: 에이전트 디스패치 모델 변경
- **Minor** 범프: 신규 에이전트, 신규 variant stable 승격, 구조적 섹션 변경
- **Patch** 범프: 문서 및 설명 업데이트

*Last Updated: 2026-08-11*
