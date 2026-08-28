---
translated_from_hash: 9caedcbefc1b637e5da996c68cf8644e84be75fb8fdbc143a8f4f93a1645223e
---
# Safety OS 사용자 가이드

**언어**: [English](user-guide.md) · **한국어**

> Safety OS 팀과 일상적으로 협업하는 실무 지향 가이드입니다. 팀 로스터와 미션 개요는 [`README_ko.md`](../README_ko.md)를, 전체 거버넌스/에이전트 명세는 [`AGENTS.md`](../AGENTS.md)를 참고하세요.

## 1. 빠른 시작

모든 작업은 동일하게 시작됩니다: **PM/CSO에게 요청하세요. 전문 에이전트를 직접 호출하지 마세요.**

1. **평상시 말로 작업을 설명합니다.** 예: "화학공장 정비(TAR)가 다음 달 시작돼 — 사전 TAR 위험성평가 패키지를 만들어줘."
2. **PM/CSO가 요청을 분류**하고 **법적 근거 게이트(legal basis gate)**를 확인합니다(모든 워크플로는 산업안전보건법/중대재해처벌법 및 도메인 법령의 규제 근거 3건 이상을 인용해야 함 — 미달 시 PM은 작업을 배치하지 않음), 필요한 전문가를 결정합니다.
3. **다단계 작업(2개 이상 파일 또는 순차 작업) 전에 PM이 실행 계획 테이블을 제시**합니다. 모든 계획은 `/sync`로 끝납니다:

   | 작업 | 에이전트 | 티어 | 스킬 |
   |------|---------|------|------|
   | 사전 TAR 위험성평가 패키지 | ehschem-agent | Medium | `tar-planning` |
   | 도급 인력 급증 대응 온보딩 | contractor-safety-agent | Medium | `contractor-onboarding` |
   | `/sync "feat(tar): pre-TAR package"` — 감사 + 커밋 + 푸시 + PR | pm | High | `sync` |

4. **계획을 승인(또는 조정)합니다.** PM은 전문가를 배치합니다 — 파일을 쓰는 작업은 순차, 읽기 전용 리서치/분석은 병렬.
5. **PM이 결과를 검증**하고 품질 게이트를 실행합니다: `bun scripts/audit.ts`(문서/구조) 및 `bun scripts/co-safety/safety-audit.ts`(legal_basis — 워크플로당 근거 3건 이상, 0 오류 필수).
6. **`/sync "type: description"`으로 작업을 마무리**합니다 — 커밋과 PR을 여는 유일한 경로입니다. 직접 `git commit`/`git push`는 pre-commit 훅이 차단합니다.

**경험칙**: "msds-agent, ~해줄 수 있어..."라고 입력하려 한다면 — 멈추고 PM/CSO에게 요청하세요. PM이 유일한 진입점입니다. 전문가는 디스패치 대상이지, 직접 대화하는 대상이 아닙니다.

## 2. 어떤 작업인가요?

PM이 어떤 전문가를 투입할지 가늠하는 표입니다 — 에이전트를 직접 호출하기 위한 것이 아니라 작업을 효율적으로 설명하기 위한 참고용입니다.

| 시나리오 | 예상 에이전트 | 관련 스킬 |
|----------|--------------|-----------|
| 유해위험요인 식별 + 위험도 산정, 위험성평가 대장 갱신 | risk-assessment-agent | `risk-assessment` |
| 고위험/비일상 작업 허가 | safety-workflow-manager | `permit-to-work` (PTW) |
| 작업 전 일일 안전교육(TBM) | safety-workflow-manager | `tool-box-meeting` |
| 화재·누출·가스누출·부상 — 사고 에스컬레이션 | emergency-agent | `emergency-response` |
| MSDS 파싱, GHS 분류, 화학물질 승인 | msds-agent | `msds-parser`, `ghs-classifier` |
| LOTO / 유해 에너지 격리 절차 | psm-agent | `psm-loto` |
| 변경관리(MOC) 패키지 | psm-agent | `psm-moc` |
| 법령·판례·해석례 조회 | legal-agent | `k-law` (KR 스코프) |
| 산업안전보건법/중대재해처벌법 갭 분석 | compliance-agent | `compliance-gap` |
| 사고 근본원인분석(5-Why / Bow-Tie) | incident-investigation-agent | `root-cause-analysis` |
| 규제 감사 대비, 증적 추적 | audit-agent | `audit-preparation` |
| 설비 유지보수 / 노후 설비 계획 | asset-integrity-agent | `asset-integrity-check` |
| 도급업체 온보딩 + 교육 패키지 | contractor-safety-agent, training-agent | `contractor-onboarding` |
| 화학공장/정유/석유화학 작업 | ehschem-agent | `tar-planning`, `process-hazard-screening` |
| LNG/LPG/수소 터미널 저장, KGS 검사 | gasterm-agent | `tank-integrity-validator`, `construction-permit-overview` |
| 발전소 보일러/터빈, ESS 화재, 아크플래시 | powergen-agent | `ess-fire-risk-assessor`, `arc-flash-analyzer` |
| 제약 GMP/GxP (배치기록, 이상관리/CAPA, QRM) | gmp/glp/gdp/gcp/gvp-agents | `gmp-qrm`, `gmp-deviation-capa`, ... |
| 산업별 EHS (반도체, 이차전지, 조선, 철강, 식품, 화장품, 폐기물, 방위, 바이오, 데이터센터, 물류, 철도) | 해당 도메인 에이전트 | `skills/` 하위 도메인 스킬 |

전체 디스패치 트리거 표: [`AGENTS.md`](../AGENTS.md) §3 "Specialist Agent Roster".

## 3. 표준 다단계 워크플로

```
사용자 요청
     │
     ▼
┌─────────────┐   legal_basis 3건 미만 ──► 차단 (PM/CSO 에스컬레이션)
│  PM / CSO   │────────────────────────
│    분류     │
└──────┬──────┘
       ▼
설계 승인 (실행 계획 테이블, /sync로 종료)
       ▼
┌─────────────────────────────────────────────┐
│  전문가 배치 (Phase 1-5)                    │
│  쓰기는 순차 · 읽기 전용은 병렬             │
│  모든 워크플로 legal_basis ≥3 인용          │
└──────┬──────────────────────────────────────┘
       ▼
┌─────────────┐   실패 ──► 수정 사이클 (최대 3회)
│  QA 게이트  │──────────────────────► 전문가로 회귀
│ audit.ts +  │
│ safety-audit│
└──────┬──────┘
       ▼ 통과
  마무리 — /sync: memlog → CHANGELOG → 감사 → 커밋 → 푸시 → PR
```

**핵심 명령** (프로젝트 루트에서 실행):

| 명령 | 기능 |
|------|------|
| `bun scripts/co-safety/safety-audit.ts` | legal_basis 게이트 — 워크플로/증거모델당 규제 근거 3건 이상, 0 오류 필수 (1,077+ 파일 검사) |
| `bun scripts/audit.ts` | 워크스페이스 표준 감사 (구조, 라이프사이클, 인코딩, 스킬 레지스트리) |
| `bun scripts/agent-verify.ts` | 에이전트 로스터 무결성 (AGENTS.md ↔ agents/ 파일) |
| `/sync "type: description"` | 유일하게 지원되는 커밋 경로 — 전체 파이프라인 실행 후 PR 생성 |

**git을 우회하지 마세요**: 직접 `git commit` / `git push`는 pre-commit 훅이 차단합니다. 모든 변경은 `/sync`를 통과합니다.

## 4. 단계 구조

| 단계 | 담당 | 수행 내용 |
|------|------|-----------|
| 1–2 거버넌스 | safety-governance-manager, legal-agent | EHS 전략, KPI 정의, 규제 추적, 법령 해석 |
| 3–4 운영 | safety-workflow-manager + 기능/도메인 에이전트 | 일일 워크플로 — TBM, PTW, 위험성평가, MSDS, 교육, 컴플라이언스 모니터링, 도메인별 EHS 작업 |
| 5 조사 | incident-investigation-agent, audit-agent | RCA/CAPA, 감사 대비, 증적 추적 |
| 6 QA / 마무리 | pm (+ auditor) | 품질 게이트, `/sync`, PR |

**쓰기 순차, 읽기 병렬**: 파일을 쓰는 에이전트는 한 번에 하나씩 실행되고, 읽기 전용 리서치/분석 에이전트(법무, 컴플라이언스, 보고)는 병렬 실행될 수 있습니다. PM이 이를 자동으로 강제합니다.

## 5. 산출물 위치

| 산출물 | 위치 |
|--------|------|
| 위험성평가 기록, 대장 | `memory/` (증거 기록, `RR-*.json` 롤업) |
| 파악사항 / 시정조치 (CA) | `memory/findings/`, `memory/corrective-actions/` |
| 세션 로그, 회의록 | `memory/YYYY-MM-DD.md`, `memory/` |
| 분석, 보고서, 납품물 | `docs/` |
| 워크플로 문서 | `workflows/` (daily / domains / compliance / emergency) |
| 증거모델 스키마 | `evidence-models/` (모든 기록이 참조하는 JSON) |
| 규제 좌표 레지스트리 | `regulations/KR/*.yaml` (법령 원문은 `k-law`로 실시간 조회) |

**도메인 규칙**:

- 모든 기록은 `타임스탬프`, `에이전트 ID`, `워크플로 ID`, `legal_basis`를 포함합니다 — 익명 증거는 없습니다.
- 사람이 읽는 운영 문서는 한국어가 기본이며, 거버넌스/에이전트/코드 파일은 영어 전용입니다 (`docs/context.md` 언어 정책 참조).
- `legal_basis` 3건 미만인 워크플로는 배치 전에 거부됩니다 — 게이트가 아니라 인용을 수정하세요.
