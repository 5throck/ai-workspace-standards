# Co-Consult — 사용자 가이드

> **대상**: 이 AI 전략 컨설팅 팀을 사용하는 인게이지먼트 리드, 애널리스트, 클라이언트
> **아키텍처**: PM 게이트웨이 → 전문 에이전트 → 스킬 → deliverables/

이 가이드는 작업 중심(task-oriented)입니다: 특정 컨설팅 작업을 완료하기 위해 무엇을 요청해야 하는지 알려줍니다. 팀 구성과 미션 선언문은 [`README.md`](../README.md)를 참고하세요.

## 1. 빠른 시작

전문 에이전트에게 직접 말을 걸지 않습니다 — 항상 **PM**(Engagement Leader)에게 말하고, PM이 적절한 전문가를 투입합니다.

```
You:  "전기차 충전 시장 진출을 준비하는 클라이언트를 위한 경쟁 분석이 필요합니다"
PM:   요청을 분석하고 단계를 분류한 뒤 실행 계획을 표시합니다:

      | # | Task                                   | Agent             | Tier   | Model  |
      |---|-----------------------------------------|--------------------|--------|--------|
      | 1 | 시장/경쟁 분석                            | strategy-analyst   | Medium | sonnet |
      | 2 | /sync "docs: add EV market analysis"     | pm                 | Medium | sonnet |

      Execution Order: Sequential
PM:   "strategy-analyst를 dispatch할까요?"
You:  "네"
PM:   ▶ strategy-analyst dispatch...
```

**협업 규칙**:
- 항상 PM으로 시작하세요. `agents/*.md` 전문 에이전트를 직접 호출하지 마십시오 — PM 게이트웨이는 도구, 프롬프트, QA 게이트 수준에서 강제됩니다(`AGENTS.md` §3 참고).
- PM은 전문가를 dispatch하기 **전에** 항상 실행 계획 표를 보여줍니다 — 검토하고 확인하면 작업이 진행됩니다.
- 기록할 가치가 있는 변경(새로운 산출물, 완료된 분석, 보고서)이 발생하면 계획의 마지막 행은 항상 `/sync "type: message"`입니다 — 이는 memlog → changelog → audit → commit → PR을 하나의 파이프라인으로 실행합니다. 직접 `git commit`을 실행하지 않습니다.

## 2. 어떤 종류의 컨설팅 작업이 필요하신가요?

아래 표를 참고하여 어떤 에이전트와 스킬이 일반적으로 투입되는지 확인하세요. 직접 이름을 언급할 필요는 없습니다 — 작업을 설명하기만 하면 됩니다 — 하지만 이 매핑을 알면 요청을 구성하고 기대치를 설정하는 데 도움이 됩니다.

| 요청 내용 | 에이전트 | 스킬 |
|---|---|---|
| "시장/경쟁 분석이 필요합니다" | strategy-analyst | `competitive-intelligence` |
| "이 권고안의 비즈니스 케이스/ROI/NPV를 만들어주세요" | strategy-analyst | `financial-modeling` |
| "한국 기업의 재무 분석이 필요합니다" (DART 기반) | data-analyst | `financial-statement-analysis`, `k-dart` |
| "이 회사의 전체 프로필/인텔리전스 보고서를 만들어주세요" | data-analyst | `company-intelligence`, `k-dart` |
| "산업 인사이트/규제 환경 분석이 필요합니다" | industry-expert | (산업 리서치, 전용 스킬 파일 없음) |
| "클라이언트 덱/임원용 프레젠테이션이 필요합니다" | communications-lead | `executive-presentation`, `narrative-framework` |
| "이 결과를 컨설팅 보고서로 작성해주세요" | communications-lead | `consulting-report-writing` |
| "조직 변화 기획/전환 로드맵이 필요합니다" | change-management-partner | `org-readiness-assessment`, `stakeholder-alignment` |
| "이 변화가 각 부서/역할에 미치는 영향을 매핑해주세요" | change-management-partner | `change-impact-assessment` |
| "기술 솔루션/아키텍처를 설계해주세요" | solutions-architect | `solution-design` |
| "이것이 기술적으로 실현 가능한가요? 위험/비용 범위는?" | solutions-architect | `technical-feasibility` |
| "여러 분석 결과를 하나의 전략적 내러티브로 통합해주세요" | strategy-analyst | `insight-synthesis` |
| "딜리버리 일정/마일스톤/리스크 레지스터를 계획해주세요" | delivery-manager | `project-delivery` |
| "이 산출물에 대한 클라이언트 검토 사이클을 관리해주세요" | delivery-manager | `stakeholder-review-management` |
| "기능별 전문성(HR/재무/운영/마케팅)이 필요합니다" | sme | (기능 도메인 전문성) |
| "이 워크스트림을 조율/팀 진행 상황을 추적해주세요" | workstream-lead | (워크스트림 조율) |
| "협업 도구/디지털 워크플로우를 설정해주세요" | technology-specialist | (플랫폼/도구 지원) |
| "통계 분석/데이터 모델링을 실행해주세요" | data-analyst | (통계/데이터 분석) |

**일반적인 다중 에이전트 시퀀스**:
- 시장 진입 인게이지먼트: `strategy-analyst`(competitive-intelligence) → `solutions-architect`(solution-design, technical-feasibility) → `strategy-analyst`(financial-modeling, technical-feasibility와 최대 2회 반복) → `communications-lead`(executive-presentation).
- 조직 전환 인게이지먼트: `change-management-partner`(org-readiness-assessment, stakeholder-alignment) → `change-management-partner`(change-impact-assessment) → `communications-lead`(narrative-framework)로 변화 스토리 작성.
- 딜리버리 핸드오프: `solutions-architect`(solution-design이 의존성 맵 + 리스크 레지스터 생성) → `delivery-manager`(project-delivery가 이를 실행 계획으로 전환) → `delivery-manager`(stakeholder-review-management)로 검토 사이클 진행.

## 3. 단계별 안내: 재무제표 분석 파이프라인

이는 가장 최근에 추가되었고 가장 복잡한 스킬(`financial-statement-analysis`)로, 한국 금융감독원 전자공시시스템(DART)을 기반으로 한 한국 기업 재무 분석을 다룹니다. 6단계 파이프라인으로 실행됩니다: **DART 수집 → 검증 → 정규화 → KPI 추출 → ROIC 밸류 드라이버 트리 → 보고서 생성.**

### 1단계 — DART 데이터 수집
`k-dart` 스킬(또는 PM에게 `data-analyst` 투입을 요청)을 사용하여 대상 기업의 공시와 재무제표를 DART OpenAPI에서 가져옵니다. 이를 위해서는 `API_K_DART` 환경 변수가 설정되어 있어야 합니다. 원본 JSON 응답을 저장하세요 — 이것이 파이프라인의 입력값입니다.

### 2단계 — 파이프라인 실행
검증 → 정규화 → KPI → 드라이버 트리 → 보고서로 이어지는 전체 체인은 하나의 스크립트로 자동화됩니다.

```bash
bun scripts/co-consult/financial-pipeline.ts <dart-json-path> --company <name> [--output-dir <dir>]
```

예시:
```bash
bun scripts/co-consult/financial-pipeline.ts ./deliverables/samsung/dart/dart-2026-07-19.json --company samsung
```

내부적으로 파이프라인 스크립트는 다음을 수행합니다:
1. 입력한 DART 데이터를 `<output-dir>/dart/dart-<date>.json`에 복사합니다.
2. **② 검증** — Python 검증 엔진을 실행하고 `<output-dir>/validation/validation-report-<date>.json`을 작성하며 통과율(pass-rate)을 보고합니다.
3. **③ 정규화** — `python/mappings/ifrs_general.json`을 사용하여 원본 DART 필드를 표준 IFRS-general 재무 모델로 매핑하고, `<output-dir>/canonical/canonical-model-<date>.json`을 작성하며 필드 커버리지 비율을 보고합니다.
4. **④ KPI 추출** — 표준 모델로부터 수익성, 성장성, 레버리지, 현금흐름 KPI를 산출하고 `<output-dir>/kpi/kpi-report-<date>.json`을 작성합니다.
5. **⑤ ROIC 밸류 드라이버 트리** — 5단계 이상의 ROIC 분해 트리를 구축하고 `<output-dir>/driver-tree/driver-tree-<date>.json`을 작성합니다.
6. **⑥ 보고서 생성** — 검증 결과, 표준 모델, KPI, 드라이버 트리를 통합하여 `<output-dir>/reports/financial-analysis-<company>-<date>.md`에 구조화된 Markdown 보고서를 작성합니다.

특정 단계를 개별적으로 실행하거나 재실행해야 하는 경우(예: 매핑 수정 후 KPI 재생성), 아래 스크립트를 개별적으로도 사용할 수 있습니다:

```bash
bun scripts/co-consult/financial-validate.ts <dart-json-path>
bun scripts/co-consult/financial-normalize.ts <dart-json-path> <mapping-path>
bun scripts/co-consult/financial-kpi.ts <canonical-model-path>
bun scripts/co-consult/financial-driver-tree.ts <canonical-model-path>
bun scripts/co-consult/financial-report.ts   # financial-pipeline.ts가 프로그래밍 방식으로 호출
```

### 3단계 — 보고서 검토
최종 Markdown 보고서는 바로 사용 가능한 산출물입니다. 클라이언트 대상 프레젠테이션으로 전환해야 한다면 `communications-lead`(`executive-presentation` 스킬)에게, 더 넓은 비즈니스 케이스에 반영되어야 한다면 `strategy-analyst`(`financial-modeling` 스킬)에게 전달하세요.

## 4. 인게이지먼트 단계 구조

`AGENTS.md` §3.5 및 §4.2에 따라 작업은 여러 단계를 거치며, PM은 Phase 0, 2, 5-6에서만 능동적으로 조율합니다 — 전문가들은 배정된 단계 내에서 자율적으로 작업합니다.

| Phase | 명칭 | 담당 |
|---|---|---|
| 0 | 프로젝트 개시 | PM |
| 1 | 전략 및 리서치 | strategy-analyst, industry-expert, data-analyst, sme, change-management-partner |
| 2 | 설계 검증 | industry-expert, sme, change-management-partner — PM이 검증 및 게이트 |
| 3 | 솔루션 및 내러티브 설계 | communications-lead, solutions-architect, sme |
| 4 | 실행 및 딜리버리 | delivery-manager, workstream-lead, technology-specialist |
| 5 | 라이프사이클 마무리 | PM (거버넌스 기록 업데이트, memory/에 로그) |
| 6 | QA 및 마무리 | PM (`bun scripts/audit.ts` 실행 후 `/sync`) |

**반복 루프**: `financial-modeling` ↔ `technical-feasibility`는 Phase 4로 이동하기 전에 비용/ROI 가정과 기술적 리스크를 조율하기 위해 최대 2회 반복될 수 있습니다.

## 5. 산출물 위치

모든 인게이지먼트 산출물은 `deliverables/` 아래에 작성됩니다:

```
deliverables/
├── drafts/          # 진행 중인 분석, 작업 중인 산출물
├── presentations/    # executive-presentation 및 narrative-framework 산출물
├── references/       # 지원 리서치, 출처 문서, 인용
└── research/         # competitive-intelligence, company-intelligence, 산업 리서치
```

`financial-statement-analysis` 파이프라인의 경우, 회사별로 별도의 하위 디렉토리가 생성됩니다(`financial-pipeline.ts`가 자동으로 생성하며, 기본값은 `deliverables/<company-name>/`)이며 여기에는 `dart/`, `validation/`, `canonical/`, `kpi/`, `driver-tree/`, `reports/`가 포함됩니다 — 위의 §3을 참고하세요.

세션 활동과 의사결정은 별도로 `memory/YYYY-MM-DD.md`에 기록됩니다(산출물이 아니라 내부 인게이지먼트 로그입니다).

## 6. 신뢰성에 관한 참고 사항

이 팀은 리서치, 초안 작성, 분석 속도를 높여주지만 전문적인 판단을 대체하지는 않습니다. 재무 수치, ROIC 계산, DART에서 도출된 데이터는 클라이언트 최종 산출물로 제시되기 전에 독립적으로 검증되어야 합니다. financial-statement-analysis 파이프라인의 수치 결과는 공개 공시 데이터와 정규화 매핑에서 도출된 근사치입니다. 항상 출처를 인용하고, 검증되지 않은 항목은 워크스페이스의 출처 표시 표준(`AGENTS.md` §7 참고)에 따라 명시하세요.
