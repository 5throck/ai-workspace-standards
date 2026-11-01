# CAD-RECOGNITION-HARDENING-001 Design

Status: Implemented
Date: 2026-09-13

## Problem

Apartment CAD drawings can encode openings and walls through a mix of layers, block references, raw polylines, arcs, and sidecar pattern files. The prior extraction path had five practical failure modes:

1. finish, hatch, furniture, and display layers could be auto-classified as wall-like with low confidence and then extracted as structural walls;
2. block-only door/window symbols could be dropped because their bounding box collapsed to a point;
3. bulged polylines that visually encode door swing arcs did not contribute arc evidence;
4. sidecar door/window pattern results replaced pipeline results wholesale, dropping recognized style metadata and detections from other layers;
5. block definitions were classified separately but not used to repair width for generic block-only inserts.

## Decision

Harden the existing V3 extraction path without replacing the public data contract:

- gate automatic wall/door/window extraction on a minimum layer classification confidence of `0.5`;
- keep block references as first-class opening candidate evidence;
- capture `GetBulge()` values for polylines and convert non-zero bulges to arc evidence;
- merge sidecar results with pipeline/layer results by handle, entity IDs, and conservative position/width overlap;
- suppress raw polygon door fallback on layers where curated sidecar door detections exist;
- classify block definitions best-effort outside the shared ModelSpace scan and use definition geometry only when its role agrees with the extraction path.

## Non-goals

- Do not expand `scan_modelspace()` to iterate `doc.Blocks`; block-definition classification remains a separate optional enrichment.
- Do not let block-definition geometry override a stronger door/window role from layer or pipeline evidence.
- Do not globally retune geometric thresholds for all drawings based on one apartment sample.

## Validation

The live ZWCAD comparison report is stored at `docs/reports/2026-09-13-cad-recognition-hardening-verification.md`.

Targeted automated validation:

```powershell
.\.venv\Scripts\pytest.exe tests\handlers\test_cad_recognition_hardening.py tests\handlers\test_extract_cad_objects_door_patterns.py tests\handlers\test_extract_cad_objects_door_pipeline_v3.py tests\handlers\test_extract_cad_objects_window_pipeline_v3.py tests\handlers\test_wall_processing_mode_dispatch.py tests\test_analyze_layers.py tests\test_door_classifier.py tests\test_window_classifier.py tests\test_block_classifier.py -q
.\.venv\Scripts\python.exe -m compileall -q src\cad_intelligence
git diff --check
```

Observed result: 140 tests passed, compileall passed, and diff-check passed with only existing LF to CRLF working-tree warnings.

## Follow-up

Definition-level geometry classification still needs semantic refinement for thin rectangular door definitions and wide panel window definitions. The current implementation safely ignores those conflicts, but a future update should improve the classifier so more live blocks can receive trusted definition-level width metadata.
