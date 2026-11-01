---
lang: ko
lang_reason: source-material
---

# Confidence-Guided Two-Pass Opening Clustering — Design Spec

**Status:** Approved (user, 2026-08-05)
**Related:**
- `memory/2026-08-05-clustering-radius-merge-risk-confirmed.md` — the confirmed,
  reproducible bug this design fixes (two physically distinct windows with a
  masonry-pier gap under 500mm merge into one candidate).
- `memory/meeting-2026-08-04-window-symbol-pipeline-clustering-radius-resolution.md`
  — the earlier threshold sweep (500→60mm) that established no single flat radius
  works, since intra-symbol evidence spread (100-300mm+) and inter-window pier gaps
  (as low as 300mm, per this bug) overlap.
- `docs/superpowers/specs/2026-08-04-window-symbol-pipeline-integration-design.md`
  — the already-shipped pipeline this design extends (`OpeningSymbolDetector`,
  `OpeningSymbolPipeline`).

## Problem

`OpeningSymbolDetector._CLUSTER_PROXIMITY_MM = 500.0` clusters raw CAD evidence
lines by flat center-to-center distance. This conflates two distinct, overlapping
distance distributions:
1. **Intra-symbol spread**: one window's own frame/sash/rail lines, legitimately
   100-300mm+ apart.
2. **Inter-window pier gap**: two physically separate windows sharing a wall run,
   separated by an ordinary masonry pier as narrow as 300mm.

No single flat radius separates these — confirmed empirically by the 2026-08-04
sweep (tightening the radius fixes over-merging but reintroduces fragmentation of
single symbols) and by a direct synthetic reproduction of the merge bug (two 900mm
windows, 300mm gap, merge into one 2100mm/8-line candidate at the current 500mm
setting).

## Design

Replace flat-radius-only clustering with a **confidence-guided two-pass** process,
implemented at the `OpeningSymbolPipeline` orchestration level (not inside
`OpeningSymbolDetector`, preserving its stated design principle — "Detector는
Classification 책임을 가지지 않는다" — the detector still only clusters and knows
nothing about classification; the pipeline adds a second clustering pass informed by
the classification stage it already runs).

### Pass 1 — Tight clustering (detector, unchanged responsibility)

`OpeningSymbolDetector` runs with a **tightened** `_CLUSTER_PROXIMITY_MM`
(candidate value: 150mm — see Verification Gate; the exact value is an empirical
constant to be confirmed, not assumed) instead of 500mm. This intentionally
under-clusters relative to today: a single window's own evidence may now split into
2+ sub-clusters, and two physically separate windows will almost always land in
separate sub-clusters (a 300mm pier exceeds a 150mm radius).

### Pass 1.5 — Evaluate each sub-cluster (pipeline, existing stages, unchanged)

For each Pass-1 sub-cluster, run the pipeline's existing Evidence → Features →
Classifier → Confidence stages exactly as today, unmodified. This produces a
`final_confidence` and `classification.matches` per sub-cluster — the exact same
signals `OpeningSymbolPipeline.run()` already computes.

### Pass 2 — Confidence-guided re-merge (new, pipeline-level)

**Revised during spec review (2026-08-05) from pairwise merging to a merge-graph +
connected-components batch process** — a naive greedy pairwise merge over 3+
mutually-eligible sub-clusters (e.g. A–B–C in a chain) is order-dependent: merging
A+B first then attempting (A+B)+C can produce a different, non-deterministic result
than merging B+C first. The corrected process:

1. **Build a merge-eligibility graph.** Nodes = Pass-1 sub-clusters below the
   completeness threshold (candidate value: `_SUBCLUSTER_COMPLETE_CONFIDENCE = 0.35`
   — see Verification Gate; deliberately lower than the existing
   `_PIPELINE_MIN_CONFIDENCE = 0.5` final-emission threshold in the handler layer,
   since this is a *provisional* per-sub-cluster check, not the final accept/reject
   decision). An edge connects two nodes via one of two rules, depending on
   whether either node is **sparse** (≤1 total evidence item — e.g. a single
   line, which has no well-defined shape of its own to compare):

   - **Standard rule** (neither node sparse) — BOTH:
     - **Within the original flat radius** (500mm, unchanged outer bound — Pass 2
       only reconsiders pairs Pass 1 would have merged under the old behavior).
     - **Collinear along one axis**, computed via each sub-cluster's **PCA
       principal axis** (not a naive mean of line angles — flagged during spec
       review: angle averaging breaks down for near-180°-apart angles, e.g. a
       0°/179° pair averages to a meaningless ~90°, which PCA's
       principal-axis-of-point-cloud approach avoids entirely). Two sub-clusters
       are collinear when their principal axes agree within a tolerance
       (candidate value: 10°) AND the vector between their centroids is parallel
       to that shared axis within the same tolerance.
   - **Sparse-node rule** (added after the Verification Gate surfaced a real
     failure case — see Result below): a sparse sub-cluster has no principal
     axis worth comparing, and forcing the standard rule incorrectly rejects
     legitimate cases like an AWNING symbol's diagonal brace line, which is
     never parallel to its frame by definition and whose centroid can fall
     outside the 500mm flat radius even though its endpoint touches the frame
     directly. When either node is sparse, replace BOTH the centroid-distance
     gate and the collinearity check with a single **point-to-bbox
     touch-distance check**: the minimum distance from any of the sparse
     sub-cluster's line endpoints to the other sub-cluster's bounding box
     (candidate value: `_MERGE_TOUCH_TOLERANCE_MM = 75.0`). This directly
     encodes "does this stray line actually connect into the other evidence
     group," is orientation-agnostic, and correctly handles a diagonal line
     whose endpoint lands exactly at (or very near) a frame corner.
2. **Compute connected components** of that graph. Each component (not each pair)
   is one merge unit — this makes Pass 2 fully order-independent: A–B–C all in one
   component merge together in a single batch operation regardless of which edge
   is evaluated first, and there is no possibility of the "(A+B) then +C" vs.
   "A then +(B+C)" divergence a pairwise-greedy approach would risk.
3. **Merge each component as one batch operation** (not sequential pairwise unions)
   — combine all lines/arcs/polylines from every sub-cluster in the component into
   a single candidate in one step, then re-run Evidence → Features → Classifier →
   Confidence on the combined result exactly like today's single-pass flow.
4. **Merge rollback (revised 2026-08-05 from strict `>` to `>=`, after the gate missed a real case)**: after re-classifying a merged component, compare `merged_confidence` against `max(original_confidence for each sub-cluster in the component)`. **Reject the merge only when `merged_confidence < max(original)` — i.e. only when combining the components' evidence actually makes classification WORSE (confuses the classifier, e.g. mismatched frame/sash patterns that don't belong together). A tie (`merged == max(original)`) or an improvement accepts the merge.** The original strict-`>` draft rejected ties as well; it was relaxed to `>=` after surfacing a regression the Verification Gate's 5 golden + 4 synthetic fixtures missed: a single window symbol whose evidence fragments in Pass 1 AND whose merged form is itself unclassifiable (a bare 4-line rectangular frame no style recognizes) sits at the same confidence either way, so strict `>` rolled the tie back and re-emitted the fragments (N candidates for 1 symbol) — strictly worse than the old single-cluster behavior. `>=` reassembles it to one candidate without weakening the guard against genuinely confusing merges, preserving the design's intent: merging is accepted unless it demonstrably hurts classification.

**Sub-clusters that already meet the completeness threshold are never merge-graph
nodes at all**, regardless of proximity to a neighbor — this is the core fix: a
paired window whose each half already looks like a complete, classifiable symbol on
its own stands as two separate final candidates, while a genuinely fragmented single
symbol (each piece alone too sparse to classify confidently) gets reassembled,
subject to the rollback check in step 4.

### Constants (new/changed)

| Constant | Old | Final (confirmed via gate, see Result) | Meaning |
|---|---|---|---|
| `OpeningSymbolDetector._CLUSTER_PROXIMITY_MM` | 500.0 | **200.0** | Pass 1 tight-clustering radius. |
| `OpeningSymbolPipeline._SUBCLUSTER_COMPLETE_CONFIDENCE` | n/a (new) | **0.4** | Below this, a Pass-1 sub-cluster is eligible for Pass-2 re-merge. (Note: the existing `_PIPELINE_MIN_CONFIDENCE = 0.5` referenced for comparison lives in the *handler* layer — `cad_io/handlers/space.py:291` — not inside `OpeningSymbolPipeline` itself; the new constant belongs in `opening_pipeline.py`, a different module.) |
| `OpeningSymbolPipeline._MERGE_RADIUS_MM` | n/a (new) | **500.0** (= old flat radius) | Pass 2's outer distance bound, standard (non-sparse) rule only. |
| `OpeningSymbolPipeline._MERGE_COLLINEARITY_DEG` | n/a (new) | **15.0** | Pass 2's direction-agreement tolerance, standard rule only. |
| `OpeningSymbolPipeline._MERGE_TOUCH_TOLERANCE_MM` | n/a (new) | **75.0** | Pass 2's point-to-bbox touch distance for the sparse-node rule. |

All five are genuinely empirical and were **confirmed against real data before
implementation**, per the Verification Gate below — do not hardcode the candidate
values into an implementation plan without running the gate first.

## Non-goals

- No change to `OpeningSymbolDetector`'s stated responsibility boundary (still pure
  clustering, no classification knowledge) — Pass 2 lives in
  `OpeningSymbolPipeline.run()`, which already owns orchestration across
  Detector/Evidence/Features/Classifier/Confidence.
- No wall-axis/wall-segment input added to the detector or pipeline — confirmed
  with the user as explicitly out of scope for this design; a pure-geometry fix
  only.
- No change to `WindowClassifier`, `ConfidenceFuser`, or evidence-extraction logic
  themselves — Pass 1.5/Pass 2 only change *when* and *what* gets fed into those
  existing, unmodified stages.
- No change to door detection (`OpeningCandidate` is opening-kind-agnostic per its
  own docstring, so this design's mechanism is reusable for doors later, but this
  design does not extend or test against door evidence — tracked separately as
  Backlog item "upgrade door recognition").
- Using an **absolute** completeness threshold (`_SUBCLUSTER_COMPLETE_CONFIDENCE`),
  not a relative one (e.g. confidence-gap or expected-completeness-ratio between
  neighboring sub-clusters) — raised during spec review as a real future
  refinement (an absolute 0.35 cutoff treats 0.34/0.33 as clearly fragmentary and
  0.49/0.48 as clearly complete, which may not always hold), but confirmed
  reasonable to start with for this scope; not implemented here.
- Not attempting to distinguish "masonry pier between two real openings" from
  "mullion bar within one opening" via any signal other than post-classification
  completeness — a genuinely ambiguous case (e.g. two adjacent, each-individually-
  sparse window fragments that happen to be two separate real windows, not one) is
  a known, accepted residual risk of this design, not solved by it. This is a
  deliberate scope boundary, not an oversight — a more precise disambiguation would
  need real evidence-pattern semantics (e.g. detecting a repeated frame-motif),
  which is a larger effort than this fix's scope.

## Pre-Implementation Verification Gate (blocking, per project convention)

Before an implementation plan is written, build and run **synthetic
ground-truth fixtures** (the exact gap this project's prior clustering
investigations lacked, per the "why this wasn't caught before" analysis in
`memory/2026-08-05-clustering-radius-merge-risk-confirmed.md`) — the set below
grew from 2 to 4 during the gate's own execution, as running it surfaced real
gaps each addition was built to close:

1. **Paired-windows-with-pier fixture**: two complete window symbols, each with
   enough evidence lines to classify confidently on its own (e.g. 4 lines, matching
   `balcony_assembly_01`'s style — note `sliding_01` itself only has 3 lines, use
   `balcony_assembly_01` as the line-count reference), placed with a 250-400mm gap
   between facing edges. **Expected: 2 final candidates**, both classified, neither
   incorrectly merged.
2. **Single-fragmented-window fixture**: one window's frame/sash/rail lines
   deliberately split into 2 spatially separated groups (simulating a drafting
   style where evidence is sparse/spread), each individually insufficient for
   confident classification, with a gap under the flat 500mm outer bound.
   **Expected: 1 final candidate**, correctly reassembled and classified.
3. **Corner-windows fixture** (added during spec review — validates collinearity is
   actually doing work, not just distance): two low-confidence/sparse sub-clusters
   placed close together (within the 500mm outer bound, so distance alone would
   make them merge-eligible) but oriented along **different wall directions** (e.g.
   one running along the x-axis, the other along the y-axis, as at a real room
   corner). **Expected: NO merge** — 2 final candidates (or 2 unresolved/low-
   confidence results, per whatever the pipeline's normal behavior is for a
   standalone low-confidence candidate — the key assertion is that collinearity
   correctly blocks the merge that distance alone would have allowed).
4. **Far-stray-line fixture** (added after the sparse-node touch-distance rule
   was introduced — see Result, guards against the new rule being too
   permissive): a lone single-line sub-cluster 800mm from an unrelated
   low-confidence group. **Expected: NO merge** — the touch-distance check must
   still have a real ceiling; a sparse fragment shouldn't merge with an
   arbitrarily distant, unrelated group just because it's sparse.

Run all four fixtures through the full pipeline with the candidate constants above.
Sweep `_CLUSTER_PROXIMITY_MM` (Pass 1) and `_SUBCLUSTER_COMPLETE_CONFIDENCE`
(Pass 2 threshold) — similar in spirit to the 2026-08-04 sweep, but this time
scored against these fixtures' KNOWN correct answers (2 / 1 / 2 / 2 candidates
respectively), not just candidate-count trends on a real drawing without
independently known ground truth.

Additionally, **re-run all 5 existing golden fixtures**
(`tests/golden/windows/{sliding,fixed,casement,awning,balcony_assembly}_01`)
through the new two-pass pipeline to confirm no regression — each must still
produce exactly 1 candidate, correctly classified, as today.

Only proceed to an implementation plan once constants are found that satisfy: all
four new synthetic fixtures' expected candidate counts AND all 5 existing golden
fixtures' unchanged behavior, simultaneously. If no single constant set satisfies
all four synthetic fixtures, escalate to the user — this would mean the confidence-
guided approach itself needs revision, not just constant tuning (do not force a
value that only partially works).

### Result (executed 2026-08-05, direct Python prototype against 4 synthetic
fixtures + all 5 existing golden fixtures)

**Constants confirmed** (12/60 swept combinations satisfied the first 3 synthetic
fixtures; picked the central value from the passing range for the standard-rule
constants, then added and confirmed the sparse-node touch-tolerance constant
after the golden-fixture regression check surfaced a real gap — see below):

| Constant | Confirmed value |
|---|---|
| `OpeningSymbolDetector._CLUSTER_PROXIMITY_MM` | **200.0** |
| `OpeningSymbolPipeline._SUBCLUSTER_COMPLETE_CONFIDENCE` | **0.4** |
| `OpeningSymbolPipeline._MERGE_RADIUS_MM` | **500.0** (unchanged from old flat radius) |
| `OpeningSymbolPipeline._MERGE_COLLINEARITY_DEG` | **15.0** |
| `OpeningSymbolPipeline._MERGE_TOUCH_TOLERANCE_MM` | **75.0** |

1. **`paired_windows` (the core bug fixture)**: 2/2 correct across **all 60** swept
   combinations of the first three constants — the fix is robust, not narrowly
   threshold-dependent.
2. **`fragmented_single`**: correctly reassembles to 1 at the confirmed constants.
   Note: an evenly-split 3-line/3-line fragmentation of the SLIDING pattern does
   NOT produce a useful test case — the classifier is pattern-based (parallel-line
   count), not length-based, so even a short, complete-looking half classifies
   confidently (0.835) at any length. The final fixture uses an uneven split
   (1 line / 2 lines) to produce genuinely low per-half confidence (0.36, no style
   match), a more realistic model of real fragmentation (e.g. a hatch or dimension
   line knocking out one line unevenly).
3. **`corner_windows`**: correctly stays at 2 (no merge) — confirms collinearity,
   not just distance, gates the merge for the standard (non-sparse) rule.
4. **`far_stray_line`** (added alongside the sparse-node rule, to guard against
   the new rule being too permissive): a lone stray line 800mm from an unrelated
   low-confidence group does NOT touch-merge — confirms the sparse-node rule's
   touch-tolerance (75mm) doesn't degrade into "any sparse fragment merges with
   anything nearby."

**Golden-fixture regression check — found and fixed one real gap, not merely
flagged.** `sliding_01`, `fixed_01`, `casement_01`, `balcony_assembly_01` all
correctly remain 1 candidate under the new two-pass logic (standard rule).
`awning_01` initially produced **2 candidates** — traced to its diagonal brace
line's centroid sitting 538-559mm from the parallel frame lines' centroids,
exceeding even the original flat 500mm radius (confirmed this is ALSO true under
today's currently-shipped, unmodified single-pass algorithm — not a regression
this design introduces; `tests/test_window_pipeline.py`'s "1 candidate" result
for this fixture today is achieved because its loader bypasses
`OpeningSymbolDetector` entirely and never exercises real spatial clustering — a
latent test-coverage gap this Verification Gate happened to surface). Root
cause: a single evidence line (the diagonal brace) has no principal axis worth
comparing to a frame group's axis, so the standard collinearity rule
structurally cannot handle it. **Fixed within this design's scope** (user
direction, 2026-08-05) by adding the sparse-node touch-distance rule described
above — re-verified: `awning_01`'s diagonal line's endpoint sits exactly at
(0, 0), a corner of the frame's bounding box (touch distance 0mm, well under the
75mm tolerance), so it now correctly merges back to 1 candidate.

**Gate verdict: PASSED, all 9 fixtures (4 synthetic + 5 golden) correct** at the
final confirmed constants, including the sparse-node rule addition.
