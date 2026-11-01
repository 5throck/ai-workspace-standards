---
sync_version: 1
lang: ko
lang_reason: source-material
---

# co-architect

> **언어**: [English](README.md) · **한국어**
> **상태**: ⚠️ Beta — v0.1.0
> Architecture firm collaboration variant integrating design (UI/UX, service design, prototyping), research (analysis, content), project coordination (scheduling, acquisition), and engineering (SketchUp, ZWCAD) into a unified 5-team workspace with 6 named workflows.

## 개요

Architecture firm collaboration variant integrating design (UI/UX, service design, prototyping), research (analysis, content), project coordination (scheduling, acquisition), and engineering (SketchUp, ZWCAD) into a unified 5-team workspace with 6 named workflows.. 전체 아키텍처와 표준은 docs/context.md를 참고하세요.

## 빠른 시작

이것은 워크스페이스 템플릿의 beta 변형입니다. `templates/common`에서 상속하며 변형별 맞춤 설정을 포함합니다.

> **설계 게이트 (ADR-0074)**: 코드 변경에는 스펙이 동반되어야 합니다 — `docs/designs/<spec-id>-design.md`를 만들고 등록한(`bun scripts/spec-register.ts --file <설계문서> --source manual`) 뒤 `/sync`하세요. 동기화 시 스펙 검사가 문서 없는 코드 변경을 차단합니다; 사소한 변경은 `--spec-exempt=E1..E5`를 쓸 수 있습니다.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** Architecture firm collaboration variant integrating design (UI/UX, service design, prototyping), research (analysis, content), project coordination (scheduling, acquisition), and engineering (SketchUp, ZWCAD) into a unified 5-team workspace with 6 named workflows.

## AI 팀 소개

당신의 파트너는 각기 고유한 역할을 가진 전문 에이전트들입니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **technical-writer** | Technical writer - creates API documentation, technical guides, and developer re | medium | inherit |
| **design-lead** | Design system architect - defines visual language, design tokens, and component  | high | inherit |
| **automation-engineer** | Implements approved technical plans for co-architect's software/platform layer — | medium | inherit |
| **zwcad-drafter** | ZWCAD technical drawing specialist | medium | inherit |
| **content-writer** | Content writer - transforms research into clear, accessible documentation and co | medium | inherit |
| **architect** | Produces implementation plans and design docs for co-architect's software/platfo | high | inherit |
| **analyst** | Research analyst - conducts systematic investigation, data synthesis, and eviden | medium | inherit |
| **project-coordinator** | Project coordinator - manages schedules, stakeholder communication, and delivery | low | inherit |
| **mep-engineer** | Mechanical, Electrical, Plumbing (MEP) and building services specialist | medium | inherit |
| **drafting-architect** | Architectural drafting standards lead and detail drawing specialist | medium | inherit |
| **design-storyteller** | Design storyteller - provides philosophical foundation, meaning, and narrative c | medium | inherit |
| **sketchup-modeler** | Engineering Team lead and 3D architectural modeling specialist | medium | inherit |
| **ux-researcher** | User research specialist - conducts user interviews, usability testing, and rese | medium | inherit |
| **bylaw-expert** | Building code, zoning ordinance, and regulatory compliance specialist | medium | inherit |
| **typography-expert** | Typography expert - specializes in font selection, type systems, and visual hier | medium | inherit |
| **visualization-expert** | Architectural 3D rendering and visual presentation specialist | medium | inherit |
| **storyteller** | Organizational storyteller - shapes organizational culture, manages change narra | medium | inherit |
| **prototype-engineer** | Interactive prototyping specialist - creates functional prototypes for testing a | medium | inherit |
| **interior-designer** | Interior architecture, space planning, and finish material specialist | medium | inherit |
| **visual-designer** | Visual design execution - creates UI designs, mockups, and design specifications | medium | inherit |
| **structural-engineer** | Structural engineering and load-bearing system specialist | medium | inherit |
| **ms365-expert** | Microsoft 365 expert - provides guidance on Outlook, Word, Excel, PowerPoint, Sh | low | inherit |
| **service-designer** | Service designer - designs end-to-end service experiences, customer journeys, an | medium | inherit |

## 스킬

- **zwcad-ai-drawing**: 
- **script-lifecycle-manager**: 
- **explain-me**: 
- **team-builder**: 
- **zod-contract-gate**: 
- **service-design**: 
- **source-command-commit-push-pr**: 
- **skill-lifecycle-manager**: 
- **ci-triage**: 
- **i18n-formatting**: 
- **project-review**: 
- **translate**: 
- **standup-synthesizer**: 
- **platform-command-lifecycle-manager**: 
- **token-usage-lint**: 
- **cad-svg-preview**: 
- **gateguard**: 
- **finishing-a-development-branch**: 
- **i18n-audit**: 
- **api-documentation**: 
- **handbook**: 
- **i18n-locale-config**: 
- **security-scan**: 
- **decision-record**: 
- **handbook-sync-audit**: 
- **meeting-facilitation**: 
- **platform-skill-lifecycle-manager**: 
- **research-analysis**: 
- **accessibility-audit**: 
- **design-foundation**: 
- **agent-lifecycle-manager**: 
- **ui-ux-design-intelligence**: 
- **update-bun-packages**: 
- **sync**: 
- **cad-space-recognition**: 
- **documentation-writing**: 
- **i18n-layout**: 
- **cad-server-manager**: 
- **evidence-ledger**: 
- **generate-room-elevation**: 

## 협업 방법

협업 방식은 품질을 극대화하고 충돌을 방지하도록 구조화되어 있습니다. 표준 워크플로는 다음과 같습니다:

### A. PM 게이트웨이

항상 요청을 시작할 때 **PM**과 먼저 대화하세요. 전문 에이전트를 직접 호출하지 마세요. PM이 요청을 분석하고 적절한 전문가를 불러옵니다.

### B. 표준 워크플로 단계

1. **팀 구성:** PM이 필요한 전문 에이전트/스킬을 생성합니다.
2. **분류:** PM이 요청을 분류하고 읽기 전용 에이전트를 병렬로 배치합니다.
3. **분석:** PM이 조사 결과를 요구사항 + 완료 기준으로 종합합니다.
4. **설계:** 아키텍트가 구현 계획 + ADR을 작성합니다.
5. **구현:** 전문가가 구현하고, PM은 실패 시 최대 3회까지 반복합니다.
6. **마무리:** PM이 결정을 기록하고 `/sync`를 실행한 뒤 PR을 엽니다.

### C. 사용 가능한 명령어

일상적인 작업은 슬래시 명령어(Claude Code 및 Gemini CLI에서 Skill로 등록됨)로 구동됩니다:

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — `CHANGELOG.md`에 항목 추가.
- `/memlog "summary"` — 오늘 세션 로그에 요약 추가.
- `/meeting` — 구조화된 인라인 다중 에이전트 토론 진행.

## 변형 유형

**유형**: collaboration

이 변형은 General work, research, documentation, and project coordination에 중점을 둡니다.

> **⚠️ 베타 변형** — 프로덕션 용도가 아닙니다.

- **클라이언트 참여**: 0/2 (변형 거버넌스 규칙 참조)
- **베타 기간**: 0/2개월
- **추가 검증**: 대기 중

승급 기준은 `scripts/helpers/variant-governance-rules.ts`를 참조하세요.

---

*최근 갱신: 2026-11-01*
