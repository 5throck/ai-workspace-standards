# Space Recognition and Judgement — Pipeline Overview

Diagram: [`space-recognition-pipeline.svg`](space-recognition-pipeline.svg). The image proposes, the CAD evidence decides, and the user reviews. Review results flow back into the ground truth, the reading rules (R01–R28) and the ontology.

| Stage | What happens | Main code |
|---|---|---|
| A. Evidence | Open the DWG and extract lines, arcs, texts and dimensions. Blocks are exploded (R19). `--bbox` skips far-away sheets, and XCLIP-ed blocks are extracted alone. Wall layers are classified, with a name veto for TILE and DEFPOINT (R20). The drawing's centerlines (`A-CEN`) serve as snap lines. The image is rendered from the DWG (R12). | `plan_evidence_com.extract_evidence`, `extract_block_evidence.py`, `plan_evidence.classify_wall_layers`, `render_evidence_png_svg.py` |
| B. Proposal and snap | A blind vision proposal applies the reading rules and is then snapped (grid first, then wall centerlines). The step also handles mirrored units (R10), categories, the wall-crossing post-check and enclosed gaps (R18). | `proposal_snap`, `proposal_spaces.spaces_from_proposal`, `zwcad_generate_spaces(seed_from_proposal)` |
| C. Doors and windows | Arc, jamb and frame doors, and glazing runs (R06–R08, R13, R15, R21). The coverage checks turn gaps into questions (R22). | `plan_evidence.recognize_openings`, `unassigned_door_targets`, `enclosed_gaps` |
| D. Review → ground truth | The user reviews an SVG overlay, one correction at a time. The ground truth records spaces, doors (`internal`, `unmodelled_side`, R26), sheets (plan → elevations), elevations A–F and `wall_finish_mm`. | `memory/drawings/{drawing}.ground-truth.json/.md` |
| E. Derivation and checks | Elevation metadata: inner faces plus the finish (R28), unfolding, door placement, thresholds (R24) and open plan (R16, R23). The ontology facts graph and its rule checks (R10, R13, R22, R24). The plan-to-elevation-sheet reconciliation (R27, R28). | `room_metadata.derive`, `ontology.facts.build_facts`, `rules.plan_reading.check_plan`, `elevation_scoring.score_drawing` |
| Outputs | SVG previews, ZWCAD elevations, and the feedback loop. | `cad-svg-preview`, `generate-room-elevation` |

## Default call without a seed (ADR-019)

When `zwcad_generate_spaces` is called without `seed_from_proposal`, `seed_from_rooms_json` or `seed_from_space_info`:

1. **Ground-truth seed — in use (the default behaviour).** If `{drawing}.ground-truth.json` exists, its spaces seed the result (`_ground_truth_proposal`, `seed_from_ground_truth`). All four reviewed drawings take this path. So do the tools that fall back to it when they get no spaces: `assign_openings`, `map_space_info`, `generate_wall_model` and the three boundary-repair tools.
2. **Geometry candidates — deprecated, kept as a fallback (option C).** With no ground truth, `_build_space_polygons` returns *unreviewed candidates* only (`confidence_state: candidate`, `needs_confirmation`). Tools that treat spaces as fact refuse them (`SPACES_UNREVIEWED`). The exit criterion is ≥ 80 % room match on ≥ 5 reviewed drawings, to be reviewed by 2026-12-31. Four drawings are reviewed so far.
