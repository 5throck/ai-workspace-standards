# Window-Style Reaches Room Association — Design Note

**Status:** Approved (PM investigation, 2026-08-05) — supersedes the framing of
"Action 4: design a room-opening association data model" from the 2026-08-05
project-review meeting synthesis.

## Corrected finding

The project-review's interior-designer sub-review concluded "no room↔opening
association exists anywhere in the codebase." **This was incomplete.** A full
room-opening association mechanism already exists and is production-quality:

- `handle_find_opening_candidates` (`cad_io/handlers/space.py:4205`, AXIS-001
  Phase B1) scans the welded wall network for gaps and classifies each as
  `door`/`window`/`unknown` by proximity-matching against `DoorEntity`/
  `WindowEntity` positions (`geometry/space_geometry.py:4255`,
  `find_wall_discontinuities`).
- `handle_assign_openings` (`cad_io/handlers/space.py:4337`, AXIS-001 Phase
  B2) attaches each `OpeningCandidate` to its owning wall and — critically —
  **both adjacent rooms for a party wall**, via `OpeningAssignment.room_ids`
  (`common/models.py:574`). It also runs reachability validation
  (`ROOM_UNREACHABLE`) and opening-count sanity checks (`ROOM_NO_DOOR`,
  `WALL_TOO_MANY_WINDOWS`).

**The real gap**: this AXIS-001 pipeline and the window-style-classification
pipeline (`OpeningSymbolPipeline` → `_build_windows_v3`, wired into the live
path this session) are two independent systems that happen to consume the
same `WindowEntity` dicts at different points, but the style fields
(`window_style`, `style_confidence`) are silently dropped at exactly one
conversion boundary: `WindowEntity.from_dict()` (`common/models.py:190`)
only reads `handle`/`layer`/`position`/`width`/`block_name` — the extra keys
`_build_windows_v3` adds on top of the base `WindowEntity.to_dict()` schema
are ignored. This is the same "field silently dropped between two layers"
pattern found and fixed for the elevation renderer (Action 5), recurring one
system over.

## Design

Thread `window_style: str | None = None` and `style_confidence: float | None
= None` through 3 dataclasses in `common/models.py`, plus the one function
in `space_geometry.py` that currently discards a matched `WindowEntity`'s
extra data:

1. **`WindowEntity`** (`common/models.py:171`): add the two fields;
   `to_dict()`/`from_dict()` updated so the fields round-trip.
2. **`OpeningCandidate`** (`common/models.py:469`): add the two fields
   (default `None` — a `door`/`unknown`-kind candidate never has them);
   `to_dict()`/`from_dict()` updated.
3. **`find_wall_discontinuities`** (`space_geometry.py:4255`): when
   `matched_window is not None`, pass
   `window_style=matched_window.window_style,
   style_confidence=matched_window.style_confidence` into the constructed
   `OpeningCandidate` (currently only `kind`/`evidence`/`evidence_state` are
   set from the match).
4. **`OpeningAssignment`**: no change needed — `to_dict()` already embeds
   `self.candidate.to_dict()`, so the new fields flow through for free once
   `OpeningCandidate` carries them.

## Out of scope

- Redesigning either pipeline's detection logic (gap-scan vs. cluster-
  classify) — they solve different problems (topological room membership vs.
  geometric style) and should stay separate; this design only stops one
  discarding the other's output.
- Door-side equivalent (swing direction, door type) — `DoorEntity` has no
  classification pipeline feeding it yet (tracked separately, Action 6).
- Any change to `ROOM_NO_DOOR`/`WALL_TOO_MANY_WINDOWS` validation logic in
  `handle_assign_openings` — out of scope, this only makes richer data
  available to a future consumer of `OpeningAssignment`.
