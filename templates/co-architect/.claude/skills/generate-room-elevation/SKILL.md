---
name: generate-room-elevation
status: active
last_reviewed: "2026-09-26"
scope: co-architect
description: >
  Generate 4-direction unfolded wall elevations (North -> East -> South -> West) for rooms in ZWCAD.
  Use when: drawing room-by-room elevations, generating elevations for all rooms in a floor plan, or generating elevations for selected rooms.
owner: pm
version: 1.2.0
metadata: 
  type: process
  triggers:
    - generate room elevation
    - draw elevations for room
    - room elevation pipeline
    - generate all elevations
prerequisites: none
---

# Generate Room Elevation Skill

This skill outlines the process for generating 4-direction unfolded elevations (North → East → South → West) for one or more rooms based on a floor plan in ZWCAD.

---

## Context

Turns an accepted floor plan into 4-direction unfolded wall elevations (North → East → South → West) in ZWCAD, room by room or for every room at once. Workflow A runs the automated pipeline from derived metadata; Workflow B drives a single room through custom scripting — the split is a role decision, not a preference (see `## Workflow A vs Workflow B`).

## Execution Steps

1. Preview the plan as SVG from derived metadata (required first step — see `## Step 0`).
2. Derive elevation metadata from the reviewed ground truth: finished surface first, then reconcile (`## Step 0b`).
3. Run Workflow A (selective/all rooms, automated pipeline, recommended) or Workflow B (single room, custom scripting).

## Output Format

Four unfolded elevation drawings per room placed on the designated ZWCAD layers, one set per requested room, matching the reviewed `rooms.json` metadata consumed from `cad-svg-preview`.

## Related Skills

- `cad-svg-preview` — produces the preview and elevation metadata this skill draws from.
- `cad-space-recognition` — produces the accepted room ground truth upstream.
- `zwcad-ai-drawing` — shares the MCP session this skill draws in.

---

## When to Use This Skill

Use this skill when the user requests to generate elevations for rooms, either:
- **Single Room Custom Run**: A custom layout or dimensions that require direct coordinates drawing via a script.
- **Selective/All Rooms Automated Run**: Running the automated pipeline to scan entities (doors/sleeves) from ZWCAD, map them to room bboxes in metadata, and regenerate elevations.

---

## Workflow A vs Workflow B — Role, Not Just Mechanism

| | Workflow A (`rematch_openings.py`) | Workflow B (`draw_room1_elevations.py`) |
|---|---|---|
| Source of truth | CAD scan + metadata (auto-detected) | Human-verified reference values (ground truth) |
| Role | Production pipeline — the tool that actually generates elevations day-to-day | Two distinct roles — see below |

Because Workflow B's opening offsets are typed in by a human who looked at the
drawing (not auto-detected), it doubles as the **accuracy baseline** for
Workflow A: when `rematch_openings.py`'s CAD-scan matching produces a
surprising result, `draw_room1_elevations.py`'s hardcoded values — and its
per-wall docstring conventions (which corner is "left" on each face) — are
what to check it against. Keep this in mind before "simplifying" Workflow B
to match Workflow A's automation; its manual, explicit nature is the point.

**Workflow B's two roles** (see `docs/adr/ADR-016-face-elevation-architecture.md`
Roadmap Addendum for the full rationale):
1. **Golden Fixture Generator** — its `WallDef`/`Opening` data is a human-verified input
   fixture, independent of how it's drawn.
2. **Renderer Oracle** — its *drawn output* is currently treated as "the correct answer"
   to compare Workflow A's ZWCAD output against. This role is planned to migrate from
   Workflow B's hand-written draw functions onto a `REFERENCE` `RenderStyle` preset once
   both workflows render through the shared `LayoutScene → RendererFactory` path (ADR-bb/cc
   target architecture, not yet implemented) — at that point "the oracle" is a style
   flag on the shared renderer, not a second hand-maintained implementation.

---

## Step 0 — Preview as SVG, from derived metadata (required)

Before drawing in ZWCAD:

1. Regenerate the metadata from the user-reviewed ground truth: `uv run python scripts/co-architect/cad/pipeline/derive_room_metadata.py "<drawing>"`. The old hand-built `rooms.json`/`walls.json` for the apartment reference plan were wrong (rooms misplaced, C.H 2,800 vs tagged 2,300); these files are now derived and must not be hand-edited.
2. Show the elevations as SVG: `render_room_elevation_svg.py --rooms memory/drawings/<drawing>.rooms.json <out_dir>` renders every room, including non-rectangular ones, and `all-rooms.svg`. See skill `cad-svg-preview`.
3. Draw in ZWCAD only after the user confirms the SVG.

`rematch_openings.py` takes C.H from `rooms.json` first, then the existing `walls.json`, then `architectural-standards.json`. The hard-coded 2,800 default is gone. Non-rectangular rooms are skipped by this 4-face pipeline with an `[INFO]` line.

## Step 0b — Elevations are drawn from the plan: finished surface, then reconcile

Elevation sheets are drawn **from the plan sheet** (reading rules R27, R28). Example: the public-hall drawing in `tests/`, where sheet 1 is the plan and sheets 2–3 are elevations A–F.

1. **Which walls:** the key plan's marker pair (`A`/`A′` …) and its coloured section line name the plan space and walls of each elevation. Record them in the ground truth under `elevations` (`space`, `marker_y`) and `sheets` (plan → elevation sheets).
2. **Which surface:** elevations are dimensioned to the **finished wall surface**, the structural face minus the finish. Put plan polygons on the drawing's own wall centerlines (for example the `A-CEN` layer) and set `_meta.wall_finish_mm`. `room_metadata.unfolded_faces(..., finish=)` then produces the sheet dimensions (for example, the lobby is 2,350 at the concrete face and 2,310 on the sheet).
3. **Reconcile:** `derive_room_metadata.py` runs `elevation_scoring.score_drawing` when the drawing has elevation sheets and writes `{drawing}.elevation-score.json`. The targets are unfolded length within 100 mm and every sheet door matched (position within 260 mm, width). Treat every `review` line as a question. Record a real plan-vs-sheet drafting difference in the ground truth instead of forcing a match.

## Workflow A — Selective/All Rooms Automated Pipeline (Recommended)

Use this workflow to automatically extract openings (doors/windows/sleeves) from the active ZWCAD drawing, reconcile them with floor plan metadata, and regenerate elevations.

> [!NOTE]
> **`--render-mode simple` is a schematic mode by design, not an incomplete `detailed`.**
> It intentionally omits brick/concrete hatch and door/window detail (plain rectangle +
> `WxH` label only) — see `docs/adr/ADR-016-face-elevation-architecture.md` ADR-aa. Don't
> "complete" it by copying `detailed` geometry into it; if a use case needs that, use
> `detailed` instead.
>
> **Workflow B does not support `--render-mode` at all** — it always draws one fixed,
> hand-authored style. See ADR-aa's "Known parity gap" note and the "Roadmap Addendum:
> Simple/Detailed Rendering Parity & Workflow A/B Convergence" section in the same doc for
> the planned convergence (Workflow B onto the shared `ZWCADRendererFactory`) and the
> current door-symbol mismatch between Workflow B's true arc and `detailed/door.py`'s
> straight-line approximation.

### Step A1: Verify Metadata Availability
Before running, ensure the drawing metadata is extracted and available under `memory/drawings/` (usually extracted from `memory/drawings.zip` if compressed):
- `{drawing_name}.rooms.json`: Contains the user-verified room bboxes and nominal openings.
- `{drawing_name}.walls.json`: Contains wall dimensions and opening metadata.
- `{drawing_name}.layers.json`: Contains layer classifications (e.g. wall layers, door layers).

> [!IMPORTANT]
> **Strict Metadata Isolation**: The elevation pipeline enforces Fail-Fast validation. Metadata is treated as belonging to exactly one drawing. Reusing metadata generated for another DWG is unsupported and results in immediate validation failure.

### Step A2: Execute Pipeline

#### Option 1: Generate for ALL Rooms
Run the following command to process and generate elevations for all rooms:
```powershell
.venv\Scripts\python.exe scripts/co-architect/cad/pipeline/rematch_openings.py
```

#### Option 2: Generate for SELECTIVE Rooms
To generate elevations only for specific rooms, pass their comma-separated names using the `--rooms` flag:
```powershell
.venv\Scripts\python.exe scripts/co-architect/cad/pipeline/rematch_openings.py --rooms "ROOM #1,ROOM #2"
```

### Step A3: Verification
1. Run the `verify_drawings.py` verification script (standalone scratch checker) to check the generated entities.
2. In ZWCAD, confirm that:
   - Old elevations on elevation layers are deleted and replaced.
   - The generated elevations are rendered to the right of the floor plan (standard starting position `X = 50000` with `5000mm` spacing).

---

## Workflow B — Single Room Custom Scripting

Use this workflow when a room requires ad-hoc layout changes or does not match the automated database.

### Step B1: Extract Room Dimensions
1. Locate the room text label inside the active drawing to determine its center coordinates.
2. Verify the East-West (EW) and North-South (NS) span sizes from the dimension lines or polyline vertices.
3. Identify opening types (door, window) and their exact offset and width from the wall corner.

### Step B2: Configure the Scaffold Script
Create or copy a script (e.g., [draw_room1_elevations.py](../../scripts/co-architect/cad/drawing/draw_room1_elevations.py)) and specify:
- Room width (`room_ew`), height (`room_ns`), and ceiling height (`ceiling`).
- Wall openings formatted as `(type, offset, width, sill, height)`.

### Step B3: Execute and Save
1. Execute the custom script:
   ```powershell
   .venv\Scripts\python.exe scripts/draw_<room>_elevations.py
   ```
2. Save the active document in ZWCAD:
   ```powershell
   .venv\Scripts\python.exe -c "import win32com.client; win32com.client.GetActiveObject('ZWCAD.Application').ActiveDocument.Save()"
   ```

## Related Skills

<!-- Link related skills here -->
