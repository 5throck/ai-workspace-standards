---
name: safety-os-execution-plan
description: Safety OS (co-safety variant) 전체 추진 계획 — 5차 회의 통합 확정본. 나중에 이 파일만 읽어도 전체 맥락과 실행 방법을 알 수 있도록 작성됨.
metadata:
  type: project
---

# Safety OS 추진 계획
**작성일**: 2026-06-03
**마지막 업데이트**: 2026-06-03 (6차 회의 반영 — Phase 2 상세화)
**현재 상태**: 계획 확정, 실행 대기 (S-00 미시작)

---

## 1. 배경 및 목표

### 왜 만드는가

한국 산업안전(EHS) 분야는 2022년 이후 중대재해처벌법 시행으로 기업의 법적 리스크가 급증했다.
안전 담당자들은 20~40개의 법령/규정을 관리하면서, 위험성평가·작업허가·설비점검 등 일상 업무를
수작업으로 처리하고 있다. AI Agent 기반 Safety Operating System(Safety OS)은 이 업무를
자동화하고 감사 추적성을 확보한다.

### 무엇을 만드는가

```
산출물 4종:
  v3.0  Safety OS Architecture Blueprint   (Enterprise Reference Architecture 문서, ~25p Draft)
  v3.1  Workflow Catalog                   (제조업 완성, 4개 산업 scaffold)
  v3.2  Skill Catalog                      (4개 core skill)
  v3.3  Agent Prompt Pack                  (PM/SGM/SWM + 핵심 4개 agent)
  v3.4  GitHub Repository Starter Kit      (Projects/safety-os/ 실제 구현물)
  v4.0  Complete Playbook                  (Phase 2 — generate-playbook.ts 자동 조립)
```

### 어떤 방식으로 만드는가

현재 workspace의 **Harness Engineering 방법론**을 그대로 따른다.
- Discover → Reuse → Adapt → Create 원칙
- GitHub-Native: 모든 산출물은 Git으로 버전 관리
- Evidence-Based: 모든 workflow는 감사 증적(evidence) 연결
- Platform-Neutral: Claude Code + Antigravity 양쪽에서 동작

---

## 2. 전체 아키텍처

### 거버넌스 계층

```
PM Agent  ←  최고 안전 책임자(CSO) 역할
  │           기존 workspace pm.md를 Safety OS context로 override
  │
  ├── Safety Governance Manager (SGM)  ←  전략 담당
  │     - 산업 Profile 선택 (manufacturing/chemical/semiconductor/construction/datacenter)
  │     - KPI 설정 및 모니터링
  │     - 컴플라이언스 목표 정의
  │     - 정책/표준 승인
  │
  └── Safety Workflow Manager (SWM)   ←  실행 담당
        - Workflow 선택 및 실행
        - Agent Team 동적 조립
        - 작업 진행 관리
        - 증적(Evidence) 수집

PM → SGM: 전략 결정이 필요할 때
PM → SWM: 실행 작업 배분 시
PM → SWM 직접 (SGM 생략): 비상 시나리오 발생 시 즉시
```

### 5계층 아키텍처

```
Layer 1  Agent Pool           15개 Agent (MVP: 7개)
Layer 2  Industry Profile     5개 산업 정의 파일 (MVP: 제조 1개)
Layer 3  Workflow Library     SSOT — 전체 시스템의 핵심
Layer 4  Scenario Library     비상 대응 시나리오
Layer 5  Evidence Graph       감사 추적성 — Finding → Corrective Action
```

### Workflow 3-tier (80:20 법칙 반영)

```
일상 업무 80%  →  workflows/daily/
  위험성평가 / 작업허가 / 설비점검 / 협력사관리 / 안전교육 / 안전순찰

컴플라이언스 10%  →  workflows/compliance/
  내부감사 / 규정준수점검 / 법령개정대응

비상대응 10%  →  workflows/emergency/
  화재대응 / 화학물질누출 / 중대재해 / 자연재해(태풍/지진)
```

### Agent 3섹션 Prompt 구조 (플랫폼 중립)

모든 agent .md 파일은 이 구조를 따른다:

```markdown
## Section A: Role & Responsibility
# 플랫폼 무관 — Claude Code와 Antigravity 양쪽에서 동일하게 읽음
# 역할, 책임, 입출력 계약, 법령 근거

## Section B: Claude Code Integration
# Skill invocation: /risk-assessment
# Agent dispatch: Agent tool
# Tool use: Read, Write, Bash

## Section C: Antigravity Integration
# Skill invocation: activate_skill risk-assessment
# Agent dispatch: agent_manager
# Tool use: read_file, write_file, run_command
```

---

## 3. 개발 전략 (2단계)

### Phase A — 독립 프로토타입

**위치**: `Projects/safety-os/`
**원칙**: workspace root 파일을 건드리지 않고 독립 개발

```
이유:
  - 빠른 실험 및 구조 검증 가능
  - 실패해도 workspace에 영향 없음
  - 안정화 후 검증된 것만 workspace에 반영
```

**common drift 방지**:
- `_ORIGIN.md`: common에서 복사해 온 파일 목록 명시
- `_COMMON_VERSION.md`: 복사 시점의 workspace common 버전 기록

### Phase B — Workspace 반영 (Promotion)

**조건**: `PROMOTION_CHECKLIST.md` 7개 항목 전부 통과 후 진행
**위치**: `templates/co-safety/` 생성 → workspace root 반영

```
L1 (Workspace Root)  ←  편집 SSOT
      ↓
L2 (templates/co-safety/)  ←  variant 정의
      ↓
L3 (Projects/safety-os/)  ←  생성 시점 스냅샷 (Phase A 결과물)
```

---

## 4. 폴더 구조 전체 (Phase A MVP)

```
Projects/safety-os/
│
│  # ── 추적 파일 (신규)
├── _ORIGIN.md                       ← common에서 복사된 파일 목록
├── _COMMON_VERSION.md               ← workspace common 버전 + git hash 스냅샷
├── PROMOTION_CHECKLIST.md           ← Phase B 전환 기준 7개 항목
│
│  # ── Common 상속 (workspace root에서 복사, 변경 최소화)
├── CLAUDE.md                        ← Safety OS context 추가만
├── GEMINI.md                        ← CLAUDE.md와 parity 유지
├── AGENTS.md                        ← Safety agent roster 포함
├── CHANGELOG.md
├── .gitignore
├── .env.sample
│
│  # ── 메모리 (Safety OS 특화 확장)
├── memory/
│   ├── MEMORY.md
│   ├── incidents/                   ← 사고 기록 (Safety OS 전용)
│   ├── findings/                    ← 감사 발견사항 기록
│   └── corrective-actions/          ← 시정조치 기록
│
│  # ── Agent 정의
├── agents/
│   ├── pm.md                        ← [복사 후 CSO override 추가]
│   ├── safety-governance-manager.md ← [신규] SGM — 전략 담당
│   ├── safety-workflow-manager.md   ← [신규] SWM — 실행 담당 (Harness Prompt 기반)
│   ├── compliance-agent.md          ← [신규] 법령 준수 점검
│   ├── risk-assessment-agent.md     ← [신규] 위험성평가 전문
│   ├── emergency-agent.md           ← [신규] 비상대응 전문
│   └── audit-agent.md               ← [신규] 감사 전문
│
│  # ── Skill 정의 (3-section 플랫폼 중립)
├── skills/
│   ├── risk-assessment/
│   │   └── SKILL.md
│   ├── permit-to-work/
│   │   └── SKILL.md
│   ├── emergency-response/
│   │   └── SKILL.md
│   └── compliance-gap/
│       └── SKILL.md
│
│  # ── 법령 레지스트리 (메타데이터만, 조문은 MCP로 조회)
├── regulations/
│   ├── _REGISTRY.md                 ← 전체 법령 목록 마스터 (사람이 관리)
│   └── KR/
│       └── tier1-laws/
│           ├── 산업안전보건법.yaml
│           └── 중대재해처벌법.yaml
│
│  # ── 산업 프로파일
├── industry-profiles/
│   └── manufacturing.yaml           ← MVP: 제조업만 완전 구현
│
│  # ── Workflow Library (SSOT)
├── workflows/
│   ├── _template/
│   │   ├── README.md                ← 7섹션 표준 포맷 (사람이 편집)
│   │   └── schema.yaml              ← 기계 읽기용 메타데이터
│   ├── daily/
│   │   └── manufacturing/
│   │       ├── _INDEX.md            ← Workflow 목록 + status/legal_basis 컬럼
│   │       ├── 위험성평가/
│   │       │   ├── README.md
│   │       │   └── schema.yaml
│   │       ├── 작업허가/
│   │       ├── 설비점검/
│   │       ├── 협력사관리/
│   │       ├── 안전교육/
│   │       └── 안전순찰/
│   ├── compliance/                  ← 폴더 구조만 (Phase 2에서 채움)
│   └── emergency/                   ← 폴더 구조만 (Phase 2에서 채움)
│
│  # ── 감사 추적성 모델
├── evidence-models/
│   └── base/
│       ├── finding.schema.json
│       └── corrective-action.schema.json
│
│  # ── v3.0 Blueprint 문서 (Draft)
├── docs/
│   ├── context.md                   ← 기존 10섹션 + Safety 4섹션
│   └── blueprint/
│       ├── 01-executive-summary.md
│       ├── 02-architecture.md
│       ├── 03-governance.md         ← 최우선 작성 (PM/SGM/SWM 구조)
│       ├── 04-agent-catalog.md
│       └── 05-implementation-roadmap.md
│
│  # ── 자동화 스크립트
├── scripts/
│   └── safety-audit.ts              ← legal_basis 누락 체크
│
│  # ── MCP 설정
└── .mcp.json                        ← MVP: codegraph만
```

---

## 5. 각 파일 작성 상세 명세

### 5.1 `_ORIGIN.md`

```markdown
# Origin Tracking
이 프로젝트는 workspace common v[버전]을 기반으로 독립 개발 중입니다.
Phase B에서 templates/co-safety/로 promotion 예정.

## Common에서 복사된 파일 (변경 시 workspace와 sync 필요)
- CLAUDE.md (기반: workspace root/CLAUDE.md)
- GEMINI.md (기반: workspace root/GEMINI.md)
- agents/pm.md (기반: workspace root/agents/pm.md + Safety override 추가)
- scripts/audit.ts (기반: workspace root/scripts/audit.ts)
- .claude/settings.json (기반: templates/common/.claude/settings.json)
- .gemini/settings.json (기반: templates/common/.gemini/settings.json)

## Safety OS 전용 파일 (신규 생성)
- agents/safety-governance-manager.md
- agents/safety-workflow-manager.md
- agents/compliance-agent.md
- agents/risk-assessment-agent.md
- agents/emergency-agent.md
- agents/audit-agent.md
- skills/
- regulations/
- industry-profiles/
- workflows/
- evidence-models/
- docs/blueprint/
- scripts/safety-audit.ts
```

### 5.2 `_COMMON_VERSION.md`

```markdown
# Common Version Snapshot
based_on_common: 1.0.0
snapshot_date: YYYY-MM-DD
pm_agent_hash: [git hash of agents/pm.md at copy time]
scripts_version: [버전 from scripts/SCRIPTS.md]
settings_hash: [git hash of .claude/settings.json]
```

### 5.3 `PROMOTION_CHECKLIST.md`

```markdown
# Phase B Promotion Checklist
이 항목이 모두 통과되어야 templates/co-safety/ 생성을 시작할 수 있습니다.

□ 1. 제조 daily 6개 workflow 완전 구현
       검증: workflows/daily/manufacturing/ 폴더에 6개 하위 폴더 존재
             각 폴더에 README.md + schema.yaml 존재
             schema.yaml에 legal_basis 필드 채워져 있음

□ 2. PM(CSO) + SGM + SWM agent 완성
       검증: agents/ 폴더에 3개 파일 존재
             각 파일에 Section A/B/C 구조 존재

□ 3. 핵심 4개 skill 완성
       검증: skills/ 폴더에 4개 하위 폴더 존재
             각 폴더에 SKILL.md 존재 (3-section 구조)

□ 4. safety-audit.ts 통과 (0 errors)
       검증: bun scripts/safety-audit.ts 실행 → exit 0

□ 5. codegraph init + status 정상
       검증: codegraph status --path ./Projects/safety-os → index ready

□ 6. _COMMON_VERSION.md 기록 완료
       검증: 파일 존재 + based_on_common 필드 채워져 있음

□ 7. bun scripts/audit.ts 통과
       검증: bun scripts/audit.ts → exit 0
```

### 5.4 `agents/pm.md` (CSO Override 추가 내용)

기존 `agents/pm.md`를 복사한 후 다음 섹션을 **파일 맨 앞에 추가**:

```markdown
## Safety OS Context Override
> 이 섹션은 Safety OS (co-safety variant)에서만 활성화됩니다.

**이 프로젝트에서 PM Agent는 최고 안전 책임자(CSO)로 동작합니다.**

### 추가 책임
- Industry Profile 선택 (manufacturing/chemical/semiconductor/construction/datacenter)
- 모든 workflow dispatch 전 legal_basis 필드 확인
- 감사 추적성(Evidence chain) 유지 확인

### Dispatch 규칙 (기존 PM Gateway에 추가)
| 상황 | 배분 대상 | 비고 |
|------|----------|------|
| 전략 결정 필요 | SGM | KPI, 정책, 산업 프로파일 변경 |
| Workflow 실행 | SWM | 일상 운영, 감사, 교육 |
| 법령 준수 조회 | Compliance Agent (직접) | SWM 없이 바로 |
| 비상 시나리오 | SWM (즉시, SGM 생략) | 화재/누출/중대재해 |

### 응답 전 체크리스트
- [ ] Industry Profile 확인됨?
- [ ] 요청이 daily/compliance/emergency 중 어느 tier인가?
- [ ] legal_basis 확인 필요한 workflow인가?
```

### 5.5 `agents/safety-governance-manager.md`

```markdown
# Safety Governance Manager (SGM)

## Section A: Role & Responsibility

**역할**: 산업안전 전략 총괄

**담당 업무**:
- Industry Profile 선택 및 관리
  - manufacturing / chemical / semiconductor / construction / datacenter
- KPI 프레임워크 정의 (TRIR, LTIR, Near Miss, 교육이수율 등)
- 컴플라이언스 목표 설정
- 정책/표준 초안 검토 및 승인
- 법령 개정 대응 전략 수립

**입력**: 경영진 방침, 법령 변경 사항, 사고 데이터, 감사 결과
**출력**: Governance Model, Safety Operating Model, KPI Framework, Compliance Framework

**보고 체계**: PM(CSO)에게 보고, SWM에게 전략 방향 제공

**주요 의사결정 기준**:
1. 법령 의무 여부 (mandatory vs recommended)
2. 산업별 리스크 프로파일
3. PSM 대상 여부 (chemical/semiconductor 사업장)

## Section B: Claude Code Integration
- 전략 문서 생성: Write tool 사용
- 법령 검토: Compliance Agent에 dispatch
- KPI 보고서: Reporting Agent에 dispatch

## Section C: Antigravity Integration
- 전략 문서 생성: write_file tool 사용
- 법령 검토: agent_manager로 Compliance Agent dispatch
```

### 5.6 `agents/safety-workflow-manager.md`

Section A의 핵심 내용은 Harness Engineering Prompt를 기반으로 작성:

```markdown
# Safety Workflow Manager (SWM)

## Section A: Role & Responsibility

**역할**: Safety OS 실행 총괄 (Harness Engineering Team Leader)

**Mission**:
안전 업무를 일관되고, 법적으로 준수하며, 추적 가능하게 수행하는
재사용 가능한 운영 시스템을 구축하고 실행한다.

**핵심 원칙**:
1. Workflow First — Workflow가 정의되어야 Agent가 배치됨
2. Scenario Driven — 시나리오 유형으로 팀 조합 결정
3. Evidence Based — 모든 실행은 증적을 남겨야 함
4. Regulation Aware — 모든 workflow는 legal_basis 필수
5. Continuously Improve — 사고/감사 결과를 workflow에 반영

**실행 흐름**:
```
사용자 요청 수신
    ↓
Industry Profile 확인 (manufacturing/chemical/...)
    ↓
요청 분류 (daily/compliance/emergency)
    ↓
Workflow 선택 (workflows/_INDEX.md 참조)
    ↓
Agent Team 조립 (industry-profiles/*.yaml 참조)
    ↓
실행 및 진행 관리
    ↓
Evidence 수집 (evidence-models/ 참조)
    ↓
결과 보고 (PM에게)
```

**Agent Team 조립 패턴**:

| 시나리오 | Leader | Team Members |
|---------|--------|--------------|
| 위험성평가 | Risk Assessment Agent | Compliance Agent |
| 화재 발생 | Emergency Agent | Audit Agent, Compliance Agent |
| 고용노동부 감독 | Audit Agent | Compliance Agent, Risk Assessment Agent |
| 중대재해 발생 | Compliance Agent | Risk Assessment Agent, Audit Agent |

**보고 체계**: PM(CSO)에게 보고, Agent Pool 직접 지휘

## Section B: Claude Code Integration
- Workflow 실행: Agent tool로 specialist dispatch
- 진행 추적: TaskCreate / TaskUpdate
- 증적 수집: Write tool (evidence-models/ 경로)

## Section C: Antigravity Integration
- Workflow 실행: agent_manager로 specialist dispatch
- 증적 수집: write_file tool
```

### 5.7 법령 YAML 형식 (`regulations/KR/tier1-laws/산업안전보건법.yaml`)

```yaml
id: KR-OSHA-2024
name: 산업안전보건법
name_en: Occupational Safety and Health Act
tier: 1
revision: 2024-01-01
source_url: https://www.law.go.kr/법령/산업안전보건법
source_mcp: mcp-kr-legislation   # Phase 2에서 활성화
applicable_industries:
  - manufacturing
  - chemical
  - semiconductor
  - construction
  - datacenter
key_articles:
  - id: art-36
    title: 위험성평가
    title_en: Risk Assessment
    workflows:
      - workflows/daily/manufacturing/위험성평가
  - id: art-37
    title: 비상조치계획
    title_en: Emergency Action Plan
    workflows:
      - workflows/emergency/비상대응
  - id: art-63
    title: 도급인의 안전조치 및 보건조치
    title_en: Safety Measures for Subcontractors
    workflows:
      - workflows/daily/manufacturing/협력사관리
psm_related: false
notes: "산업안전의 기본법. 안전관리자 선임, 위험성평가, 교육, 보호구, 작업환경관리 의무 규정"
```

### 5.8 산업 프로파일 (`industry-profiles/manufacturing.yaml`)

```yaml
name: Manufacturing
name_ko: 제조업
psm_required: false
psm_elements: 0

core_regulations:
  - KR-OSHA-2024           # 산업안전보건법
  - KR-SERIOUS-DISASTER-2022  # 중대재해처벌법

risk_profile:
  high:
    - 협착 (entanglement)
    - 추락 (fall)
    - 충돌 (collision)
    - 화재 (fire)
  medium:
    - 근골격계 질환 (ergonomic injury)
    - 화학물질 노출 (chemical exposure)

primary_agents:
  - risk-assessment-agent
  - compliance-agent
  - audit-agent

secondary_agents:
  - emergency-agent
  - incident-investigation-agent

optional_agents:
  - training-agent
  - reporting-agent

workflow_priority:
  daily:
    - 위험성평가
    - 작업허가
    - 설비점검
    - 협력사관리
    - 안전교육
    - 안전순찰
  compliance:
    - 내부감사
    - 규정준수점검
  emergency:
    - 화재대응
    - 중대재해대응

safety_framework: 안전보건관리체계_7대요소
notes: "PSM 대상 아님. 7대 요소 기반 관리체계 구축 필요."
```

### 5.9 Workflow 표준 포맷 (`workflows/_template/schema.yaml`)

```yaml
# ── 식별 정보
id: ""                     # 예: risk-assessment-manufacturing
name: ""                   # 한국어 이름
name_en: ""               # 영어 이름
industry: ""              # manufacturing / chemical / semiconductor / construction / datacenter
category: ""              # daily / compliance / emergency

# ── 상태 관리 (감사 리스크 방지 핵심 필드)
status: template          # active | template | deprecated
applicability: optional   # mandatory | recommended | optional
legal_basis: ""           # 법령명 + 조항 (예: 산업안전보건법 제36조)
framework: ""             # 7대요소 | PSM_12요소 | ISO45001 | 내부

# ── 실행 정보
trigger: ""               # 발동 조건
owner: ""                 # 담당 역할 (예: 안전관리자)
actors:
  agents: []              # 담당 Agent 목록
  human: []               # 참여 인력 역할

# ── 입출력
inputs: []
outputs: []
evidence:                 # 생성해야 하는 증적
  - type: ""              # 예: 위험성평가서
    model: ""             # evidence-models/ 경로
    retention: ""         # 보관 기간 (예: 3년)

# ── 품질 관리
kpis: []
review_cycle: ""          # 검토 주기
last_reviewed: ""
```

### 5.10 Workflow README 표준 포맷 (`workflows/_template/README.md`)

```markdown
# [Workflow 이름]

## 1. Purpose (목적)

## 2. Trigger (발동 조건)

## 3. Participants (참여자)
| 역할 | 담당 Agent | 담당 인력 |
|------|----------|---------|

## 4. Inputs (입력)

## 5. Steps (절차)
| # | 단계 | 담당 | 결정 조건 | 산출물 |
|---|------|------|---------|------|

## 6. Evidence (증적)
| 증적명 | 양식 | 보관 기간 |
|------|------|--------|

## 7. Regulations (근거 법령)
| 법령 | 조항 | 내용 |
|------|------|------|
```

### 5.11 `evidence-models/base/finding.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Finding",
  "description": "감사/점검에서 발견된 지적사항",
  "type": "object",
  "required": ["id", "date", "source", "description", "severity", "legal_basis"],
  "properties": {
    "id": { "type": "string", "pattern": "^F-[0-9]{8}-[0-9]{3}$" },
    "date": { "type": "string", "format": "date" },
    "source": { "type": "string", "enum": ["internal_audit", "regulatory_inspection", "incident", "self_assessment"] },
    "description": { "type": "string" },
    "severity": { "type": "string", "enum": ["critical", "major", "minor", "observation"] },
    "legal_basis": { "type": "string" },
    "workflow_ref": { "type": "string" },
    "corrective_action": { "$ref": "#/definitions/CorrectiveActionRef" }
  },
  "definitions": {
    "CorrectiveActionRef": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "due_date": { "type": "string", "format": "date" },
        "owner": { "type": "string" },
        "status": { "type": "string", "enum": ["open", "in_progress", "closed", "overdue"] }
      }
    }
  }
}
```

### 5.12 `scripts/safety-audit.ts`

MVP 버전 — legal_basis 체크만:

```typescript
#!/usr/bin/env bun
/**
 * safety-audit.ts
 * Safety OS 전용 QA 게이트
 * 
 * MVP 검증 항목:
 *   1. schema.yaml 파일의 legal_basis 필드 존재 및 비어있지 않음
 *   2. status 필드 유효값 확인 (active | template | deprecated)
 *   3. applicability 필드 유효값 확인
 * 
 * Phase 2 추가 예정:
 *   4. mcp-kr-legislation으로 법령 개정일 최신 여부 확인
 *   5. evidence-models 링크 유효성 확인
 *   6. CodeGraph index.ts 자동 생성
 */

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import * as yaml from 'js-yaml'

const WORKFLOWS_DIR = './workflows'
const VALID_STATUS = ['active', 'template', 'deprecated']
const VALID_APPLICABILITY = ['mandatory', 'recommended', 'optional']

let errors = 0
let warnings = 0

async function findSchemaFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await findSchemaFiles(path))
    else if (entry.name === 'schema.yaml') files.push(path)
  }
  return files
}

async function validateSchema(filePath: string) {
  const content = await readFile(filePath, 'utf-8')
  const schema = yaml.load(content) as Record<string, unknown>

  // 1. legal_basis 체크
  if (!schema.legal_basis || schema.legal_basis === '') {
    console.error(`❌ MISSING legal_basis: ${filePath}`)
    errors++
  }

  // 2. status 유효값
  if (!VALID_STATUS.includes(schema.status as string)) {
    console.error(`❌ INVALID status "${schema.status}": ${filePath}`)
    errors++
  }

  // 3. applicability 유효값
  if (!VALID_APPLICABILITY.includes(schema.applicability as string)) {
    console.warn(`⚠️  INVALID applicability "${schema.applicability}": ${filePath}`)
    warnings++
  }
}

const schemaFiles = await findSchemaFiles(WORKFLOWS_DIR)
for (const file of schemaFiles) await validateSchema(file)

console.log(`\nSafety Audit: ${errors} errors, ${warnings} warnings`)
if (errors > 0) process.exit(1)
```

### 5.13 `.mcp.json` (MVP)

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "codegraph",
      "args": ["serve", "--mcp", "--path", "./Projects/safety-os"],
      "description": "Code intelligence — symbol graph, impact analysis"
    }
  }
}
```

Phase 2에서 추가:
```json
{
  "mcpServers": {
    "codegraph": { ... },
    "mcp-kr-legislation": {
      "command": "npx",
      "args": ["-y", "mcp-kr-legislation"],
      "description": "법제처 Open API — 법령/판례/행정규칙 130+ tools"
    },
    "k-skill": {
      "command": "...",
      "description": "K-Skill repository — Korean service skills"
    }
  }
}
```

### 5.14 `docs/context.md` (Safety OS 4섹션 추가)

기존 10섹션에 아래 추가:

```markdown
## Industry Profile
[manufacturing | chemical | semiconductor | construction | datacenter]
PSM Required: [Yes/No]
Primary Risk: [주요 위험 유형]

## Applicable Regulations
Core:
  - 산업안전보건법 (KR-OSHA-2024)
  - 중대재해처벌법 (KR-SERIOUS-DISASTER-2022)
Industry-specific:
  - [추가 법령]

## Organization Scope
Sites: [사업장 목록]
Employee Count: [규모]
Contractor Ratio: [협력사 비율]
Safety Manager Count: [안전관리자 수]

## Emergency Contacts
Safety Manager: [연락처]
Emergency Response: 119
KOSHA Hotline: 1644-4544
```

---

## 6. v3.0 Blueprint Draft 작성 명세

### 파일 순서 및 핵심 내용

**`03-governance.md` — 최우선 작성**

이 문서가 Safety OS 전체의 핵심 차별점을 설명한다.
PM이 CSO 역할을 하고 SGM/SWM을 지휘하는 구조가 기존 Safety 솔루션과 다른 점.

```markdown
# Part III — Governance Architecture

## 3.1 Governance Hierarchy

PM Agent (Chief Safety Officer)
  ├── Safety Governance Manager — Strategy
  └── Safety Workflow Manager — Execution
              ↓
         Agent Pool

## 3.2 PM as CSO
[역할 설명 + dispatch 규칙 테이블]

## 3.3 Safety Governance Manager
[전략 책임 + Deliverables]

## 3.4 Safety Workflow Manager
[실행 책임 + Harness Engineering 원칙 + Agent Team Assembly 패턴]

## 3.5 Agent Team Assembly
[시나리오별 팀 조합 테이블]

## 3.6 Document Governance
[이 문서 자체의 리뷰 주기, 업데이트 트리거, 승인 체계]
```

**`01-executive-summary.md`**

```markdown
# Part I — Executive Summary

## 1.1 Vision
[Safety OS가 가능하게 하는 8가지: 법령준수 ~ 지속개선]

## 1.2 Business Drivers
[규제 복잡성 증가, 인력 지식 격차, 고령화, 운영 리스크, 감사 대응 필요성]

## 1.3 Design Principles
Principle 1: Discover Before Create
Principle 2: Workflow First
Principle 3: Scenario Driven
Principle 4: Evidence Based
Principle 5: Traceability by Design
Principle 6: GitHub Native
Principle 7: Continuous Improvement
```

**`02-architecture.md`**

```markdown
# Part II — Enterprise Architecture

## 2.1 Reference Architecture (Layer 0~8 다이어그램)
## 2.2 Technology Stack
  Primary: CodeGraph + Claude Code/Antigravity + GitHub + MCP
  Extended (Phase 2): mcp-kr-legislation + K-Skill
  Future: Neo4j (대규모 확장), OpenAI Agent SDK (멀티플랫폼)
## 2.3 Knowledge Traceability Model
  Regulation → Requirement → Control → Workflow → Skill → Script → Evidence → Finding → Corrective Action
```

**`04-agent-catalog.md`**

```markdown
# Part IV — Agent Architecture

## 4.1 Agent Organization
## 4.2 Priority 1 Agents (MVP)
  PM(CSO) / SGM / SWM / Compliance / Risk Assessment / Emergency / Audit
## 4.3 Priority 2 Agents (Phase 1)
  PSM / Incident Investigation / Contractor Safety / Asset Integrity
## 4.4 Priority 3 Agents (Phase 2)
  Training / Reporting / Knowledge Graph / Legal Intelligence
## 4.5 Agent Team Assembly Patterns
  [시나리오별 팀 조합 테이블]
```

**`05-implementation-roadmap.md`**

```markdown
# Part XII — Implementation Strategy

## Phase 0: Foundation       projects/safety-os/ 기반 구조
## Phase 1: Discovery        법령 레지스트리 + 산업 프로파일
## Phase 2: Knowledge Eng.   Knowledge Graph + 법령 MCP 연동
## Phase 3: Workflow Eng.    전체 5개 산업 workflow 완성
## Phase 4: Skill Eng.       10개 skill 완성
## Phase 5: Script Eng.      SOP/Checklist/Audit/Emergency 스크립트
## Phase 6: Scenario Eng.    비상 시나리오 라이브러리
## Phase 7: Agent Eng.       15개 agent 완성
## Phase 8: Pilot            제조업 사업장 파일럿
## Phase 9: Rollout          전 산업 확장

## MVP 범위 (현재 진행 중)
[Phase 0 + Phase 1 일부 + Phase 3 제조업 + Phase 4 핵심 4개]
```

---

## 7. 실행 순서 (단계별 상세)

### Phase A — MVP 구현

#### S-00: 기반 구조 생성

```bash
# 1. 폴더 생성
mkdir -p Projects/safety-os
cd Projects/safety-os

# 2. 하위 폴더 전체 생성
mkdir -p agents skills/{risk-assessment,permit-to-work,emergency-response,compliance-gap}
mkdir -p regulations/KR/tier1-laws
mkdir -p industry-profiles
mkdir -p workflows/{_template,daily/manufacturing,compliance,emergency}
mkdir -p workflows/daily/manufacturing/{위험성평가,작업허가,설비점검,협력사관리,안전교육,안전순찰}
mkdir -p evidence-models/base
mkdir -p docs/{blueprint}
mkdir -p scripts
mkdir -p memory/{incidents,findings,corrective-actions}
mkdir -p .codegraph

# 3. workspace common 파일 복사
cp ../../agents/pm.md agents/pm.md
cp ../../CLAUDE.md CLAUDE.md
cp ../../GEMINI.md GEMINI.md
# ... (필요한 파일들 복사)

# 4. 추적 파일 생성
# _ORIGIN.md, _COMMON_VERSION.md, PROMOTION_CHECKLIST.md 작성

# 5. codegraph 초기화
codegraph init .

# 6. .mcp.json 생성 (codegraph만)
```

**완료 조건**: 폴더 구조 존재 + codegraph init 성공 + _ORIGIN.md 작성 완료

---

#### S-01: pm.md CSO Override

**작업**: `agents/pm.md` 파일 상단에 Safety OS Context Override 섹션 추가
**위치**: 파일 맨 앞 (기존 내용 위에 prepend)
**내용**: 5.4항의 CSO Override 내용 그대로 삽입

**완료 조건**: pm.md에 "Safety OS Context Override" 섹션 존재

---

#### S-02: SGM Agent 작성

**파일**: `agents/safety-governance-manager.md`
**내용**: 5.5항 참조
**핵심**: Section A — 전략 책임 명확화, dispatch 기준 정의

**완료 조건**: 3-section 구조 완성 + SGM이 "무엇을 결정하는가" 명확히 서술됨

---

#### S-03: SWM Agent 작성

**파일**: `agents/safety-workflow-manager.md`
**내용**: 5.6항 참조
**핵심**: Section A — Harness Engineering Prompt의 Mission + 핵심 원칙 + 실행 흐름 + Agent Team 조립 패턴

**완료 조건**: 3-section 구조 완성 + Agent Team Assembly 패턴 테이블 포함

---

#### S-04: 법령 레지스트리 tier1

**파일 2개**:
- `regulations/KR/tier1-laws/산업안전보건법.yaml`
- `regulations/KR/tier1-laws/중대재해처벌법.yaml`
- `regulations/_REGISTRY.md` (목록 마스터)

**내용**: 5.7항 YAML 형식 참조
**핵심**: key_articles에 주요 조항과 workflow 매핑 포함

**완료 조건**: 2개 YAML 파일 존재 + key_articles에 최소 3개 조항 매핑

---

#### S-05: Industry Profile (제조업)

**파일**: `industry-profiles/manufacturing.yaml`
**내용**: 5.8항 참조
**핵심**: primary_agents, workflow_priority, risk_profile 필드 완성

**완료 조건**: manufacturing.yaml 존재 + 모든 필드 채워짐

---

#### S-06: 제조업 Daily Workflow 6개

각 workflow 폴더에 `README.md` + `schema.yaml` 작성.

**6개 workflow**:

| # | Workflow | Legal Basis | 핵심 내용 |
|---|---------|------------|---------|
| 1 | 위험성평가 | 산업안전보건법 제36조 | 작업식별→위험식별→위험도평가→대책→승인→적용 |
| 2 | 작업허가 | 산업안전보건법 (PTW) | 신청→위험검토→승인→수행→종료확인 |
| 3 | 설비점검 | 산업안전보건법 제38조 | 점검계획→수행→결과기록→이상처리→보고 |
| 4 | 협력사관리 | 중대재해처벌법 제4조 | 등록→자격검증→교육→작업허가→출입승인 |
| 5 | 안전교육 | 산업안전보건법 제29조 | 대상식별→자료작성→교육실시→이수확인→기록 |
| 6 | 안전순찰 | 산업안전보건법 (내부) | 계획→순찰수행→위험발견→시정지시→확인 |

**완료 조건**: 6개 폴더 각각에 README.md + schema.yaml 존재, schema.yaml의 legal_basis 채워짐

---

#### S-07: Core 4개 Skill

각 skill 폴더에 `SKILL.md` 작성 (3-section 구조).

| Skill | Section A 핵심 | 관련 Workflow |
|-------|--------------|--------------|
| risk-assessment | 위험 식별→분석→평가→대책 방법론 | 위험성평가 |
| permit-to-work | PTW 발행→승인→실행→종료 절차 | 작업허가 |
| emergency-response | 비상유형 분류→대응팀→절차→보고 | emergency/* |
| compliance-gap | 법령 요구사항 vs 현황 Gap 분석 | 내부감사 |

**완료 조건**: 4개 SKILL.md 존재 + 3-section 구조 완성

---

#### S-08: Evidence Models Base

**파일**:
- `evidence-models/base/finding.schema.json` (5.11항 참조)
- `evidence-models/base/corrective-action.schema.json`

corrective-action schema:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CorrectiveAction",
  "type": "object",
  "required": ["id", "finding_ref", "description", "owner", "due_date", "status"],
  "properties": {
    "id": { "type": "string", "pattern": "^CA-[0-9]{8}-[0-9]{3}$" },
    "finding_ref": { "type": "string" },
    "description": { "type": "string" },
    "root_cause": { "type": "string" },
    "owner": { "type": "string" },
    "due_date": { "type": "string", "format": "date" },
    "completion_date": { "type": "string", "format": "date" },
    "status": { "type": "string", "enum": ["open", "in_progress", "closed", "overdue", "cancelled"] },
    "verification_method": { "type": "string" },
    "evidence": { "type": "array", "items": { "type": "string" } }
  }
}
```

**완료 조건**: 2개 JSON schema 파일 존재

---

#### S-09: safety-audit.ts (기본)

**파일**: `scripts/safety-audit.ts`
**내용**: 5.12항 코드 참조
**실행**: `bun scripts/safety-audit.ts`

**완료 조건**: 스크립트 실행 → 0 errors

---

#### S-10: v3.0 Blueprint Draft

**작성 순서**: 03 → 01 → 02 → 04 → 05

| 파일 | 목표 분량 | 핵심 내용 |
|------|--------|---------|
| `03-governance.md` | 5~6p | **최우선** — PM/SGM/SWM 계층, dispatch 규칙, 팀 조합 패턴 |
| `01-executive-summary.md` | 4~5p | 비전, Business Drivers, 7개 설계 원칙 |
| `02-architecture.md` | 6~8p | Layer 0~8 다이어그램, Technology Stack, Traceability Model |
| `04-agent-catalog.md` | 4~5p | 15개 agent Priority 분류, 간략 정의 |
| `05-implementation-roadmap.md` | 3~4p | Phase 0~9, MVP 범위 명시 |

**완료 조건**: 5개 파일 존재 + 총 22~28p + Document Control Table 포함

---

#### S-11: PROMOTION_CHECKLIST 검증

`PROMOTION_CHECKLIST.md`의 7개 항목을 순서대로 확인.
모두 통과하면 Phase B 진행.

---

### Phase B — Workspace 반영

#### S-12: templates/co-safety/ 생성

```
templates/co-safety/
  variant.json                 ← 신규 작성
  CLAUDE.md / GEMINI.md
  AGENTS.md
  agents/ (Safety OS 전체)
  skills/ (4개 → 확장)
  regulations/
  industry-profiles/
  workflows/
  evidence-models/
  docs/blueprint/
  scripts/ (safety-audit.ts 포함)
  .mcp.json
```

**variant.json 핵심 내용**:
```json
{
  "inherits_common": "1.0.0",
  "variant_type": "domain-specific",
  "domain": "safety-os",
  "name": "co-safety",
  "description": "Enterprise Safety Operating System — AI Agent-based EHS platform",
  "industry_profiles": ["manufacturing", "chemical", "semiconductor", "construction", "datacenter"],
  "regulation_scope": ["KR-OSHA", "PSM", "ISO45001", "중대재해법"],
  "evidence_requirements": "strict",
  "agent_overrides": {
    "pm": {
      "type": "additive",
      "reason": "Safety OS adds CSO role with SGM/SWM dispatch rules",
      "overrides": ["safety-governance-workflow", "cso-dispatch-protocol"]
    }
  }
}
```

#### S-13: workspace root 반영

```bash
# AGENTS.md에 Safety OS agent roster 추가
bun run agent:verify   # 검증

# validate-templates 실행
bun scripts/validate-templates.ts
```

#### S-14: 최종 검증

```bash
bun scripts/audit.ts         # workspace 전체 감사
bun scripts/validate-templates.ts  # template 일관성
```

---

## 8. Phase 2 계획 (MVP 이후 — 상세)

Phase 2는 4개 하위 단계로 구성된다. 의존성 순서를 반드시 지킨다.

```
Phase 2-A: Knowledge Engineering    (S-20~S-24)  ← 법령 MCP + CodeGraph 심화
      ↓
Phase 2-B: Industry Expansion       (S-25~S-29)  ← 4개 산업 + 시나리오 라이브러리
      ↓
Phase 2-C: Agent & Skill Expansion  (S-30~S-35)  ← 나머지 8개 agent + 6개 skill
      ↓
Phase 2-D: Documentation & Automation (S-36~S-40) ← v3.0 Full + v4.0 Playbook
```

---

### Phase 2-A: Knowledge Engineering (S-20~S-24)

**목표**: 법령 MCP 연동, 법령 레지스트리 완성, CodeGraph 심화

#### S-20: mcp-kr-legislation 설치 및 연동

```bash
# Step 1: 패키지 확인
npm search mcp-kr-legislation
npx mcp-kr-legislation --version

# Step 2: .mcp.json 업데이트
# "mcp-kr-legislation": { "command": "npx", "args": ["-y", "mcp-kr-legislation"] }

# Step 3: 연동 테스트 (산안법 제36조 조회 성공 확인)
```

**regulations/ YAML 업데이트**:
- `source_mcp: mcp-kr-legislation` 활성화
- 각 article에 `mcp_query_template` 필드 추가:
  ```yaml
  mcp_query_template: "산업안전보건법 제{article_number}조"
  ```

**완료 조건**: mcp-kr-legislation으로 산안법 제36조 조회 성공 + YAML source_mcp 활성화

---

#### S-21: regulations/ tier2~4 확장

```
tier2/ (하위 법령)
  산안법-시행령.yaml
  산안법-시행규칙.yaml
  중대재해법-시행령.yaml

tier3/ (프레임워크)
  PSM고시.yaml
  위험성평가고시.yaml
  KOSHA-Guide.yaml
  PSM-12요소.yaml           ← 12개 요소 → workflow 매핑 테이블
  안전보건관리체계-7요소.yaml
  ISO45001.yaml

tier4/ (업종별 특화 법령)
  화학물질관리법.yaml
  화학물질평가법.yaml
  고압가스안전관리법.yaml
  소방기본법.yaml
  화재예방법.yaml
  위험물안전관리법.yaml
  전기안전관리법.yaml
  대기환경보전법.yaml
  물환경보전법.yaml
  폐기물관리법.yaml
  건설기술진흥법.yaml
  건설산업기본법.yaml
  근로기준법.yaml
  산업재해보상보험법.yaml
```

**`regulations/_REGISTRY.md`** 전체 법령 목록 테이블 업데이트:
```markdown
| ID | 법령명 | Tier | 업종 | 담당 Agent |
|----|-------|------|------|-----------|
| KR-OSHA-2024 | 산업안전보건법 | 1 | 전체 | Compliance |
| KR-SD-2022 | 중대재해처벌법 | 1 | 전체 | Compliance |
| KR-PSM-고시 | PSM 고시 | 3 | chemical, semiconductor | PSM |
...
```

**완료 조건**: tier2 3개 + tier3 6개 + tier4 14개 이상 YAML 존재 (총 23개+)

---

#### S-22: safety-audit.ts Phase 2 확장

추가 검증 로직:

```typescript
// 검증 4: mcp-kr-legislation 법령 개정일 체크
async function checkRegulationRevision(yamlPath: string) {
  const schema = parseYaml(yamlPath)
  if (!schema.source_mcp) return   // MCP 미연동 법령 skip
  // mcp-kr-legislation으로 최신 개정일 조회 → YAML revision과 비교
  // 불일치 시 warning 출력
}

// 검증 5: evidence-models 링크 유효성
async function checkEvidenceLinks(schemaPath: string) {
  const schema = parseYaml(schemaPath)
  for (const ev of schema.evidence ?? []) {
    if (ev.model && !existsSync(ev.model)) {
      console.error(`❌ BROKEN evidence link: ${ev.model} in ${schemaPath}`)
      errors++
    }
  }
}
```

**완료 조건**: Phase 2 확장 버전 실행 → 0 errors + revision warning 0

---

#### S-23: CodeGraph 심화 (index.ts 자동생성)

`safety-audit.ts`에 추가:

```typescript
// 검증 6: index.ts 자동생성
async function generateIndexTs(workflowPath: string) {
  const schema = parseYaml(`${workflowPath}/schema.yaml`)
  const legalBasisIds = schema.legal_basis_ids ?? []
  const regulationImports = legalBasisIds.map((id: string) =>
    `import { ${id} } from '../../../regulations/KR/tier1-laws/${id}'`
  ).join('\n')

  const content = `
// AUTO-GENERATED — edit schema.yaml, not this file
// Generated: ${new Date().toISOString()}
${regulationImports}
import type { WorkflowSchema } from '../../_template/types'

export const workflow: WorkflowSchema = {
  id: '${schema.id}',
  status: '${schema.status}',
  applicability: '${schema.applicability}',
  legalBasis: '${schema.legal_basis}',
  industry: '${schema.industry}',
  category: '${schema.category}',
}
`
  await writeFile(`${workflowPath}/index.ts`, content)
}
```

CodeGraph 재인덱싱 및 검증:
```bash
codegraph index Projects/safety-os/
codegraph impact KR_OSHA_art36 --path Projects/safety-os/
# 예상 출력: 연결된 workflow/skill/agent 목록
```

**완료 조건**: 모든 active workflow에 index.ts 생성 + `codegraph impact` 쿼리 성공

---

#### S-24: K-Skill 연동

```yaml
# skills/compliance-gap/SKILL.md Section A 수정
extends: k-skill/법령검색
safety_override:
  regulation_scope: [KR-OSHA, PSM, 중대재해법]
  industry_filter: [manufacturing, chemical, semiconductor]
  output_format: gap_analysis_report
```

**.mcp.json 업데이트**:
```json
"k-skill": {
  "command": "...",
  "description": "K-Skill repository — 법령검색 및 Korean service skills"
}
```

**완료 조건**: K-Skill 법령검색 호출 성공 + compliance-gap skill extends 동작

---

### Phase 2-A 완료 체크리스트
```
□ mcp-kr-legislation 조회 성공 (산안법 제36조 응답 확인)
□ regulations/ tier2~4 완성 (최소 23개 법령 YAML)
□ codegraph impact KR_OSHA_art36 → workflow 목록 출력
□ safety-audit.ts Phase 2 버전 통과 (0 errors)
□ K-Skill 법령검색 연동 확인
```

---

### Phase 2-B: Industry Expansion (S-25~S-29)

**목표**: 5개 산업 전체 Workflow 완성

#### S-25: Chemical Industry

**`industry-profiles/chemical.yaml`**:
```yaml
name: Chemical
psm_required: true
psm_elements: 12
core_regulations: [KR-OSHA-2024, KR-SD-2022, KR-PSM-고시, 화학물질관리법, 고압가스안전관리법]
risk_profile:
  high: [폭발, 독성물질누출, 공정이상]
  medium: [화재, 환경오염]
```

**PSM 12대 요소 구현 (우선순위 순서)**:

| Priority | 요소 | Workflow 경로 | Legal Basis |
|---------|------|------------|------------|
| P1 | 위험성평가 (PSM) | daily/chemical/위험성평가-psm/ | PSM 고시 제3조 |
| P1 | 작업허가제 | daily/chemical/작업허가-psm/ | PSM 고시 제11조 |
| P1 | 비상조치계획 | emergency/chemical/비상조치/ | PSM 고시 제8조 |
| P2 | 변경관리(MOC) | daily/chemical/변경관리/ | PSM 고시 제5조 |
| P2 | 공정안전자료 | daily/chemical/공정안전자료/ | PSM 고시 제2조 |
| P2 | 운전절차 | daily/chemical/운전절차/ | PSM 고시 제4조 |
| P3 | 설비관리 | daily/chemical/설비관리/ | PSM 고시 제6조 |
| P3 | 협력업체관리 | daily/chemical/협력업체관리-psm/ | PSM 고시 제7조 |
| P3 | 교육훈련 | daily/chemical/교육훈련-psm/ | PSM 고시 제9조 |
| P4 | 사고조사 | daily/chemical/사고조사/ | PSM 고시 제10조 |
| P4 | 자체감사 | compliance/chemical/자체감사/ | PSM 고시 제12조 |
| P4 | 경영자참여 | compliance/chemical/경영자참여/ | PSM 고시 제1조 |

**완료 조건**: chemical/_INDEX.md의 12개 PSM 요소 모두 `status: active`

---

#### S-26: Semiconductor Industry

**`industry-profiles/semiconductor.yaml`**:
```yaml
name: Semiconductor
psm_required: true
psm_elements: 8   # 12개 중 반도체 해당 요소만
core_regulations: [KR-OSHA-2024, KR-SD-2022, 화학물질관리법, 고압가스안전관리법]
risk_profile:
  high: [화학물질노출, 특수가스누출, 클린룸장애]
  medium: [화재, 전기사고]
```

**핵심 Workflow (8개)**:
```
daily/semiconductor/
  화학물질안전관리/    ← MSDS 기반 취급절차
  특수가스안전/        ← SiH4, HF, Cl2 등 관리
  클린룸안전/          ← 출입통제, 정전기, ESD
  위험성평가-반도체/   ← PSM P1
  작업허가-반도체/     ← PSM P1
  설비관리-fab/        ← PSM P3
  MOC-fab/             ← PSM P2
  비상대응-화학/       ← PSM P1
```

**완료 조건**: semiconductor/_INDEX.md의 PSM 해당 8개 요소 `status: active`

---

#### S-27: Construction Industry

**`industry-profiles/construction.yaml`**:
```yaml
name: Construction
psm_required: false
core_regulations: [KR-OSHA-2024, KR-SD-2022, 건설기술진흥법]
risk_profile:
  high: [추락, 낙하물, 중장비충돌]
  medium: [붕괴, 감전, 화재]
```

**핵심 Workflow (6개)**:
```
daily/construction/
  TBM/                  ← 작업 전 안전점검회의
  작업허가-건설/         ← 고소/화기/밀폐/굴착
  고소작업안전/          ← 안전대, 안전난간
  중장비안전/            ← 신호수, 접근금지구역
  협력사관리-건설/       ← 다단계 도급 관리
  낙하물방지/            ← 안전망, 낙하물방지망
```

**완료 조건**: construction/_INDEX.md의 6개 핵심 workflow `status: active`

---

#### S-28: Data Center Industry

**`industry-profiles/datacenter.yaml`**:
```yaml
name: DataCenter
psm_required: false
core_regulations: [KR-OSHA-2024, 전기안전관리법, 소방기본법]
risk_profile:
  high: [정전, 화재, 서비스중단]
  medium: [냉각시스템장애, 보안침해]
```

**핵심 Workflow**:
```
daily/datacenter/
  변경관리-IT/           ← ITIL 기반 변경 관리
  설비점검-전기/          ← UPS, PDU, 냉각설비
  화재대응-IDC/
compliance/datacenter/
  BCP/                    ← 업무연속성계획
  DR/                     ← 재해복구계획
  보안감사/
emergency/datacenter/
  정전대응/
  서비스복구/
```

**완료 조건**: datacenter/_INDEX.md의 핵심 workflow `status: active`

---

#### S-29: Cross-Industry Scenario Library + compliance/emergency 완성

**5개 Cross-Industry Scenario**:

```
workflows/emergency/화재대응/
  schema.yaml:
    response_team: [emergency-agent, compliance-agent, audit-agent]
    workflow:
      1. 발견 및 신고 (119, 사내 비상연락망)
      2. 초기대피 (비상구 경로 확인)
      3. 초기진압 시도 (소화기, 옥내소화전)
      4. 전문대응팀 지원
      5. 현장보존 및 조사
      6. 고용노동부 신고 (사망/3일 이상 시)
      7. 원인분석 및 재발방지
    legal_basis: 산업안전보건법 제37조, 소방기본법

workflows/emergency/화학물질누출/
  schema.yaml:
    response_team: [psm-agent, emergency-agent, compliance-agent]
    workflow:
      1. 누출감지 (센서, 육안)
      2. 격리구역 설정
      3. 방재팀 출동
      4. 환경청/고용부 신고
      5. 제독 및 수습
      6. 원인조사
    legal_basis: 화학물질관리법 제43조, PSM 고시 제8조

workflows/emergency/중대재해/
  schema.yaml:
    response_team: [compliance-agent, incident-investigation-agent, reporting-agent]
    note: "사망사고 발생 즉시 고용부 신고. 현장 변경 절대 금지."
    workflow:
      1. 현장 보존 (절대 변경 금지)
      2. 즉시 신고 (고용노동부, 검찰청)
      3. 피해자 구호
      4. 경영책임자 보고
      5. 수사 대비 증거 보전
      6. RCA 원인조사
      7. 재발방지 대책
    legal_basis: 중대재해처벌법 제4조, 산업안전보건법 제57조

workflows/emergency/태풍대응/
  response_team: [disaster-response-agent, emergency-agent]
  workflow:
    1. 기상청 예보 수신
    2. 설비 고정 및 보호
    3. 야적물 정리
    4. 인원 대피 계획
    5. 태풍 통과 후 피해 점검
    6. 복구 우선순위 결정

workflows/emergency/지진대응/
  response_team: [disaster-response-agent, asset-integrity-agent]
  workflow:
    1. 지진감지 (진도 계측)
    2. 즉시 대피 (테이블 아래, 외부 개방지)
    3. 여진 대비 30분 대기
    4. 설비 피해 점검 (PSM 설비 우선)
    5. 유해물질 누출 확인
    6. 복구 우선순위 결정
```

**완료 조건**: 5개 시나리오 schema.yaml + README.md 완성

---

### Phase 2-B 완료 체크리스트
```
□ chemical: PSM 12개 workflow 전체 status: active
□ semiconductor: PSM 해당 8개 status: active
□ construction: 6개 핵심 workflow status: active
□ datacenter: BCP + DR + 변경관리 status: active
□ 5개 Cross-Industry scenario 완성
□ 5개 산업 compliance/ 최소 2개 workflow
□ safety-audit.ts — 전체 산업 0 errors
```

---

### Phase 2-C: Agent & Skill Expansion (S-30~S-35)

**목표**: 7개 → 15개 agent, 4개 → 10개 skill

#### S-30: PSM Agent

```markdown
## Section A
역할: 공정안전관리(PSM) 전문 오케스트레이터

담당: PSM 12대 요소 실행 총괄 / HAZOP 분석 / MOC 관리 / 작업허가제 운영

⚠️ 법적 주의사항:
- HAZOP 결과는 공정안전보고서에 포함 의무 (PSM 고시 제3조)
- MOC 완료 전 변경 작업 착수 금지
- 중대산업사고 발생 시 즉시 고용노동부 신고 (산안법 제54조)
- 공정안전보고서 고용부 심사·확인 이후 가동 원칙

Inputs: 공정정보, 위험물질 목록, 변경요청서
Outputs: HAZOP 보고서, MOC 패키지, PSM 12대 요소 이행 현황
```

---

#### S-31: Asset Integrity Agent

```markdown
## Section A
역할: 설비 무결성(Asset Integrity) 전문

담당: 예방정비 계획 / 설비 검사 이력 관리 / 노후 설비 위험도 평가
Legal Basis: 산업안전보건법 제38조, PSM 고시 제6조

Outputs: 설비 점검 계획, 이상 설비 보고, 교체 권고
```

---

#### S-32: Incident Investigation Agent

```markdown
## Section A
역할: 사고조사 및 근본원인분석 전문

Investigation Methods: 5-Why / RCA / Bow-Tie / Tripod Beta

⚠️ 법적 주의사항:
- 사망 또는 3일 이상 요양 시 고용노동부 즉시 신고 (산안법 제57조)
- 중대재해 시 수사 대비 현장 보존 — 현장 변경 절대 금지
- RCA 보고서 3년 보관 의무
- 경영책임자 서명 필요 서류 목록 확인

Outputs: 사고조사 보고서, RCA 결과, 재발방지 대책
```

---

#### S-33: Contractor Safety Agent

```markdown
## Section A
역할: 협력업체(도급/용역) 안전 전문

담당: 등록/자격검증 / 사전교육 / 작업 중 모니터링 / 성과 평가

⚠️ 법적 주의사항 (중대재해처벌법 핵심):
- 도급인의 안전보건 확보 의무 (중대재해법 제4조)
- 협력업체 산재 발생 시 원청 책임 가능
- 연 2회 이상 협력업체 안전점검 권고

Outputs: 적격심사 결과, 교육 이수 확인, 모니터링 보고
```

---

#### S-34: Training Agent + Reporting Agent

**Training Agent**:
```markdown
## Section A
법정 교육 유형 (산안법 제29조):
  채용 시: 8시간 이상
  작업내용 변경 시: 2시간 이상
  특별교육 (고위험 작업): 16시간 이상
  관리감독자: 연 16시간 이상

Outputs: 교육 커리큘럼, 교육자료, 이수 확인서, 역량 매트릭스
```

**Reporting Agent**:
```markdown
## Section A
KPI 지표:
  TRIR (Total Recordable Incident Rate)
  LTIR (Lost Time Incident Rate)
  Near Miss 건수
  위험성평가 완료율
  법정 교육 이수율
  시정조치 적시 완료율
  협력업체 안전점검 완료율

보고 주기: 월간 / 분기 / 연간
보고 대상: CEO, CSO, 안전보건위원회
```

---

#### S-35: Skill 6개 추가

| Skill | 목적 | 관련 Agent | 관련 Workflow |
|-------|------|-----------|--------------|
| `hazop-analysis` | HAZOP 절차 실행 지원 | PSM Agent | daily/chemical/위험성평가-psm |
| `psm-moc` | MOC 패키지 생성 | PSM Agent | daily/chemical/변경관리 |
| `root-cause-analysis` | 5-Why / RCA / Bow-Tie 실행 | Incident Investigation | emergency/*/사고조사 |
| `audit-preparation` | 감사 대비 체크리스트 생성 | Audit Agent | compliance/*/내부감사 |
| `contractor-onboarding` | 협력사 등록~교육 패키지 | Contractor Safety | daily/*/협력사관리 |
| `asset-integrity-check` | 설비 점검 계획 생성 | Asset Integrity | daily/*/설비점검 |

---

### Phase 2-C 완료 체크리스트
```
□ 15개 agent 전체 3-section 구조 완성
□ 10개 skill 전체 완성
□ PSM Agent HAZOP + MOC 실행 테스트
□ Incident Investigation Agent 5-Why 실행 테스트
□ bun run agent:verify 통과 (AGENTS.md 일치)
□ safety-audit.ts skill dependency 검증 0 errors
```

---

### Phase 2-D: Documentation & Automation (S-36~S-40)

**목표**: v3.0 Full 완성, generate-playbook.ts 구현, v4.0 조립

#### S-36: v3.0 Group 1 — Industry & Workflow (8개 파일)

```
13-workflow-design.md    ← 7섹션 표준 포맷 공식화
14-workflow-library.md   ← 전체 workflow 참조 목록
07-manufacturing.md      ← Draft 확장 (PSM 없음 명시)
08-chemical.md           ← PSM 12대 요소 전체 포함
09-semiconductor.md
10-construction.md
11-datacenter.md
12-scenario-library.md   ← 5개 Cross-Industry 시나리오
```

`08-chemical.md` 핵심 구조:
```markdown
## 8.2 Regulatory Framework — PSM 12대 요소
| 요소 | Status | Workflow | Legal Basis |
|------|--------|---------|------------|
| 위험성평가 | mandatory | daily/chemical/위험성평가-psm | PSM 고시 제3조 |
... (12개 전체)
```

---

#### S-37: v3.0 Group 2 — Engineering Standards (10개 파일)

```
15-skill-design.md        ← 3-section 포맷 표준
16-skill-catalog.md       ← 10개 skill 전체 목록
17-script-design.md       ← 6개 script 유형 포맷
18-knowledge-graph.md     ← Traceability model
19-graph-schema.md        ← Node + Relationship + Governance
20-repository-architecture.md
21-branching-strategy.md
22-pr-governance.md
23-automation-gates.md    ← safety-audit.ts + generate-playbook.ts
24-prompt-engineering.md  ← 3-section 포맷 전체
```

---

#### S-38: v3.0 Appendix (11개 파일)

```
A-agent-definitions.md      ← 15개 agent 요약
B-workflow-templates.md
C-skill-templates.md
D-script-templates.md       ← SOP/Checklist/Audit/Emergency/Incident/Training
E-governance-templates.md
F-github-templates.md       ← _ORIGIN.md, _COMMON_VERSION.md, PROMOTION_CHECKLIST.md
G-prompt-templates.md       ← 3-section 완전 예시
H-knowledge-graph-examples.md ← codegraph impact 예시 출력
I-regulation-registry.md    ← _REGISTRY.md 전체 + YAML 포맷 설명
J-codegraph-integration.md  ← init→index→impact 워크플로우 가이드
K-korean-regulatory-glossary.md ← 한국어 ↔ 영어 용어 대조표 (30개 이상)
```

`Appendix K` 핵심 용어:
```markdown
| 한국어 | 영어 | 법령/설명 |
|--------|------|---------|
| 위험성평가 | Risk Assessment | 산안법 제36조 |
| 작업허가제 | Permit to Work | PTW |
| 중대재해처벌법 | Serious Accidents Punishment Act | — |
| 공정안전관리 | Process Safety Management | PSM |
| 변경관리 | Management of Change | MOC |
| 안전보건관리체계 | OHSMS | 7대 요소 |
| 증적 | Evidence / Audit Trail | 감사 증거물 |
| 시정조치 | Corrective Action | CA |
| 도급 | Subcontracting | 협력업체 포함 |
| 중대산업사고 | Major Industrial Accident | PSM 고시 대상 |
```

---

#### S-39: generate-playbook.ts 구현

```typescript
// scripts/generate-playbook.ts
import { readdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import * as yaml from 'js-yaml'

const BLUEPRINT_DIR = './docs/blueprint'
const OUTPUT = `./docs/v4.0-playbook-${new Date().toISOString().slice(0,10)}.md`

async function main() {
  let out = ''

  // 1. Document Control Header
  out += `# Safety OS Architecture Blueprint v4.0\n`
  out += `**Generated**: ${new Date().toISOString().slice(0,10)}\n\n---\n\n`

  // 2. Blueprint 파일 순서대로 조립
  const files = (await readdir(BLUEPRINT_DIR))
    .filter(f => f.endsWith('.md') && !f.includes('appendix'))
    .sort()
  for (const f of files) {
    out += await readFile(`${BLUEPRINT_DIR}/${f}`, 'utf-8')
    out += '\n\n---\n\n'
  }

  // 3. Industry Profile 요약 자동 삽입
  out += `\n## Industry Profile Summary\n\n`
  for (const f of await readdir('./industry-profiles').catch(() => [])) {
    if (!f.endsWith('.yaml')) continue
    const d = yaml.load(await readFile(`./industry-profiles/${f}`, 'utf-8')) as Record<string, unknown>
    out += `### ${d.name} — PSM: ${d.psm_required}\n`
    out += `Regulations: ${(d.core_regulations as string[])?.join(', ')}\n\n`
  }

  // 4. Workflow 전체 목록 자동 생성
  out += `\n## Complete Workflow Index\n\n`
  for (const cat of ['daily', 'compliance', 'emergency']) {
    out += `### ${cat.toUpperCase()}\n\n`
    for (const ind of await readdir(`./workflows/${cat}`).catch(() => [])) {
      const idx = `./workflows/${cat}/${ind}/_INDEX.md`
      if (existsSync(idx)) out += await readFile(idx, 'utf-8') + '\n'
    }
  }

  // 5. Regulation Registry 자동 삽입
  const reg = './regulations/_REGISTRY.md'
  if (existsSync(reg)) {
    out += `\n## Regulation Registry\n\n` + await readFile(reg, 'utf-8')
  }

  // 6. Appendix 조립
  const appDir = `${BLUEPRINT_DIR}/appendix`
  if (existsSync(appDir)) {
    out += '\n\n# Appendices\n\n'
    for (const f of (await readdir(appDir)).filter(f => f.endsWith('.md')).sort()) {
      out += await readFile(`${appDir}/${f}`, 'utf-8') + '\n\n---\n\n'
    }
  }

  await writeFile(OUTPUT, out)
  const size = (await import('fs')).statSync(OUTPUT).size
  console.log(`✅ v4.0 Playbook: ${OUTPUT} (${Math.round(size/1024)}KB)`)
}

await main()
```

**완료 조건**: 실행 성공 + 출력 파일 최소 100KB

---

#### S-40: v4.0 Playbook 검증

```bash
bun scripts/generate-playbook.ts
wc -l docs/v4.0-playbook-*.md      # 분량 확인
grep "^# " docs/v4.0-playbook-*.md | wc -l   # Part 수
grep "^## " docs/v4.0-playbook-*.md | wc -l  # Section 수
```

**완료 조건**: v4.0-playbook.md 100p+ 확인

---

### Phase 2-D 완료 체크리스트
```
□ v3.0 Full: 26개 섹션 + Appendix 11개 완성 (~80p)
□ generate-playbook.ts 실행 성공 (exit 0)
□ v4.0-playbook.md 생성 + 최소 100p
□ Appendix K 용어집 30개 이상
```

---

### Phase 2 전체 완료 체크리스트
```
Phase 2-A:
  □ mcp-kr-legislation 조회 성공
  □ regulations/ 23개 이상 법령 YAML
  □ codegraph impact 쿼리 동작
  □ safety-audit.ts Phase 2 0 errors
  □ K-Skill 연동 확인

Phase 2-B:
  □ chemical PSM 12개 모두 active
  □ semiconductor PSM 8개 active
  □ construction 6개 active
  □ datacenter BCP/DR/변경관리 active
  □ 5개 Cross-Industry scenario 완성

Phase 2-C:
  □ 15개 agent 3-section 완성
  □ 10개 skill 완성
  □ bun run agent:verify 통과

Phase 2-D:
  □ v3.0 Full 완성
  □ generate-playbook.ts 동작
  □ v4.0 Playbook 100p+ 확인
```

---

## 9. 한국 산업안전 법령 체계 참고

```
핵심 법령 (tier1)
  산업안전보건법       — 안전관리자, 위험성평가, 교육, 보호구, 작업환경관리
  중대재해처벌법       — 경영책임자 의무, 안전보건관리체계 구축

관리 프레임워크
  안전보건관리체계 7대 요소  — 모든 사업장
  PSM 12대 요소             — 화학/정유/가스/반도체 (법적 의무)

PSM 12대 요소 (화학/반도체 사업장은 전체 mandatory):
  공정안전자료 / 위험성평가 / 운전절차 / 설비관리
  변경관리(MOC) / 협력업체관리 / 교육훈련 / 비상조치계획
  사고조사 / 자체감사 / 작업허가제 / 경영자참여

기업 내부 관리규정 (20~30개 수준):
  안전보건관리규정 / 위험성평가 규정 / 작업허가제 규정
  협력업체 안전관리 규정 / 비상대응 규정 / 사고조사 규정
  MOC 규정 / 보호구 관리 규정 / 밀폐공간 작업 규정
  고소작업 규정 / 화기작업 규정 / 화학물질 관리 규정 등
```

---

## 10. 진행 상태 트래킹

| Step | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| S-00 기반 구조 생성 | ⬜ 미시작 | — | |
| S-01 pm.md CSO override | ⬜ 미시작 | — | S-00 필요 |
| S-02 SGM agent | ⬜ 미시작 | — | S-01 필요 |
| S-03 SWM agent | ⬜ 미시작 | — | S-01 필요 |
| S-04 법령 레지스트리 tier1 | ⬜ 미시작 | — | S-00 필요 |
| S-05 industry-profiles/manufacturing | ⬜ 미시작 | — | S-04 필요 |
| S-06 workflows/daily/manufacturing 6개 | ⬜ 미시작 | — | S-05 필요 |
| S-07 skills 4개 | ⬜ 미시작 | — | S-05 병행 |
| S-08 evidence-models/base | ⬜ 미시작 | — | S-06 필요 |
| S-09 safety-audit.ts | ⬜ 미시작 | — | S-06 필요 |
| S-10 v3.0 Blueprint Draft | ⬜ 미시작 | — | S-01~03 필요 |
| S-11 PROMOTION_CHECKLIST | ⬜ 미시작 | — | S-00~10 필요 |
| S-12 templates/co-safety/ | ⬜ 미시작 | — | S-11 통과 후 |
| S-13 workspace root 반영 | ⬜ 미시작 | — | S-12 필요 |
| S-14 최종 검증 | ⬜ 미시작 | — | S-13 필요 |

**Phase 2-A: Knowledge Engineering**

| Step | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| S-20 mcp-kr-legislation 설치 및 연동 | ⬜ 미시작 | — | Phase A 완료 후 |
| S-21 regulations/ tier2~4 확장 (23개+) | ⬜ 미시작 | — | S-20 후 |
| S-22 safety-audit.ts Phase 2 확장 | ⬜ 미시작 | — | S-21 후 |
| S-23 CodeGraph 심화 (index.ts 자동생성) | ⬜ 미시작 | — | S-22 후 |
| S-24 K-Skill 연동 | ⬜ 미시작 | — | S-23 후 |

**Phase 2-B: Industry Expansion**

| Step | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| S-25 Chemical (PSM 12대 요소 전체) | ⬜ 미시작 | — | 2-A 완료 후 |
| S-26 Semiconductor (PSM 8개 요소) | ⬜ 미시작 | — | S-25 후 |
| S-27 Construction (6개 핵심 workflow) | ⬜ 미시작 | — | S-25 병행 |
| S-28 DataCenter (BCP/DR/변경관리) | ⬜ 미시작 | — | S-25 병행 |
| S-29 Cross-Industry 5개 시나리오 + compliance/emergency | ⬜ 미시작 | — | S-25~28 후 |

**Phase 2-C: Agent & Skill Expansion**

| Step | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| S-30 PSM Agent | ⬜ 미시작 | — | 2-B 완료 후 |
| S-31 Asset Integrity Agent | ⬜ 미시작 | — | S-30 병행 |
| S-32 Incident Investigation Agent | ⬜ 미시작 | — | S-30 병행 |
| S-33 Contractor Safety Agent | ⬜ 미시작 | — | S-30 병행 |
| S-34 Training Agent + Reporting Agent | ⬜ 미시작 | — | S-30 병행 |
| S-35 Skill 6개 (hazop, psm-moc, rca, audit-prep, contractor, asset) | ⬜ 미시작 | — | S-30~34 후 |

**Phase 2-D: Documentation & Automation**

| Step | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| S-36 v3.0 Group 1 — Industry & Workflow (8개 파일) | ⬜ 미시작 | — | 2-B 완료 후 |
| S-37 v3.0 Group 2 — Engineering Standards (10개 파일) | ⬜ 미시작 | — | 2-C 완료 후 |
| S-38 v3.0 Appendix A~K (11개 파일) | ⬜ 미시작 | — | S-36~37 후 |
| S-39 generate-playbook.ts 구현 | ⬜ 미시작 | — | S-36~38 후 |
| S-40 v4.0 Playbook 생성 및 검증 (100p+) | ⬜ 미시작 | — | S-39 후 |

---

_Last updated: 2026-06-03 — 6차 회의 반영, Phase 2 전체 상세화 (S-20~S-40, 21개 스텝, 4개 하위 단계, 완료 조건 포함)._
