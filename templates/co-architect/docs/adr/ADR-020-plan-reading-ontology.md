# ADR-020 Plan-Reading Ontology for Recognition Rules

> **Status**: Accepted — steps 1, 2 and 3 done
> **Date**: 2026-09-25
> **Deciders**: Co-Architect PM, user
> **Related**: ADR-017 (knowledge graph platform), ADR-018 (vision-first recognition), ADR-019

---

## Context

The reading rules for walls, spaces, doors and windows keep growing: R01–R24 in `docs/reports/room-scoring/reading-rules.json`. Each rule was written as free text. Its connections to the concepts it talks about, to other rules, and to the code that enforces it lived only in comments.

This caused a concrete defect. The door placement on a wall face was computed in two places: the elevation SVG and `walls.json`. The two drifted apart: a mirrored door landed on the wrong wall in one of them (fixed on 2026-09-25).

## Decision

Treat the rules as an ontology, introduced in three steps. Build it on the existing YAML/JSON rule stores and the ADR-017 graph rather than on a new OWL toolchain.

### Step 1 — vocabulary and links (this change)

- `src/cad_intelligence/ontology/concepts.yaml` defines:
  - **Concepts** with single inheritance (`is_a`): evidence (Layer, Block, Label, PlanImage, GlazingRun, MirrorAxis); elements (Wall, Opening → Door → SwingDoor/JambDoor/FrameDoor, Window); spaces (Room, NonRoom → Balcony/Planter/WetZone/Circulation/Core/Storage, Void, OpenPlanSpace, Unit); and elevation Faces.
  - **Properties**, such as F.L, C.H, threshold and sill.
  - **Relations**: bounds, connects, opens_to, open_to, merged_into, part_of, mirrors, has_face, placed_on, and others.
  - Where a code enum exists, a concept maps to it through `code_enum`, for example `SpaceCategory.ROOM`.
- Every reading rule now carries:
  - `applies_to`: the concepts it governs;
  - `depends_on`: the rules it builds on;
  - `enforced_by`: `code`, `prompt` (vision proposal only) or `review` (a question for the user);
  - `implemented_by`: the `module:symbol` that enforces it.
- `cad_intelligence.ontology.validate()` and `tests/test_ontology.py` fail when any of these links break: an unknown concept, a missing rule, a dependency cycle, or a function that was renamed or deleted.
- `rules_for(concept)` returns the rules that apply to a concept, including inherited ones. For example, R24 on Door also applies to FrameDoor.

### Step 2 — one placement per fact (done 2026-09-25)

- `OntologyNode` (`common/models.py`) is a fact node typed by an ontology concept, with properties and evidence ids (ADR-010). It is registered for `ArchitectureGraph` serialization.
- Each relation in `concepts.yaml` declares the ADR-017 `EdgeType` it is stored as (`graph_edge`, optional `reverse`). `validate()` checks that the edge type exists.
- `ontology/facts.py` `build_facts()` turns the reviewed ground truth and the unfolded faces into a facts graph:
  - Space -contains-> Face (has_face)
  - Face -hosts-> Opening (placed_on; offset, width, sill, head)
  - Space -accessed_by-> Door (connects), and Space -connected_to-> Space (so `to_room_graph()` works)
  - Space -contains_opening-> Window (opens_to)
  - Space -adjacent_to-> Space (open_to)
- Non-rooms are classified by the concept `examples` (e.g. WET ZONE → WetZone, balcony → Balcony, stair core → Core).
- **Consumer:** `room_metadata.derive()` now builds the `walls.json` openings from the graph query `placements()` instead of from its own face data. `derive_room_metadata.py` writes `{drawing}.facts.json`.
- Tests: `tests/test_ontology_facts.py`.

### Step 3 — reasoning over the graph (done 2026-09-25)

- `rules/plan_reading.py` adds ADR-017 `RuleEngine` rules (domain `plan_reading`) that check the recognised facts graph. `Rule.applies_to` now also matches an `OntologyNode` concept and its `is_a` ancestors, so a rule on `Door` also checks `FrameDoor`. The rules are:
  - **R10** `mirror_consistent_placement`: an opening `XR` in a mirrored unit sits on the mirrored face (E↔W) at the mirrored offset.
  - **R13** `window_not_toward_circulation`: glazing between a Room and a Circulation zone is not a window.
  - **R22** `door_connects_two_spaces`: a door joins exactly two spaces, with an open-plan group counted as one side; `opening_is_placed`: every opening of a Room appears on an elevation face.
  - **R24** `sunken_door_levels`: the threshold covers the level drop, and the head is ≤ C.H − 200.
- `check_plan(graph)` returns violations as review questions. `derive_room_metadata.py` stores them in `{drawing}.facts.json` under `review`.
- `ontology.coverage_report()` lists concepts no rule covers, rules enforced only by the prompt (R02–R05, R11: candidates for code), and code rules that depend on non-code rules.
- **What the checks found on the reference drawings:**
  - Artefacts in the facts builder itself: non-room sides were missing, and loose name matching treated a living room as a prefix of its mirrored copy "_R". Both were fixed with the strict resolver `ontology/names.py`, which metadata derivation now shares.
  - A ground-truth data error: a mirrored inner window was named `kitchen | utility_R` (only the last side suffixed). The mirroring script now suffixes every side.
  - Two placement bugs in elevation metadata:
    - Multi-leaf (bi-fold) doors were never placed.
    - The door-leaf candidate was chosen as "the first one near a face". It is now "the one where the wall is open" (least wall linework along the span). This fixed 11 doors whose original and mirrored placements disagreed (7 in the 32-pyeong plan, 4 in the third drawing). The user-approved ROOM #2 reference is unchanged.
  - The remaining findings are genuine review items: a shower-screen door inside a bathroom, a door into a space not yet defined (TBD), and a door with no from/to that touches three rooms.

### Update 2026-09-25 — wall cavity, internal doors, door kinds (rules v1.8)

- New concepts in `concepts.yaml`:
  - **`WallCavity`** (is_a Element) — a narrow strip (≈400 mm or less) enclosed between two parallel walls is pipe/dead space, never a Space; it stays unassigned and each room ends on the centerline of its own wall.
  - **`InternalDoor`** (is_a Door) — a door within one space (e.g. a shower screen); joins no second space and is not drawn on an elevation.
  - **`FoldingDoor`**, **`SlidingDoor`** (is_a Door) — the bi-fold and double-line sliding door kinds.
- `Storage` gained closet examples, so every space and door in the three reference drawings now resolves to a specific concept instead of falling back to generic `NonRoom`/`Door`; `tests/test_ontology.py` enforces this.
- Door properties **`internal`** and **`unmodelled_side`** record the user's confirmation; R22 and the placement rules accept them instead of re-asking.
- New rules in `docs/reports/room-scoring/reading-rules.json` (now v1.8, R01–R26):
  - **R25** `wall_cavity_strip`: the strip between two walls is a wall cavity, not a space.
  - **R26** `internal_and_unmodelled_side_doors`: internal doors stay off elevations; a confirmed door whose far side is a space not modelled yet is marked `unmodelled_side`.

### Update 2026-09-26 — sheets, elevations drawn from the plan (rules v2.0)

- New concepts: `Sheet` → `PlanSheet`, `ElevationSheet`; `KeyPlan`, `SectionMarker`; the Face property `finish_offset`. New relations: `derived_from` (ElevationSheet → PlanSheet), `unfolds` (ElevationSheet → Space), `marks` (SectionMarker → Face). Korean terms for plan sheet, elevation sheet and key plan live in the KR profile.
- **R27** (elevation sheets define the rooms) is now enforced in code. **R28** (elevations are drawn from the plan, dimensioned to the finished surface, reconciled with it) is implemented by `elevation_scoring.score_drawing` and `room_metadata.unfolded_faces(finish=)`.
- Drawing evidence (public hall): the plan sheet is the source of the two elevation sheets. Lengths reconcile within 73 mm once the polygons sit on the drawing's centerlines and the 20 mm finish is applied, and all 14 sheet doors match. The one real drafting difference (elevator door spacing, 2,700 in the plan vs 2,600/2,635 on the sheet) is recorded, not forced.

## Consequences

- Positive: adding a rule means declaring what it applies to and what enforces it, and CI checks those links. Rules can be looked up by concept.
- Negative: rule authors must keep `implemented_by` current; the test enforces this.
- Out of scope: OWL/RDF export. The YAML can be converted later if an external reasoner is needed.
