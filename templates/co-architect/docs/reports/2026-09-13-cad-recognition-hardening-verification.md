# CAD Recognition Hardening Verification — 2026-09-13

## Scope

This report verifies the CAD recognition hardening work for `tests/아파트 평면도.dwg` against `origin/main` and the current working branch.

The verification focuses on the failure modes reported for Korean apartment CAD drawings:

- false wall extraction from finish/furniture/hatch layers;
- door/window symbols represented only as block references;
- door swing arcs represented as polyline bulges;
- sidecar door/window patterns replacing, rather than merging with, pipeline results;
- block definition geometry being available as an additional width/classification signal without overwriting stronger role evidence.

## Live DWG comparison

Environment: live ZWCAD COM session, active document `아파트 평면도.dwg` with 2,918 ModelSpace entities.

| Metric | `origin/main` | current branch | Note |
|---|---:|---:|---|
| walls | 464 | 385 | Expected reduction from low-confidence/non-structural wall-layer filtering. |
| doors | 13 | 13 | Count preserved after suppressing noisy polygon fallback on sidecar-covered door layers. |
| windows | 6 | 8 | Additional window candidates are preserved by merge rather than sidecar overwrite. |
| dimensions | 79 | 79 | Unchanged. |
| doors with width < 300mm | 3 | 3 | No net regression after fallback suppression. |
| windows with width < 300mm | 2 | 4 | Extra sleeve/window candidates retained; needs visual review in the next CAD QA pass. |
| block-definition-enriched doors | 0 | 0 | No agreed door definition enrichment in this drawing. Conflicting definitions were ignored. |
| block-definition-enriched windows | 0 | 0 | No agreed window definition enrichment in this drawing. Conflicting definitions were ignored. |

Intermediate local JSON summaries were generated under `artifacts/cad-recognition-live-baseline.json` and `artifacts/cad-recognition-live-current.json`; they are intentionally not required for runtime behavior.

## Regression coverage added

New regression tests cover:

1. low-confidence auto-classified layers being skipped from object extraction;
2. block-only opening candidates being preserved;
3. width fallback from block scale/name conventions;
4. bulged polylines generating arc evidence;
5. sidecar merge deduplication by handles/entity IDs and spatial overlap;
6. block definition geometry repairing generic block-only window width;
7. conflicting block definitions not overriding the current extraction role;
8. sidecar-covered door layers suppressing noisy raw polygon fallback fragments.

## Validation commands

```powershell
.\.venv\Scripts\pytest.exe tests\handlers\test_cad_recognition_hardening.py tests\handlers\test_extract_cad_objects_door_patterns.py tests\handlers\test_extract_cad_objects_door_pipeline_v3.py tests\handlers\test_extract_cad_objects_window_pipeline_v3.py tests\handlers\test_wall_processing_mode_dispatch.py tests\test_analyze_layers.py tests\test_door_classifier.py tests\test_window_classifier.py tests\test_block_classifier.py -q
.\.venv\Scripts\python.exe -m compileall -q src\cad_intelligence
git diff --check
```

Result: `139 passed`; compile and diff-check passed. Git emitted only existing LF→CRLF working-tree warnings.

## Follow-up recommendation

The current branch fixes the highest-risk extraction regressions and keeps live DWG door counts stable. The next improvement should refine block-definition geometry classification itself: in the live drawing, definitions such as `D900`/`D1000` are thin rectangles and are currently classified as windows by pure geometry, while `PW2400` is classified as sliding door. The current integration safely ignores such conflicts, but improving definition-level semantics would allow more real drawing symbols to receive block-definition width metadata.
