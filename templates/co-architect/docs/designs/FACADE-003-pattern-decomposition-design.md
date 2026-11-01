# FACADE-003 — FacadePattern Decomposition

> **Status**: Implemented
> **Dependencies**: FACADE-001 (mesh pipeline), FACADE-002 (multi-floor assembly)
> **Supersedes**: Flat `FacadePattern` constructor (deprecated in favor of composed sub-patterns)
> **Updated**: 2026-07-11 — implementation complete: `OpeningPattern`, `EntrancePattern`, `WindowBandPattern` sub-patterns; `PatternKind(StrEnum)`; `PatternChangeSet` with lazy init; `PatternConflict`; `from_legacy()` migration; `FacadePatternApplier` sub-pattern dispatch

---

## 1. Problem

`FacadePattern` is a flat monolith with mixed concerns:

```python
# Before (FACADE-002): flat fields for all pattern types
@dataclass(frozen=True)
class FacadePattern:
    pattern_id: str
    wall_height_ratio: float
    sill_height: float | None        # OpeningPattern concern
    window_height: float | None      # OpeningPattern concern
    door_height: float | None        # OpeningPattern concern
    has_entrance: bool               # EntrancePattern concern
    entrance_width: float | None     # EntrancePattern concern
    entrance_height: float | None    # EntrancePattern concern
```

Adding new pattern types (balcony, louver, shading, cornice) would grow this
monolith indefinitely. Flat fields also prevent type-safe dispatch — the
`FacadePatternApplier` must check multiple `None` fields to determine behavior.

## 2. Design

### 2.1 Sub-Pattern Composition

Decompose `FacadePattern` into composed frozen sub-patterns:

```
FacadePattern
├── wall_height_ratio: float
├── OpeningPattern?      (sill, window, rhythm)
├── EntrancePattern?     (width, height, position)
└── WindowBandPattern?   (band, spandrel, mullion)
```

Each sub-pattern is a `@dataclass(frozen=True)` with typed fields.
`FacadePattern` holds optional references — `None` means "not applicable".

### 2.2 PatternKind Enum

`PatternKind(StrEnum)` identifies which sub-pattern produced a `PatternChangeSet`:

```python
class PatternKind(StrEnum):
    OPENING = "opening"
    ENTRANCE = "entrance"
    WINDOW_BAND = "window_band"
```

Used by `PatternConflict.winner`/`PatternConflict.loser` instead of raw strings.

### 2.3 PatternChangeSet + Lazy Init

`PatternChangeSet` accumulates modifications from a single sub-pattern pass.
Each carries its own `source: PatternKind` — no caller-specified names needed.

```python
@dataclass
class PatternChangeSet:
    source: PatternKind
    sill_overrides: dict[str, float]
    height_overrides: dict[str, float]
    door_overrides: dict[str, float]
    added_openings: list[FacadeOpening]
    conflicts: list[PatternConflict]
```

`FacadePatternApplier.apply()` uses **lazy initialization**:
```python
changeset: PatternChangeSet | None = None  # lazy — first actual sub-pattern wins
if pattern.opening:
    changeset = self._apply_opening(floor, pattern.opening)
if pattern.window_band:
    wb = self._apply_window_band(floor, pattern.window_band)
    changeset = wb if changeset is None else changeset.merge(wb)
```

If all sub-patterns are `None`, returns the floor unchanged (early return).

### 2.4 Migration: `from_legacy()`

`from_legacy()` is a **migration helper, NOT deprecated**. It converts old
flat `FacadePattern` data into the new composed structure:

```python
@classmethod
def from_legacy(cls, **kwargs) -> "FacadePattern":
    """Migration helper: flat fields → composed sub-patterns."""
    ...
```

**What IS deprecated**: constructing `FacadePattern` with flat fields like
`sill_height=900` directly on the constructor. Use `from_legacy()` or the
new sub-pattern constructors.

### 2.5 PatternConflict

Conflicts during `merge()` are recorded with typed `winner`/`loser`:

```python
@dataclass
class PatternConflict:
    field: str
    wall_id: str
    winner: PatternKind    # Enum, not string
    loser: PatternKind     # Enum, not string
    winner_value: float | None
    loser_value: float | None
```

## 3. v1 Scope

| Sub-pattern | Fields | Priority |
|-------------|--------|----------|
| OpeningPattern | sill_height, window_height, rhythm | 1 |
| EntrancePattern | has_entrance, entrance_width, entrance_height, position | 2 |
| WindowBandPattern | band_height, spandrel_height, mullion_spacing | 3 |

## 4. v2 (Future)

CurtainWall, Balcony, Louver, Shading, Cornice sub-patterns — add as new
frozen dataclasses + `PatternKind` enum values. No changes to `FacadePattern`
or `PatternChangeSet` structure needed.
