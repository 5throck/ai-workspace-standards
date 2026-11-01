---
lang: ko
lang_reason: source-material
translated_from_hash: f00fe7ed6ebe2ddfae95d75ae8f5d3b7b840039721013603b7178e41f0af4660
---

# Co-Architect 사용자 가이드

**언어**: [English](user-guide.md) · **한국어**

> 이 가이드는 co-architect 프로젝트의 *사용법* — 건축 작업을 에이전트 팀에
> 전달하는 방법, 6개의 이름 있는 워크플로, 산출물 위치를 설명합니다. 최초 설치는
> [`guides/first-time-user-guide.md`](guides/first-time-user-guide.md)를, 전체
> 로스터와 저장소 구조는 [`../README_ko.md`](../README_ko.md)를, 거버넌스 규칙은
> [`../AGENTS.md`](../AGENTS.md)를 참고하세요.

## 1. 빠른 시작

1. 작업은 **PM**에게 전달합니다 — PM이 유일한 진입점입니다. 일상 언어로
   요청하세요: *"판교 84㎡ 리모델링 제안 — 시장 조사, 디자인 탐색, 인허가
   검토까지."*
2. 다중 에이전트 작업에는 PM이 **실행 계획 표**(작업 | 에이전트 | 티어 | 모델 |
   플랫폼)를 보여주고, 전문가 디스패치 전에 사용자의 승인을 기다립니다.
3. 작업은 6개의 이름 있는 워크플로 중 하나로 진행됩니다: `market-research`(시장
   조사), `design-exploration`(디자인 탐색), `project-acquisition`(수주),
   `design-delivery`(디자인 납품), `permit-compliance`(인허가 검토),
   `interior-execution`(인테리어 시공).
4. 엔지니어링 산출물(SketchUp 모델, ZWCAD 도면)은 **엔지니어링 팀** 리드
   (`sketchup-modeler`)와 CAD 드래프터를 경유합니다.
5. 마무리는 `/sync` — PM의 품질 게이트를 모두 통과한 후에만 실행합니다.

> **기본 규칙**: 건축법·도시계획 관련 진술은 항상 `bylaw-expert`가 KR 국가
> 프로파일 기준으로 확인한 내용만 사용합니다 — 도면 에이전트의 기억에 의존하지
> 않습니다.

## 2. 어떤 작업인가요?

| 시나리오 | 담당 에이전트 | 비고 |
|---------------|-----------------|-------|
| 입지/시장 조사, 경쟁사 브리프 | analyst, content-writer | 리서치 팀 |
| 콘셉트 디자인, 무드보드, UX 흐름 | design-lead, ux-researcher, visual-designer, prototype-engineer | 디자인 팀 |
| 서비스 블루프린트, 고객 여정 | service-designer | 디자인 팀 |
| 타이포그래피, 스토리텔링, 렌더링 | typography-expert, design-storyteller, visualization-expert | 디자인 팀 |
| 일정 관리, RFP/제안 수주 | project-coordinator, ms365-expert | 프로젝트 팀 |
| 기술 문서화 | technical-writer | 프로젝트 팀 |
| 3D 모델링 (SketchUp) | sketchup-modeler (리드) | 엔지니어링 팀 |
| 2D CAD 도면 (ZWCAD) | zwcad-drafter, drafting-architect | 엔지니어링 팀 |
| 구조 / 설비 검토 | structural-engineer, mep-engineer | 엔지니어링 팀 |
| 건축법 & 용도지역 검토 | bylaw-expert | 리서치 팀 |
| 실내 공간 계획 & 마감 재료 | interior-designer | 디자인 팀 |

## 3. 다섯 개의 팀

```
                       사용자
                        │
                     PM (관문)
        ┌───────────┬───┴───────┬─────────────┐
      디자인       리서치       프로젝트      엔지니어링
  (design-lead)  (analyst)  (project-    (sketchup-
        │             │      coordinator)    modeler)
    8명           3명          2명          4명
                                       + platform-engineering
                                         (architect 리드,
                                          automation-engineer)
```

5개 팀에 24명의 전문 에이전트가 있습니다. `platform-engineering` 팀은 워크스페이스
자체의 스크립트와 스킬을 유지보수합니다 (ADR-0036: TypeScript 자동화 스크립트).

## 4. MCP 서버 (CAD 스택)

| 서버 | 용도 |
|--------|---------|
| `zwcad-mcp` | 2D/3D ZWCAD 파일 자동화 및 도면 생성 (56개 도구) |
| `building_skill` | 한국 건축법 및 용도지역 규제 분석 |
| `base-map` | 코드 리뷰·임베딩·앙상블 협의용 로컬 LLM 추론 |

`.env`와 플랫폼별 `settings.local.json`(gitignore)에 설정합니다. 전체 도구
스택은 [`co-architect.context.md`](co-architect.context.md)를 참고하세요.

## 5. CAD 인텔리전스 플랫폼

이 워크스페이스는 한국 아파트 평면도 판독용 CAD 인텔리전스 계층
(`src/cad_intelligence/`, 동결된 v5.1 헌법)을 포함합니다: 한국어 라벨 정답셋
기준의 방/문/창 인식, 실내 입면 생성, 기계 판독용 건축용어 글로서리. 국가
프로파일(`docs/countries/KR.md` +
`src/cad_intelligence/ontology/profiles/KR.yaml`)은 `CAD_COUNTRY` 변수로
선택되며, 기본값은 KR입니다.

인식 결과의 상태 라벨은 참고 지식입니다 — 실제 적용 전에 최신 법령으로
확인하세요 (프로파일 자체의 경고문 참조).

## 6. 산출물 위치

| 산출물 | 위치 |
|-------------|----------|
| 설계 문서 / ADR | `docs/designs/`, `docs/adr/` |
| 도면·렌더링 익스포트 | `artifacts/` |
| 회의록, 세션 로그 | `memory/` |
| ZWCAD/SketchUp 작업 파일 | 프로젝트 루트 또는 `artifacts/` (바이너리 커밋은 PM 승인 필요) |

## 7. 베타 안내

이 템플릿은 **베타(v0.1.0)**입니다. 검증된 `Projects/co-architect` 워크스페이스에서
승격되었으며, 참여 피드백을 수집 중입니다. 디자인 도메인 스킬(접근성 감사,
UI/UX 인텔리전스, 서비스 디자인, 토큰 사용 린트, 디자인 토큰)은 `variant.json`의
`hub.consumes` 선언을 통해 **co-design 허브**에서 소비합니다 — 업그레이드는 로컬
수정이 아니라 허브 승격 웨이브를 통해 전달됩니다.
