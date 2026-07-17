---
lang: ko
lang_reason: source-material
---

# co-deck 에이전트 목록

이 폴더에는 강연/발표 자료 제작 워크플로우 및 핸드북 문서 제작을 위한 13개의 전문 에이전트 (PM + 12명의 전문가)가 있습니다.

## 에이전트 인덱스

| 에이전트 | 파일 | 단계 | 인계 체인 |
|---------|------|------|----------|
| PM | `pm.md` | 0-11, H-0~H-7 (전체) | → 전체 에이전트 |
| Version | `version.md` | 횡단 | ← 전체 에이전트 |
| Research | `research.md` | 1, H-1 | pm → research → source-verifier |
| Source Verifier | `source-verifier.md` | 1.5 | research → source-verifier → storyline (선택) |
| Storyline | `storyline.md` | 2-3 | source-verifier → storyline → design |
| Design | `design.md` | 4 | storyline → design → image-curator ‖ diagram-specialist |
| Image Curator | `image-curator.md` | 3.5 | design → image-curator → html-build (선택, diagram-specialist와 병렬) |
| Diagram Specialist | `diagram-specialist.md` | 3.5 | design → diagram-specialist → html-build (선택, image-curator와 병렬) |
| Build | `html-build.md` | 5-8 | design → html-build → measure |
| Measure | `measure.md` | 9-10 | html-build → measure → pdf-export |
| Export | `pdf-export.md` | 11 | measure → pdf-export |
| Handbook Writer | `handbook-writer.md` | H-2~H-4 | pm → handbook-writer → handbook-reviewer |
| Handbook Reviewer | `handbook-reviewer.md` | H-5 | handbook-writer → handbook-reviewer → pm |

## H-Stage 파이프라인 (핸드북 — 문서 제작)

11-Stage 슬라이드 파이프라인과 독립적입니다. 사용자가 핸드북, 코스 사이트, 또는 동반 핸드북을 요청하면 트리거됩니다.

```
H-0: PM — 확인: 주제, 언어, 출력 디렉토리, 동반 모드
H-1: research — 웹 리서치 [동반 모드: 건너뜀, 캐시된 출력 재사용]
H-2: handbook-writer — 섹션 유형 + 챕터 구조 제안
H-3: handbook-writer — 챕터 콘텐츠 작성 (SECTION_TYPES + AUTHORING_GUIDELINES)
H-4: handbook-writer — 강의 개요 + 강사 가이드 생성
H-5: handbook-reviewer — handbook-doctor.ts + check-authoring.ts → 수정
H-6: PM/automation — 테마 적용 → CSS → 검색 인덱스 → 메타
H-7: PM — 시크릿 스캔 + 배포 + 검증
```

**H-Stage 규칙**:
- 동반 모드에서 H-1 건너뜀 — 캐시된 리서치, 이미지, 다이어그램, 레퍼런스, 버전 재사용
- 다크 모드는 자동 감지 (3-layer CSS) — H-0에서 사용자 설정 프롬프트 없음
- 테마는 H-6의 도메인 단계 (단순 에셋이 아님)
- `examples/`는 `check-authoring.ts`의 CI 회귀 테스트 픽처로 사용

## 주요 규칙

- PM은 **유일한 진입점** — 사용자는 전문가 에이전트와 직접 대화하지 않음
- Version 에이전트는 **모든 파일 수정 전에 반드시 호출**
- `source-verifier`는 **선택** — 초안 반복 시 `--skip-verify`로 건너뜀
- `image-curator`는 **선택** — 모든 슬라이드가 `image_role: none`인 경우 건너뜀
- `diagram-specialist`는 **선택** — slide_deck.md에 `visual_spec` 필드가 없으면 건너뜀
- `image-curator`와 `diagram-specialist`는 Stage 3.5에서 **병렬 실행**
- Gate **1.5** (소스 신뢰도), **2**, **5**는 사용자 명시적 승인 필요; Gate 3, 4는 선택 (Gate 1은 폐기)
- `project_state.json`은 강연 진행 상태의 **단일 진실 공급원**
- `handbook-writer`와 `handbook-reviewer`는 **H-Stage에서만 dispatch** — 11-Stage 파이프라인에서는 사용 불가

전체 워크플로우 다이어그램과 데이터 흐름은 [`AGENTS.md`](../AGENTS.md) 참조.
