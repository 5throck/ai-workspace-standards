---
lang: ko
lang_reason: proper-noun
---

# `zwcad_extract_text_labels` — New MCP Tool Design Spec

> **Status**: Draft, pending spec review
> **Created**: 2026-07-31
> **Related**: `docs/superpowers/specs/2026-07-31-sidecar-door-pattern-detection-design.md` (established convention: `search_layers` never hardcoded, live-COM-read style for data the cache doesn't carry)

## Problem

While matching detected rooms against door/window info, a real need surfaced: the reference drawing's `7TXT` layer has 84 `AcDbText` entities — almost certainly room-name labels (e.g. "거실", "침실") — but no existing MCP tool exposes text-entity *content* (the string itself). `Entry`/`ModelSpaceScanResult` (`common/models.py`) has no text-value field at all; `zwcad_analyze_layers` only returns per-layer entity-type histograms, not individual entity content; `zwcad_extract_cad_objects`'s `scanned_entities` is scoped to wall/door/window-relevant layers, not arbitrary text layers.

## Goal

Add a new, standalone MCP tool, `zwcad_extract_text_labels`, that returns the text content + position of every `AcDbText`/`AcDbMText` entity on a caller-specified set of layers. Generalized (not scoped to room-name labels specifically, not scoped to "7TXT") — any caller-supplied `search_layers` list works, matching this session's established "never hardcode a layer name in Python" convention from the door/window sidecar work.

## Non-Goals

- Not attempting to correlate text labels with rooms automatically in this tool — that's a follow-up step done by the caller (or a future tool), using the returned `position` field against `SpacePolygon.polygon_points` from `zwcad_generate_spaces`.
- Not parsing/stripping MText formatting codes (e.g. `\P`, `\C1;`) from `AcDbMText.TextString` — returned verbatim; a known, documented limitation, not a defect, since MText codes are a separate parsing concern outside this tool's scope.
- Not modifying `Entry`/`ModelSpaceScanResult` to add a text field — this tool does its own narrowly-scoped live COM read (same "don't inflate the shared cache for a niche need" principle already established by `_detect_curved_cluster_doors`).

## Design

### Registration

New handler `handle_extract_text_labels(params: dict) -> HandlerResult` in `src/cad_intelligence/cad_io/handlers/space.py`, registered via the same `@register_tool(default_registry, name="zwcad_extract_text_labels", description=..., input_schema=..., requires_com=True)` decorator pattern already used by `handle_extract_cad_objects` (confirmed at `space.py:2191-2199` — this is the actual, current registration mechanism; the `com_bridge.py` file has an older, apparently-unregistered duplicate of `handle_extract_cad_objects` from a prior architecture generation and is out of scope/untouched here).

### Input schema

```python
_EXTRACT_TEXT_LABELS_SCHEMA = {
    "type": "object",
    "properties": {
        "search_layers": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Layer names to scan for AcDbText/AcDbMText entities. Required -- never defaults to a hardcoded layer name.",
        },
    },
    "required": ["search_layers"],
}
```

### Implementation

```python
def handle_extract_text_labels(params: dict) -> HandlerResult:
    if not _PYWIN32_AVAILABLE:
        raise ZWCADConnectionError(_STUB_MSG)

    search_layers = params.get("search_layers")
    if not search_layers:
        raise ValueError("search_layers is required and must be non-empty")
    layer_set = set(search_layers)

    bridge = _get_bridge()
    doc = bridge.app.ActiveDocument
    ms = doc.ModelSpace

    labels: list[dict] = []
    for i in range(ms.Count):
        entity = ms.Item(i)
        if entity.ObjectName not in ("AcDbText", "AcDbMText"):
            continue
        if entity.Layer not in layer_set:
            continue
        try:
            position = tuple(entity.InsertionPoint)[:2]
        except Exception:
            position = None
        labels.append({
            "handle": entity.Handle,
            "layer": entity.Layer,
            "object_name": entity.ObjectName,
            "text": entity.TextString,
            "position": list(position) if position else None,
        })
    return HandlerResult.success(text_labels=labels)
```

This mirrors `_detect_curved_cluster_doors`'s live-COM-read style (`ms.Count`/`ms.Item(i)` iteration, try/except around a COM property read that could be absent/fail on some entity subtype) rather than a live-COM helper elsewhere, since no shared cache carries text content today.

## Testing

1. A mocked `doc.ModelSpace` with one `AcDbText` entity on a layer in `search_layers` → returned in `text_labels` with correct `handle`/`layer`/`text`/`position`.
2. An `AcDbMText` entity → also returned (both types handled).
3. An entity on a layer NOT in `search_layers` → excluded (regression: must not hardcode any layer name).
4. A non-text entity (e.g. `AcDbLine`) on a matching layer → excluded (type filter works).
5. Empty `search_layers` (`[]` or omitted) → `ValueError` (fail loud, not silent empty-list-passthrough — same "caller-facing param, not internal plumbing" principle as the door/window `search_layers` convention).
6. **Manual real-drawing verification, required before this tool is trusted in production** (not just a nice-to-have): call `zwcad_extract_text_labels(search_layers=["7TXT"])` against the live drawing and confirm (a) `entity.TextString` doesn't raise/misbehave on `AcDbMText` specifically — no existing pitfall entry in the door-pattern sidecar's `known_pitfalls` covers this COM property on this ZWCAD binding, unlike `NumberOfVertices` (a documented precedent for COM properties silently diverging from AutoCAD ActiveX docs on this binding), so this is a genuinely unverified assumption, not a formality — and (b) labels with plausible Korean room-name text are returned at sensible positions.

## Files Touched

- `src/cad_intelligence/cad_io/handlers/space.py`: new schema constant, new `handle_extract_text_labels` handler.
- `tests/handlers/` — new test file `test_extract_text_labels.py`.
- `CHANGELOG.md`.
