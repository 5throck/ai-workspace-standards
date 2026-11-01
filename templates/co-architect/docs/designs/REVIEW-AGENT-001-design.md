---
lang: ko
lang_reason: proper-noun
---

# REVIEW-AGENT-001: Review Agent Framework

> **Spec ID**: REVIEW-AGENT-001
> **Version**: 1.1
> **Status**: Implemented (Stage C2 — Builder/Policy/LLM/Aggregator/Orchestrator, `src/cad_intelligence/review_agent/`)
> **Created**: 2026-07-05
> **Updated**: 2026-07-09 — Stage C2 full implementation landed; `zwcad_review_drawing` MCP tool registered (`cad_io/handlers/review.py`).
> **Authors**: architect
> **Pattern**: Rule 3
> **Rationale**: rule-engine + LLM-driven policy decisions over Graph data (Graph → Rule Engine → LLM → Merge → Report) — see ADR-007 §13.3
> **Source**: V3 completion — review framework for drawing quality assurance
> **Related**: [`PIPELINE-001`](PIPELINE-001-design.md) (Flow), [`GRAPH-001`](GRAPH-001-design.md) (Data Model), [`API-001`](API-001-design.md) (Interface), [`TEST-001`](TEST-001-design.md) (Verification), [`ADR-007`](../adr/ADR-007-appspec-rendering-architecture.md) §13.3 (Rule 3 — Composite Orchestrator)

---

## Scope

This document defines the **review agent framework** — a structured approach to detecting issues in generated drawings and providing actionable feedback. The framework is designed to work within the PM dispatch flow defined in AGENTS.md.

---

## 1. Execution Framework

The review agent operates within the execution pipeline:

```
Planner → PM → Executor → Reviewer
                              │
                              ▼
                    ReviewReport
                    ├── CRITICAL → immediate fix, block pipeline
                    ├── HIGH     → review before proceeding
                    ├── MEDIUM   → review, warn
                    ├── LOW      → log only
                    └── INFO     → silent log
```

### 1.1 Role in PM Dispatch

Per AGENTS.md, the PM is the single point of entry. The review agent is dispatched by PM after execution phases complete:

```
User Request → PM Triage → Workflow → Execute → PM dispatches Reviewer → ReviewReport → PM decides
```

The review agent does **not** modify the DWG — it only produces a `ReviewReport` with findings. Modification is the PM's responsibility based on severity policy.

---

## 2. Review Categories

### 2.1 Omissions

Missing elements that should be present.

| Check | Severity | Example |
|-------|----------|---------|
| Missing dimensions | HIGH | Wall has no length annotation |
| Incomplete walls | CRITICAL | Wall ends in mid-air (no closure) |
| Unlabeled rooms | MEDIUM | Room polygon exists but has no name |
| Missing openings | HIGH | Wall has a gap but no door/window assigned |
| Missing axis labels | LOW | Axis exists but no grid label |

### 2.2 Conflicts

Contradictory information in the drawing.

| Check | Severity | Example |
|-------|----------|---------|
| Overlapping geometry | HIGH | Two rooms share interior area |
| Dimension contradictions | HIGH | Wall dimension doesn't match actual length |
| Duplicate entities | MEDIUM | Two walls at the same position |
| Confident misclassification | MEDIUM | Node classified as door but confidence < threshold |

### 2.3 Inconsistencies

Violations of conventions, standards, or internal consistency.

| Check | Severity | Example |
|-------|----------|---------|
| Layer violations | MEDIUM | Entity on wrong layer per layer standard |
| Annotation errors | LOW | Text annotation misspelling or wrong value |
| Confidence below threshold | MEDIUM | Opening assignment confidence < 0.6 |
| Topology errors | CRITICAL | Room polygon self-intersects |

---

## 3. ReviewIssue Data Model

```python
@dataclass(frozen=True)
class ReviewIssue:
    severity: str           # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
    category: str           # "omission" | "conflict" | "inconsistency"
    description: str        # Human-readable issue description
    evidence: list[str]     # Graph node UIDs / entity handles involved
    confidence: float       # 0.0–1.0 — how certain we are about this issue
    suggested_fix: str | None  # Recommended remediation
    location: str | None   # DWG coordinate / entity handle reference
```

### 3.1 Issue Components

| Component | Purpose |
|-----------|---------|
| `severity` | Enables PM severity-based routing policy |
| `category` | Groups related issues for reporting |
| `description` | Human-readable explanation |
| `evidence` | Machine-readable references for automated repair |
| `confidence` | Helps PM prioritize uncertain vs certain issues |
| `suggested_fix` | Enables future Auto Repair Agent (M5+) |
| `location` | DWG coordinate for visual highlighting in Web UI |

---

## 4. Issue Severity Levels

| Severity | Description | PM Action | Examples |
|----------|-------------|-----------|----------|
| **CRITICAL** | Data loss risk, structural integrity failure | Immediate fix, block pipeline | Wall break, room self-intersection, zero rooms detected |
| **HIGH** | Missing required element, significant deviation | Review before proceeding, block if unacknowledged | Missing door, dimension mismatch, overlapping rooms |
| **MEDIUM** | Annotation error, minor quality gap | Review, warn | Layer violation, confidence below threshold, duplicate entity |
| **LOW** | Cosmetic, formatting | Log only | Misspelled label, minor layer mismatch |
| **INFO** | Observation, suggestion | Silent log | Optimization suggestion, style note |

---

## 5. PM Severity Policy

The PM agent's handling of review issues is configurable:

```python
SEVERITY_POLICY = {
    "CRITICAL": {"action": "block", "auto_fix": True},
    "HIGH":     {"action": "block", "auto_fix": False},
    "MEDIUM":   {"action": "warn", "auto_fix": False},
    "LOW":      {"action": "log",  "auto_fix": False},
    "INFO":     {"action": "silent_log", "auto_fix": False},
}
```

| Severity | Block Pipeline? | Auto-Fix? | Require Acknowledgment? |
|----------|----------------|-----------|------------------------|
| CRITICAL | Yes | Yes (if fix available) | Yes |
| HIGH | Yes | No | Yes |
| MEDIUM | No | No | Yes |
| LOW | No | No | No |
| INFO | No | No | No |

---

## 6. Rule-Based vs LLM Review

### 6.1 Rule-Based Checks (Deterministic)

Run first — fast, reproducible, no hallucination risk.

| Check | Implementation | Source |
|-------|---------------|--------|
| Topology validation | `polygon.is_valid`, no self-intersection | shapely |
| Dimension match | `abs(dim_value - actual_length) < tolerance` | GeometryModel |
| Layer compliance | Entity layer ∈ expected layer set | Layer standard |
| Confidence threshold | `node.confidence < CONFIDENCE_ACCEPT_THRESHOLD` | SemanticModel |
| Object count | Expected count range vs actual count | Ground truth |
| Wall closure | No UNCLOSED_WALLS exceptions | space_geometry |

### 6.2 LLM Checks (Ambiguous Cases)

Run second — for cases where deterministic rules are insufficient.

| Check | Why LLM | Confidence |
|-------|---------|------------|
| Room naming accuracy | "거실" vs "Living Room" vs "거실 (Living Room)" | Context-dependent |
| Wall type classification | Structural vs partition (no explicit layer signal) | Requires judgment |
| Annotation language | Korean vs English vs mixed | Context-dependent |
| Opening type inference | Swing vs sliding (no explicit marker) | Requires geometry context |

### 6.3 Execution Order

```
Rule-based checks (all)
  → Collect issues
  → Filter: skip LLM check if rule-based already found CRITICAL/HIGH
LLM checks (filtered subset)
  → Collect issues
  → Merge with rule-based issues
  → Deduplicate (same evidence → keep highest severity)
```

---

## 7. ReviewReport

```python
@dataclass(frozen=True)
class ReviewReport:
    drawing_path: str
    timestamp: str
    total_issues: int
    issues_by_severity: dict[str, int]  # {"CRITICAL": 1, "HIGH": 3, ...}
    issues: list[ReviewIssue]
    pass_fail: bool  # True if no CRITICAL or HIGH issues
```

---

## 8. MCP Tool

```
zwcad_review_drawing
  Input:
    - drawing_path: str (optional — uses active document if omitted)
    - checks: list[str] (optional — default: all rule-based checks)
    - include_llm: bool (default: false)
    - severity_min: str (default: "INFO")
  Output:
    - status: "success"
    - report: ReviewReport (as dict)
```

---

## 9. Integration with Future Auto Repair

The `suggested_fix` field in `ReviewIssue` enables a future **Auto Repair Agent**:

```
ReviewReport
  → PM filters by severity
  → For CRITICAL/HIGH with suggested_fix:
      → Auto Repair Agent attempts fix
      → Re-review to verify fix
      → PM approves or escalates
```

This is deferred to M5+ but the data model is designed to support it.

---

## 10. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D75 | Reviewer produces report, not modifications | Separation of concerns — review is orthogonal to repair |
| D76 | 5-level severity (CRITICAL–INFO) | Granular enough for PM routing policy without overwhelming |
| D77 | Rule-based before LLM | Determinism first, LLM only for ambiguous cases |
| D78 | suggested_fix in data model | Future Auto Repair Agent can act on it without re-analysis |
| D79 | PM controls action via severity policy | Configurable without changing review logic |

---

## Document Dependencies

```
PIPELINE-001
      ↓
GRAPH-001           ← Review checks query graph nodes/edges
      ↓
API-001
      ↓
TRANSACTION-001
      ↓
TEST-001
      ↓
REVIEW-AGENT-001    ← Review rules check against graph + API contracts
(this doc)
      ↓
SPACE-001           ← Space validation uses review framework
```
