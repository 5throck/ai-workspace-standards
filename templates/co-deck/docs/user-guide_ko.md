# co-deck 사용자 가이드

**Language**: [English](user-guide.md) · **한국어**

co-deck 에이전트 팀으로 강연 자료와 핸드북을 제작하기 위한 실전 중심 가이드입니다. 로스터 개요와 소개 성격의 요약은 [README_ko.md](../README_ko.md)를 참고하세요. 거버넌스와 파이프라인 내부 구조는 [AGENTS.md](../AGENTS.md)를 참고하세요.

## 1. Quick Start

co-deck는 워크스페이스의 **PM Gateway** 패턴을 따릅니다 — 전문 에이전트에게 직접 말을 걸지 않고, 모든 요청은 `pm` 에이전트를 거칩니다. PM은 요청을 분류하고 실행 계획을 세운 뒤 적절한 전문 에이전트를 디스패치합니다.

1. **인게이지먼트 시작**: 원하는 바를 자연어로 설명합니다 (예: "대학원생을 위한 기후금융 강연 만들어줘" 또는 "이 덱의 컴패니언 핸드북 만들어줘").
2. **PM이 요청을 분류**하고, 다단계 작업(파일 2개 이상 또는 순차 단계 2개 이상)이면 아무도 디스패치하기 전에 **실행 계획 표**를 먼저 표시합니다:

   | # | Task | Agent | Tier | Model |
   |---|------|-------|------|-------|
   | 1 | [작업] | [전문가] | High/Medium/Low | [모델] |
   | N | `/sync "type(scope): message"` | pm | Medium | [모델] |

3. **PM이 전문 에이전트를 디스패치**합니다 (`Agent` 도구 사용). 쓰기 작업은 한 번에 하나씩 순차 진행하고, 읽기 전용 리서치/분석은 병렬로 진행할 수 있습니다 (예: Stage 3.5의 `image-curator`와 `diagram-specialist`).
4. **필수 게이트에서 승인**합니다 (게이트 2 — 콘텐츠 준비 완료; 게이트 5 — 샘플 PDF 준비 완료). 선택적 게이트(1.5, 3, 4)는 검토 후 자동으로 진행됩니다.
5. **`/sync`로 마무리**: 결과물이 준비되면 `/sync "feat(deck): <변경 내용>"`을 실행하세요 — 이것이 커밋을 위한 유일하게 승인된 방법입니다. memlog → CHANGELOG 항목 → audit → commit → push → PR 순으로 실행됩니다. 직접 `git commit`/`git push` 및 `--no-verify`는 pre-commit 훅에 의해 차단됩니다.

> `research`, `storyline`, `design`, `html-build`, `image-curator`, `diagram-specialist`, `measure`, `pdf-export`, `version`, `handbook-writer`, `handbook-reviewer`를 직접 호출하지 마세요 — 항상 PM에게 요청하세요.

## 2. 어떤 종류의 덱 작업인가요?

아래 표는 요청이 어떤 에이전트 + 스킬로 라우팅되는지 보여줍니다. 이름은 `agents/`와 `skills/`의 실제 파일명과 일치합니다.

| 작업 / 시나리오 | Agent | Skill | 비고 |
|---|---|---|---|
| 주제에 대한 자료, 사실, 배경 조사 | `research` | `research` | `lecture-profile.md` 로드; `research_notes.md` 작성; Stage 1 |
| 인용된 URL/출처가 실제로 존재하고 신뢰할 수 있는지 확인 | `source-verifier` | (전용 SKILL.md 없음; 에이전트 전용) | `source-verification.md` + Trust Score 출력; Stage 1.5, 선택 (`--skip-verify`) |
| 스토리라인/내러티브 구조, 챕터 흐름, 슬라이드별 개요 | `storyline` | `storyline` | `image_role`/`image_query` 필드를 포함한 `storyline.md` + `slide_deck.md` 작성; Stages 2-3 |
| 테마/시각 디자인 — 색상 팔레트, 폰트, 레이아웃 확정 | `design` | `design` | `design_spec.md` 작성; Stage 4; 참조 URL/이미지 분석 가능 |
| 슬라이드 이미지 검색·다운로드 (Pixabay/Unsplash/Pexels) | `image-curator` | (전용 SKILL.md 없음; 에이전트 전용) | `assets/images/` + `image-manifest.json` 출력; Stage 3.5, 선택, diagram-specialist와 병렬 실행 |
| SVG 컨셉 다이어그램 또는 데이터 차트 생성 | `diagram-specialist` | (전용 SKILL.md 없음; 에이전트 전용) | 6개 다이어그램 유형(cycle/flow/matrix/pyramid/timeline/comparison) + 3개 차트 유형(bar/line/pie); Stage 3.5, 선택 |
| 실제 HTML 슬라이드 덱 빌드/생성 | `html-build` | `html-build` | `data-theme` 적용, 6개 테마(`outline`, `outlook`, `pitch`, `pitch-enhanced`, `vertical`, `zen`) 및 2개 목차 서랍 스타일(`glass-drawer`, `solid-drawer`) 지원, 이미지 주입, 강연자 소개, 연락처 슬라이드 삽입; Stages 5-8 |
| PDF 출력을 위한 렌더링된 레이아웃 측정 (레거시, Playwright) | `measure` | `measure` | **Deprecated** — `prep-pdf`로 대체됨 |
| Playwright 없이 PDF 출력 준비 | `pdf-export` | `prep-pdf` | 4계층 스펙 병합(base → theme → style → overrides) 해석; Stages 9-10 |
| 샘플 또는 최종 인쇄용 PDF 생성 | `pdf-export` | `pdf-export` | `pdf-lib`을 통해 샘플(5슬라이드) 후 전체 PDF 생성; Stage 11 |
| 핸드북 / 문서 사이트 / 코스 사이트 빌드 | `handbook-writer`, `handbook-reviewer` | `handbook` | 독립적인 H-Stage 파이프라인 (H-0~H-7); 아래 §3 참고 |
| 파일을 이전 버전으로 되돌리기, 또는 수정 전 스냅샷 | `version` | `version` | 횡단적; 모든 에이전트의 모든 수정 전에 자동 호출됨 |
| 새 시각 테마 또는 스타일 변형 생성 | `design`, `html-build`, `storyline` (T-Stage) | `theme-authoring` | 진입점이 경량 Style Workflow 또는 5단계 T-Stage Theme Workflow로 라우팅 |

## 3. 핸드북 파이프라인 워크스루 (H-Stage)

**"make handbook"**, **"create handbook"**, **"build course site"**, **"companion handbook"**을 요청하면, PM은 11단계 슬라이드 파이프라인에서 벗어나 **H-Stage 파이프라인**으로 전환합니다 — 검색 가능한 테마 기반 핸드북을 정적 사이트(단독형, 기존 강연 덱의 컴패니언, 또는 다중 강연 전체 코스 사이트)로 제작하는 별도의 독립적인 흐름입니다.

```
H-0: PM              — 주제, 언어, 출력 디렉터리, 컴패니언 모드 확인 (다크 모드는 자동)
H-1: research         — 웹 리서치 (단독형 모드에서만; 컴패니언 모드는 캐시된 리서치 재사용)
H-2: handbook-writer  — 섹션 유형 + 챕터 구조 제안
H-3: handbook-writer  — 챕터 콘텐츠 작성 (SECTION_TYPES + AUTHORING_GUIDELINES)
H-4: handbook-writer  — Course Overview + Instructor Guide 생성
H-5: handbook-reviewer — handbook-doctor.ts + check-authoring.ts 실행, 수정 적용
H-6: PM/automation    — 테마 적용, CSS 생성, 검색 인덱스 빌드, 메타 태그
H-7: PM               — 시크릿 스캔, 배포, 검증
```

**컴패니언 모드**(`companion: true`)는 H-1을 건너뛰고 기존 강연 프로젝트의 캐시된 결과물을 재사용합니다(재조사하지 않음):
- `research_notes.md` (리서치 패키지)
- `image-manifest.json`의 `assets/images/` (이미지 캐시)
- `assets/diagrams/*.svg` (다이어그램 캐시)
- `source-verification.md`의 참고문헌 (참고문헌 캐시)
- `_versions/` 스냅샷 (버전 캐시)

전체 파이프라인 스펙: `skills/handbook/SKILL.md`.

## 4. 인게이지먼트 / 프로덕션 단계 구조

co-deck는 `AGENTS.md` §3.5 및 §4.1.5에 따라 모든 결과물을 단계에 매핑합니다:

| Phase | 명칭 | PM 역할 | 전문 에이전트 |
|---|---|---|---|
| 0 | 프로젝트 시작 | 소유자 — `lecture-profile.md` 로드, `project_state.json` 초기화 | — |
| 1 | 리서치 | 직접 핸드오프 | `research` |
| 1.5 | 출처 검증 | 게이트 1.5 검토자 — Trust Score 확인 | `source-verifier` (선택) |
| 2-3 | 스토리라인 | 게이트 2 승인자 (필수) | `storyline` |
| 3.5 | 이미지 큐레이션 + 다이어그램 생성 | 관찰자 | `image-curator` ‖ `diagram-specialist` (둘 다 선택, 병렬 실행) |
| 4 | 디자인 | 게이트 3 검토자 (선택) | `design` |
| 5-8 | HTML 빌드 | 게이트 4 검토자 (선택) | `html-build` |
| 9-10 | 레이아웃 측정 / PDF 준비 | 관찰자 | `measure` (deprecated) 또는 `prep-pdf` |
| 11 | PDF 출력 | 게이트 5 승인자 (필수) | `pdf-export` |

**필수 게이트**: 게이트 2(콘텐츠/스토리라인 승인)와 게이트 5(샘플 PDF 승인)는 PM이 진행하기 전에 사용자의 명시적 승인이 필요합니다. 게이트 1.5, 3, 4는 선택 사항입니다 — PM이 결과를 검토하고 이상이 없으면(예: Trust Score 70% 미만이 아니면) 자동으로 진행합니다.

핸드북이 슬라이드 덱이 아니라 결과물일 경우, H-Stage 핸드북 파이프라인(위 §3)이 이 표와 독립적으로 실행됩니다.

새 테마/스타일을 만들기 위한 경량 **T-Stage 파이프라인**도 있습니다(위 표의 `theme-authoring` 참고) — 이는 주요 11단계 프로덕션 흐름의 일부가 아닙니다.

## 5. 출력 / 결과물 위치

모든 강연 프로젝트는 Stage 0에서 생성된 `presentations/<project-name>/` 아래에 위치합니다:

```
presentations/<project-name>/
  lecture-profile.md          # docs/lecture-profile.md의 프로젝트별 사본
  project_state.json          # 단계별 상태/승인 추적
  research_notes.md           # Stage 1 출력
  source-verification.md      # Stage 1.5 출력 (Trust Score)
  storyline.md                # Stage 2 출력
  slide_deck.md                # Stage 2-3 출력 (슬라이드별 콘텐츠 + image_role/image_query)
  design_spec.md               # Stage 4 출력 (색상/폰트/레이아웃)
  assets/images/                # Stage 3.5 출력 (image-curator)
  image-manifest.json           # Stage 3.5 출력
  assets/diagrams/*.svg (+.png)  # Stage 3.5 출력 (diagram-specialist)
  diagram-manifest.json          # Stage 3.5 출력
  lecture_vN.html                # Stage 5-8 출력 (html-build)
  pdf_layout_spec.md / layout summary  # Stage 9-10 출력
  sample_5slides.pdf             # Stage 11 샘플 출력 (게이트 5)
  <project-name>.pdf              # Stage 11 최종 인쇄용 출력
  _versions/                      # version 에이전트 스냅샷 (횡단적)
```

프로젝트에 종속되지 않는 공유 자산은 `docs/` 아래에 있습니다:

- `docs/lecture-profile.md` — 새 프로젝트마다 복사되는 마스터 프로필 템플릿
- `docs/html-themes/` — 테마/스타일 레지스트리(`THEMES.md`), 공유 `styles/`, `themes/`, `preview/preview.html`
- `docs/co-deck.context.md`, `docs/designs/` — 변형 컨텍스트 및 디자인 노트

핸드북 결과물(H-Stage)은 H-0에서 확인한 출력 디렉터리(단독형 핸드북, 강연 컴패니언, 또는 전체 코스 사이트)에 작성되며, H-6/H-7에 따라 정적 사이트로 배포됩니다.

위 모든 것을 뒷받침하는 자동화 스크립트는 `scripts/co-deck/`에 있습니다(전체 매니페스트는 `scripts/co-deck/SCRIPTS.md` 참고) — 일반적으로 직접 호출하지 않으며, 디스패치된 전문 에이전트가 대신 실행합니다.

---

## 6. 테마 × 스타일 미리보기 (`preview.html`)

co-deck은 `docs/html-themes/preview/preview.html`에 브라우저 기반의 대화형 테마 × 스타일 미리보기 도구를 제공합니다. 실제 프로덕션 렌더링 파이프라인(`buildThemeDeck`)을 그대로 사용하여 테마 및 스타일 조합을 실시간 렌더링합니다.

### 사용 방법:
1. 브라우저에서 `docs/html-themes/preview/preview.html`을 클릭하여 엽니다 (`file://` 로컬 경로 및 웹서버 환경 모두 지원).
2. 상단 바 드롭다운 메뉴에서 **테마**와 **스타일**을 선택합니다 (예: `theme=pitch-enhanced&style=premium-dark`).
3. URL 쿼리 파라미터로 직접 원하는 조합을 지정할 수도 있습니다:
   `docs/html-themes/preview/preview.html?theme=outlook&style=classic`

### 미리보기 자산 재생성 명령:
새로운 테마/스타일을 추가하거나 수정했을 때 미리보기 데이터 및 덱을 갱신합니다:
```bash
# 매니페스트(themes-manifest.js) 재생성
bun scripts/co-deck/generate-themes-manifest.ts

# docs/html-themes/preview/decks/ 폴더 내 전체 27개 미리보기 HTML 덱 재생성
bun scripts/co-deck/build-theme-preview.ts
```
