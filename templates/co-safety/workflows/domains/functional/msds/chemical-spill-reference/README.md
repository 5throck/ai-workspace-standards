# 화학물질 누출 참조 (Chemical Spill Reference) Workflow

> **WORKFLOW TYPE**: `reference` — This workflow provides data and dispatches to `emergency-agent` for execution. MSDS domain does NOT perform spill response directly.

## 1. Objective
Provide MSDS Section 6 (Accidental Release Measures) data and dispatch trigger to `emergency-agent` when chemical spill events occur, per OSHA-KR Article 110 and 위험물안전관리법.

## 2. Applicability
Triggered when a chemical spill event is detected or reported at any site under the `chemical-handling` profile.

## 3. Reference Workflow Pattern

This workflow implements the **reference workflow pattern** (per `docs/_shared/reference-workflow-pattern.md`):
- **Data provider role**: MSDS domain supplies substance-specific data
- **Execution delegation**: Actual spill response is `emergency-agent`'s domain
- **Handoff interface**: Structured data transfer with trigger conditions

## 4. Workflow Steps

### Step 1: Spill Event Trigger
- Receive trigger: chemical ID, location, estimated quantity, environmental conditions.
- Identify affected substance via CAS number or product code.

### Step 2: Section 6 Data Extraction
- Pull MSDS Section 6 (Accidental Release Measures) from `msds-record.json`:
  - Personal precautions (PPE for responders)
  - Environmental precautions (containment, runoff prevention)
  - Cleanup methods (absorption materials, neutralization)
  - Storage of recovered material

### Step 3: Additional Data Assembly
- **GHS classification**: from `ghs-classification-record.json` (acute toxicity, flammability, reactivity)
- **Recommended PPE**: from MSDS Section 8
- **Reporting authorities**: determine if quantity exceeds thresholds for:
  - 소방서 (Fire Department) — 위험물안전관리법
  - 환경청 (Regional Environment Office) — K-REACH 오염 방지
  - 고용노동관서 (MOEL Regional Office) — worker injury reporting
  - 지자체 (Local Government) — environment pollution

### Step 4: Handoff to emergency-agent
- Dispatch trigger to `emergency-agent` with structured data package:
  ```json
  {
    "trigger": "chemical_spill_event",
    "substance_data": {
      "msds_section_6": "...",
      "ghs_classification": "...",
      "recommended_ppe": "..."
    },
    "reporting_requirements": [...],
    "dispatch_timestamp": "ISO-8601"
  }
  ```

### Step 5: Post-Incident Documentation
- After emergency-agent completes response, receive outcome summary.
- Update inventory records (waste disposal, recovered material).
- Trigger incident-investigation workflow for root cause analysis.

## 5. Data Provided (Reference Interface)

| Data Item | Source | Required |
|-----------|--------|----------|
| MSDS Section 6 (accidental release) | `msds-record.json` | ✓ |
| GHS classification | `ghs-classification-record.json` | ✓ |
| Recommended PPE | `msds-record.json` Section 8 | ✓ |
| Reporting authorities | Computed from substance + quantity | ✓ |
| Evacuation radius | MSDS Section 6 + substance properties | Optional |

## 6. Boundary with emergency-agent

| Activity | MSDS Domain | emergency-agent |
|----------|-------------|-----------------|
| Section 6 data provision | ✓ | — |
| PPE recommendation data | ✓ | — |
| Spill containment execution | — | ✓ |
| Worker evacuation execution | — | ✓ |
| Regulatory body notification | — | ✓ |
| Cleanup operation | — | ✓ |
| Post-incident report | Reference data | ✓ Owns |

## 7. Legal Disclaimer
> Reference workflow assistance only. Actual spill response requires qualified emergency responders and emergency-agent's execution protocols.
