---
sync_version: 1
translated_from_hash: PLACEHOLDER
---

# co-deck

> **Status**: 🔶 Beta — v0.1.0

**Co-Deck** 워크스페이스에 오신 것을 환영합니다. 이곳은 강연 및 발표 자료를 AI와 함께 제작하는 11단계 워크플로우 시스템입니다.

## 1. 팀 미션

**미션:** 리서치부터 인쇄용 PDF까지, 전문 AI 에이전트 팀이 강연 자료 제작을 처음부터 끝까지 함께합니다.

10개의 전문 에이전트가 역할을 분담하여 자료 조사, 출처 검증, 스토리라인 구성, 디자인, 이미지 수집, HTML 슬라이드 빌드(4가지 테마), 레이아웃 측정, PDF 출력까지 단계별로 처리합니다.

## 2. AI 팀 소개

| 에이전트 | 단계 | 역할 |
|---------|------|------|
| **PM** | 0-11 (전체) | 오케스트레이터 — 유일한 사용자 창구, `project_state.json` 관리 |
| **Version** | 전체 (횡단) | 모든 파일 수정 전 스냅샷 저장 |
| Research | 1 | 웹 리서치 및 자료 수집; `lecture-profile.md` 로드 → `research_notes.md` |
| Source Verifier | 1.5 | URL 접근성 + 내용 교차 검증 → `source-verification.md` (Trust Score) |
| Storyline | 2-3 | 스토리라인 및 슬라이드 구성 (`image_role`/`image_query` 포함) → `slide_deck.md` |
| Design | 4 | 색상, 폰트, 레이아웃 확정 → `design_spec.md` |
| Image Curator | 3.5 | 상업적 무제한 이미지 검색·다운로드 → `assets/images/` + `image-manifest.json` |
| Build | 5-8 | HTML 슬라이드 + 테마 적용 (`data-theme`) → `lecture_vN.html` |
| Measure | 9-10 | Playwright 레이아웃 측정 + 폰트 다운로드 → `pdf_layout_spec.md` |
| Export | 11 | 샘플 PDF → 검수 → 전체 PDF → `<project>.pdf` |

## 3. 이 팀과의 협업 방법

### A. PM 게이트웨이
항상 **PM**과 대화하여 요청을 시작하세요. 전문 에이전트를 직접 호출하지 마십시오.

### B. 표준 워크플로 단계

```
[PM] → Research → Content → Design → Build → Measure → Export
       (1단계)   (2-3단계)  (4단계)  (5-8단계) (9-10단계) (11단계)

             ↑
        [Version] — 모든 파일 수정 전 자동 호출
```

**필수 승인 게이트**: 게이트 2 (콘텐츠 확인), 게이트 3 (디자인 확정), 게이트 5 (샘플 PDF 검수)

### C. 주요 명령어

```bash
# 버전 스냅샷 (수정 전 항상 실행)
bun scripts/co-deck/snapshot.ts <file>.md --workspace presentations/<project> --desc "..." --agent storyline

# 레이아웃 측정 (Playwright 필요)
bun scripts/co-deck/measure-layout.ts presentations/<project>/lecture_vN.html

# PDF 생성
bun scripts/co-deck/gen-slides-pdf.ts --project presentations/<project> --sample 5
bun scripts/co-deck/gen-slides-pdf.ts --project presentations/<project>
```

### D. 슬래시 명령어

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR
- `/changelog "..."` — `CHANGELOG.md`에 항목 추가
- `/memlog "summary"` — 오늘 세션 로그에 요약 추가

## 4. 의존성 설치

```bash
bun install   # pdf-lib, fflate, @pdf-lib/fontkit 설치 (Playwright는 optionalDependency — 기본 제외)

# 레이아웃 측정(measure-layout.ts)이 필요한 경우에만:
bun add playwright
bunx playwright install chromium
```

*Last Updated: 2026-06-19 — co-deck variant template*
