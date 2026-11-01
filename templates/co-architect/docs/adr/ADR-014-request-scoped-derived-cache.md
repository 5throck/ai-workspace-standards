# ADR-014: Request-Scoped Derived-Result Cache (`RequestContext.shared`)

**Status**: Accepted — Implemented
**Date**: 2026-07-14
**Related**: ADR-011 (HandlerResult), ADR-013 (COM Handler Migration), AXIS-001-design.md (Auto-Chain Redundant-Recompute Fix, 2026-07-14)

---

## Context

Several `handlers/space.py` MCP handlers follow an "auto-run upstream step if
inputs omitted" convention (documented throughout AXIS-001-design.md):
`handle_generate_axis_grid`, `handle_generate_spaces`, and
`handle_generate_wall_model` all re-invoke `handle_extract_cad_objects`
internally whenever the caller doesn't pass `walls`/`doors`/`windows`
directly, and `handle_find_opening_candidates`/`handle_assign_openings`
extend the same convention one or two levels deeper. This makes single-call
ergonomics good for MCP clients (`handle_assign_openings({})` "just works"
against the active drawing) at the cost of a call-graph that fans out with
chain depth.

`scan_modelspace()` (`handlers/space.py`) already deduplicates the one truly
expensive step — the raw COM walk of `doc.ModelSpace` — via
`RequestContext.scan_result`/`scan_document_id`, cleared at the end of every
MCP request. That cache does **not** cover the CPU-side work built on top of
the scan: `handle_extract_cad_objects`'s classify+flatten+typed-object
construction, `handle_generate_spaces`'s shapely polygonization, and
`handle_generate_axis_grid`'s clustering plus `{file}.axes.json`
reconcile/save I/O. Each auto-chain hop that omits its inputs re-does that
work from scratch.

Measured impact: a single `handle_assign_openings({})` call re-ran
`handle_extract_cad_objects` 3–4× and `handle_generate_spaces`/
`handle_generate_axis_grid` 2× each within one request — see
`tests/bench/test_com_performance.py::test_auto_chain_assign_openings`,
whose docstring called this "the worst-case user-facing latency before any
optimization."

**Notable finding**: `request_context.py` already declared a `SharedKey` enum
(`SCAN`, `LAYERS`, `GEOMETRY`, `WALL_CANDIDATES`) and a `RequestContext.shared`
dict specifically for this purpose, described in the module's own docstring
as part of a "three-layer state architecture." No handler ever read or wrote
`.shared` — it was dead infrastructure from a prior, never-completed pass.

## Decision

Activate `RequestContext.shared` as a request-scoped memoization cache for
the **default/auto-chain invocation** of the three handlers with the widest
fan-out, and add the missing keys/helpers to make it safe to use elsewhere.

### 1. `SharedKey` additions

```python
class SharedKey(str, enum.Enum):
    SCAN = "scan"                        # pre-existing, unused before this ADR
    LAYERS = "layers"                    # pre-existing, unused before this ADR
    GEOMETRY = "geometry"                # pre-existing, unused before this ADR
    WALL_CANDIDATES = "wall_candidates"  # pre-existing, unused before this ADR
    EXTRACTED_OBJECTS = "extracted_objects"  # new
    AXIS_GRID = "axis_grid"                  # new
    SPACES = "spaces"                        # new
```

`LAYERS`/`GEOMETRY`/`WALL_CANDIDATES` remain unused after this ADR — they are
pre-existing reservations for handlers not yet in scope, not a regression.

### 2. `get_shared`/`set_shared` — cache-key-gated, not blind reuse

```python
def get_shared(key: SharedKey, cache_key: object = None) -> object | None: ...
def set_shared(key: SharedKey, value: object, cache_key: object = None) -> None: ...
```

Entries are stored as `(cache_key, value)`. A lookup only returns the stored
value when the caller-supplied `cache_key` matches exactly; a mismatch is
treated as a miss, not a stale hit. This is deliberately conservative: it
costs one cheap tuple/string comparison per call and removes any need to
reason about whether two auto-chain invocations "probably" produced the same
inputs.

### 3. Scope: cache only the parameter-free default path

Each of the three handlers computes an `is_default_call` flag from its own
params and only consults/populates the cache when true:

| Handler | `is_default_call` condition | `cache_key` |
|---|---|---|
| `handle_extract_cad_objects` | `params.get("layers") is None` | `layers_json_path` |
| `handle_generate_spaces` | `walls`/`doors`/`windows`/`wall_components`/`layers`/`axis_grid` all `None` | `layers_json_path` |
| `handle_generate_axis_grid` | `params.get("walls") is None` | `(layers_json_path, doc_name, axes_path, profile)` |

Any call that supplies explicit override data — e.g.
`handle_find_opening_candidates` passing its own extracted `walls` into
`handle_generate_axis_grid`, or `handle_assign_openings` passing
`handle_generate_wall_model`'s post-dedup `Wall` list into a second
axis-grid call — bypasses the cache entirely and computes fresh, because the
result legitimately depends on caller-supplied data the cache cannot assume
is identical to a previous call's. This intentionally leaves some redundant
computation on the table (documented as a known limitation below) in
exchange for zero risk of returning a result computed from different inputs.

### 4. Invalidation

`ctx.shared` is cleared in the same two places `ctx.scan_result` already is:

- `invalidate_document()` (`handlers/request_context.py`) — any mutation
  handler calling this also drops derived caches, not just the scan.
- `scan_modelspace()`'s cache-miss branch, when the active document changes
  mid-request (`cached_id != doc_id`) — derived results computed for the
  previous document must not leak into the new one.

### 5. Telemetry

`TelemetryKey.SHARED_CACHE_HITS`/`SHARED_CACHE_MISSES` (new) track
request-scoped hit/miss counts, mirroring the existing
`SCAN_CACHE_HITS`/`SCAN_CACHE_MISSES` pattern. Used by
`test_auto_chain_assign_openings` to assert hits > 0 as a regression guard.

## Consequences

### Positive

- `handle_assign_openings({})`'s deepest auto-chain no longer recomputes
  `handle_extract_cad_objects`/`handle_generate_spaces` from scratch on every
  hop within one request.
- Zero change to any handler's public parameters, return shape, or the
  additive-only auto-chain convention (AXIS-001 B1–B3's own "additive-only
  constraint" still holds — this is a memoization layer underneath it).
- Reuses `request_context.py`'s existing lifecycle guarantees (per-request
  lifetime, `invalidate_document()` on mutation) instead of introducing a new
  cache with its own invalidation rules.

### Negative / Known limitations

- **Not fully general**: calls with explicit override params are not
  deduplicated even when their inputs often originate from the same
  underlying extraction. Closing this gap in general would require a
  value-based cache key (e.g. hashing the `walls` payload), which was
  judged not worth the complexity/risk for this pass — tracked as future
  work if profiling shows it still matters.

  > **Update (2026-07-14, same-day follow-up)**: one instance of this
  > "explicit override" pattern turned out not to be a legitimate
  > distinct-inputs case at all, but a latent bug. `handle_assign_openings`
  > was passing `handle_generate_wall_model`'s output (`Wall.to_dict()`,
  > keyed by `id`) as the `walls` override into `handle_generate_axis_grid`,
  > which parses its `walls` param as raw `WallSegment.to_dict()` (keyed by
  > `handle`). Every such call raised `KeyError('handle')` inside
  > `_WallSegment.from_dict`, silently swallowed by a blanket
  > `except Exception: pass` — so `axis_grid_obj` was always `None` via
  > this path and the dimension-corroboration step (`corroborate_dimensions`,
  > §8.1's 0.20-weighted dimension evidence) never ran through the
  > auto-chain, in addition to the wasted recompute. Fixed by removing the
  > explicit `walls` override entirely: `handle_assign_openings` now calls
  > `handle_generate_axis_grid({"layers_json_path": ...})` and lets it
  > auto-chain its own `WallSegment` extraction — which is *also* now a
  > cache hit in the common case, since `handle_find_opening_candidates`'s
  > earlier default-invocation call already populated the same
  > `SharedKey.AXIS_GRID` entry. This closes the specific case that
  > mattered most; genuinely distinct-input explicit-override calls (e.g. a
  > future caller supplying a hand-edited axis grid) remain uncached by
  > design.
- `RequestContext.shared` is keyed by `SharedKey` only (one slot per key per
  request), not per-document — safe today because a request only ever
  targets one active document, but would need revisiting if a future
  handler operates across multiple documents in one request.
- Thread-local (`_ctx`, `threading.local()`) — safe under the current
  single-request-at-a-time server loop; would need reassessment under a
  concurrent-request execution model.

## Verification

Full suite: 3623 passed, 5 skipped (unrelated optional-dependency skips), 0
failed. `bun scripts/audit.ts` — all checks passed. PR
[#140](https://github.com/5throck/co-architect/pull/140).
