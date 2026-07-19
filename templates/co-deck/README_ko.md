---
content_hash: PLACEHOLDER
sync_version: 1
---

# co-deck

> **⚠️ 베타 변형** - 상태: beta (v0.2.0)
> 이 변형은 활발히 개발 중이며 프로덕션 환경에서 사용해서는 안 됩니다.

---

강연 및 발표 자료 제작 변형 — 리서치부터 인쇄용 PDF까지 이어지는 11단계 AI 워크플로우, 그리고 핸드북/코스 사이트 제작을 위한 독립적인 H-Stage 파이프라인. 리서치, 출처 검증, 콘텐츠, 디자인, 이미지 큐레이션, 다이어그램/차트 생성, HTML 빌드(5개 테마), 레이아웃 측정, PDF 출력, 핸드북 문서 제작을 담당하는 12개의 전문 에이전트를 포함합니다.

## Quick Start

이 변형은 워크스페이스 템플릿의 베타 변형입니다. `templates/common`을 상속하며 변형별 커스터마이징을 포함합니다.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## Beta Status

이 변형은 현재 **베타** 상태이며 다음을 필요로 합니다:

- **클라이언트 인게이지먼트**: 0/2 (변형 거버넌스 규칙 참고)
- **베타 기간**: 0/2개월
- **추가 체크**: 대기 중

승격 기준은 `scripts/helpers/variant-governance-rules.ts`를 참고하세요.

## Variant Type

**Type**: lecture

이 변형은 리서치부터 인쇄용 PDF까지의 강연 및 발표 자료 제작, 그리고 검색 가능한 테마 기반 핸드북(정적 사이트: 단독형, 컴패니언, 또는 전체 코스 사이트)에 초점을 맞춥니다.

## Agent Roster

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| pm | 11단계 파이프라인 + H-Stage 핸드북 파이프라인을 오케스트레이션; 유일한 사용자 진입점 | High | inherit |
| research | 웹 소스 수집; lecture-profile.md 로드 | Medium | inherit |
| source-verifier | 리서치 URL 검증 → source-verification.md + Trust Score | Medium | inherit |
| storyline | image_role/image_query 필드를 포함한 storyline.md, slide_deck.md 작성 | Medium | inherit |
| design | 시각 디자인 스타일을 design_spec.md로 확정 | Medium | inherit |
| image-curator | 상업적 사용 가능 이미지 검색·다운로드 (Pixabay/Unsplash/Pexels) | Medium | inherit |
| diagram-specialist | visual_spec으로부터 SVG 컨셉 다이어그램과 데이터 차트 생성; HTML은 SVG가 우선, PDF는 PNG 선택 | Medium | inherit |
| html-build | 테마 주입(`data-theme`)을 포함한 HTML 슬라이드 생성; 5개 테마 | Medium | inherit |
| measure | Playwright로 슬라이드 레이아웃 자동 측정; TTF 폰트 다운로드 | Medium | inherit |
| pdf-export | 측정된 레이아웃 데이터로부터 샘플/전체 PDF 생성 | Medium | inherit |
| version | 모든 수정 전 파일 스냅샷; 이전 상태 복원 | Low | inherit |
| handbook-writer | 핸드북 콘텐츠 작성 — 챕터 구조, 본문, 코스 자료 (H-2~H-4) | Medium | inherit |
| handbook-reviewer | 품질 게이트 — handbook-doctor, check-authoring 실행 및 수정 적용 (H-5) | Medium | inherit |

## Skills

- **research**: 소스 수집 및 아이디어 발굴 — 주제/대상 확인, lecture-profile.md 로드, research_notes.md 작성
- **source-verifier**: URL 검증 — Level 1 HTTP 체크 + Level 2 콘텐츠 교차 검증; Trust Score 출력
- **storyline**: 스토리라인 설계 — image_role/image_query를 포함한 storyline.md, slide_deck.md 작성; 커버/구분 슬라이드 확인 처리
- **design**: 시각 디자인 확정 — 레이아웃, 색상 팔레트, 폰트 패밀리 결정 및 design_spec.md 저장
- **image-curator**: 이미지 확보 — Pixabay(키 불필요), Unsplash URL, Pexels/Unsplash API; 모든 소스 상업적 사용 무제한
- **diagram-specialist**: 다이어그램/차트 생성 — 6개 컨셉 다이어그램 유형(cycle/flow/matrix/pyramid/timeline/comparison) + 3개 SVG 차트 유형(bar/line/pie); HTML의 기본 전달 형식은 SVG이며, PNG는 선택 사항으로 PDF 출력 시에만 필요
- **html-build**: HTML 슬라이드 생성 — `data-theme` 속성 적용; base.css + 오버라이드 CSS 주입; 5개 테마(outline, pitch, pitch-enhanced, vertical, zen)
- **measure**: 레이아웃 측정 (deprecated) — Playwright로 좌표를 추출하고 TTF 폰트 다운로드; **prep-pdf**로 대체됨
- **prep-pdf**: Playwright 불필요한 PDF 준비 — 4계층 스펙 병합(base → theme → style → overrides) 해석, 폰트 검증, 레이아웃 요약 출력; Stage 9-10에서 `measure`를 대체
- **pdf-export**: PDF 생성 — pdf-lib을 통한 샘플(5슬라이드) 및 전체 PDF 생성
- **version**: 버전 스냅샷 — 수정 전 파일 백업; 요청 시 이전 상태 복원
- **handbook**: 핸드북 문서 제작 — H-Stage 파이프라인(H-0~H-7); 단독형/컴패니언/전체 코스 사이트; 다크 모드(3계층 CSS), i18n, 6개 섹션 유형, 5개 기본 테마
- **theme-authoring**: 새 co-deck 테마(T-Stage, 5단계) 또는 스타일(경량, 3단계) 생성의 진입점; `docs/html-themes/THEMES.md` 레지스트리 업데이트

---

**Generated**: 2026-06-17T08:35:00.930Z
**MVP Wave 3** - L2-to-Variant Pipeline
