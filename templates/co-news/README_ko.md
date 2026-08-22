---
sync_version: 1
translated_from_hash: e0b5b9ede505da17fdc38000d1630a7476fdcfb25baf549cdbaa991a44eee456
lang: ko
lang_reason: source-material
---

# co-news

> **언어**: [English](README.md) · **한국어**
> **상태**: ⚠️ Beta — v0.1.0
> Business/finance journalism variant for economics reporters covering listed companies — synthesizes regulator financial disclosures (DART via the k-dart skill under the KR country profile in docs/countries/) and commercial-law research (k-law under KR) into fact-checked, naturally human-written articles (output language follows project i18n settings; the KR profile defaults to ko) with financial infographics for readers including listed-company IR staff, CFOs/executives, and PE/VC/bank finance professionals.

## 개요

Business/finance journalism variant for economics reporters covering listed companies — synthesizes regulator financial disclosures (DART via the k-dart skill under the KR country profile in docs/countries/) and commercial-law research (k-law under KR) into fact-checked, naturally human-written articles (output language follows project i18n settings; the KR profile defaults to ko) with financial infographics for readers including listed-company IR staff, CFOs/executives, and PE/VC/bank finance professionals.. 전체 아키텍처와 표준은 docs/context.md를 참고하세요.

## 빠른 시작

이것은 워크스페이스 템플릿의 beta 변형입니다. `templates/common`에서 상속하며 변형별 맞춤 설정을 포함합니다.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** Business/finance journalism variant for economics reporters covering listed companies — synthesizes regulator financial disclosures (DART via the k-dart skill under the KR country profile in docs/countries/) and commercial-law research (k-law under KR) into fact-checked, naturally human-written articles (output language follows project i18n settings; the KR profile defaults to ko) with financial infographics for readers including listed-company IR staff, CFOs/executives, and PE/VC/bank finance professionals.

## AI 팀 소개

당신의 파트너는 각기 고유한 역할을 가진 전문 에이전트들입니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **fact-checker** | Fact-checker - the newsroom's citation gatekeeper | medium | inherit |
| **financial-analyst** | Financial analyst - runs the k-dart skill against DART filings (KR country profile) to produce articl | medium | inherit |
| **legal-researcher** | Legal researcher - runs the k-law skill against the National Law Information Cen | medium | inherit |
| **reporter** | Reporter - drafts the article headline, lead, and body strictly from the fact-ch | medium | inherit |
| **style-editor** | Style editor - runs the AI-tell reduction pass and house-style conformance pass  | medium | inherit |
| **visual-editor** | Visual editor - turns the financial-analyst's narrative brief into inline SVG fi | medium | inherit |

## 스킬

- **ai-tell-reduction**: 
- **financial-infographic-svg**: 
- **financial-journalism-style**: 
- **financial-narrative-brief**: 
- **source-verification-ledger**: 

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

*최근 업데이트: 2026-08-11*
