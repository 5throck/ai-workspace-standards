---
sync_version: 1
translated_from_hash: TBD
---

# co-deck

> **Status**: 🔶 Beta — v0.1.0

**Co-Deck** 워크스페이스에 오신 것을 환영합니다. 이곳은 강연 및 발표 자료를 AI와 함께 제작하는 11단계 워크플로우 시스템입니다.

## 1. 팀 미션

**미션:** 리서치부터 인쇄용 PDF까지, 전문 AI 에이전트 팀이 강연 자료 제작을 처음부터 끝까지 함께합니다.

8개의 전문 에이전트가 역할을 분담하여 자료 조사, 스토리라인 구성, 디자인, HTML 슬라이드 빌드, 레이아웃 측정, PDF 출력까지 단계별로 처리합니다.

## 2. AI 팀 소개

| 에이전트 | 단계 | 역할 |
|---------|------|------|
| **PM** | 0-6 (전체) | 오케스트레이터 — 유일한 사용자 창구, `project_state.json` 관리 |
| **Version** | 전체 (횡단) | 모든 파일 수정 전 스냅샷 저장 |
| Research | 1 | 웹 리서치 및 자료 수집 → `research_notes.md` |
| Content | 2-3 | 스토리라인 및 슬라이드 구성 → `storyline.md`, `slide_deck.md` |
| Design | 4 | 색상, 폰트, 레이아웃 확정 → `design_spec.md` |
| Build | 5-8 | HTML 슬라이드 + 이미지 생성 → `lecture_vN.html` |
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
python scripts/snapshot.py <file>.md --workspace presentations/<project> --desc "..." --agent content

# 레이아웃 측정
python scripts/measure_layout.py presentations/<project>/lecture_vN.html

# PDF 생성
python scripts/gen_sample5.py --project presentations/<project>
python scripts/gen_full.py    --project presentations/<project>
```

### D. 슬래시 명령어

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR
- `/changelog "..."` — `CHANGELOG.md`에 항목 추가
- `/memlog "summary"` — 오늘 세션 로그에 요약 추가

## 4. 의존성 설치

```bash
pip install fpdf2 pillow playwright
playwright install chromium
bun --version   # audit.ts, dev-sync.ts 실행에 필요
```

*Last Updated: 2026-06-18 — co-deck variant template*
