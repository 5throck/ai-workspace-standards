# Gas Terminal Construction/Permit Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 construction/permit phase workflows (3 individual + 1 orchestrator) to the gasterm domain, covering KGS Code-driven pre-construction technical review, mid-construction inspection, and completion inspection under gas 3 laws.

**Architecture:** Hybrid approach — 3 standalone workflows following existing README.md + schema.yaml pattern, plus 1 orchestrator workflow with explicit phase tracking and dependency enforcement. All workflows dispatch through gasterm-agent (PM-only invocation).

**Tech Stack:** YAML (schemas), Markdown (workflows), JSON Schema (evidence models), TypeScript (audit config)

**Design Spec:** `docs/superpowers/specs/2026-07-05-gasterm-construction-permit-design.md`

**Working Directory:** `.worktrees/feat/gasterm-construction-permit`

---

## File Map

### New Files (11)

| File | Responsibility |
|------|----------------|
| `workflows/domains/industry/gasterm/pre-construction-technical-review/README.md` | Phase 1 workflow documentation |
| `workflows/domains/industry/gasterm/pre-construction-technical-review/schema.yaml` | Phase 1 schema |
| `workflows/domains/industry/gasterm/mid-construction-inspection/README.md` | Phase 2 workflow documentation |
| `workflows/domains/industry/gasterm/mid-construction-inspection/schema.yaml` | Phase 2 schema |
| `workflows/domains/industry/gasterm/completion-inspection/README.md` | Phase 3 workflow documentation |
| `workflows/domains/industry/gasterm/completion-inspection/schema.yaml` | Phase 3 schema |
| `workflows/domains/industry/gasterm/construction-permit-overview/README.md` | Orchestrator workflow documentation |
| `workflows/domains/industry/gasterm/construction-permit-overview/schema.yaml` | Orchestrator schema with phase tracking |
| `evidence-models/domains/industry/gasterm/gasterm-pre-construction-review-record.json` | Phase 1 evidence model |
| `evidence-models/domains/industry/gasterm/gasterm-mid-construction-inspection-record.json` | Phase 2 evidence model |
| `evidence-models/domains/industry/gasterm/gasterm-completion-inspection-record.json` | Phase 3 evidence model |
| `evidence-models/domains/industry/gasterm/gasterm-construction-permit-overview-record.json` | Orchestrator evidence model |
| `regulations/KR/City-Gas-Business.yaml` | City Gas Business Act regulation file |

### Modified Files (6)

| File | Change |
|------|--------|
| `docs/domains/industry/gasterm/scope.md` | Add 4 workflows to table, update component counts from 8→12, add KGS Code construction section |
| `agents/domains/industry/gasterm/gasterm-agent.md` | Add construction/permit legal basis (Section A), update responsibilities & scope (Section B), update dispatch triggers (PM-ONLY INVOCATION) |
| `regulations/KR/LPG-Safety-Business.yaml` | Add Articles 27-2, 45 |
| `regulations/KR/High-Pressure-Gas-Safety.yaml` | Add Article 22-2 |
| `scripts/domain-config.ts` | Add construction-phase cross-domain refs |
| `AGENTS.md` | Add construction-permit skill entries to Specialist Agent Roster and Skills table |

---

### Task 1: Regulation Files — Create City-Gas-Business.yaml and update existing regs

**Files:**
- Create: `regulations/KR/City-Gas-Business.yaml`
- Modify: `regulations/KR/LPG-Safety-Business.yaml`
- Modify: `regulations/KR/High-Pressure-Gas-Safety.yaml`

- [ ] **Step 1: Create `regulations/KR/City-Gas-Business.yaml`**

```yaml
source_mcp: mcp-kr-legislation
jurisdiction: KR
regulator: MOTIE (산업통상자원부) / KGS (한국가스안전공사)
framework: City-Gas-Business
title_ko: 도시가스사업법
title_en: City Gas Business Act
primary_law:
  name_ko: 도시가스사업법
  articles:
    - article: "17-5"
      topic_ko: 시설·기술·검사 기준 위임 (KGS Code)
kgs_code_delegation:
  description: "도시가스사업법 제17조의5에 따라 시설·기술·검사의 상세기준을 한국가스안전공사가 정함"
  covered_by_kgs_code: true
applicable_facilities:
  - 도시가스_배관시설
  - 도시가스_저장시설
  - 도시가스_공급시설
last_updated: "2026-07-05"
```

- [ ] **Step 2: Update `regulations/KR/LPG-Safety-Business.yaml` — add Articles 27-2, 45**

Add after the existing `articles` array entries:

```yaml
    - article: "27-2"
      topic_ko: 시설·기술·검사 상세기준 위임 (KGS Code)
    - article: "45"
      topic_ko: 검사 기준 (공사인허가·완성검사)
```

Add after `charging_stations`:

```yaml
kgs_code_delegation:
  description: "액화석유가스의 안전관리 및 사업법 제27조의2에 따라 시설·기술·검사의 상세기준을 한국가스안전공사가 정함"
  covered_by_kgs_code: true
permit_procedure:
  pre_review: "KGS 기술검토 (별지 제8호서식 준용)"
  mid_inspection: "KGS 입회 중간검사"
  completion_inspection: "KGS 입회 완성검사 → 지자체 허가"
```

- [ ] **Step 3: Update `regulations/KR/High-Pressure-Gas-Safety.yaml` — add Article 22-2**

Add after the existing `articles` array entries:

```yaml
    - article: "22-2"
      topic_ko: 시설·기술·검사 상세기준 위임 (KGS Code)
```

Add after `kgs_inspection`:

```yaml
kgs_code_delegation:
  description: "고압가스안전관리법 제22조의2에 따라 시설·기술·검사의 상세기준을 한국가스안전공사가 정함"
  covered_by_kgs_code: true
permit_procedure:
  pre_review: "KGS 기술검토 (시행규칙 제7조)"
  mid_inspection: "KGS 입회 중간검사"
  completion_inspection: "KGS 입회 완성검사 → 지자체 허가"
```

- [ ] **Step 4: Run audit to verify regulation files pass**

Run: `cd .worktrees/feat/gasterm-construction-permit && bun scripts/audit.ts`
Expected: ✅ 0 errors (regulation section validates `source_mcp: mcp-kr-legislation`)

- [ ] **Step 5: Commit**

```bash
cd .worktrees/feat/gasterm-construction-permit
git add regulations/KR/
git commit -m "feat(gasterm): add City-Gas-Business.yaml + update LPG/HPG regs with KGS Code delegation articles"
```

---

### Task 2: Phase 1 — pre-construction-technical-review workflow

**Files:**
- Create: `workflows/domains/industry/gasterm/pre-construction-technical-review/README.md`
- Create: `workflows/domains/industry/gasterm/pre-construction-technical-review/schema.yaml`

- [ ] **Step 1: Create `pre-construction-technical-review/README.md`**

```markdown
# 사전기술검토 (Pre-Construction Technical Review) Workflow

## 1. 목적
본 워크플로우는 한국 가스안전 관련 법령(고압가스안전관리법 (High-Pressure Gas Safety Control Act) 제22조의2, 액화석유가스의 안전관리 및 사업법 (LPG Safety Control and Business Act) 제27조의2, 도시가스사업법 (City Gas Business Act) 제17조의5)에 따른 KGS Code 준거 시설기술 기준 적합성 심사(사전기술검토)를 관리한다. 고압가스안전관리법 시행규칙 제7조에 따른 기술검토 신청 절차를 포함한다.

## 2. 워크플로우 단계
1. 신청 준비 — 시설계획서, 배치도, 안전관리계획서, KGS Code 준거 자료 수집
2. KGS 기술검토 신청 — 별지 제8호서식 (고압법 시행규칙 제7조)
3. 심사 대기 — KGS 기술기준위원회 검토 (실무 2~4주)
4. 결과 수령 — 적합 / 보완 요구 / 부적합 판정
5. 지자체 변경허가 신청 — 기술검토 결과 첨부

## 3. 증거 기록
다중 출처의 `legal_basis`를 포함하여 `gasterm-pre-construction-review-record.json`을 생성한다.

## 4. 법적 면책 고지
> 본 시스템은 워크플로우 자동화 지원만 제공하며, 최종 판단은 자격을 갖춘 가스안전관리자 및 한국가스안전공사(KGS) 검사관의 검토가 필요합니다. 공사인허가는 지자체의 권한이며, KGS 기술검토 결과는 허가 심사의 참고 자료입니다.
```

- [ ] **Step 2: Create `pre-construction-technical-review/schema.yaml`**

```yaml
schema_version: "1.0"
workflow_id: pre-construction-technical-review
title: "사전기술검토 (Pre-Construction Technical Review)"
status: active
applicability: mandatory
workflow_type: core

legal_basis:
  - 고압가스안전관리법 Article 22-2
  - 고압가스안전관리법 시행규칙 Article 7
  - 액화석유가스의 안전관리 및 사업법 Article 27-2
  - 도시가스사업법 Article 17-5
industry_profile: gas-facility
agent: gasterm-agent
evidence_model: gasterm-pre-construction-review-record.json
```

- [ ] **Step 3: Run audit to verify**

Run: `cd .worktrees/feat/gasterm-construction-permit && bun scripts/audit.ts`
Expected: ✅ 0 errors (legal_basis ≥3, status/applicability valid)

- [ ] **Step 4: Commit**

```bash
cd .worktrees/feat/gasterm-construction-permit
git add workflows/domains/industry/gasterm/pre-construction-technical-review/
git commit -m "feat(gasterm): add pre-construction-technical-review workflow (Phase 1)"
```

---

### Task 3: Phase 2 — mid-construction-inspection workflow

**Files:**
- Create: `workflows/domains/industry/gasterm/mid-construction-inspection/README.md`
- Create: `workflows/domains/industry/gasterm/mid-construction-inspection/schema.yaml`

- [ ] **Step 1: Create `mid-construction-inspection/README.md`**

```markdown
# 중간검사 (Mid-Construction Inspection) Workflow

## 1. 목적
본 워크플로우는 한국 가스안전 관련 법령(고압가스안전관리법 (High-Pressure Gas Safety Control Act) 제22조의2, 액화석유가스의 안전관리 및 사업법 (LPG Safety Control and Business Act) 제45조, 도시가스사업법 (City Gas Business Act) 제17조의5)에 따른 KGS 입회 중간검사를 관리한다. 공사 진도 50~70% 시점에서 시공이 설계 및 KGS Code 기준에 부합하는지 확인한다.

## 2. 전제 조건
- 사전기술검토(Phase 1) 합격 완료증이 필수

## 3. 워크플로우 단계
1. 중간검사 신청 — 공사 진도 50~70% 시점, KGS에 검사 일정 협의
2. KGS 입회 전 현장 확인 — 현장 상태 점검, 필수 서류 준비
3. KGS 입회 중간검사 — 배관 용접, 토목 기초, 탱크 설치 등 핵심 공정 확인
4. 시정 조치 (필요시) — 부적합 항목 시정 및 재검사
5. 결과 기록 — 합격 / 보완 / 부적합, 다음 단계 진행 가능 여부

## 4. 증거 기록
다중 출처의 `legal_basis`를 포함하여 `gasterm-mid-construction-inspection-record.json`을 생성한다.

## 5. 법적 면책 고지
> 본 시스템은 워크플로우 자동화 지원만 제공하며, 최종 판단은 자격을 갖춘 가스안전관리자 및 한국가스안전공사(KGS) 검사관의 검토가 필요합니다.
```

- [ ] **Step 2: Create `mid-construction-inspection/schema.yaml`**

```yaml
schema_version: "1.0"
workflow_id: mid-construction-inspection
title: "중간검사 (Mid-Construction Inspection)"
status: active
applicability: mandatory
workflow_type: core

legal_basis:
  - 고압가스안전관리법 Article 22-2
  - 액화석유가스의 안전관리 및 사업법 Article 45
  - 도시가스사업법 Article 17-5
industry_profile: gas-facility
agent: gasterm-agent
evidence_model: gasterm-mid-construction-inspection-record.json
depends_on: pre-construction-technical-review
```

- [ ] **Step 3: Run audit to verify**

Run: `cd .worktrees/feat/gasterm-construction-permit && bun scripts/audit.ts`
Expected: ✅ 0 errors

- [ ] **Step 4: Commit**

```bash
cd .worktrees/feat/gasterm-construction-permit
git add workflows/domains/industry/gasterm/mid-construction-inspection/
git commit -m "feat(gasterm): add mid-construction-inspection workflow (Phase 2)"
```

---

### Task 4: Phase 3 — completion-inspection workflow

**Files:**
- Create: `workflows/domains/industry/gasterm/completion-inspection/README.md`
- Create: `workflows/domains/industry/gasterm/completion-inspection/schema.yaml`

- [ ] **Step 1: Create `completion-inspection/README.md`**

```markdown
# 완성검사 (Completion Inspection) Workflow

## 1. 목적
본 워크플로우는 한국 가스안전 관련 법령(고압가스안전관리법 (High-Pressure Gas Safety Control Act) 제22조의2·제28조, 액화석유가스의 안전관리 및 사업법 (LPG Safety Control and Business Act) 제37조·제45조, 도시가스사업법 (City Gas Business Act) 제17조의5)에 따른 KGS 입회 완성검사를 관리한다. 전체 공사 완료 후 종합 검사를 수행하고, 합격 시 지자체 허가증 발급 및 운영 개시 절차를 포함한다.

## 2. 전제 조건
- 중간검사(Phase 2) 합격 완료증이 필수

## 3. 워크플로우 단계
1. 완성검사 신청 — 전체 공사 완료 후 KGS에 신청
2. 사전 점검 — 가스누출 시험, 압력시험, 전기식 안전장치 점검
3. KGS 입회 완성검사 — 전체 시설 종합 검사
4. 시정 조치 (필요시) — 부적합 항목 시정 및 재검사
5. 지자체 허가증 발급 — KGS 합격 결과 → 지자체 변경허가 완료
6. 운영 개시 — 안전관리자 선임 확인, 정기검사 주기 설정

## 4. 증거 기록
다중 출처의 `legal_basis`를 포함하여 `gasterm-completion-inspection-record.json`을 생성한다.

## 5. 법적 면책 고지
> 본 시스템은 워크플로우 자동화 지원만 제공하며, 최종 판단은 자격을 갖춘 가스안전관리자 및 한국가스안전공사(KGS) 검사관의 검토가 필요합니다. 공사인허가는 지자체의 권한입니다.
```

- [ ] **Step 2: Create `completion-inspection/schema.yaml`**

```yaml
schema_version: "1.0"
workflow_id: completion-inspection
title: "완성검사 (Completion Inspection)"
status: active
applicability: mandatory
workflow_type: core

legal_basis:
  - 고압가스안전관리법 Article 22-2
  - 고압가스안전관리법 Article 28
  - 액화석유가스의 안전관리 및 사업법 Article 37
  - 액화석유가스의 안전관리 및 사업법 Article 45
  - 도시가스사업법 Article 17-5
industry_profile: gas-facility
agent: gasterm-agent
evidence_model: gasterm-completion-inspection-record.json
depends_on: mid-construction-inspection
```

- [ ] **Step 3: Run audit to verify**

Run: `cd .worktrees/feat/gasterm-construction-permit && bun scripts/audit.ts`
Expected: ✅ 0 errors

- [ ] **Step 4: Commit**

```bash
cd .worktrees/feat/gasterm-construction-permit
git add workflows/domains/industry/gasterm/completion-inspection/
git commit -m "feat(gasterm): add completion-inspection workflow (Phase 3)"
```

---

### Task 5: Orchestrator — construction-permit-overview workflow

**Files:**
- Create: `workflows/domains/industry/gasterm/construction-permit-overview/README.md`
- Create: `workflows/domains/industry/gasterm/construction-permit-overview/schema.yaml`

- [ ] **Step 1: Create `construction-permit-overview/README.md`**

```markdown
# 건설인허가 전체 관리 (Construction Permit Overview) Workflow

## 1. 목적
본 워크플로우는 가스 시설(고압가스, 액화석유가스, 도시가스)의 건설/인허가 전체 라이프사이클을 관리하는 오케스트레이터이다. 가스 3법에 따른 KGS Code 준거 3단계 인허가 절차(사전기술검토 → 중간검사 → 완성검사)를 순차적으로 dispatch하고 상태를 추적한다.

## 2. 관련 법령
- 고압가스안전관리법 제22조의2, 시행규칙 제7조
- 액화석유가스의 안전관리 및 사업법 제27조의2, 제45조
- 도시가스사업법 제17조의5

## 3. 오케스트레이션 단계
1. **Phase 1** — 사전기술검토 (`pre-construction-technical-review`)
2. **Phase 2** — 중간검사 (`mid-construction-inspection`) — Phase 1 합격 시에만 dispatch
3. **Phase 3** — 완성검사 (`completion-inspection`) — Phase 2 합격 시에만 dispatch
4. **완료** — 지자체 허가증 발급, 정기검사 주기 설정 (운영 단계 인수)

## 4. 상태 추적
각 phase의 상태를 `not_started | in_progress | passed | failed`로 추적하며, `depends_on` 필드가 `passed`일 때만 다음 단계를 dispatch한다.

## 5. 증거 기록
다중 출처의 `legal_basis`를 포함하여 `gasterm-construction-permit-overview-record.json`을 생성한다.

## 6. 법적 면책 고지
> 본 시스템은 워크플로우 자동화 지원만 제공하며, 최종 판단은 자격을 갖춘 가스안전관리자 및 한국가스안전공사(KGS) 검사관의 검토가 필요합니다. 공사인허가는 지자체의 권한이며, KGS 기술검토 결과는 허가 심사의 참고 자료입니다.
```

- [ ] **Step 2: Create `construction-permit-overview/schema.yaml`**

```yaml
schema_version: "1.0"
workflow_id: construction-permit-overview
title: "건설인허가 전체 관리 (Construction Permit Overview)"
status: active
applicability: mandatory
workflow_type: core

legal_basis:
  - 고압가스안전관리법 Article 22-2
  - 액화석유가스의 안전관리 및 사업법 Article 27-2
  - 도시가스사업법 Article 17-5
industry_profile: gas-facility
agent: gasterm-agent
evidence_model: gasterm-construction-permit-overview-record.json

phases:
  - id: pre_review
    workflow_id: pre-construction-technical-review
    order: 1
  - id: mid_inspection
    workflow_id: mid-construction-inspection
    order: 2
    depends_on: pre_review
  - id: completion
    workflow_id: completion-inspection
    order: 3
    depends_on: mid_inspection
```

- [ ] **Step 3: Run audit to verify**

Run: `cd .worktrees/feat/gasterm-construction-permit && bun scripts/audit.ts`
Expected: ✅ 0 errors

- [ ] **Step 4: Commit**

```bash
cd .worktrees/feat/gasterm-construction-permit
git add workflows/domains/industry/gasterm/construction-permit-overview/
git commit -m "feat(gasterm): add construction-permit-overview orchestrator workflow"
```

---

### Task 6: Evidence Models — 4 new JSON Schema files

**Files:**
- Create: `evidence-models/domains/industry/gasterm/gasterm-pre-construction-review-record.json`
- Create: `evidence-models/domains/industry/gasterm/gasterm-mid-construction-inspection-record.json`
- Create: `evidence-models/domains/industry/gasterm/gasterm-completion-inspection-record.json`
- Create: `evidence-models/domains/industry/gasterm/gasterm-construction-permit-overview-record.json`

- [ ] **Step 1: Create `gasterm-pre-construction-review-record.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "gasterm-pre-construction-review-record.json",
  "title": "Gas Terminal Pre-Construction Technical Review Record",
  "description": "KGS Code 준거 사전기술검토 결과 기록. 가스 3법에 따른 시설기준·기술기준 적합성 심사.",
  "version": "1.0.0",
  "type": "object",
  "required": ["record_id", "facility_type", "kgs_inspection_status", "psm_applicable", "gas_type", "legal_basis", "e_signature", "nomenclature", "audit_trail"],
  "properties": {
    "record_id": { "type": "string", "pattern": "^GTRM-PREV-[0-9]{4}-[0-9]{4}$" },
    "facility_type": {
      "type": "string",
      "enum": ["LNG_terminal", "LPG_charging", "hydrogen_charging", "city_gas_storage", "pipe_transfer"]
    },
    "kgs_inspection_status": {
      "type": "string",
      "enum": ["certified", "pending", "failed", "expired"]
    },
    "psm_applicable": {
      "type": "boolean",
      "description": "대규모 가스터미널 PSM 적용 여부"
    },
    "gas_type": {
      "type": "string",
      "enum": ["LNG", "LPG", "hydrogen", "natural_gas", "other"]
    },
    "project_id": { "type": "string" },
    "review_type": {
      "type": "string",
      "enum": ["new_construction", "modification", "expansion"]
    },
    "kgs_code_references": {
      "type": "array",
      "items": { "type": "string" },
      "description": "적용된 KGS Code 항목 (예: KGS AC211, KGS FA121 등)"
    },
    "application_date": { "type": "string", "format": "date" },
    "review_result": {
      "type": "string",
      "enum": ["pass", "supplement_required", "fail"]
    },
    "supplement_items": {
      "type": "array",
      "items": { "type": "string" },
      "description": "보완 요구 항목"
    },
    "kgs_review_id": { "type": "string", "description": "KGS 기술검토 접수번호" },
    "local_gov_submission_date": { "type": "string", "format": "date" },
    "local_government": { "type": "string", "description": "관할 지자체" },
    "legal_basis": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 3
    },
    "e_signature": { "$ref": "../../../_shared/base/common.schema.json#/definitions/e_signature" },
    "nomenclature": { "$ref": "../../../_shared/base/common.schema.json#/definitions/nomenclature" },
    "audit_trail": { "$ref": "../../../_shared/base/common.schema.json#/definitions/audit_trail" }
  }
}
```

- [ ] **Step 2: Create `gasterm-mid-construction-inspection-record.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "gasterm-mid-construction-inspection-record.json",
  "title": "Gas Terminal Mid-Construction Inspection Record",
  "description": "KGS 입회 중간검사 결과 기록. 공사 진행 중 시공 품질 및 KGS Code 준수 확인.",
  "version": "1.0.0",
  "type": "object",
  "required": ["record_id", "facility_type", "kgs_inspection_status", "psm_applicable", "gas_type", "legal_basis", "e_signature", "nomenclature", "audit_trail"],
  "properties": {
    "record_id": { "type": "string", "pattern": "^GTRM-MINS-[0-9]{4}-[0-9]{4}$" },
    "facility_type": {
      "type": "string",
      "enum": ["LNG_terminal", "LPG_charging", "hydrogen_charging", "city_gas_storage", "pipe_transfer"]
    },
    "kgs_inspection_status": {
      "type": "string",
      "enum": ["certified", "pending", "failed", "expired"]
    },
    "psm_applicable": {
      "type": "boolean",
      "description": "대규모 가스터미널 PSM 적용 여부"
    },
    "gas_type": {
      "type": "string",
      "enum": ["LNG", "LPG", "hydrogen", "natural_gas", "other"]
    },
    "project_id": { "type": "string" },
    "pre_construction_review_id": { "type": "string", "description": "Phase 1 사전기술검토 합격증 ID" },
    "construction_progress_pct": { "type": "number", "minimum": 0, "maximum": 100 },
    "kgs_inspector": { "type": "string", "description": "KGS 입회 검사관 성명" },
    "inspection_date": { "type": "string", "format": "date" },
    "inspected_items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "item": { "type": "string" },
          "result": { "type": "string", "enum": ["pass", "fail", "na"] },
          "notes": { "type": "string" }
        },
        "required": ["item", "result"]
      },
      "description": "검사 항목별 결과 (배관 용접, 토목 기초, 탱크 설치 등)"
    },
    "deficiencies": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "item": { "type": "string" },
          "severity": { "type": "string", "enum": ["critical", "major", "minor"] },
          "corrective_action": { "type": "string" },
          "due_date": { "type": "string", "format": "date" }
        },
        "required": ["item", "severity"]
      }
    },
    "inspection_result": {
      "type": "string",
      "enum": ["pass", "supplement_required", "fail"]
    },
    "local_government": { "type": "string" },
    "legal_basis": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 3
    },
    "e_signature": { "$ref": "../../../_shared/base/common.schema.json#/definitions/e_signature" },
    "nomenclature": { "$ref": "../../../_shared/base/common.schema.json#/definitions/nomenclature" },
    "audit_trail": { "$ref": "../../../_shared/base/common.schema.json#/definitions/audit_trail" }
  }
}
```

- [ ] **Step 3: Create `gasterm-completion-inspection-record.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "gasterm-completion-inspection-record.json",
  "title": "Gas Terminal Completion Inspection Record",
  "description": "KGS 입회 완성검사 결과 기록. 전체 시설 종합 검사 후 지자체 허가증 발급 및 운영 개시.",
  "version": "1.0.0",
  "type": "object",
  "required": ["record_id", "facility_type", "kgs_inspection_status", "psm_applicable", "gas_type", "legal_basis", "e_signature", "nomenclature", "audit_trail"],
  "properties": {
    "record_id": { "type": "string", "pattern": "^GTRM-COMP-[0-9]{4}-[0-9]{4}$" },
    "facility_type": {
      "type": "string",
      "enum": ["LNG_terminal", "LPG_charging", "hydrogen_charging", "city_gas_storage", "pipe_transfer"]
    },
    "kgs_inspection_status": {
      "type": "string",
      "enum": ["certified", "pending", "failed", "expired"]
    },
    "psm_applicable": {
      "type": "boolean",
      "description": "대규모 가스터미널 PSM 적용 여부"
    },
    "gas_type": {
      "type": "string",
      "enum": ["LNG", "LPG", "hydrogen", "natural_gas", "other"]
    },
    "project_id": { "type": "string" },
    "mid_construction_inspection_id": { "type": "string", "description": "Phase 2 중간검사 합격증 ID" },
    "kgs_inspector": { "type": "string", "description": "KGS 입회 검사관 성명" },
    "inspection_date": { "type": "string", "format": "date" },
    "pressure_test_result": {
      "type": "object",
      "properties": {
        "test_date": { "type": "string", "format": "date" },
        "test_pressure_bar": { "type": "number" },
        "holding_time_min": { "type": "integer" },
        "result": { "type": "string", "enum": ["pass", "fail"] }
      }
    },
    "leak_test_result": {
      "type": "object",
      "properties": {
        "test_date": { "type": "string", "format": "date" },
        "test_medium": { "type": "string", "enum": ["nitrogen", "air", "gas", "water"] },
        "result": { "type": "string", "enum": ["pass", "fail"] }
      }
    },
    "safety_device_test": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "device": { "type": "string" },
          "test_result": { "type": "string", "enum": ["pass", "fail"] },
          "notes": { "type": "string" }
        }
      }
    },
    "deficiencies": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "item": { "type": "string" },
          "severity": { "type": "string", "enum": ["critical", "major", "minor"] },
          "corrective_action": { "type": "string" },
          "reinspection_date": { "type": "string", "format": "date" }
        },
        "required": ["item", "severity"]
      }
    },
    "inspection_result": {
      "type": "string",
      "enum": ["pass", "supplement_required", "fail"]
    },
    "permit_granted": { "type": "boolean" },
    "permit_granted_date": { "type": "string", "format": "date" },
    "permit_number": { "type": "string" },
    "local_government": { "type": "string" },
    "operation_start_date": { "type": "string", "format": "date" },
    "safety_manager_appointed": { "type": "boolean" },
    "next_periodic_inspection_date": { "type": "string", "format": "date" },
    "legal_basis": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 3
    },
    "e_signature": { "$ref": "../../../_shared/base/common.schema.json#/definitions/e_signature" },
    "nomenclature": { "$ref": "../../../_shared/base/common.schema.json#/definitions/nomenclature" },
    "audit_trail": { "$ref": "../../../_shared/base/common.schema.json#/definitions/audit_trail" }
  }
}
```

- [ ] **Step 4: Create `gasterm-construction-permit-overview-record.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "gasterm-construction-permit-overview-record.json",
  "title": "Gas Terminal Construction Permit Overview Record",
  "description": "건설/인허가 전체 라이프사이클 관리 기록. 3단계 KGS Code 인허가 절차 상태 추적.",
  "version": "1.0.0",
  "type": "object",
  "required": ["record_id", "facility_type", "kgs_inspection_status", "psm_applicable", "gas_type", "legal_basis", "e_signature", "nomenclature", "audit_trail"],
  "properties": {
    "record_id": { "type": "string", "pattern": "^GTRM-CPOV-[0-9]{4}-[0-9]{4}$" },
    "facility_type": {
      "type": "string",
      "enum": ["LNG_terminal", "LPG_charging", "hydrogen_charging", "city_gas_storage", "pipe_transfer"]
    },
    "kgs_inspection_status": {
      "type": "string",
      "enum": ["certified", "pending", "failed", "expired"]
    },
    "psm_applicable": {
      "type": "boolean",
      "description": "대규모 가스터미널 PSM 적용 여부"
    },
    "gas_type": {
      "type": "string",
      "enum": ["LNG", "LPG", "hydrogen", "natural_gas", "other"]
    },
    "project_id": { "type": "string" },
    "phases": {
      "type": "object",
      "properties": {
        "pre_review": {
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["not_started", "in_progress", "passed", "failed"] },
            "workflow_id": { "type": "string", "const": "pre-construction-technical-review" },
            "result_id": { "type": "string" }
          }
        },
        "mid_inspection": {
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["not_started", "in_progress", "passed", "failed"] },
            "workflow_id": { "type": "string", "const": "mid-construction-inspection" },
            "result_id": { "type": "string" },
            "depends_on": { "type": "string", "const": "pre_review" }
          }
        },
        "completion": {
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["not_started", "in_progress", "passed", "failed"] },
            "workflow_id": { "type": "string", "const": "completion-inspection" },
            "result_id": { "type": "string" },
            "depends_on": { "type": "string", "const": "mid_inspection" }
          }
        }
      }
    },
    "permit_status": {
      "type": "string",
      "enum": ["not_applied", "applied", "granted", "rejected"]
    },
    "local_government": { "type": "string" },
    "overall_status": {
      "type": "string",
      "enum": ["in_progress", "completed", "on_hold", "failed"]
    },
    "legal_basis": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 3
    },
    "e_signature": { "$ref": "../../../_shared/base/common.schema.json#/definitions/e_signature" },
    "nomenclature": { "$ref": "../../../_shared/base/common.schema.json#/definitions/nomenclature" },
    "audit_trail": { "$ref": "../../../_shared/base/common.schema.json#/definitions/audit_trail" }
  }
}
```

- [ ] **Step 5: Run audit to verify all evidence models pass**

Run: `cd .worktrees/feat/gasterm-construction-permit && bun scripts/audit.ts`
Expected: ✅ 0 errors (all required gasterm fields present, `$ref` targets exist)

- [ ] **Step 6: Commit**

```bash
cd .worktrees/feat/gasterm-construction-permit
git add evidence-models/domains/industry/gasterm/
git commit -m "feat(gasterm): add 4 evidence models for construction/permit phase"
```

---

### Task 7: Update Agent — gasterm-agent.md

**Files:**
- Modify: `agents/domains/industry/gasterm/gasterm-agent.md`

- [ ] **Step 1: Add legal basis entries to Section A**

After the existing `위험물안전관리법` line, add:

```markdown
- **고압가스 안전관리법 제22조의2** — 시설·기술·검사 상세기준 (KGS Code) 위임
- **고압가스 안전관리법 시행규칙 제7조** — 기술검토 신청 절차
- **액화석유가스의 안전관리 및 사업법 제27조의2** — 시설·기술·검사 상세기준 위임
- **액화석유가스의 안전관리 및 사업법 제45조** — 검사 기준 (공사인허가·완성검사)
- **도시가스사업법 제17조의5** — 시설·기술·검사 기준 위임
```

- [ ] **Step 2: Add construction/permit to Responsibilities (Section B)**

After "정기 설비 점검" in the Responsibilities list, add:

```markdown
- 건설/인허가 단계 관리 (사전기술검토, 중간검사, 완성검사)
```

- [ ] **Step 3: Add construction/permit to Workflow Pattern (Section C)**

After step 4 ("KGS 규제 준수 검증"), add:

```markdown
4.5. 건설/인허가 시: `construction-permit-overview`로 전체 라이프사이클 관리
     (사전기술검토 → 중간검사 → 완성검사 순차 dispatch)
```

- [ ] **Step 4: Update dispatch triggers (PM-ONLY INVOCATION)**

Replace the existing trigger line with:

```
Trigger: "가스터미널", "LNG", "LPG", "수소 충전소", "가스 저장탱크", "가스 누출", "KGS 검사", "고압가스", "공사인허가", "사전기술검토", "중간검사", "완성검사", "KGS Code", "건설허가"
```

- [ ] **Step 5: Commit**

```bash
cd .worktrees/feat/gasterm-construction-permit
git add agents/domains/industry/gasterm/gasterm-agent.md
git commit -m "feat(gasterm): update agent with construction/permit legal basis, responsibilities, triggers"
```

---

### Task 8: Update Scope Document — gasterm/scope.md

**Files:**
- Modify: `docs/domains/industry/gasterm/scope.md`

- [ ] **Step 1: Update Components table**

Change:
```markdown
| Agent | 1 (`gasterm-agent`) |
| Workflows | 8 (7 core + 1 reference) |
| Evidence Models | 7 |
| Regulations | 3 (고압가스법, LPG법, 수소법) |
```

To:
```markdown
| Agent | 1 (`gasterm-agent`) |
| Workflows | 12 (10 core + 1 reference + 1 orchestrator) |
| Evidence Models | 11 |
| Regulations | 4 (고압가스법, LPG법, 수소법, 도시가스법) |
```

- [ ] **Step 2: Add new workflows to Workflows table**

After row 8 (`major-gas-incident-reference`), add:

```markdown
| 9 | construction-permit-overview | orchestrator | 건설/인허가 전체 관리 (3단계 오케스트레이터) |
| 10 | pre-construction-technical-review | core | 사전기술검토 (KGS Code 적합성 심사) |
| 11 | mid-construction-inspection | core | 중간검사 (KGS 입회 공정검사) |
| 12 | completion-inspection | core | 완성검사 (KGS 입회 완성검사 → 허가) |
```

- [ ] **Step 3: Add KGS Code Construction section before Section 7**

Insert:

```markdown
## 7. KGS Code Construction/Permit Procedure

가스 3법에 따른 건설/인허가는 KGS Code를 실질적 심사 기준으로 삼는다.

| 단계 | 내용 | 주관 | 선행 조건 |
|------|------|------|-----------|
| 사전기술검토 | 시설기준·기술기준 적합성 심사 | KGS | — |
| 지자체 변경허가 | KGS 검토 결과 바탕 허가 | 지자체 | 사전기술검토 합격 |
| 중간검사 | 공사 진행 중 KGS 입회 검사 | KGS | 변경허가 완료 |
| 완성검사 | 전체 시설 종합 검사 | KGS | 중간검사 합격 |
| 허가증 발급 | 완성검사 합격 후 허가 | 지자체 | 완성검사 합격 |
| 운영 개시 | 정기검사 주기 설정 | 자체 | 허가증 발급 |
```

Renumber subsequent sections (old §7 → §8, old §8 → §9).

- [ ] **Step 4: Commit**

```bash
cd .worktrees/feat/gasterm-construction-permit
git add docs/domains/industry/gasterm/scope.md
git commit -m "docs(gasterm): update scope with construction/permit workflows and KGS Code procedure"
```

---

### Task 9: Update Audit Config — domain-config.ts

**Files:**
- Modify: `scripts/domain-config.ts`

- [ ] **Step 1: Add construction-phase cross-domain references**

After the existing `psm_applicable` entry in `CROSS_DOMAIN_REFS`, add:

```typescript
    { field: 'construction_permit_ref', fromDomain: 'gasterm', fromTier: 'industry', toDomain: 'ehsconst', toTier: 'industry' },
    { field: 'contractor_safety_plan_ref', fromDomain: 'gasterm', fromTier: 'industry', toDomain: 'contractor-safety', toTier: 'functional' },
```

- [ ] **Step 2: Run audit to verify**

Run: `cd .worktrees/feat/gasterm-construction-permit && bun scripts/audit.ts`
Expected: ✅ 0 errors (cross-domain refs validated — may show warnings for target domain fields if not yet added to evidence models, which is acceptable for forward references)

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat/gasterm-construction-permit
git add scripts/domain-config.ts
git commit -m "feat(audit): add gasterm construction-phase cross-domain refs to domain-config"
```

---

### Task 10: Update AGENTS.md — Specialist Agent Roster and Skills

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add construction-permit skills to Skills table**

After the `tank-integrity-validator` entry, add:

```markdown
| construction-permit-overview | gasterm-agent | Orchestrate full construction/permit lifecycle (3-phase KGS Code inspection) |
| pre-construction-technical-review | gasterm-agent | Execute KGS Code pre-construction technical review (시설·기술 기준) |
| mid-construction-inspection | gasterm-agent | Execute KGS on-site mid-construction inspection |
| completion-inspection | gasterm-agent | Execute KGS on-site completion inspection and permit issuance |
```

- [ ] **Step 2: Commit**

```bash
cd .worktrees/feat/gasterm-construction-permit
git add AGENTS.md
git commit -m "docs(agents): register 4 construction/permit skills in AGENTS.md"
```

---

### Task 11: Final Audit and Summary

- [ ] **Step 1: Run full audit**

Run: `cd .worktrees/feat/gasterm-construction-permit && bun scripts/audit.ts`
Expected: ✅ 0 errors across all files

- [ ] **Step 2: Verify file counts**

Run:
```bash
cd .worktrees/feat/gasterm-construction-permit
echo "=== New workflow directories ==="
ls -d workflows/domains/industry/gasterm/*/ | wc -l
echo "=== New evidence models ==="
ls evidence-models/domains/industry/gasterm/*.json | wc -l
echo "=== Regulation files ==="
ls regulations/KR/*.yaml | wc -l
```

Expected: 12 workflow dirs, 11 evidence models, 4 regulation files

- [ ] **Step 3: Summary commit (if any loose files remain)**

```bash
cd .worktrees/feat/gasterm-construction-permit
git add -A
git status
# Only commit if there are uncommitted changes
```
