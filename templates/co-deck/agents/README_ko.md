# co-deck 에이전트 목록

이 폴더에는 강연/발표 자료 제작 워크플로우를 위한 8개의 전문 에이전트가 있습니다.

## 에이전트 인덱스

| 에이전트 | 파일 | 단계 | 역할 |
|---------|------|------|------|
| PM | `pm.md` | 0-6 (전체) | 오케스트레이터 — 유일한 사용자 창구 |
| Version | `version.md` | 0-6 (횡단) | 파일 수정 전 스냅샷 보관 |
| Research | `research.md` | 1 | 웹 리서치 및 자료 수집 |
| Content | `storyline.md` | 2-3 | 스토리라인 및 슬라이드 덱 작성 |
| Design | `design.md` | 3 | 디자인 스펙 (색상, 폰트, 레이아웃) |
| Build | `html-build.md` | 4 | HTML 슬라이드 + 이미지 생성 |
| Measure | `measure.md` | 4 | Playwright 레이아웃 측정 + 폰트 다운로드 |
| Export | `pdf-export.md` | 4-5 | 샘플 PDF → 검수 → 전체 PDF |

## 주요 규칙

- PM은 **유일한 진입점** — 사용자는 전문가 에이전트와 직접 대화하지 않음
- Version 에이전트는 **모든 파일 수정 전에 반드시 호출**
- Gate 2, 3, 5는 **사용자 명시적 승인** 필요
- `project_state.json`은 강연 진행 상태의 **단일 진실 공급원**

전체 워크플로우 다이어그램과 데이터 흐름은 [`AGENTS.md`](../AGENTS.md) 참조.
