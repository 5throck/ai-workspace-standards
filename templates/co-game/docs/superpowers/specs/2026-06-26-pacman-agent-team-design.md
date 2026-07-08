# Pac-Man Game — Agent Team Composition & Workflow Design

**Date**: 2026-06-26
**Status**: Implemented
**Approach**: A — 3 new game-specific agents

---

## 1. Project Overview

### 1.1 What We're Building

A **Full Classic Pac-Man** clone running on **Web (HTML5 Canvas)**, built with **Vanilla TypeScript + Canvas API**.

### 1.2 Scope (Full Classic)

- Tile-based maze with walls, dots, power pellets
- Pac-Man character with directional movement and animation
- 4 ghosts, each with distinct AI behavior patterns:
  - **Blinky** (Red) — Direct chase (targets Pac-Man's current tile)
  - **Pinky** (Pink) — Ambush (targets 4 tiles ahead of Pac-Man's direction)
  - **Inky** (Cyan) — Flanking (uses Blinky's position + Pac-Man's position to calculate target)
  - **Clyde** (Orange) — Shy (chases when far, retreats to corner when close)
- Power-up system (frightened mode, ghost eating)
- Fruit bonus system
- Stage/level progression with increasing difficulty
- Lives system (3 lives default)
- Score, high score, level display (HUD)

### 1.3 Constraints

- **No game framework** — Vanilla TypeScript + Canvas API only
- **Placeholder graphics** — Geometric shapes (circles, arcs, rectangles), no pixel art files
- **No external game assets** — All visuals and sounds generated procedurally
- **English-only** code, commits, and documentation

---

## 2. Agent Team Composition

### 2.1 Full Team Roster (10 Agents)

| # | Agent | File | Tier | Type | Phase | Role |
|---|-------|------|------|------|-------|------|
| 1 | **PM** | `agents/pm.md` | High | Existing | 0, 2, 5, 6 | Project orchestration, GATE management, lifecycle |
| 2 | **architect** | `agents/architect.md` | High | Existing | 1, 2 | Code architecture design (module structure, type system) |
| 3 | **game-designer** | `agents/game-designer.md` | High | New | 1, 2 | Game mechanics, ghost AI patterns, level design, difficulty curve |
| 4 | **designer** | `agents/designer.md` | Medium | Existing | 3 | UI/UX — start screen, HUD, game over, settings menu |
| 5 | **asset-artist** | `agents/asset-artist.md` | Medium | New | 3 | Sprite sheet specs, animation frame specs, sound asset list |
| 6 | **game-developer** | `agents/game-developer.md` | Low | New | 4 | Canvas rendering, game loop, collision detection, sprite system |
| 7 | **game-debugger** | `agents/game-debugger.md` | Medium | New | 4 | Bug analysis, fix proposals, bug pattern documentation |
| 8 | **test-runner** | `agents/test-runner.md` | Medium | Existing | 4 | Unit tests, integration tests, gameplay QA |
| 9 | **stack-setup** | `agents/stack-setup.md` | Low | Existing | 0, 1 | TypeScript environment, Vite build, dev server |
| 10 | **security-monitor** | `agents/security-monitor.md` | Medium | Existing | 0, 5 | Dependency vulnerability scan (compliance) |

### 2.2 New Agent Definitions

#### game-designer (Tier: High, Phase: 1-2)

**Responsibilities:**
- Define all game mechanics (movement rules, scoring, lives, power-ups)
- Design ghost AI behavior patterns for all 4 ghosts (pseudo-code level)
- Design maze layout data format (2D tile array, TileType enum)
- Define difficulty curve per stage (ghost speed, scatter/chase timings, power-up duration)
- Design reward system (dot=10pts, power pellet=50pts, ghost=200-1600pts, fruit bonuses)
- Define stage progression rules (when/how maze changes, speed increases)

**Deliverables:**
- `projects/pacman/docs/game-mechanics.md` — Core mechanics specification
- `projects/pacman/docs/ghost-ai-spec.md` — Ghost AI behavior patterns with pseudo-code
- `projects/pacman/docs/level-design.md` — Maze layouts, difficulty progression, tile types

**Interaction:** Works in parallel with `architect` during Phase 1-2. Receives game design requirements from PM. Produces JSON handoff contracts for `game-developer` (Phase 4).

#### asset-artist (Tier: Medium, Phase: 3)

**Responsibilities:**
- Define Pac-Man sprite frames (4 directions × mouth open/close animation)
- Define ghost sprites for 4 ghost types (red, pink, cyan, orange) + frightened + eyes-only states
- Define maze tile visual specs (wall style, dot, power pellet, empty space)
- Define procedural rendering instructions for all visual elements (geometric shapes)
- Create sound asset list with descriptions (waka-waka, ghost death, game over, stage clear, etc.)

**Deliverables:**
- `projects/pacman/docs/asset-spec.md` — Complete asset registry with rendering instructions
- `projects/pacman/docs/sprite-sheet-spec.md` — Frame-by-frame sprite layout

**Interaction:** Works in parallel with `designer` during Phase 3. Produces asset specifications that `game-developer` uses for rendering implementation.

#### game-developer (Tier: Low, Phase: 4)

**Responsibilities:**
- Implement HTML5 Canvas rendering engine (game loop, requestAnimationFrame, double buffering)
- Implement tile-based map rendering from level data
- Implement collision detection system (Pac-Man vs walls, dots, ghosts, power pellets)
- Implement sprite system (directional animation, frame selection, procedural rendering)
- Implement entity classes (Pacman, Ghost base + 4 subclasses)
- Implement state machines (Pacman: IDLE/ACTIVE/DEAD/DYING; Ghost: SCATTER/CHASE/FRIGHTENED/EATEN/HOUSE)
- Implement ghost AI from game-designer's specifications
- Implement scoring, lives, and stage progression systems

**Deliverables:**
- `src/engine/` — GameLoop, Renderer, InputManager, CollisionSystem
- `src/entities/` — Pacman, Ghost (base + 4 variants), Dot, PowerPellet, Fruit
- `src/systems/` — ScoreSystem, StageManager, StateMachine
- `src/maps/` — Level data files

**Interaction:** Receives implementation plans from both `architect` (code structure) and `game-designer` (game behavior). Works sequentially across 5 sprints in Phase 4.

### 2.3 Agent Dispatch Rules

| Trigger | Agent | Phase |
|---------|-------|-------|
| Game mechanics, AI patterns, level design needed | `game-designer` | 1, 2 |
| Sprite/asset specifications needed | `asset-artist` | 3 |
| Canvas rendering, game loop, entity implementation | `game-developer` | 4 |
| Code architecture, module structure | `architect` | 1, 2 |
| UI/UX screens and layout | `designer` | 3 |
| Build config, boilerplate, UI layer | `game-developer` | 4 |
| Test execution, QA validation | `test-runner` | 4 |
| Environment setup | `stack-setup` | 0, 1 |
| Security scan | `security-monitor` | 0, 5 |

---

## 3. Workflow Design

### 3.1 Phase-by-Phase Execution Plan

#### Phase 0 — Project Initialization (PM-owned)

| Task | Agent | Tier | Parallel? |
|------|-------|------|:---------:|
| Scaffold Vite + TypeScript project | `stack-setup` | Low | ✅ |
| Baseline dependency security scan | `security-monitor` | Medium | ✅ |
| Register 3 new agents in AGENTS.md | PM (direct) | High | — |
| Create agent .md files for game-designer, asset-artist, game-developer | PM (delegates to `game-developer`) | Low | — |
| Log session to memory/ | PM (direct) | High | — |

**Output**: Ready-to-code project skeleton with all 10 agents registered.

#### Phase 1-2 — Design (architect + game-designer, parallel)

| Task | Agent | Tier | Parallel? |
|------|-------|------|:---------:|
| Code architecture design (modules, types, interfaces) | `architect` | High | ✅ |
| Game mechanics specification | `game-designer` | High | ✅ |
| Ghost AI behavior patterns (pseudo-code) | `game-designer` | High | ✅ |
| Maze layout format + level data design | `game-designer` | High | ✅ |
| ADR: Why vanilla TS + Canvas | `architect` | High | ✅ |
| **PM GATE**: User reviews and approves architecture + game design | PM | High | — |

**Output**: `projects/pacman/docs/architecture.md`, `projects/pacman/docs/game-mechanics.md`, `projects/pacman/docs/ghost-ai-spec.md`, `projects/pacman/docs/level-design.md`, `docs/adr/001-*.md`

#### Phase 3 — Design Handoff (designer + asset-artist, parallel)

| Task | Agent | Tier | Parallel? |
|------|-------|------|:---------:|
| UI/UX design (start screen, HUD, game over) | `designer` | Medium | ✅ |
| Sprite sheet specification | `asset-artist` | Medium | ✅ |
| Procedural rendering instructions | `asset-artist` | Medium | ✅ |
| Sound asset list | `asset-artist` | Medium | ✅ |
| **PM GATE**: User reviews and approves UI + asset specs | PM | High | — |

**Output**: `projects/pacman/docs/ui-spec.md`, `projects/pacman/docs/asset-spec.md`, `projects/pacman/docs/sprite-sheet-spec.md`

#### Phase 4 — Execution (5 sprints, sequential with embedded QA)

**Sprint 1: Foundation**
| Task | Agent | Tier |
|------|-------|------|
| Vite config, HTML structure, CSS base styles | `game-developer` | Low |
| src/config/ — Game constants and configuration | `game-developer` | Low |
| src/utils/ — Basic utility functions (vector math, etc.) | `game-developer` | Low |

**Sprint 2: Core Engine**
| Task | Agent | Tier |
|------|-------|------|
| Game loop (GameLoop class, requestAnimationFrame) | `game-developer` | Low |
| Canvas renderer setup and tile map rendering | `game-developer` | Low |
| Collision detection system | `game-developer` | Low |
| Input manager (keyboard controls) | `game-developer` | Low |
| QA: Unit tests for collision, input | `test-runner` | Medium |

**Sprint 3: Entities**
| Task | Agent | Tier |
|------|-------|------|
| Pacman entity (movement, animation, state) | `game-developer` | Low |
| Ghost base entity + 4 ghost subclasses with AI | `game-developer` | Low |
| State machines (CHASE/SCATTER/FRIGHTENED/EATEN) | `game-developer` | Low |
| Sprite system (directional frames, procedural draw) | `game-developer` | Low |
| QA: Unit tests for state transitions, AI behavior | `test-runner` | Medium |

**Sprint 4: Gameplay Systems**
| Task | Agent | Tier |
|------|-------|------|
| Scoring system (dots, power pellets, ghosts, fruit) | `game-developer` | Low |
| Stage/level progression | `game-developer` | Low |
| Lives system and respawn logic | `game-developer` | Low |
| Difficulty scaling per stage | `game-developer` | Low |
| QA: Integration tests (full gameplay loop) | `test-runner` | Medium |

**Sprint 5: UI Layer**
| Task | Agent | Tier |
|------|-------|------|
| Start screen, pause menu, game over screen | `game-developer` | Low |
| HUD (score, lives, level, high score) | `game-developer` | Low |
| DOM ↔ Canvas integration | `game-developer` | Low |
| QA: Full acceptance testing | `test-runner` | Medium |
| **PM GATE**: Sprint review (max 2 iterations) | PM | High |

**Output**: Fully functional Pac-Man game with all classic features.

#### Phase 5 — Lifecycle Finalization (PM-owned)

| Trigger | Action |
|---------|--------|
| 3 new agents added | Update AGENTS.md rosters, subagent tables |
| New skills possibly added | Update SKILLS.md if needed |
| Governance artifacts changed | Agent lifecycle manager skill |

#### Phase 6 — Quality Assurance & Finalization (PM-owned)

| Task | Agent | Tier |
|------|-------|------|
| Run `bun scripts/qa-gate.ts` | PM | Medium |
| Workspace audit | PM | Medium |
| All tests passing verification | PM | Medium |
| `/sync "feat(pacman): initial pac-man game"` — commit + push + PR | PM | Medium |

### 3.2 Execution Plan Summary

| # | Task | Agent | Tier | Model | Parallel? |
|---|------|-------|------|-------|:---------:|
| 1 | Scaffold Vite + TS project | `stack-setup` | Low | claude-haiku-4-5 | ✅ |
| 2 | Baseline security scan | `security-monitor` | Medium | claude-sonnet-4-6 | ✅ |
| 3 | Register new agents in AGENTS.md | `game-developer` | Low | claude-haiku-4-5 | — |
| 4 | Code architecture design | `architect` | High | claude-opus-4-7 | ✅ |
| 5 | Game mechanics + ghost AI + level design | `game-designer` | High | claude-opus-4-7 | ✅ |
| 6 | **PM GATE**: Design approval | PM | High | claude-opus-4-7 | — |
| 7 | UI/UX design (screens, HUD) | `designer` | Medium | claude-sonnet-4-6 | ✅ |
| 8 | Sprite + asset specifications | `asset-artist` | Medium | claude-sonnet-4-6 | ✅ |
| 9 | **PM GATE**: Design approval | PM | High | claude-opus-4-7 | — |
| 10 | Sprint 1: Foundation boilerplate | `game-developer` | Low | claude-haiku-4-5 | — |
| 11 | Sprint 2: Core engine | `game-developer` | Low | claude-haiku-4-5 | — |
| 12 | Sprint 3: Entity implementation | `game-developer` | Low | claude-haiku-4-5 | — |
| 13 | Sprint 4: Gameplay systems | `game-developer` | Low | claude-haiku-4-5 | — |
| 14 | Sprint 5: UI layer | `game-developer` | Low | claude-haiku-4-5 | — |
| 15 | QA testing (per sprint) | `test-runner` | Medium | claude-sonnet-4-6 | — |
| 16 | **PM GATE**: Sprint review | PM | High | claude-opus-4-7 | — |
| 17 | Lifecycle finalization | PM | Medium | claude-sonnet-4-6 | — |
| 18 | QA gate + final verification | PM | Medium | claude-sonnet-4-6 | — |
| 19 | `/sync "feat(pacman): initial pac-man game"` | PM | Medium | claude-sonnet-4-6 | — |

---

## 4. Design Decisions

### 4.1 Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Platform | Web (HTML5 Canvas) | Zero installation, instant play, universal access |
| Tech stack | Vanilla TS + Canvas | No framework dependency, maximum learning value, lightweight |
| Agent approach | Approach A (3 new agents) | Best balance of game domain expertise vs orchestration complexity |
| Graphics | Procedural/geometric shapes | AI-generated pixel art quality insufficient; placeholder approach |
| Test strategy | Per-sprint QA | Early defect detection, continuous validation |
| Sprint strategy | Sequential sprints in Phase 4 | Game development has strict dependencies: engine → entities → gameplay → UI |

### 4.2 Trade-offs Acknowledged

- **No pixel art assets**: The game will use colored circles, arcs, and rectangles. This is intentional — the focus is on gameplay mechanics and architecture, not visual fidelity. Assets can be swapped later.
- **Ghost AI complexity**: The 4-ghost AI patterns (Blinky/Pinky/Inky/Clyde) require careful implementation. `game-designer` produces pseudo-code; `game-developer` translates to TypeScript. Any ambiguity in the AI spec will be caught by `test-runner`.
- **Single-file maze data**: Level data will be stored as TypeScript 2D arrays rather than external JSON files. This simplifies the initial implementation; JSON import can be added in a future iteration.

---

## 5. Directory Structure (Actual)

```
projects/pacman/                  (project root)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts                  (entry point)
│   ├── style.css                (full-viewport black background, centered canvas)
│   ├── vite-env.d.ts
│   ├── config/
│   │   ├── constants.ts         (game speed, tile size, ghost house geometry)
│   │   ├── types.ts             (Direction, TileType, EntityState, GameState, GhostMode)
│   │   └── index.ts             (barrel export)
│   ├── engine/
│   │   ├── GameLoop.ts          (fixed-timestep loop with accumulator pattern)
│   │   ├── Renderer.ts          (Canvas context wrapper)
│   │   ├── InputManager.ts      (keyboard input handling)
│   │   ├── CollisionSystem.ts   (dot/entity collision detection)
│   │   └── index.ts             (barrel export)
│   ├── entities/
│   │   ├── EntityBase.ts        (base class: position, velocity, direction, grid alignment)
│   │   ├── GhostBase.ts         (abstract ghost: target-based pathfinding, mode management)
│   │   ├── Pacman.ts            (player character)
│   │   ├── Blinky.ts            (direct chase)
│   │   ├── Pinky.ts             (ambush)
│   │   ├── Inky.ts              (flanking)
│   │   ├── Clyde.ts             (shy)
│   │   ├── Dot.ts               (static helper: isDotTile)
│   │   ├── PowerPellet.ts       (static helper: isPowerPelletTile)
│   │   ├── Fruit.ts             (bonus item with spawn/expire/collection)
│   │   └── index.ts             (barrel export)
│   ├── systems/
│   │   ├── ScoreSystem.ts       (score tracking, high score, extra life)
│   │   ├── StageManager.ts      (level progression, difficulty scaling)
│   │   ├── StateMachine.ts      (generic state machine with transitions)
│   │   ├── GhostHouseManager.ts (scatter/chase cycling, ghost release timing)
│   │   ├── SoundManager.ts      (procedural Web Audio API sounds)
│   │   └── index.ts             (barrel export)
│   ├── maps/
│   │   ├── level-1.ts           (classic 28×31 ROM-accurate maze)
│   │   └── index.ts             (barrel export)
│   ├── renderers/
│   │   ├── PacmanRenderer.ts    (procedural Pac-Man with mouth animation)
│   │   ├── GhostRenderer.ts     (procedural ghosts: normal, frightened, eyes-only)
│   │   ├── MazeRenderer.ts      (tile-based rendering with caching, flash mode)
│   │   ├── HUDRenderer.ts       (score, high score, stage, lives)
│   │   └── index.ts             (barrel export)
│   ├── ui/
│   │   ├── StartScreen.ts       (title screen with "PRESS ENTER TO START")
│   │   ├── PauseScreen.ts       (pause overlay)
│   │   ├── GameOverScreen.ts    (final score + restart prompt)
│   │   └── index.ts             (barrel export)
│   └── utils/
│       ├── vector.ts            (tileToPixel, isAligned, etc.)
│       └── index.ts             (barrel export)
├── tests/
│   ├── pacman-turn-drift.test.ts
│   ├── tunnel-wrapping.test.ts
│   ├── ghost-exit-simulation.test.ts
│   ├── ghost-exit-full-sim.test.ts
│   ├── ghost-exit-exact-sim.test.ts
│   └── placeholder.test.ts
└── docs/
    ├── README.md
    ├── architecture.md
    ├── game-mechanics.md
    ├── ghost-ai-spec.md
    ├── level-design.md
    ├── ui-spec.md
    └── asset-spec.md
```

### 5.1 Discrepancies from Original Plan

| Planned | Actual | Reason |
|---------|--------|--------|
| `Entity.ts` | `EntityBase.ts` | More descriptive naming convention |
| `Ghost.ts` | `GhostBase.ts` | More descriptive naming convention |
| No `SoundManager.ts` | `SoundManager.ts` added | Procedural Web Audio API sound system (waka, power, ghost eat, death, level up, game over, siren) |
| No `renderers/` dir | `renderers/` with 4 renderers | Separated rendering from entities for cleaner architecture |
| No `ui/` dir | `ui/` with 3 screens | Separated UI overlay screens from entities |
| No `style.css` | `style.css` added | Full-viewport black background styling |
| No barrel exports | `index.ts` barrel exports | Clean module boundaries |
| `10 agents` (incl. code-writer) | `9 agents` (+ game-debugger, no code-writer) | code-writer removed, game-debugger added for bug analysis |
```

### 5.2 Post-Implementation Stabilization

**2026-07-01**: A diagnostic meeting reviewed the implemented codebase against this design and
found four stabilization issues (ghost mode-reversal logic untested/implicit, house-exit movement
float-fragile, potential collision tunneling risk at high speed, undocumented `HUD_OFFSET_Y`
convention). See [`memory/meeting-2026-07-01-pacman-diagnosis.md`](../../../memory/meeting-2026-07-01-pacman-diagnosis.md)
for full findings and [`projects/pacman/docs/architecture.md` §9-10](../../../projects/pacman/docs/architecture.md)
for the resulting coordinate-system documentation and known-issues log.
