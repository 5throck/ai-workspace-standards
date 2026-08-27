# Reference Workflow Pattern Guide

> **Pattern origin**: Established 2026-06-17 per MSDS domain meeting (`memory/meeting-2026-06-17-msds-open-questions-resolution.md` Q1 resolution).
>
> **First application**: `workflows/domains/functional/msds/chemical-spill-reference/` — provides spill data and dispatches to `emergency-agent`.

---

## 1. When to Use This Pattern

The reference workflow pattern applies when:

1. **Domain A** owns critical **data** related to an event
2. **Domain B** (or shared agent) owns the **execution** of response
3. Direct duplication of the workflow in Domain A would create maintenance overhead and role confusion

### Candidate Scenarios

| Reference Workflow | Source Domain | Target Agent | Notes |
|-------------------|---------------|--------------|-------|
| `chemical-spill-reference` | MSDS | emergency-agent | First application (v1) |
| `chemical-recall-reference` | GMP | emergency-agent | Future (v2) |
| `emergency-shutdown-reference` | PSM | emergency-agent | Future (v2) |
| `confined-space-entry-reference` | EHS-Mfg | emergency-agent | Future (v2) |
| `radiation-spill-reference` | (future) | emergency-agent | Future (v3) |

---

## 2. Pattern Definition

A reference workflow:

- **Type**: `workflow_type: reference` in `schema.yaml`
- **Has**: `target_agent` field (the agent receiving the dispatch)
- **Provides**: Data package defined in `data_provided` field
- **Triggers**: Handoff protocol defined in `handoff_protocol` field
- **Does NOT**: Execute the actual response (target agent does)

### Schema Fields (extends standard workflow schema)

```yaml
schema_version: "1.0"
workflow_id: <name>-reference
title: "<Korean> (<English>)"
status: active
applicability: mandatory

# NEW fields for reference pattern
workflow_type: reference            # core | reference | deprecated
target_agent: <agent-name>          # dispatch destination
data_provided:                      # what this workflow supplies
  - <data_item_1>
  - <data_item_2>
handoff_protocol:                   # when and how to dispatch
  trigger: <event-name>
  dispatch_to: <agent-name>
  include_data:
    - <data_field_1>
    - <data_field_2>

# Standard fields
legal_basis:
  - <source_1>
  - <source_2>
industry_profile: <profile-name>
agent: <source-domain-agent>
evidence_model: <evidence-model>
```

---

## 3. Comparison: Core vs Reference Workflow

| Aspect | Core Workflow | Reference Workflow |
|--------|---------------|-------------------|
| Purpose | Execute complete process | Provide data + dispatch |
| `workflow_type` | `core` (or omitted) | `reference` |
| `target_agent` | Not required | **Required** |
| Execution | Self-contained | Delegates to target_agent |
| `legal_basis` requirement | Full (per domain standard) | Reduced (≥2 typically) |
| Audit treatment | Full validation | Exception for legal_basis strictness |

---

## 4. Audit Script Handling

`safety-audit.ts` v2.3.0+ applies reduced `legal_basis` requirement for reference workflows:

```typescript
const requiredMin = isReference ? 2 : 3;  // MSDS example
```

This is because the reference workflow inherits regulatory authority from its `target_agent`'s domain. The target agent is responsible for compliance with the response action's regulations.

---

## 5. Implementation Example

### `workflows/domains/functional/msds/chemical-spill-reference/schema.yaml`

```yaml
schema_version: "1.0"
workflow_id: chemical-spill-reference
title: "화학물질 누출 참조 (데이터 제공)"
status: active
applicability: mandatory
workflow_type: reference
target_agent: emergency-agent
data_provided:
  - msds_section_6_accidental_release_measures
  - recommended_ppe
  - reporting_authorities
handoff_protocol:
  trigger: chemical_spill_event
  dispatch_to: emergency-agent
  include_data:
    - msds_section_6
    - ghs_classification
legal_basis:
  - OSHA-KR Article 110
  - 위험물안전관리법
industry_profile: chemical-handling
agent: msds-agent
evidence_model: msds-record.json
```

### README.md Structure

Reference workflow READMEs should explicitly state:

```markdown
# [Workflow Name] Reference Workflow

> **WORKFLOW TYPE**: `reference` — This workflow provides data and dispatches to
> `target-agent` for execution. [Source domain] does NOT perform [activity] directly.

## 1. Objective
[What data is provided, what is dispatched]

## 2. Applicability
[When this workflow triggers]

## 3. Reference Workflow Pattern
[Reference this guide]

## 4. Workflow Steps
### Step 1: Trigger Detection
### Step 2: Data Assembly
### Step 3: Handoff to target-agent
### Step 4: Post-Incident Documentation

## 5. Data Provided (Reference Interface)
[Structured list of data items]

## 6. Boundary with target-agent
[Role separation matrix]

## 7. Legal Disclaimer
```

---

## 6. Benefits

1. **Single source of truth**: Data stays in owning domain, no duplication
2. **Clear role boundaries**: No ambiguity about which agent does what
3. **Maintainability**: Data format changes occur in one place
4. **Extensibility**: Pattern reusable for future domain additions
5. **Audit clarity**: Reference workflows explicitly marked, easier compliance review

---

## 7. Anti-Patterns to Avoid

### ❌ Don't: Create shadow execution
A reference workflow should NOT include execution steps. If you're tempted to add "Step 4: Contain the spill" — that belongs in the target agent's workflow.

### ❌ Don't: Duplicate data
Don't copy data from source domain into target agent's records. Target agent references source via evidence_model ID.

### ❌ Don't: Skip handoff protocol
Without explicit `handoff_protocol`, the reference becomes orphaned. Always specify trigger and dispatch instructions.

### ❌ Don't: Use for simple data lookup
If a workflow just looks up data without dispatching, it's not a reference workflow — it's a utility skill. Reference workflows always involve a handoff.

---

## 8. Domain Onboarding Integration

When adding a new domain, consider if any reference workflows are needed:

- Does this domain own data that another domain/agent needs during events?
- Should this domain dispatch to `emergency-agent` for any scenarios?
- Are there cross-domain workflows where role separation would clarify?

Document any reference workflows in the domain's `docs/domains/<name>/scope.md`.

---

## 9. Future Pattern Extensions

Potential variations for future needs:

| Pattern Variant | Use Case |
|-----------------|----------|
| `workflow_type: notification` | One-way notification (no dispatch) |
| `workflow_type: escalation` | Upward escalation (e.g., to PM/CSO) |
| `workflow_type: aggregation` | Collects data from multiple domains |

These are not implemented in v1. Add as needed.
