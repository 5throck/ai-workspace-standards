# Pac-Man — Code Architecture

**Date**: 2026-06-27
**Status**: Approved (pending PM GATE)
**Author**: architect

---

## 1. Module Architecture

### 1.1 Module Overview

```
main.ts
├── config/          (no dependencies)
│   ├── constants.ts
│   └── types.ts
├── maps/            (depends on: config)
│   └── level-1.ts
├── engine/          (depends on: config)
│   ├── GameLoop.ts
│   ├── Renderer.ts
│   ├── InputManager.ts
│   └── CollisionSystem.ts
├── entities/        (depends on: config, engine)
│   ├── EntityBase.ts
│   ├── Pacman.ts
│   ├── GhostBase.ts
│   ├── Blinky.ts
│   ├── Pinky.ts
│   ├── Inky.ts
│   ├── Clyde.ts
│   ├── Dot.ts
│   ├── PowerPellet.ts
│   └── Fruit.ts
├── systems/         (depends on: config, entities)
│   ├── StateMachine.ts
│   ├── ScoreSystem.ts
│   ├── StageManager.ts
│   └── GhostHouseManager.ts
├── renderers/       (depends on: config, entities)
│   ├── PacmanRenderer.ts
│   ├── GhostRenderer.ts
│   ├── MazeRenderer.ts
│   └── HUDRenderer.ts
└── ui/              (depends on: config)
    ├── StartScreen.ts
    ├── PauseScreen.ts
    └── GameOverScreen.ts
```

### 1.2 Module Responsibilities

| Module | Responsibility | Public API |
|--------|---------------|------------|
| `config/` | Constants, enums, type definitions, interfaces | All shared types and game constants |
| `engine/` | Core game loop, canvas rendering, input, collision | `GameLoop.start()`, `Renderer.draw()`, `InputManager`, `CollisionSystem.check()` |
| `entities/` | All game objects with position, velocity, state | `EntityBase.update()`, `Pacman`, `GhostBase`, `Dot`, `PowerPellet`, `Fruit` |
| `systems/` | Game-wide state management, scoring, stages | `StateMachine`, `ScoreSystem`, `StageManager`, `GhostHouseManager` |
| `maps/` | Level data as tile arrays, map loading | `MapData` interface, `getLevelData(stage: number): MapData` |
| `renderers/` | Procedural drawing for entities and maze | `PacmanRenderer.draw()`, `GhostRenderer.draw()`, `MazeRenderer.draw()`, `HUDRenderer.draw()` |
| `ui/` | Screen overlays (start, pause, game over) | `StartScreen.show()`, `PauseScreen.show()`, `GameOverScreen.show()` |

### 1.3 Dependency Rules

- `config/` has ZERO dependencies (pure types and constants)
- `engine/` depends only on `config/`
- `entities/` depends on `config/` and `engine/`
- `systems/` depends on `config/` and `entities/`
- `renderers/` depends on `config/` and `entities/`
- `maps/` depends on `config/`
- `ui/` depends on `config/`
- `main.ts` orchestrates all modules

**No circular dependencies exist in this graph.**

---

## 2. Core Type System

### 2.1 Enums

```typescript
enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  NONE = 'NONE'
}

enum TileType {
  EMPTY = 0,
  WALL = 1,
  DOT = 2,
  POWER_PELLET = 3,
  GHOST_HOUSE_DOOR = 4,
  GHOST_HOUSE = 5,
  TUNNEL = 6,
  FRUIT_SPAWN = 7
}

enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  DYING = 'DYING',
  GAME_OVER = 'GAME_OVER',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE'
}

enum PacmanState {
  NORMAL = 'NORMAL',
  DYING = 'DYING',
  RESPAWNING = 'RESPAWNING'
}

enum GhostMode {
  SCATTER = 'SCATTER',
  CHASE = 'CHASE',
  FRIGHTENED = 'FRIGHTENED',
  EATEN = 'EATEN',
  IN_HOUSE = 'IN_HOUSE',
  LEAVING_HOUSE = 'LEAVING_HOUSE'
}

enum GhostName {
  BLINKY = 'BLINKY',
  PINKY = 'PINKY',
  INKY = 'INKY',
  CLYDE = 'CLYDE'
}

enum FruitType {
  CHERRY = 'CHERRY',
  STRAWBERRY = 'STRAWBERRY',
  ORANGE = 'ORANGE',
  APPLE = 'APPLE',
  MELON = 'MELON',
  GALAXIAN = 'GALAXIAN',
  BELL = 'BELL',
  KEY = 'KEY'
}
```

### 2.2 Core Interfaces

```typescript
interface Position {
  x: number;  // pixel position
  y: number;
}

interface Velocity {
  dx: number; // pixels per update
  dy: number;
}

interface TileCoord {
  col: number; // tile column (0-27)
  row: number; // tile row (0-30)
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MapData {
  tiles: TileType[][];
  pacmanStart: TileCoord;
  ghostStarts: Record<GhostName, TileCoord>;
  fruitSpawn: TileCoord;
  tunnelRow: number;
  totalDots: number;
}

interface Entity {
  position: Position;
  velocity: Velocity;
  direction: Direction;
  nextDirection: Direction; // buffered input
  tileCoord(): TileCoord;
  update(deltaTime: number): void;
  reset(start: TileCoord): void;
}

interface AnimationFrame {
  direction: Direction;
  frame: number;      // frame index within animation cycle
  totalFrames: number; // total frames in this animation cycle
}

interface GhostTargetStrategy {
  getTarget(ghost: TileCoord, pacman: TileCoord, ghosts: Record<GhostName, TileCoord>): TileCoord;
}

interface ScatterChaseCycle {
  mode: GhostMode.SCATTER | GhostMode.CHASE;
  duration: number; // milliseconds
}

interface ScoreEvent {
  type: 'dot' | 'power_pellet' | 'ghost' | 'fruit';
  points: number;
  position: TileCoord;
}

interface ScatterTarget {
  col: number;
  row: number;
}
```

### 2.3 Entity Class Hierarchy

```
EntityBase (abstract)
├── Pacman
├── GhostBase (abstract)
│   ├── Blinky
│   ├── Pinky
│   ├── Inky
│   └── Clyde
├── Dot
├── PowerPellet
└── Fruit
```

`EntityBase` provides: position, velocity, direction, nextDirection, tileCoord(), reset()

`GhostBase` adds: mode (GhostMode), targetStrategy, frightenedTimer, releaseTimer

---

## 3. Game Loop Architecture

### 3.1 Fixed Timestep with Accumulator

```typescript
class GameLoop {
  private readonly FIXED_DT = 1000 / 60; // 16.67ms
  private accumulator = 0;
  private lastTime = 0;
  private running = false;

  /** Interpolation alpha (0–1) between physics ticks for smooth rendering. */
  get renderAlpha(): number { return this.accumulator / this.fixedDt; }

  /** Render callback receives alpha for interpolation (backward compat with zero-arg). */
  onRender: ((alpha: number) => void) | (() => void) | null = null;

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private loop(currentTime: number): void {
    if (!this.running) return;
    const elapsed = currentTime - this.lastTime;
    this.lastTime = currentTime;
    this.accumulator += Math.min(elapsed, 100); // cap at 100ms to prevent spiral

    while (this.accumulator >= this.FIXED_DT) {
      this.update(this.FIXED_DT);
      this.accumulator -= this.FIXED_DT;
    }

    const alpha = this.accumulator / this.FIXED_DT;
    this.onRender?.(alpha); // encoding-check-ignore
    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void { /* all game logic */ }

  pause(): void { this.running = false; }
  resume(): void { this.start(); }
}
```

### 3.2 Design Decisions

- **Fixed timestep for update**: Ensures deterministic game logic regardless of frame rate
- **Variable render**: Render every rAF call for smooth visuals
- **Accumulator cap (100ms)**: Prevents death spiral if tab is backgrounded
- **Update/render separation**: Clean separation of concerns
- **Render interpolation alpha**: `renderAlpha = accumulator / fixedDt` provides a 0–1 factor for smoothing visual positions between discrete physics ticks. Renderers can use this to interpolate entity positions for sub-tick rendering.

### 3.3 Input Buffering

```typescript
class InputManager {
  private bufferedInput: Direction = Direction.NONE;

  handleKeyDown(key: string): void {
    const dir = this.keyToDirection(key);
    if (dir !== Direction.NONE) {
      this.bufferedInput = dir; // single-slot buffer
    }
  }

  consumeInput(): Direction {
    const input = this.bufferedInput;
    this.bufferedInput = Direction.NONE;
    return input;
  }
}
```

**Pre-turn buffering**: Player can press the next direction BEFORE reaching an intersection. When the entity reaches a tile center where the desired direction is valid, the buffer is consumed and the entity turns.

---

## 4. Collision System Design

### 4.1 Tile-Based Wall Collision

Entities move pixel-by-pixel. At each update:
1. Calculate next position based on velocity
2. Check leading-edge tile(s) against map data
3. If next tile is WALL, stop movement along that axis (snap to tile edge)
4. Check for grid alignment (within tolerance) to allow direction change

```typescript
class CollisionSystem {
  canMove(pos: Position, vel: Velocity, map: MapData): boolean {
    // Check the tile at the leading edge of the entity's bounding box
    const leadingX = pos.x + vel.dx + (vel.dx > 0 ? HALF_SIZE : -HALF_SIZE);
    const leadingY = pos.y + vel.dy + (vel.dy > 0 ? HALF_SIZE : -HALF_SIZE);
    const tile = this.getTileAtPixel(leadingX, leadingY, map);
    return tile === TileType.EMPTY || tile === TileType.DOT ||
           tile === TileType.POWER_PELLET || tile === TileType.TUNNEL ||
           tile === TileType.FRUIT_SPAWN;
  }
}
```

### 4.2 Grid Alignment Enforcement

For smooth cornering, entities are considered "grid-aligned" when within `ALIGNMENT_TOLERANCE` (2px) of a tile center. Only grid-aligned entities can change direction.

### 4.3 Entity-Entity Collision

Simple distance-based check: if two entities' tile coordinates match (same tile), they are colliding.

| Interaction | Condition | Result |
|------------|-----------|--------|
| Pac-Man + Dot | Same tile, ghost mode irrelevant | Dot collected, +10 points |
| Pac-Man + Power Pellet | Same tile | Pellet collected, +50 points, ghosts → FRIGHTENED |
| Pac-Man + Ghost (SCATTER/CHASE) | Same tile | Pac-Man dies |
| Pac-Man + Ghost (FRIGHTENED) | Same tile | Ghost eaten, Pac-Man gets points |
| Pac-Man + Ghost (EATEN) | Same tile | No collision (pass through) |
| Pac-Man + Fruit | Same tile | Fruit collected, bonus points |

### 4.4 Tunnel Wrapping

When Pac-Man or a ghost's x-position goes below 0, wrap to the right side of the map, and vice versa. Tunnel row is defined in `MapData.tunnelRow`.

---

## 5. State Machine Pattern

### 5.1 Generic StateMachine<TState>

```typescript
/** Metadata passed to all state-change callbacks. */
interface TransitionEvent<TState> {
  from: TState;
  to: TState;
  trigger?: string;          // optional label identifying what caused the transition
}

/** Callback signature — receives event metadata. Zero-arg callbacks are supported
 *  via JS argument-passing semantics (extra args silently ignored). */
type StateChangeCallback<TState> = (event: TransitionEvent<TState>) => void;

class StateMachine<TState extends string> {
  private current: TState;
  private transitions: Map<string, Set<TState>> = new Map();
  private onEnter: Map<TState, StateChangeCallback<TState>[]> = new Map();
  private onExit: Map<TState, StateChangeCallback<TState>[]> = new Map();

  constructor(initial: TState) { this.current = initial; }

  /** 'from' accepts '*' wildcard to allow transition from ANY current state. */
  addTransition(from: TState | '*', to: TState): void { /* ... */ }
  onStateEnter(state: TState, callback: StateChangeCallback<TState>): void { /* ... */ }
  onStateExit(state: TState, callback: StateChangeCallback<TState>): void { /* ... */ }

  /** Passes TransitionEvent to all callbacks. Specific transitions take priority
   *  over wildcard ('*') transitions when both match. */
  transition(to: TState, trigger?: string): boolean {
    const allowed = this.transitions.get(this.current) ?? this.transitions.get('*'); // encoding-check-ignore
    if (!allowed?.has(to)) return false; // encoding-check-ignore
    const event: TransitionEvent<TState> = { from: this.current, to, trigger };
    this.onExit.get(this.current)?.forEach(cb => cb(event)); // encoding-check-ignore
    this.current = to;
    this.onEnter.get(to)?.forEach(cb => cb(event)); // encoding-check-ignore
    return true;
  }

  get state(): TState { return this.current; }
  reset(initial: TState): void { /* ... */ }
}
```

### 5.2 Pac-Man State Machine

```
NORMAL → DYING (ghost collision in SCATTER/CHASE mode)
DYING → RESPAWNING (death animation complete, lives > 0)
RESPAWNING → NORMAL (respawn complete)
DYING → GAME_OVER (death animation complete, lives = 0)
```

### 5.3 Ghost Mode State Machine

```
IN_HOUSE → LEAVING_HOUSE (release timer elapsed)
LEAVING_HOUSE → SCATTER (exited house)
SCATTER → CHASE (scatter timer elapsed)
CHASE → SCATTER (chase timer elapsed)
SCATTER/CHASE → FRIGHTENED (power pellet eaten)
FRIGHTENED → EATEN (Pac-Man eats ghost)
FRIGHTENED → SCATTER/CHASE (frightened timer elapsed)
EATEN → IN_HOUSE (reached ghost house)
IN_HOUSE → LEAVING_HOUSE (brief pause, then re-release)
```

### 5.4 Global Mode Timer

The `GhostHouseManager` maintains a global scatter/chase cycle timer. All non-frightened, non-eaten ghosts follow the same global mode (SCATTER or CHASE). The cycle is defined as an array of `ScatterChaseCycle` objects.

---

## 6. ADR-001: Vanilla TypeScript + Canvas API

### Context

We need to build a 2D tile-based game (Pac-Man clone) that runs in the browser. Options considered:
- **Option A**: Vanilla TypeScript + HTML5 Canvas 2D API
- **Option B**: Phaser.js (mature 2D game framework)
- **Option C**: PixiJS (WebGL rendering) + custom game logic

### Decision

**Option A — Vanilla TypeScript + Canvas 2D API.**

### Consequences

**Positive:**
- Zero framework dependency — smallest possible bundle size
- Full control over game loop timing, collision, and rendering
- Pac-Man is simple enough that Canvas 2D is more than sufficient (~250 objects max)
- Maximum learning value — team understands every line of the engine
- No vendor lock-in or framework upgrade concerns
- Vite HMR works perfectly for fast iteration

**Negative:**
- Must build sprite system, animation, and collision from scratch
- No built-in scene management or object pooling
- More boilerplate for simple tasks (e.g., sprite drawing)
- Performance ceiling lower than WebGL (but irrelevant for Pac-Man's scale)

**Mitigation:**
- The architecture separates engine concerns into clean modules
- StateMachine and CollisionSystem are reusable patterns
- Procedural rendering avoids sprite asset pipeline complexity

---

## 7. File Dependency Graph

```
         config
        /  |   \
       /   |    \
     maps  |  renderers ← entities ← engine
      \    |     /          |
       \   |    /           |
        \  |   /            |
       systems ←─────────────
          |
       main.ts (orchestrates all)
```

**Dependency Matrix:**

| From → To | config | engine | entities | systems | maps | renderers | ui |
|------------|:------:|:------:|:--------:|:-------:|:----:|:----------:|:--:|
| config     |   —    |        |          |         |      |            |   |
| engine     |   ✅    |   —    |          |         |      |            |   |
| entities   |   ✅    |   ✅    |    —     |         |      |            |   |
| systems    |   ✅    |        |    ✅     |    —     |      |            |   |
| maps       |   ✅    |        |          |         |   —  |            |   |
| renderers  |   ✅    |        |    ✅     |         |      |     —      |   |
| ui         |   ✅    |        |          |         |      |            |  — |

**Verified: No circular dependencies.**

---

## 8. Acceptance Criteria

- [x] All modules have clear single responsibilities
- [x] No circular dependencies between modules
- [x] Type system covers all game entities and states
- [x] Game loop supports pause/resume via `running` flag
- [x] Collision system handles all entity interactions (wall, entity, collectible)
- [x] State machines are generic (`StateMachine<TState>`) and reusable

---

## 9. Coordinate-System Convention (World/Tile Space vs. Screen/Pixel Space)

This codebase has two coordinate spaces in play at all times. Confusing them is the single most
common source of off-by-`HUD_HEIGHT` bugs in this project (see §10 for a concrete instance).

### 9.1 The two spaces

| Space | Description | Row 0 means | Used by |
|-------|-------------|-------------|---------|
| **Tile/world space** | Discrete `{ col, row }` grid coordinates. 0-based, no HUD awareness. | The top row of the **maze**, not the canvas. | `TileCoord`, `MapData.tiles[row][col]`, ghost pathfinding (`getNextTileInDirection`, `getTileTypeAt`, `SCATTER_TARGETS`), `GhostTargetStrategy` |
| **Screen/pixel space** | Continuous `{ x, y }` pixel coordinates as drawn on the `<canvas>`. | The top of the **canvas**, which includes the `HUD_HEIGHT` (16px) strip above the maze. | `Position` (`Entity.position`), `Renderer`/`*Renderer` draw calls, `CollisionSystem` pixel-based checks |

The maze is not drawn starting at canvas y=0 — it starts at `y = HUD_OFFSET_Y` (`= HUD_HEIGHT = 16`),
leaving room for the score/lives HUD strip above it (`HUD_SCORE_Y = 0`, `HUD_LIVES_Y = CANVAS_HEIGHT - 16`).
`MazeRenderer.draw()` and `drawFlash()` are passed `HUD_OFFSET_Y` explicitly as the vertical draw
origin (`main.ts:659`, `main.ts:719`).

### 9.2 The rule

> **`HUD_OFFSET_Y` must be added exactly once whenever converting a tile/world row to a screen
> pixel Y, and subtracted exactly once whenever converting a screen pixel Y back to a tile/world
> row. It must never appear in pure tile-to-tile or col/row-only arithmetic.**

Concretely:

- **Tile → pixel (add offset)**: `vector.tileToPixel()` is the canonical helper —
  `y = row * TILE_SIZE + TILE_SIZE / 2 + HUD_OFFSET_Y`. Any code that manually derives a pixel
  Y from a row (e.g. a tile-center snap or an exit/target pixel position) MUST add `HUD_OFFSET_Y`
  the same way. Current call sites doing this inline: `EntityBase.snapToGrid()`,
  `EntityBase.reset()` (via `tileToPixel`), `GhostBase.updateHouseMovement()`'s `exitY` calculation.
- **Pixel → tile (subtract offset)**: `vector.pixelToTile()` is the canonical helper —
  `row = Math.floor((y - HUD_OFFSET_Y) / TILE_SIZE)`. Any code deriving a tile/row from a pixel Y
  MUST subtract `HUD_OFFSET_Y` first. Current call sites doing this: `EntityBase.tileCoord()`,
  `vector.isAligned()`, `CollisionSystem.getTileAtPixel()`, `CollisionSystem.checkEntityCollision()`,
  `CollisionSystem.checkDotCollection()`.
- **Tile ↔ tile (no offset)**: Code that never touches a pixel value — pathfinding
  (`GhostBase.getNextTileInDirection()`, `getTileTypeAt()`), scatter targets
  (`SCATTER_TARGETS`), map bounds checks against `MapData.tiles[row]` — must NOT add or subtract
  `HUD_OFFSET_Y`. Row 0 here means "top row of the maze," full stop.
- **`Entity.position` is always screen-space.** Every entity's `{ x, y }` position is stored with
  the HUD offset already baked in (set via `tileToPixel()` in `reset()`). Do not assume
  `position.y` is a "raw" maze-relative pixel value anywhere — it isn't. If you need maze-relative
  math, subtract `HUD_OFFSET_Y` first (or use `tileCoord()` / `pixelToTile()`).

### 9.3 Practical checklist for new code

- [ ] Deriving a pixel Y from a `TileCoord.row`? Use `tileToPixel()`, or add `HUD_OFFSET_Y` manually if you can't call it directly. <!-- encoding-check-ignore -->
- [ ] Deriving a `TileCoord.row` from `Entity.position.y` or any other screen pixel Y? → use `tileCoord()` / `pixelToTile()`, or subtract `HUD_OFFSET_Y` manually.
- [ ] Working purely with `col`/`row` integers (map array indexing, pathfinding, scatter targets)? → never touch `HUD_OFFSET_Y`.
- [ ] Adding a new module that draws to canvas? → pass/receive `HUD_OFFSET_Y` explicitly as a parameter (as `MazeRenderer.draw()` does), don't hardcode `16`.

---

## 10. Known Issues / Diagnosis Log

### 2026-07-01 — Diagnostic Meeting Findings

A cross-functional diagnostic meeting (architect, game-developer, game-debugger, test-runner;
grounded in an independent `base-map` local-LLM code review of `GhostBase.ts`,
`GhostHouseManager.ts`, and `CollisionSystem.ts`) identified four issues in the current
implementation. Full transcript: [`memory/meeting-2026-07-01-pacman-diagnosis.md`](../../../memory/meeting-2026-07-01-pacman-diagnosis.md).

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 1 | `GhostBase.updateHouseMovement()` relies on raw float comparisons (`centerX ± 1`) instead of explicit tile-snapping — fragile to speed/timestep changes. Three near-duplicate test files (`ghost-exit-simulation.test.ts`, `ghost-exit-full-sim.test.ts`, `ghost-exit-exact-sim.test.ts`) are debugging residue from past instability, not intentional coverage. | `src/entities/GhostBase.ts` | Refactor planned (tests first, see Action Items below) |
| 2 | `GhostBase.setMode()`'s reversal logic is an implicit, non-exhaustive nested-`if` chain keyed on `prevMode`/`newMode` — untested in isolation, and an easy regression target when adding a new `GhostMode`. | `src/entities/GhostBase.ts` (`setMode`) | Refactor planned: explicit `(prevMode, newMode) → shouldReverse` transition table |
| 3 | `CollisionSystem.getTileAtPixel()` performs per-frame, per-axis float-to-tile conversion; at higher stage speeds this carries a theoretical tunneling risk (leading-edge check could skip a thin wall). Not yet observed in practice. | `src/engine/CollisionSystem.ts` | Open — monitor, no fix scheduled yet |
| 4 | `HUD_OFFSET_Y` was applied without a documented coordinate-system convention, making call sites look inconsistent even though the underlying rule was applied correctly. | `src/config/constants.ts`, `src/entities/GhostBase.ts`, `src/engine/CollisionSystem.ts` | **Resolved by §9 above** |

**Sequencing agreed at the meeting**: tests before refactor. Consolidate the three ghost-exit test
files into one canonical regression test and add mode-reversal unit tests locking in current
behavior *before* refactoring `setMode()` or `updateHouseMovement()` — this code is `Status:
Implemented` and has broken before under exactly this kind of change.

See the meeting transcript's Action Items table (A-01 through A-05) for full task breakdown and ownership.

### 2026-07-03 — Sprint 1 Resolution Notes (Improvement Plan)

The 2026-07-03 project review meeting identified additional issues beyond the 2026-07-01 diagnosis.
Sprint 1 addressed the following:

| # | Issue | Resolution | Status |
|---|-------|-----------|--------|
| A-06 | GameLoop had no render interpolation between physics ticks | Added `renderAlpha` getter (`accumulator / fixedDt`) and passes alpha to `onRender` callback. Backward compatible with zero-arg callbacks. | ✅ Resolved |
| A-07 | SoundManager had no `dispose()`, siren only scheduled 10s, no gain disconnect, no ADSR | Added `dispose()`, `masterGain`/`setVolume()`, `applyADSR()` helper, proper node cleanup on `onended`, recursive siren reschedule via `setTimeout`. | ✅ Resolved |
| A-08 | StateMachine lacked transition metadata, wildcard support | Added `TransitionEvent<TState>`, `StateChangeCallback<TState>`, wildcard `'*'` transitions, optional `trigger` parameter. 16 unit tests. | ✅ Resolved |
| A-12 | ScoreSystem directly accessed localStorage — not testable | Added `StorageAdapter` interface, constructor accepts optional `storage` parameter, `onScoreChange` callback. 16 integration tests. | ✅ Resolved |
| A-03 | CI had no test job, Vitest had no config | Activated `test-pacman` CI job, added Vitest config with v8 coverage provider. | ✅ Resolved |
| A-01 | Test helpers duplicated across 3 files | Extracted `cloneMapData()` to `tests/helpers/test-utils.ts`. | ✅ Resolved |

**Tests**: 7 test files, 55 tests passing (Vitest 3.2.6). Coverage provider: v8.
