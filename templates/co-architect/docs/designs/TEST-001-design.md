# TEST-001: Verification Strategy

> **Spec ID**: TEST-001
> **Version**: 1.1
> **Status**: Implemented — 1857+ tests passing
> **Created**: 2026-07-05
> **Updated**: 2026-07-09 — §1.5 (Performance Benchmarks) and §2.3 (CI Gate Rules) are now backed by real code (Stage A of the Benchmark & Golden Dataset program area, see `docs/firm-governance/production-readiness-program.md` §2.1); previously narrative/design-only. Updated 2026-07-08 — test count corrected from "200+" to actual current count (1857+ passing, per CI/CHANGELOG)
> **Authors**: architect
> **Source**: V3 completion — authoritative verification strategy
> **Related**: [`PIPELINE-001`](PIPELINE-001-design.md) (Flow), [`GRAPH-001`](GRAPH-001-design.md) (Data Model), [`API-001`](API-001-design.md) (Interface), [`TRANSACTION-001`](TRANSACTION-001-design.md) (Transactions), [`ADR-009`](../adr/ADR-009-pipeline-execution-framework.md) (Ground Truth)

---

## Scope

This document defines the **verification strategy** for the CAD Intelligence codebase — test categories, infrastructure, performance benchmarks, memory budgets, and CI gate rules.

---

## 1. Test Categories

### 1.1 Unit Tests

Target individual functions and classes in isolation. No ZWCAD/COM dependency.

| Area | Module | Key Concerns |
|------|--------|-------------|
| Geometry | `space_geometry.py` | Polygonize, weld, bridge, dedup, validate |
| Axis Grid | `axis_grid.py` | Extract, reconcile (drift/split/merge), snap |
| Semantic | `opening_assignment.py` | Confidence scoring, wall assignment, face labels |
| Pattern Engine | `patterns/registry.py` | Pattern registration, matching, inference |
| Pipeline | `pipeline/artifacts.py`, `pipeline/run.py` | Serialization, stable_hash, phase contracts |
| Graph | `graph/evidence.py`, `graph/query_service.py` | RecognitionStore, query methods |
| Application Spec | `application/__init__.py` | SupportsApplicationSpec protocol, validate() |

**Run command**: `python -m pytest tests/ -x -q`

**Convention**:
- One `unittest.TestCase` per concern
- Inline dataclass fixtures (no external file dependencies)
- COM-free — all geometry/semantic tests must pass without ZWCAD

### 1.2 Integration Tests

Test cross-phase data flow and handler chains.

| Chain | Phases | What It Tests |
|-------|--------|---------------|
| Drawing → Geometry | Phase 1 → 2 | `analyze_layers` → `generate_spaces` produces valid polygons |
| Geometry → Semantic | Phase 2 → 3 | `build_feature_store` → `build_object_candidates` produces candidates |
| Full Pipeline | Phase 1 → 5 | End-to-end DWG → DrawingModel → output |

**Convention**:
- Integration tests may require a mock COM layer or recorded COM responses
- Marked with `@pytest.mark.integration` for CI filtering

### 1.3 Golden DWG Tests

Known DWG input → known JSON output regression tests.

**Infrastructure**:
- Test DWG files stored in `tests/test_data/` (e.g., `test_apt.dwg`)
- Expected output stored alongside (e.g., `test_apt.ground_truth.json`)
- Pipeline runs on test DWG → output compared to expected JSON
- Any diff in canonical JSON triggers test failure

**Minimum**: 2 reference DWG drawings (one simple, one complex)

### 1.4 Mutation / Failure Injection Tests

Deliberately inject defects to verify robustness.

| Injection | Target | Expected Behavior |
|-----------|--------|-------------------|
| Missing wall | `generate_spaces` | UNCLOSED_WALLS exception |
| Broken polygon | `polygonize_network` | Graceful handling, no crash |
| Duplicate door | `assign_openings` | Both assigned or one flagged |
| Invalid layer | `analyze_layers` | Layer ignored, no crash |
| Empty room | `generate_spaces` | Filtered by MIN_SPACE_AREA |
| Corrupt FeatureStore | `build_object_candidates` | Partial results with warnings |
| Zero-width opening | `find_opening_candidates` | Filtered or flagged |
| Negative coordinates | `extract_axis_grid` | Correct handling (no crash) |
| Extremely large coordinates | `polygonize_network` | Bounded processing, no infinite loop |

### 1.5 Performance Benchmarks

> **Implemented (Stage A, 2026-07-09)**: this subsection is now backed by real code — `src/cad_intelligence/pipeline/benchmark.py` (harness), `scripts/run-benchmark.ts` (CI entrypoint), `tests/test_data/benchmark-baseline.json` (Reference Baseline artifact). The gate-threshold logic described below lives in `benchmark.py`'s `evaluate_budgets()`.

Baseline targets for reference DWGs, measured under controlled conditions.

#### Benchmark Targets

| Benchmark | DWG Size | Entities | Performance Target | Memory Budget |
|-----------|----------|----------|--------------------| --------------|
| Small | 100 KB | ~500 | polygonize < 1s, feature store < 2s, graph build < 1s | Peak < 100 MB |
| Medium | 1 MB | ~5,000 | polygonize < 10s, feature store < 15s, graph build < 5s | Peak < 500 MB |
| Large | 10 MB | ~50,000 | polygonize < 60s, feature store < 90s, graph build < 30s | Peak < 2 GB |
| Pattern matching | — | — | < 0.1s per candidate, < 5s for 100 candidates | — |

#### Memory Measurement

- Measured via `tracemalloc` peak memory
- CI gate: **fail if peak exceeds budget by > 10%**
- Regression tracking: benchmark results stored in CI artifacts for trend analysis

```python
import tracemalloc

def benchmark_memory(func, *args):
    tracemalloc.start()
    result = func(*args)
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    return result, peak  # peak in bytes
```

### 1.6 Ground Truth Evaluation

Per-phase evaluation against known-good reference data (ADR-009 §5).

| Metric | Threshold |
|--------|-----------|
| Wall Recall | ≥ 98% |
| Door Recall | ≥ 94% |
| Window Recall | ≥ 91% |
| Room Recall | ≥ 97% |
| Pattern Precision | ≥ 96% |

**Structural check**: zero actual entities against non-zero expected always fails.

---

## 2. Test Infrastructure

### 2.1 Fixtures Directory

```
tests/
  test_data/
    test_apt.dwg              # Reference drawing (apartment)
    test_apt.ground_truth.json # Expected pipeline output
    minimal.ground_truth.json  # Minimal test fixture
```

### 2.2 Conftest Patterns

```python
# tests/conftest.py
@pytest.fixture
def sample_wall_segment():
    return WallSegment(...)

@pytest.fixture
def sample_axis_grid():
    return AxisGrid(...)
```

### 2.3 CI Gate Rules

> **Implemented (Stage A, 2026-07-09)**: the "Memory budget" and "Performance regression" rows below are enforced by `src/cad_intelligence/pipeline/benchmark.py`'s `evaluate_budgets()` (memory = hard fail at `BUDGET_TOLERANCE` = ×1.1; timing = non-blocking warn at `TIMING_WARN_TOLERANCE` = ×1.5), wired into CI via `scripts/run-benchmark.ts` and `.github/workflows/ci.yml`.

| Rule | Threshold | Action |
|------|-----------|--------|
| Test pass rate | 100% (excluding known flaky) | Block merge |
| Coverage (unit) | ≥ 80% | Warn |
| Mutation pass rate | ≥ 90% | Warn |
| Memory budget | < budget × 1.1 | Fail |
| Performance regression | < target × 1.5 | Warn (trend) |
| Known flaky tests | Whitelisted in `pyproject.toml` | Skip in CI gate calculation |

### 2.4 Known Flaky Tests

Currently whitelisted:
- `test_m5_production.py::TestConnectionCache::test_cache_hit_skips_check` — detects ZWCAD running on the CI host

---

## 3. Current Test Coverage

### 3.1 Test Files

| File | Tests | Area |
|------|-------|------|
| `test_axis_grid.py` | 21 | Axis extraction, reconciliation, snapping |
| `test_opening_assignment.py` | 12 | Confidence scoring, wall assignment |
| `test_space_geometry.py` | ~50 | Polygonize, weld, bridge, classify |
| `test_pipeline_serialization.py` | 18 | Artifact contracts |
| `test_backward_compatibility.py` | 11 | Schema migration |
| `test_phase_registry.py` | 12 | Phase plugin system |
| `test_artifact_contracts.py` | 19 | Pipeline artifact contracts |
| `test_recognition_evidence.py` | 22 | RecognitionStore, evidence chain |
| `test_pattern_registry.py` | 10 | Pattern DSL registration |
| `test_graph_query_service.py` | 24 | Graph query API |
| `test_application_spec.py` | 13 | ApplicationSpec protocol |
| `test_ground_truth.py` | 42 | Ground truth evaluation |
| `test_regression.py` | 18 | Regression baseline |
| `test_m5_production.py` | ~8 | Integration / production tests |

**Total**: ~280 tests (as of V3)

---

## 4. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D70 | COM-free unit tests | Tests must pass without ZWCAD — enables CI on any machine |
| D71 | Inline fixtures over external files | Simplicity; no file-path fragility |
| D72 | Memory budget via tracemalloc | Built-in stdlib; no external dependency |
| D73 | 10% budget tolerance for memory | Accounts for measurement noise |
| D74 | Golden DWG regression | Catches unintended changes in pipeline output |

---

## Document Dependencies

```
PIPELINE-001
      ↓
GRAPH-001
      ↓
API-001
      ↓
TRANSACTION-001
      ↓
TEST-001 (this doc)  ← Tests reference all upstream docs
      ↓
REVIEW-AGENT-001
```
