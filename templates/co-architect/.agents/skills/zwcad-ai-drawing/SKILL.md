---
name: zwcad-ai-drawing
description: "Draws geometry in ZWCAD 2026 using MCP tools (primary) or the Python CAD Agent (fallback). Prefer direct MCP tool calls for structured requests; use the CAD Agent only for ambiguous natural-language prompts that require LLM translation."
version: 1.3.0
scope: co-architect
status: active
last_reviewed: "2026-09-09"
gemini-parity: sync
owner: zwcad-drafter
metadata: 
  type: task
  triggers:
    - draw
    - cad draw
    - ai draw in zwcad
    - draw a house plan
    - draw a rectangle in zwcad
    - draw a circle in zwcad
    - draw a line in zwcad
    - draw a layout in zwcad
prerequisites: none
---

# ZWCAD AI Drawing Skill

This skill allows the agent to create geometry in ZWCAD 2026 via two execution paths. **Prefer the MCP direct path** for structured drawing requests where coordinates and parameters can be determined. Use the **CAD Agent fallback** only when the prompt is too ambiguous for the agent to compute exact coordinates.

## Context

The primary drawing path for ZWCAD 2026: structured requests execute as direct MCP tool calls; ambiguous natural-language prompts fall back to the Python CAD Agent for LLM translation, with an interactive prompting loop as the last resort. Path selection is decided first (`## Execution Path Decision`), then the matching step procedure runs.

## Execution Steps

1. Decide the execution path: MCP direct (primary), CAD Agent fallback, or interactive loop (`## Execution Path Decision`).
2. MCP direct — issue the structured tool calls against the running session (`## Step 1`).
3. CAD Agent fallback — route ambiguous natural language through the CAD Agent chain (`## Step 2` / `## Step 3a`).
4. Interactive prompting loop — iterate with the user when automation cannot disambiguate (`## Step 3`).

## Output Format

Drawn geometry in the live ZWCAD session (walls, doors, windows, annotations on the target layers) plus a per-call result summary naming the path taken (MCP / CAD Agent / interactive) and any tool errors returned by the session.

## Related Skills

- `cad-server-manager` — owns the server session this skill talks to.
- `cad-svg-preview` — visual review of what was drawn.
- `generate-room-elevation` — elevation drawing built on the same session.

---

## When to Use This Skill

Use this skill when the user requests to draw geometry, plans, or room divisions in ZWCAD, for example:
* "Draw a square of size 50 by 50 at (10, 10)"
* "Draw a small house plan dividing it into Living Room and Bedroom"
* "Draw a layout with Office A and Office B"

---

## Execution Path Decision

| Condition | Path |
|-----------|------|
| User provides concrete coordinates, dimensions, or a structured layout that the agent can calculate | **Path A — MCP Direct** (Step 1) |
| User request is vague or requires creative spatial decisions the agent cannot make deterministically | **Path B — CAD Agent Fallback** (Step 2) |
| User wants an interactive chat session for iterative drawing | **Path C — Interactive Mode** (Step 3) |

> [!TIP]
> Most drawing requests from the design-delivery workflow (Phase 4) follow a confirmed SketchUp handoff package with known coordinates. These should always use **Path A**.

---

## Step 1 — MCP Direct (Primary Path)

Call `zwcad-mcp` tools directly. The MCP server is auto-spawned by the host (Claude Code / Gemini / Antigravity) as configured in `.mcp.json`.

### Available MCP Tools

#### Drawing & Geometry

| Tool | Required Parameters | Optional Parameters | Description |
|------|---------------------|---------------------|-------------|
| `zwcad_draw_line` | `start_point` [x,y,z], `end_point` [x,y,z] | `layer`, `color` | Straight line segment |
| `zwcad_draw_polyline` | `vertices` [x1,y1,x2,y2,...] (min 4 values) | `closed` (bool), `layer` | 2D lightweight polyline |
| `zwcad_draw_circle` | `center` [x,y,z], `radius` | `layer`, `color` | Circle in ModelSpace |
| `zwcad_draw_arc` | `center` [x,y,z], `radius`, `start_angle`, `end_angle` | `layer`, `color` | Arc (angles in degrees) |
| `zwcad_draw_text` | `text`, `insertion_point` [x,y,z], `height` | `rotation`, `layer` | Single-line text object |
| `zwcad_draw_mtext` | `position` [x,y,z], `width`, `text` | `layer`, `height` | Multi-line text entity |
| `zwcad_draw_aligned_dimension` | `start` [x,y,z], `end` [x,y,z], `text_position` [x,y,z] | `text_override`, `layer` | Aligned dimension |
| `zwcad_apply_hatch` | `polyline_handle` (string) | `pattern_name`, `pattern_type`, `associativity`, `layer`, `color` | Hatch fill on closed polyline |
| `zwcad_insert_block` | `block_name`, `position` [x,y,z] | `scale` [x,y,z], `rotation`, `layer` | Block reference insertion |

#### Query & Inspection

| Tool | Required Parameters | Optional Parameters | Description |
|------|---------------------|---------------------|-------------|
| `zwcad_get_active_document_info` | — | — | Active document metadata (filename, layers, entity count, units) |
| `zwcad_get_selected_geometry` | — | — | Properties of currently selected entities |
| `zwcad_list_layers` | — | — | All layers with frozen/locked/color state |
| `zwcad_extract_model` | — | `layers` (string[]) | All entities + CA_METADATA project tags |

#### Layer Management

| Tool | Required Parameters | Optional Parameters | Description |
|------|---------------------|---------------------|-------------|
| `zwcad_set_layer_state` | `layer_name` | `frozen` (bool), `locked` (bool) | Freeze/thaw and lock/unlock a layer |

#### Undo Transactions

| Tool | Required Parameters | Description |
|------|---------------------|-------------|
| `zwcad_start_undo_marker` | — | Begin an undo transaction group |
| `zwcad_end_undo_marker` | — | End an undo transaction group |

#### Compliance

| Tool | Required Parameters | Optional Parameters | Description |
|------|---------------------|---------------------|-------------|
| `zwcad_check_compliance` | — | `layers` (string[]) | Check drawing against zoning bylaws |

#### File Management (M2-A)

| Tool | Required Parameters | Optional Parameters | Description |
|------|---------------------|---------------------|-------------|
| `zwcad_save_drawing` | — | `filepath` (string) | Save active drawing (SaveAs if filepath provided) |
| `zwcad_open_drawing` | `filepath` (string) | — | Open a DWG file |
| `zwcad_new_drawing` | — | `template` (string) | Create a new drawing |
| `zwcad_close_drawing` | — | `save_changes` (bool) | Close active drawing |

#### Modify Tools (M2-B)

| Tool | Required Parameters | Optional Parameters | Description |
|------|---------------------|---------------------|-------------|
| `zwcad_move_entity` | `handle` (string), `offset` [dx,dy,dz] | — | Move entity by offset |
| `zwcad_copy_entity` | `handle` (string) | `offset` [dx,dy,dz] | Copy entity with optional offset |
| `zwcad_rotate_entity` | `handle` (string), `center` [x,y,z], `angle` (degrees) | — | Rotate entity around center |
| `zwcad_delete_entity` | `handle` (string) | — | Delete entity by handle |
| `zwcad_mirror_entity` | `handle` (string), `point1` [x,y,z], `point2` [x,y,z] | — | Mirror entity across axis |
| `zwcad_offset_entity` | `handle` (string), `distance` (float) | — | Offset entity by distance |

#### Layer Enhancement (M2-C)

| Tool | Required Parameters | Optional Parameters | Description |
|------|---------------------|---------------------|-------------|
| `zwcad_create_layer` | `name` (string) | `color` (int) | Create a new layer with optional color |
| `zwcad_set_entity_layer` | `handle` (string), `layer_name` (string) | — | Move entity to a layer |
| `zwcad_delete_layer` | `name` (string) | — | Delete a layer |
| `zwcad_apply_layer_standards` | — | — | Auto-create standard A-* architectural layers |

### Layer Naming Convention

Follow the project layer standard defined in `agents/zwcad-drafter.md`:

| Layer | Usage |
|-------|-------|
| `A-WALL` | Walls |
| `A-DOOR` | Doors |
| `A-WIND` | Windows |
| `A-DIMS` | Dimensions |
| `A-ANNO` | Annotations / labels |
| `A-HATCH` | Hatching / fill patterns |
| `A-SITE` | Site plan elements |
| `A-GRID` | Grid lines |

### Example Workflow (MCP Direct)

```
1. zwcad_start_undo_marker
2. zwcad_draw_polyline(vertices=[0,0,500,0,500,300,0,300], closed=true, layer="A-WALL")
3. zwcad_draw_text(text="Living Room", insertion_point=[250,150,0], height=5, layer="A-ANNO")
4. zwcad_draw_aligned_dimension(start=[0,0,0], end=[500,0,0], text_position=[250,-20,0], layer="A-DIMS")
5. zwcad_end_undo_marker
```

---

## Step 2 — CAD Agent Fallback (Complex Natural Language)

Use this path when the user's request is ambiguous or requires creative spatial decisions that cannot be deterministically computed.

### Step 2a: Verify LLM API Key

The CAD agent loads environment variables from the project root `.env` file on startup.
Verify that the `.env` file contains at least one of the following API keys:

| Key | Provider |
|-----|----------|
| `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` | Anthropic (GLM) |
| `GEMINI_API_KEY` | Google Gemini |
| `OPENAI_API_KEY` | OpenAI |

> [!CAUTION]
> If none of these keys are present in `.env`, the LLM translation step will fail. Ask the user to add an API key to the `.env` file at the project root.

### Step 2b: Execute Drawing Command

Run the Python CAD agent from the project root:
```bash
python src/agent/cad_agent.py --prompt "<user_prompt>"
```
The CAD Agent will internally use an LLM to translate the natural language prompt into drawing commands.

---

## Step 3 — Interactive Prompting Loop (Optional)

If the user requests to enter an interactive chat session to draw multiple things dynamically, run:
```bash
python src/agent/cad_agent.py --interactive
```

---

## Step 3a — CAD Agent Chain Mode (M3-A)

For high-quality outputs, use the 4-step AI prompt chain instead of single-step generation:

```bash
python src/agent/cad_agent.py --server --port 3333
# Then POST to http://127.0.0.1:3333/draw with mode: "chain"
```

The chain executes 4 steps:
1. **Interpret** — LLM analyzes the prompt into structured design intent (entity types, dimensions, constraints)
2. **Generate** — LLM generates JSON drawing commands from the enriched intent context
3. **Validate** — LLM cross-checks commands against intent (score, issues, suggestions)
4. **Execute** — If valid, commands execute on ZWCAD. If validation fails, up to 2 auto-revision cycles run

> [!TIP]
> Use chain mode for complex multi-entity drawings or when accuracy is critical (e.g. regulatory submissions). The validation step catches coordinate errors and missing entities before they reach ZWCAD.

### Error Recovery (M3-C)

All drawing executions (both single-step and chain mode) are wrapped in automatic undo protection:
- `start_undo_marker` is called before execution
- On success, `end_undo_marker` closes the transaction
- On failure, the system sends an UNDO command to ZWCAD to rollback partial changes

---

## Step 4 — Verify Drawing Status

* Check the console logs returned by the command execution.
* Ensure the log outputs:
  - `Successfully connected` or `Successfully launched new ZWCAD instance`
  - `Bound to active drawing`
  - `Added lightweight polyline` or `Added line`/`Added MText`
  - `Successfully executed drawing instruction.`
* If ZWCAD was launched in the background, remind the user that it will have minimized and restored itself to focus in the foreground of their desktop, showing the newly created drawings.

## Related Skills

<!-- Link related skills here -->
