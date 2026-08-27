# Gas Terminal Construction/Permit Workflow Design Spec

> **Date**: 2026-07-05
> **Status**: Approved
> **Branch**: `feat/gasterm-construction-permit`
> **Domain**: `gasterm` (Gas Terminal Safety)
> **Approach**: Hybrid (existing workflow pattern + orchestrator phase tracking)

## 1. Problem Statement

The gasterm domain currently covers 8 workflows focused on **operational phase** safety (tank inspection, leak detection, charging operations, etc.). The **construction/permit phase** — which covers KGS Code-driven pre-construction technical review, mid-construction inspection, and completion inspection — is entirely missing.

Under Korean gas law ("gas 3 laws"), KGS Code is the legally binding detailed standard for facility/technology/inspection criteria. The construction/permit process follows:

```
Pre-construction Technical Review (KGS)
  → Mid-construction Inspection (KGS on-site)
    → Completion Inspection (KGS on-site)
      → Local Government Permit Issuance
```

## 2. Scope

### Legal Coverage

| Law | Abbreviation | Key Articles |
|-----|-------------|-------------|
| 고압가스안전관리법 | HPGSCA | 제22조의2 (KGS Code delegation), 제14조 (storage tank), 제17조 (handling), 제28조 (safety manager); 시행규칙 제7조 (technical review application) |
| 액화석유가스의 안전관리 및 사업법 | LPG-SCBA | 제27조의2 (KGS Code delegation), 제45조 (inspection criteria), 제29조 (charging safety), 제30조 (storage), 제37조 (safety manager) |
| 도시가스사업법 | City Gas Act | 제17조의5 (facility/technology/inspection criteria delegation) |

### Facility Coverage

All gas types covered by existing gasterm scope:

- `LNG_terminal` — LNG import/export terminals (Incheon, Pyeongtaek, Samcheok, Tongyeong)
- `LPG_charging` — LPG charging stations (1,200+ nationwide)
- `hydrogen_charging` — Hydrogen refueling stations
- `city_gas_storage` — City gas storage facilities
- `pipe_transfer` — Pipeline transfer facilities

### Out of Scope

- PSM process safety management (handled by `psm-agent`)
- Chemical hazard data (handled by `msds-agent`)
- Emergency response execution (handled by `emergency-agent`)
- Operational-phase periodic inspections (existing 8 workflows — unchanged)

## 3. Architecture

### Approach: Hybrid

Follow existing README.md + schema.yaml pattern for 3 individual workflows. Add 1 orchestrator workflow with explicit phase tracking for the full lifecycle.

### Workflow Lifecycle

```
construction-permit-overview (orchestrator)
  |
  +-- Phase 1: pre-construction-technical-review
  |     KGS Code compliance review for facility/technology standards
  |
  +-- Phase 2: mid-construction-inspection
  |     KGS on-site mid-construction inspection (50-70% progress)
  |     depends_on: Phase 1 passed
  |
  +-- Phase 3: completion-inspection
        KGS on-site completion inspection
        depends_on: Phase 2 passed
        → Local government permit issuance
```

### File Structure

```
workflows/domains/industry/gasterm/
  construction-permit-overview/           # orchestrator (NEW)
    README.md
    schema.yaml
  pre-construction-technical-review/      # Phase 1 (NEW)
    README.md
    schema.yaml
  mid-construction-inspection/           # Phase 2 (NEW)
    README.md
    schema.yaml
  completion-inspection/                 # Phase 3 (NEW)
    README.md
    schema.yaml
```

### Files Updated

| File | Change |
|------|--------|
| `docs/domains/industry/gasterm/scope.md` | Add 4 workflows to table, update component counts |
| `agents/domains/industry/gasterm/gasterm-agent.md` | Add construction/permit legal basis, update scope |
| `regulations/KR/LPG-Safety-Business.yaml` | Add Articles 27-2, 45 |
| `regulations/KR/High-Pressure-Gas-Safety.yaml` | Add Article 22-2 |
| `regulations/KR/City-Gas-Business.yaml` | NEW — City Gas Business Act regulation file |
| `evidence-models/domains/gasterm/gasterm-pre-construction-review-record.json` | NEW |
| `evidence-models/domains/gasterm/gasterm-mid-construction-inspection-record.json` | NEW |
| `evidence-models/domains/gasterm/gasterm-completion-inspection-record.json` | NEW |
| `evidence-models/domains/gasterm/gasterm-construction-permit-overview-record.json` | NEW |

## 4. Individual Workflow Designs

### 4.1 Phase 1: `pre-construction-technical-review` (사전기술검토)

**Purpose**: Submit technical review to KGS; verify facility design complies with KGS Code standards for facility/technology criteria.

**Steps**:
1. Application preparation — facility plan, layout drawings, safety management plan, KGS Code compliance documentation
2. KGS technical review application — Form 제8호서식 (per HPGSCA Enforcement Rule Article 7)
3. Review pending — KGS technical review (typically 2-4 weeks in practice)
4. Result receipt — pass / supplement required / fail
5. Local government permit application — submit KGS review result to local government

**Legal Basis (≥3)**:
- 고압가스안전관리법 제22조의2 — 시설·기술·검사 상세기준 위임
- 고압가스안전관리법 시행규칙 제7조 — 기술검토 신청 절차
- 액화석유가스의 안전관리 및 사업법 제27조의2 — 시설·기술·검사 상세기준 위임
- 도시가스사업법 제17조의5 — 시설·기술·검사 기준 위임

**Common fields**: `facility_type`, `gas_type`, `kgs_inspection_status: pending`, `psm_applicable`

### 4.2 Phase 2: `mid-construction-inspection` (중간검사)

**Purpose**: KGS on-site mid-construction inspection to verify construction progress complies with design and KGS Code standards.

**Steps**:
1. Mid-inspection application — at 50-70% construction progress, coordinate schedule with KGS
2. Pre-inspection site verification — site condition check, document preparation
3. KGS on-site mid-inspection — verify pipe welding, civil foundations, tank installation
4. Corrective actions (if required) — address non-compliant items
5. Result recording — pass / supplement / fail, determine if next phase is eligible

**Legal Basis (≥3)**:
- 고압가스안전관리법 제22조의2 — KGS Code inspection standards
- 액화석유가스의 안전관리 및 사업법 제45조 — inspection criteria
- 도시가스사업법 제17조의5 — inspection criteria

**Phase dependency**: Requires `pre_construction_review_id` (Phase 1 pass certificate)

### 4.3 Phase 3: `completion-inspection` (완성검사)

**Purpose**: KGS on-site completion inspection after full construction; upon pass, local government issues permit and operation may begin.

**Steps**:
1. Completion inspection application — after full construction, apply to KGS
2. Pre-inspection checks — gas leak test, pressure test, electrical safety device test
3. KGS on-site completion inspection — comprehensive facility inspection
4. Corrective actions (if required) — address non-compliant items and re-inspect
5. Local government permit issuance — KGS pass result submitted to local government
6. Operation start — verify safety manager appointment, set periodic inspection schedule

**Legal Basis (≥3)**:
- 고압가스안전관리법 제22조의2 — KGS Code inspection standards
- 고압가스안전관리법 제28조 — safety manager appointment
- 액화석유가스의 안전관리 및 사업법 제45조 — inspection criteria
- 액화석유가스의 안전관리 및 사업법 제37조 — safety manager appointment

**Phase dependency**: Requires `mid_construction_inspection_id` (Phase 2 pass certificate)

### 4.4 Orchestrator: `construction-permit-overview`

**Purpose**: Manage the full construction/permit lifecycle. Sequentially dispatch individual phases and track overall status.

**Key schema fields**:

```yaml
construction_permit:
  project_id: string
  facility_type: enum (LNG_terminal / LPG_charging / hydrogen_charging / city_gas_storage / pipe_transfer)
  gas_type: enum (LNG / LPG / hydrogen / natural_gas)
  phases:
    pre_review:
      status: not_started | in_progress | passed | failed
      workflow_id: pre-construction-technical-review
      result_id: string?
    mid_inspection:
      status: not_started | in_progress | passed | failed
      workflow_id: mid-construction-inspection
      result_id: string?
      depends_on: pre_review
    completion:
      status: not_started | in_progress | passed | failed
      workflow_id: completion-inspection
      result_id: string?
      depends_on: mid_inspection
  local_government: string       # 관할 지자체
  permit_status: not_applied | applied | granted | rejected
```

**Dependency rule**: A phase with `depends_on` can only be dispatched when the referenced phase has `status: passed`.

## 5. Evidence Models

All evidence records include standard fields: `legal_basis` (≥3), `e_signature`, `audit_trail`, `nomenclature`, plus gasterm common fields (`facility_type`, `kgs_inspection_status`, `psm_applicable`, `gas_type`).

| Evidence Model | Target Workflow | Additional Key Fields |
|----------------|----------------|----------------------|
| `gasterm-pre-construction-review-record.json` | pre-construction-technical-review | `review_type`, `kgs_code_references[]`, `review_result`, `local_gov_submission_date` |
| `gasterm-mid-construction-inspection-record.json` | mid-construction-inspection | `construction_progress_pct`, `kgs_inspector`, `inspected_items[]`, `deficiencies[]` |
| `gasterm-completion-inspection-record.json` | completion-inspection | `pressure_test_result`, `leak_test_result`, `safety_device_test`, `permit_granted_date` |
| `gasterm-construction-permit-overview-record.json` | construction-permit-overview | `phases{}`, `permit_status`, `overall_status` |

## 6. Cross-Domain Interface

| Link | Description | Trigger |
|------|-------------|---------|
| gasterm → ehsconst | Construction safety (TBM, fall/collapse prevention) | Mid-inspection: verify construction safety compliance |
| gasterm → contractor-safety | Contractor safety management | Review contractor qualifications and safety plans |
| gasterm → compliance | Regulatory compliance verification | Pre-permit: verify regulatory applicability |
| gasterm → psm | PSM applicability determination | Pre-construction review: assess if facility triggers PSM |
| gasterm → tank-inspection-maintenance | Operational handoff | Completion inspection pass → set periodic inspection schedule |

## 7. Gasterm Agent Updates

### Legal Basis additions (Section A)

```markdown
- **고압가스 안전관리법 제22조의2** — 시설·기술·검사 상세기준 (KGS Code) 위임
- **고압가스 안전관리법 시행규칙 제7조** — 기술검토 신청 절차
- **액화석유가스의 안전관리 및 사업법 제27조의2** — 시설·기술·검사 상세기준 위임
- **액화석유가스의 안전관리 및 사업법 제45조** — 검사 기준
- **도시가스사업법 제17조의5** — 시설·기술·검사 기준 위임
```

### Scope update (Section B)

Add construction/permit phase to responsibilities and clarify that gasterm now covers both **construction/permit** and **operational** phases.

### Dispatch trigger additions (PM-ONLY INVOCATION)

Add: "공사인허가", "사전기술검토", "중간검사", "완성검사", "KGS Code", "건설허가"

## 8. Legal Disclaimer

> 본 시스템은 워크플로우 자동화 지원만 제공하며, 최종 판단은 자격을 갖춘 가스안전관리자 및 한국가스안전공사(KGS) 검사관의 검토가 필요합니다. 공사인허가는 지자체의 권한이며, KGS 기술검토 결과는 허가 심사의 참고 자료입니다.
