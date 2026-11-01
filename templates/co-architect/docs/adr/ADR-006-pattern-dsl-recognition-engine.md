---
lang: ko
lang_reason: source-material
---

# ADR-006: Pattern DSL & Recognition Engine

> **Spec ID**: ADR-006
> **Version**: 1.0 (design)
> **Status**: Design approved
> **Created**: 2026-07-05
> **Authors**: architect
> **Source**: Extracted from ADR-004 §3–5 (Object Candidate Layer, Pattern Library, Semantic Objects). User-approved ADR split: "ADR-004에 더 많은 기능을 넣기보다 역할을 분리하는 것을 권합니다."
> **Supersedes**: ADR-004 §3 (Object Candidate Layer), ADR-004 §4 (Pattern Library), ADR-004 §5 (Semantic Object Architecture)
> **Related**: [`ADR-004`](ADR-004-cad-intelligence-pipeline-design.md) (Pipeline — Phase 2/3/4 connect to this ADR), [`ADR-005`](ADR-005-architecture-graph-schema.md) (Graph Schema — receives SemanticObjects from this pipeline), [`ADR-007`](ADR-007-appspec-rendering-architecture.md) (ApplicationSpec — downstream consumer), [`AXIS-001-design.md`](../designs/AXIS-001-design.md) (existing opening candidate/assignment pipeline reused in Parameter Extraction)

---

## 1. Overview

The Recognition Engine transforms raw geometry (GeometryModel from Phase 2) into typed Semantic Objects that populate the ArchitectureGraph (Phase 4). The pipeline within this phase is:

```
Object Candidate Layer → Pattern Engine → Inference Engine → Semantic Objects
```

**Key separation of concerns:**
- **Pattern Engine** *scores* candidates against pattern definitions — it produces ranked match results, but does not make final classification decisions.
- **Inference Engine** *decides* the final classification — it resolves conflicts, applies specificity ordering, and defers ambiguous cases to AI.

This ADR also defines the **Relationship Rules DSL** — declarative YAML rules that define which edges exist between node types in the ArchitectureGraph.

**Architecture Principles Applied**:

| # | Principle | Implementation |
|---|-----------|----------------|
| AP3 | Pattern scores; Inference decides | §4–5 — PatternEngine produces scores, InferenceEngine resolves conflicts |
| AP4 | Relationship rules as declarative DSL | §6 — YAML-based edge rules, zero code changes for new types |

---

## 2. Object Candidate Layer

### Purpose

Bridge between Feature Extraction (Phase 2) and Pattern Library. Groups connected components into plausible object candidates **before any classification**.

### Data Structure

```python
@dataclass
class ObjectCandidate:
    candidate_id: str          # persistent — becomes Object ID upon pattern match
    component_id: str          # source Connected Component
    candidate_type: str        # "opening" | "structural" | "vertical" | "furniture" | "mep" | "unknown"
    component_features: ComponentFeatures  # reference to computed features
    suggested_patterns: list[tuple[str, float]]  # ranked (pattern_name, confidence) to try
```

### Candidate Type Classification Logic

| Signal | candidate_type | Rationale |
|--------|---------------|-----------|
| Wall contact + arc present | `opening` (Door candidate) | Arc = swing indicator on wall |
| Wall contact + parallel frames | `opening` (Window candidate) | Frames = window glazing bars |
| Wall contact + gap detected | `opening` (generic) | Gap in wall network = potential opening |
| High double_line_pair ratio | `structural` (Wall candidate) | Double lines = wall thickness |
| Small closed loops, no wall contact | `furniture` | Furniture forms small polygons |
| Circle, no wall contact | `structural` (Column candidate) | Column plan view = circle/square |
| Very short segments, low connectivity | `mep` | Electrical/plumbing = short, disconnected |

### Why Candidates Matter

Door can be expressed as Arc + 2 Lines, or Block, or Polyline + Exploded Block + Arc. All are Connected Components, but not all are patterns yet.

```
Component                    Object Candidate              Semantic Object
─────────────────           ──────────────────            ──────────────
Arc + 2 Lines        →       candidate:0045        →       Door:0056
Block "D900"         →       candidate:0046        →       Door:0057
Parallel Frames      →       candidate:0051        →       Window:0078
```

Pattern is **one way to interpret** an Object Candidate — not the only way. This separation keeps Pattern Library as a classifier, not a creator.

---

## 3. Pattern DSL (YAML)

### Why DSL instead of Python Code

Patterns are data, not logic. Adding Sliding Door, Curtain Wall, Elevator, or any future object type must be possible without code changes. Patterns are defined in YAML, loaded at runtime, evaluated by a shared engine.

### Pattern Definition Format

```yaml
# patterns/opening/door.yaml
pattern: door
category: opening
required:
  - host_wall
  - opening          # gap in wall
optional:
  - arc              # swing indicator
  - swing_line       # swing direction line
constraints:
  width:
    min: 700
    max: 1200
  arc_angle:
    min: 80
    max: 100
  wall_contact: true
```

```yaml
# patterns/opening/window.yaml
pattern: window
category: opening
required:
  - host_wall
  - opening
  - frame            # parallel frame lines
optional:
  - center_line      # mullion center line
  - glass            # glass indicator lines
constraints:
  width:
    min: 500
    max: 3000
  double_frame: optional
```

```yaml
# patterns/opening/sliding_door.yaml
pattern: sliding_door
category: opening
required:
  - host_wall
  - opening
constraints:
  width:
    min: 1400
    max: 3600
  arc_angle:
    max: 10          # no arc = sliding
  wall_contact: true
```

### Pattern Category Tree

```
PatternLibrary
 │
 ├── Opening
 │    ├── Door
 │    ├── DoubleDoor
 │    ├── SlidingDoor
 │    ├── FoldingDoor
 │    └── Window
 │
 ├── Structural
 │    ├── Wall
 │    ├── Column
 │    ├── Beam
 │    └── Slab
 │
 ├── Vertical
 │    ├── Stair
 │    ├── Elevator
 │    └── Ramp
 │
 ├── Furniture
 │
 └── MEP
```

This hierarchy extends directly to BIM/IFC — the same object taxonomy is used throughout.

### Extensibility

Adding a new object type = add a YAML file in the appropriate category directory. No Python code changes, no new classes, no PatternEngine modification. The engine evaluates constraints declaratively.

---

## 4. Pattern Engine

### Interface

```python
class PatternEngine:
    def evaluate(self, candidate: ObjectCandidate, pattern: PatternDef) -> PatternMatch | None:
        """Score a candidate against a single pattern. Returns None if constraints not met."""

    def match_best(self, candidate: ObjectCandidate) -> PatternMatch | None:
        """Try all applicable patterns, return highest-scoring match."""

    def match_all(self, candidate: ObjectCandidate) -> list[PatternMatch]:
        """Return all pattern matches above minimum threshold (for diagnostics)."""
```

### Scoring Algorithm

Weighted feature scoring where each feature contributes proportionally to the final confidence:

```
confidence = Σ(feature_score_i × feature_weight_i) / Σ(feature_weight_i)
```

Each `PatternMatch` contains:
- `pattern_name`: matched pattern name
- `category`: opening / structural / vertical / furniture / mep
- `confidence`: 0.0–1.0 overall score
- `per_feature_scores`: dict of individual feature contributions
- `matched_constraints`: list of satisfied constraints
- `missing_constraints`: list of unsatisfied optional constraints

### Pattern Engine Responsibility Boundary

The Pattern Engine **scores** candidates. It does NOT:
- Make the final classification decision (that's Inference Engine)
- Mutate the ArchitectureGraph
- Handle ambiguous cases or AI deferral

---

## 5. Inference Engine

### Responsibility

The Inference Engine takes Pattern Engine scores and makes the **final classification decision**. It resolves multi-pattern conflicts using:

1. **Confidence threshold**: Scores below minimum → reject
2. **Score gap**: If top-2 scores have a gap > threshold → accept top score
3. **Specificity ordering**: More specific patterns win ties (door > opening)
4. **Ambiguous → AI deferral**: If neither gap nor specificity resolves → flag for AI review

### Resolution States

| State | Condition | Action |
|-------|-----------|--------|
| `confident` | Score > 0.85 | Auto-accept, create SemanticObject |
| `resolved` | Score gap > 0.3 | Accept top score |
| `ambiguous` | Gap < 0.3, no specificity win | Defer to AI |
| `rejected` | All scores < threshold | Create Unknown node |

### Interface

```python
class InferenceEngine:
    def infer(self, candidate: ObjectCandidate, matches: list[PatternMatch]) -> InferenceResult:
        """Resolve pattern conflicts and produce final classification."""

    def infer_all(self, candidates: list[ObjectCandidate], engine: PatternEngine) -> list[InferenceResult]:
        """Batch inference over all candidates."""
```

```python
@dataclass
class InferenceResult:
    candidate_id: str
    decision: str              # "confident" | "resolved" | "ambiguous" | "rejected"
    selected_type: str | None # "door", "window", None
    confidence: float
    top_scores: list[tuple[str, float]]
    inference_reason: str
```

---

## 6. Relationship Rules DSL

### Principle

All relationship rules between node types are **declarative (YAML)**, not hard-coded. Adding a new object type or relationship requires zero code changes — only a YAML rule addition.

### DSL Format

```yaml
# relationships.yaml
version: "1.0"

rules:
  # Structural containment
  - source: Room
    target: Wall
    edge: BOUNDED_BY
    direction: bidirectional    # Room→Wall and Wall→Room (via BELONGS_TO)

  - source: Room
    target: Furniture
    edge: CONTAINS
    direction: unidirectional

  # Wall-Opening hierarchy
  - source: Wall
    target: Opening
    edge: HOSTS
    direction: unidirectional

  - source: Opening
    target: SemanticObject
    edge: FILLED_BY
    condition: "target.category == 'opening'"
    direction: unidirectional

  # Access relationships
  - source: Room
    target: Door
    edge: ACCESSED_BY
    direction: unidirectional

  - source: Door
    target: Room
    edge: OPENS_TO
    condition: "door is on wall shared with target room"
    direction: unidirectional

  # Adjacency
  - source: Room
    target: Room
    edge: ADJACENT_TO
    condition: "rooms share at least one wall"
    direction: bidirectional

  # Alignment
  - source: Wall
    target: Wall
    edge: ALIGNS_WITH
    condition: "walls are parallel and co-linear within tolerance"
    direction: bidirectional
```

### Loading and Validation

```python
class RelationshipRule:
    source: str
    target: str
    edge: EdgeType
    condition: str | None
    direction: str  # "unidirectional" | "bidirectional"

class RelationshipRulesEngine:
    def load_rules(self, path: Path) -> list[RelationshipRule]: ...
    def validate_rules(self, rules: list[RelationshipRule]) -> list[str]: ...
```

Rules are loaded at startup, validated against the known EdgeType enum and node types. Invalid rules produce warnings but don't block pipeline execution.

---

## 7. Parameter Extraction

Parameter Extraction produces the data needed for elevation generation, BIM export, and AI reasoning. It operates on confirmed Semantic Objects.

### Door Parameters

| Parameter | Description | Source |
|-----------|-------------|--------|
| `width` | Door width in mm | BBox width or arc radius |
| `height` | Door height (optional) | Z-coordinate or attribute |
| `host_wall` | Which wall this door is on | BBox ↔ Wall intersection |
| `offset` | Distance along wall from origin | Projection onto wall centerline |
| `hinge` | Hinge side (left/right) | Arc geometry analysis |
| `swing` | Swing direction (inward/outward) | Arc center side vs wall normal |
| `rotation` | Door rotation angle | Block rotation or arc |

### Window Parameters

| Parameter | Description | Source |
|-----------|-------------|--------|
| `width` | Window width in mm | BBox width or frame extent |
| `height` | Window height (optional) | Z-coordinate or attribute |
| `host_wall` | Which wall this window is on | BBox ↔ Wall intersection |
| `offset` | Distance along wall from origin | Projection onto wall centerline |
| `sill_height` | Sill height from floor | Z-coordinate or fallback (900mm) |
| `glass_count` | Number of glass panes | Inner lines count |
| `frame_type` | Single / Double frame | Parallel line analysis |

### Reusable Existing Code

| Function | File | Reuse |
|----------|------|-------|
| `_nearest_wall_for_gap` | `semantic/opening_assignment.py` | Host wall detection (200mm tolerance) |
| `opening_face_label` | `semantic/opening_assignment.py` | Compass face from wall direction |
| `confidence_for_candidate` | `semantic/opening_assignment.py` | Evidence aggregation |
| `assign_openings_to_walls` | `semantic/opening_assignment.py` | Full wall membership assignment |
| `_classify_door_entity` | `handlers/space.py` | Entity type classification |
| `_group_door_entities` | `handlers/space.py` | Spatial clustering |
| `_parse_block_width` | `semantic/opening_evidence.py` | Block name → (kind, width_mm) |

Total: ~2,390 lines of existing opening-related tests covering these functions.

---

## 8. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D2 | Pattern Library as interpreter, not creator | Object Candidate Layer precedes Pattern Library. Pattern interprets candidates, does not create from scratch. |
| D3 | DSL-based pattern definitions (YAML) | Adding new object types = new YAML file, no code changes. Engine evaluates constraints declaratively. |
| D4 | Deterministic first, AI second | Pattern Matching handles regular cases (majority in Korean CAD). AI handles only ambiguous edge cases. |
| D8 | Flat Semantic Object Taxonomy | All objects share same parent level. Category grouping is organizational, not hierarchical. |
| D32 | Relationship rules declarative via YAML DSL | Edge rules are data, not code. New node types add YAML rules, zero code changes. |

---

## 9. Acceptance Criteria

- [ ] `PatternEngine` evaluates YAML pattern constraints against `ObjectCandidate` features
- [ ] Door and Window patterns produce correct match/miss results on known test components
- [ ] New pattern addition (e.g., `SlidingDoor`) requires only a YAML file
- [ ] `InferenceEngine` resolves confident/resolved/ambiguous/rejected states correctly
- [ ] Ambiguous candidates flagged for AI deferral (score gap < 0.3, no specificity win)
- [ ] Relationship Rules DSL loads YAML rules at startup without code changes
- [ ] Host wall detection assigns each Door/Window to the correct Wall (within 200mm tolerance)
- [ ] Wall-local offset computed correctly (projection onto wall centerline)
- [ ] Swing direction inferred from arc geometry (hinge side + inward/outward)
- [ ] All parameters (width, offset, host_wall, sill_height) stored on `ObjectFeatures`

---

## 10. Out of Scope

1. **Pattern Learning (AI→YAML)** — AI-generated pattern suggestions. Needs production data volume. Deferred to M2–M3.
2. **Confidence Propagation** — Cross-object confidence influence (e.g., if all walls on a floor are 200mm, a 180mm wall should have lower confidence). Needs end-to-end AI integration.
3. **Ontology-based pattern matching** — Pattern matching that considers ISA hierarchy (see ADR-005 §7). Future work.

---

## 11. Related

- [`ADR-004`](ADR-004-cad-intelligence-pipeline-design.md) — Pipeline & Artifact Architecture (Phase 3 "Semantic Reconstruction" contains this engine)
- [`ADR-005`](ADR-005-architecture-graph-schema.md) — Architecture Graph Schema (receives SemanticObjects; edge types defined here become Graph edges)
- [`ADR-001`](ADR-001-architecture-graph.md) — Architecture Graph IR principle (Semantic Objects feed the Graph)
- [`AXIS-001`](../designs/AXIS-001-design.md) — Existing opening candidate/assignment pipeline (reuse in Parameter Extraction)
