# BENCHMARK-002 — Benchmark Stage C+D Design

> **Status**: Implemented (v10)
> **Created**: 2026-07-10
> **Implemented**: 2026-07-11
> **Supersedes**: extends TEST-001 Stage A (performance harness)
> **Depends on**: GOLDEN-001 (§2.4 golden snapshot infrastructure)

---

## Problem

GOLDEN-001(§2.4) provides regression-test snapshots for all 6 Application-layer
modules, but lacks **quantitative accuracy evaluation**. Snapshot tests verify
"same as before" but not "correct." Additionally, the existing performance
benchmark (TEST-001 Stage A) only measures lower-pipeline stages; no
Application-layer performance budgets exist.

This spec defines **Stage C** (quality benchmarks with accuracy metrics) and
**Stage D** (Application-layer performance budgets), completing the benchmark
infrastructure defined in the Production Readiness Program §2.1.

---

## Design Decisions (24 items)

### Core Architecture

**B1 — Two-Track Benchmark: Quality + Performance**

Stage C = quality benchmark (accuracy metrics), Stage D = performance benchmark
(performance budgets). Independent but sharing fixtures/infrastructure.

**B2 — Bench CLI Subcommands**

```
bench quality          # Run quality benchmarks (Stage C)
bench perf             # Run performance benchmarks (Stage D, extends TEST-001)
bench real             # Run real-DWG benchmarks
bench compare          # Compare results across runs
bench export           # Export results to JSON/CSV
bench update-gt        # Generate GT diff (never auto-overwrites golden)
```

Python `argparse` subcommand structure. `bench update-gt` generates `gt.diff`
(never directly replaces golden). `bench compare` accepts `--source artifact|db` —
v1 supports `artifact` only; `db` is an extension point (B21).

### Ground Truth

**B3 — GT Generator + Validation Chain (Approval Workflow)**

1. `gt_generator.py` computes GT from fixture graphs
2. Hand-verified golden GT stored in `gt_golden/`
3. `test_gt_generator.py` compares generated vs golden

Golden update workflow (never auto-overwrite):
1. `bench update-gt` generates `gt.diff` with Before/After/Delta format:
   ```
   net_area: 120.00 → 120.36 (+0.30%)
   wall_count: 4 → 4 (no change)
   ```
2. Change summary included
3. Human reviews diff
4. Approved → manual golden replacement

**B4 — Multi-Dimensional Metrics: Output + Structural + Diagnostic**

(a) Output Correctness — dimensional accuracy, counts
(b) Structural Correctness — containment, traceability, continuity
(c) Diagnostic Info — mismatched IDs, IoU values, angular deviations

Single pass/fail is insufficient; multi-signal + diagnostic output.

**B5 — Per-Fixture GT Directory + Metadata + Graph Schema Version**

```
tests/bench/fixtures/{fixture_name}/
    metadata.json    # fixture_version, generator_version,
                     # graph_schema_version, generated_at
    graph.json       # serialized ArchitectureGraph
    gt/              # per-module ground truth
        takeoff.json
        schedule.json
        section.json
        ceiling.json
        facade.json
        review.json
```

**B20 — Schema Versioning**

All GT, Metrics, and Baseline JSON files record `schema` name and `schema_version`
number (e.g. `{"schema": "takeoff_gt", "schema_version": 2}`). Migration functions
provided. Implementation note: migration functions should declare supported
version ranges (e.g. `supports_from=[1], supports_to=2`). Migration itself is
test-covered (e.g. `test_schema_migration.py` validates v1→v2 and rejects
unsupported versions).

### Quality Metrics — Tolerance & Scoring

**B6 — Dual Tolerance: Absolute + Relative**

```
pass if abs_error < ABS_THRESHOLD OR relative_error < REL_THRESHOLD
```

| Metric Type | ABS_THRESHOLD | REL_THRESHOLD |
|------------|--------------|----------------|
| Area       | 100.0 mm²    | 0.01           |
| Length     | 1.0 mm       | 0.01           |

**B12 — Score Pipeline: MetricEvaluator → MetricScore → ScoreAggregator**

Three-stage decomposition:
1. `MetricEvaluator` → normalizes to 0.0–1.0
2. `MetricScore` — individual metric result
3. `ScoreAggregator` — combines into module/overall scores

Default Aggregator = `WeightedMeanAggregator`. Alternatives
(`ArithmeticMean`, `GeometricMean`) are extension points.

Weight validation (3 invariants, using explicit exceptions not assert):
- Sum of weights = 1.0
- All weights >= 0
- No weight for undefined metrics

Aggregator identity recorded in benchmark results:
`{"aggregator": "weighted_mean", "aggregator_version": 1}`

**CI Gate ≠ Overall Score**: CI evaluates per-metric criticality (B22).
Overall Score is a dashboard summary, not a CI gate.

**B22 — CI Gate Criticality — Configuration Data**

Criticality is managed via YAML config file, not hardcoded:
`tests/bench/criticality_config.yaml`.

```yaml
# Per-metric criticality per module
takeoff:
  area_accuracy:
    criticality: CRITICAL
  reconciliation:
    criticality: CRITICAL
  line_count:
    criticality: MAJOR

schedule:
  row_count:
    criticality: CRITICAL
  dimensional_accuracy:
    criticality: MAJOR

ceiling:
  zone_count:
    criticality: CRITICAL
  polygon_iou:
    criticality: MAJOR

facade:
  footprint_area:
    criticality: CRITICAL
  merge_continuity:
    criticality: MAJOR

review:
  f1_score:
    criticality: CRITICAL
  recall:
    criticality: CRITICAL

# CI Gate failure count thresholds
ci_gate:
  critical:
    max_fail_count: 0      # fail_count > 0 → BLOCK
  major:
    max_fail_count: 2      # fail_count > 2 → BLOCK
  minor:
    max_fail_count: null   # null = never blocks (warn only)
```

### Per-Module Quality Gates

**B7 — Takeoff**
- (Output) Area accuracy (dual tolerance), reconciliation invariant
- (Structural) wall→room containment
- (Diagnostic) mismatched wall/room IDs

**B8 — Schedule**
- (Output) Row count reconciliation, dimensional accuracy
- (Structural) Opening→host wall traceability
- (Diagnostic) mismatched line IDs

**B9 — Ceiling**
- (Output) Zone count, height accuracy
- (Structural) Polygon IoU >= 0.99, grid spacing ±10%
- (Diagnostic) IoU values, vertex misses

**B10 — Facade**
- (Output) Footprint area, total height
- (Structural) Adjacent Normals Consistency, Merged Face Continuity
- (Diagnostic) normal angles, discontinuity positions

**B11 — Review Agent KPI — Precision + Recall + F1 + Confusion Matrix**
- F1 >= 0.90, Recall >= 0.95, Precision >= 0.90
- Confusion Matrix: expected × actual cross-tabulation

### Performance Extension

**B13 — Budget Lifecycle — 3-Stage + Full Statistics**

Stage 1: `measured × 3.0` → warn
Stage 2: `P95 × 1.5` → fail
Stage 3: fixed budget

Records: mean, median, P95, max. Gate uses P95.

**B14 — Application-Layer Performance Tiers**

6 modules × 3 tiers. Budget keys:
`takeoff_s`, `schedule_s`, `section_s`, `ceiling_s`, `facade_s`, `review_s`,
`app_layer_peak_memory_bytes`.

### Real DWG Runbook

**B15 — Real DWG Structure + Hash + DWG Revision + Generator Version**

```
tests/bench/fixtures/real_dwg/{name}/
    {name}.dwg
    metadata.json     # cad_engine, cad_version, dwg_revision (AC1032/AC1036),
                      # units, origin, coordinate_system, drawing_hash (SHA256),
                      # ground_truth_generator_version
    gt/
        takeoff.json
        schedule.json
        ...
```

Real DWG `README.md` runbook must include:
- (a) How to prepare input DWG
- (b) GT generation procedure
- (c) Benchmark execution command
- (d) Result verification method

**B16 — Real DWG GT with App-Layer Phases**
Extension of `ground_truth.py` phase 6+.

**B17 — Regression Report (Reason + Confidence + Source)**

`actions/cache` keyed on main SHA. Per-PR Regression Report artifact:
module delta + regression reason + confidence (range: 0.0–1.0) + confidence_source.

`confidence_source` is one of:
- `"rule"` — deterministic rule-based (e.g. delta exceeds threshold)
- `"heuristic"` — empirical heuristic (e.g. multi-metric pattern)
- `"model"` — ML/statistical model-based

Implementation note: the three sources may use different semantic scales for
confidence 0.0–1.0; implementation docs should clarify whether this is an absolute
scale or a relative indicator.

Future extension: PASS/WARN/FAIL summary status for dashboard (out of current
scope).

### Mutation Validation

**B19 — Mutation Validation — Explicit Contract + Drop Type**

All drop type thresholds operate on **normalized MetricScore (range: 0.0–1.0)**.

```python
@dataclass
class Mutation:
    name: str
    description: str
    fixture: str
    mutation_fn: Callable
    affected_modules: set[str]
    expected_metrics: list[str]
    expected_drop_type: Literal["absolute", "relative", "boolean_fail"]
    expected_metric_drop: dict[str, float]
```

`expected_drop_type` semantics (all on MetricScore 0.0–1.0):
- `"absolute"` — MetricScore drops by >= X points
  (e.g. `{"area_accuracy": 0.5}` means score 0.95→0.40 = FAIL)
- `"relative"` — MetricScore drops by >= X percent
  (e.g. `{"area_accuracy": 0.3}` means score 1.0→0.69 = FAIL)
- `"boolean_fail"` — metric transitions PASS→FAIL
  (`expected_metric_drop` value is ignored; only flip is verified)

### History Persistence

**B21 — Benchmark History Persistence (deferred)**

Short-term: GitHub Actions Artifact (30-day retention).
Long-term extension point: external storage (DB, Object Storage).
`bench compare --source artifact|db`: v1 supports `artifact` only;
`db` is a reserved extension point for future dashboard/trend analysis.
Implementation deferred to post-Phase 5.

---

## File Structure

```
src/cad_intelligence/pipeline/
    benchmark.py              # Stage A — B13/B14 extension
    bench_cli.py              # ✅ bench subcommands: quality, perf, real, compare, export, update-gt (B2)
    bench_quality.py          # ✅ quality engine: metrics, path resolution, CI gate (B4, B6, B7-B11, B22)
    bench_scores.py           # ✅ MetricScore + evaluators + aggregators (B12)
    gt_generator.py          # ✅ fixture → GT with schema versioning (B3, B20)
    gt_diff.py                # ✅ diff + change summary (B3)
    gt_schema_migration.py    # ✅ schema migration registry + v1→v2 migrations (B20)
    bench_real_dwg.py         # ✅ real DWG fixture validation + benchmark runner (B15)
    bench_regression.py       # ✅ scalar field regression detector (B17)
    ground_truth.py           # existing — B16 extension point

tests/
    bench/
        __init__.py
        conftest.py
        criticality_config.yaml              # B22
        test_gt_generator.py                 # ✅ B3 (37 tests)
        test_gt_diff.py                      # ✅ B3 (26 tests)
        test_quality_bench.py                # ✅ B4/B6/B7-B11/B22 (52+ tests)
        test_mutation_validation.py          # ✅ B19 (21 tests)
        test_performance_ext.py              # ✅ B13/B14 (22 tests)
        test_schema_migration.py             # ✅ B20 (22 tests)
        fixtures/
            rectangle/                       # ✅ metadata.json, graph.json, gt/*.json (6 modules)
            l_shape/                          # ✅ same structure
            corridor/                         # ✅ same structure
            shared_opening/                   # ✅ same structure
            concave/                          # ✅ same structure
            gt_golden/                        # ✅ hand-verified golden (30 JSONs across 5 fixtures)
                {fixture}/
                    takeoff.json
                    schedule.json
                    section.json
                    ceiling.json
                    facade.json
                    review.json
            real_dwg/
                README.md                    # ✅ B15: runbook template
    golden/                                  # existing GOLDEN-001 snapshots
```

## Implementation Phases

### Phase 1: GT Generator ✅ (37 tests)
- `gt_generator.py`, `gt_diff.py`, `gt_golden/` (30 JSONs), `test_gt_generator.py` (37 tests)
- Fixture `metadata.json` + `graph.json` + `gt/*.json` (5 fixtures × 6 modules, schema+version)

### Phase 2: Quality Bench Engine + CI Integration ✅ (52 tests)
- `bench_quality.py`, `bench_scores.py`, `criticality_config.yaml`
- `test_quality_bench.py` (52 tests)
- CI integration: quality bench + regression check steps in ci.yml

### Phase 3: Performance Extension ✅ (22 tests)
- `benchmark.py` extension (6 stages, lifecycle policy, APP_LAYER_BUDGETS)
- `test_performance_ext.py` (22 tests)

### Phase 4: Mutation Validation ✅ (47 tests)
- `bench_mutation.py` — `Mutation` dataclass, `MutationResult`, `MUTATION_REGISTRY` (21 mutations, B19)
- `test_mutation_validation.py` (21 tests) — refactored to use Mutation dataclass
- `test_bench_mutation.py` (26 tests) — dataclass unit tests, registry integrity

### Phase 5: CLI + Real DWG + CI Full Integration ✅
- `bench_cli.py` (6 subcommands: quality, perf, real, compare, export, update-gt)
- `bench_real_dwg.py` (fixture validation, GT validation mode)
- `bench_regression.py` (scalar field regression detection)
- `gt_schema_migration.py` + `test_schema_migration.py` (22 tests, B20)
- CI: Stage C quality bench + Stage D regression check steps in ci.yml
- Review Agent KPI: ClassificationEvaluator (precision/recall/F1, B11)
- Structural metrics: ContainmentEvaluator, SetMembershipEvaluator, NumericRangeEvaluator (B7-B10)
- `docs/designs/BENCHMARK-002-design.md`, program §2.1, CHANGELOG

### Deferred Items (post-Phase 5)
- **B21 Benchmark History Persistence**: External storage (DB/Object Storage) for trend analysis. Reserved extension point.
- **B16 Real DWG App-Layer GT**: Extension of `ground_truth.py` for phase 6+. Requires actual DWG files.

### Implemented Post-Design
- **B19 Formal Mutation Dataclass** (2026-07-10): `bench_mutation.py` — `Mutation` dataclass with `apply()` (identity guard), `verify()` (absolute/relative/boolean_fail drop types), `MutationResult` frozen record, `MUTATION_REGISTRY` with all 21 formalised mutations. `test_mutation_validation.py` refactored from ad-hoc deep-copy to registry-driven. 26 new tests (`test_bench_mutation.py`).
- **B17 Full Regression Report** (2026-07-10): `bench_regression.py` extended with B17 fields — `reason` (human-readable regression explanation), `confidence` (0.0–1.0), `confidence_source` (`"rule"` for deterministic threshold checks; `"heuristic"` and `"model"` reserved). `generate_regression_report()` produces `schema_version: 1` JSON artifact for CI caching. Threshold=0 bug fix (ZeroDivisionError on `confidence` computation). CI workflow updated: `--report` mode with artifact upload (30-day retention). 19 new tests (`test_bench_regression.py`).

**Total: ~235+ tests, 30+ GT JSONs, 5 fixture metadata/graph pairs, all COM-free.**
