# Pac-Man — Game Mechanics Specification

**Date**: 2026-06-27
**Author**: game-designer

---

## 1. Core Movement

### 1.1 Pac-Man Movement Rules

- **Grid-aligned continuous movement**: Pac-Man moves continuously along tile corridors. Movement is aligned to the tile grid (16px tiles, 448x496 canvas).
- **Pre-turn buffering**: Player can press a direction key BEFORE reaching an intersection. The input is buffered as `nextDirection`. When Pac-Man reaches a tile center where `nextDirection` is a valid (non-wall) direction, the buffer is consumed and Pac-Man turns.
- **Single-slot buffer**: Only the most recent direction input is stored. No input queue.
- **No stopping**: Pac-Man never stops moving (except during death animation and pause).

### 1.2 Speed Values

Base speed is defined in pixels per update tick. At 60fps fixed timestep:
- **Pac-Man base**: 2.0 px/tick (1 tile in 8 ticks = ~8 tiles/sec)

Stage speed multipliers are defined in `level-design.md` difficulty curve.

### 1.3 Wall Collision

- Leading-edge tile checking: before moving, check the tile at the leading edge of Pac-Man's bounding box in the direction of movement.
- If the target tile is a WALL, movement in that direction is blocked. Pac-Man snaps to the tile edge and continues in the current direction if valid, or stops.
- Grid alignment tolerance: within ±2px of tile center is considered "aligned" for direction change.

### 1.4 Tunnel Wrapping

- Row 14 of the map is the tunnel row.
- When Pac-Man's x-position goes below 0 (moving left past the left edge), wrap to x = 448 (right edge of map).
- When Pac-Man's x-position goes above 448 (moving right past the right edge), wrap to x = 0.
- Same wrapping applies to all ghosts.

---

## 2. Scoring System

| Item | Points | Trigger |
|------|--------|---------|
| Dot | 10 | Pac-Man moves onto a DOT tile |
| Power Pellet | 50 | Pac-Man moves onto a POWER_PELLET tile |
| Ghost (1st eaten in fright) | 200 | Pac-Man collides with FRIGHTENED ghost |
| Ghost (2nd eaten in fright) | 400 | Same fright period |
| Ghost (3rd eaten in fright) | 800 | Same fright period |
| Ghost (4th eaten in fright) | 1600 | Same fright period |

### Ghost Score Multiplier

Ghosts eaten during a single fright period double in value: 200, 400, 800, 1600. The counter resets to 200 when a new fright period begins (new power pellet consumed).

### Score Display

- Current score displayed at top-left of HUD
- High score displayed at top-center of HUD

---

## 3. Lives System

- **Starting lives**: 3
- **Extra life**: Awarded at 10,000 points (classic behavior)
- **Death sequence**:
  1. Game state transitions to DYING
  2. Pac-Man death animation plays (~1.5 seconds)
  3. If lives remaining > 0: decrement lives, reset all entity positions, brief pause (~2s), resume PLAYING
  4. If lives remaining = 0: transition to GAME_OVER

### Respawn Positions

After death, all entities reset to their starting positions (see level-design.md for coordinates).

---

## 4. Power-Up System

### 4.1 Power Pellet Activation

When Pac-Man collects a power pellet:
1. All ghosts in SCATTER or CHASE mode immediately transition to FRIGHTENED mode
2. Ghosts currently IN_HOUSE or LEAVING_HOUSE are NOT affected
3. Ghosts currently EATEN continue returning to house (not affected)
4. Ghost eating counter resets to 1st ghost (200 pts)

### 4.2 Frightened Mode Behavior

- Ghosts move at 50% speed (modified by stage difficulty curve)
- At each intersection, ghosts choose a RANDOM valid direction (not targeting Pac-Man)
- Ghosts cannot reverse direction during fright (except on initial fright entry)
- Frightened ghosts are rendered in blue (flashing blue/white in last 2 seconds)

### 4.3 Frightened Duration

Decreases per stage (see level-design.md difficulty curve):
- Stage 1: 6 seconds
- Stage 2: 5 seconds
- Stage 3: 4 seconds
- Stage 4+: 3 seconds
- Stage 21+: 0 seconds (power pellets have no effect)

### 4.4 Warning Flash

In the last 2 seconds of fright, ghosts alternate between blue and white every 200ms as a visual warning that fright mode is ending.

### 4.5 Eaten Ghost Behavior

When Pac-Man collides with a FRIGHTENED ghost:
1. Ghost transitions to EATEN mode
2. Score is awarded (200/400/800/1600)
3. Ghost becomes "eyes only" (no body rendered)
4. Ghost moves at 2x speed back to ghost house
5. Upon reaching ghost house entrance, ghost enters IN_HOUSE mode
6. After brief pause (~0.5s), ghost exits as LEAVING_HOUSE, then returns to current global mode (SCATTER or CHASE)

---

## 5. Win Condition

- **Stage complete**: All DOT and POWER_PELLET tiles have been collected
- **Level complete animation**: Brief flash of maze walls (~1 second)
- **Transition**: After animation, load next stage (or same map with increased difficulty if only one map)

---

## 6. Loss Condition

- **Game over**: All lives lost (3 deaths)
- **Game over sequence**:
  1. Death animation plays for final life
  2. "GAME OVER" text appears at maze center
  3. Final score and high score displayed
  4. After ~3 seconds, "PRESS ENTER TO RESTART" appears
  5. On Enter key press, reset everything and return to MENU state

---

## 7. Game State Machine

```
GameState Transitions:
  MENU ──[Start/Enter]──→ PLAYING
  PLAYING ──[P/Escape]──→ PAUSED
  PAUSED ──[P/Escape]──→ PLAYING
  PLAYING ──[Ghost collision]──→ DYING
  DYING ──[Anim done + lives>0]──→ PLAYING (respawn)
  DYING ──[Anim done + lives=0]──→ GAME_OVER
  PLAYING ──[All dots eaten]──→ LEVEL_COMPLETE
  LEVEL_COMPLETE ──[Anim done]──→ PLAYING (next stage)
  GAME_OVER ──[Enter key]──→ MENU
```

### State Descriptions

| State | Game Active? | Input | Rendering |
|-------|:---:|---------|-----------|
| MENU | No | Start button / Enter key | Static maze with title text |
| PLAYING | Yes | Arrow keys, P/Escape | Full game rendering |
| PAUSED | No | P/Escape to resume | Frozen frame + "PAUSED" overlay |
| DYING | No | None accepted | Death animation |
| GAME_OVER | No | Enter to restart | "GAME OVER" + scores |
| LEVEL_COMPLETE | No | None accepted | Maze flash animation |

---

## 8. Input Mapping

| Key | Action |
|-----|--------|
| Arrow Up / W | Queue UP direction |
| Arrow Down / S | Queue DOWN direction |
| Arrow Left / A | Queue LEFT direction |
| Arrow Right / D | Queue RIGHT direction |
| P / Escape | Toggle PAUSE |
| Enter | Start game (from MENU) / Restart (from GAME_OVER) |

---

## 9. Acceptance Criteria

- [ ] Pac-Man moves continuously and smoothly along tile corridors
- [ ] Pre-turn buffering allows early direction input at intersections
- [ ] Wall collision prevents passing through walls
- [ ] Tunnel wrapping works on both edges
- [ ] All scoring values match the specification table
- [ ] Ghost score multiplier doubles per ghost eaten in single fright
- [ ] Lives system decrements on death, triggers game over at 0
- [ ] Power pellet activates frightened mode with correct duration per stage
- [ ] Frightened warning flash activates in last 2 seconds
- [ ] Eaten ghosts return to house as eyes at 2x speed
- [ ] Stage completes when all dots and pellets are collected
- [ ] Game over triggers when all lives are lost
- [ ] All state transitions follow the state machine diagram
- [ ] Input mapping matches the table above

---

## 10. Dynamic Difficulty Model (Design Direction)

> **Status**: Design specification for future implementation. Not yet implemented.
> **Purpose**: Provide a mathematically grounded framework for adaptive difficulty that
> responds to player performance in real-time, extending the existing static per-stage
> difficulty tables in `level-design.md`.

### 10.1 Design Philosophy

The classic Pac-Man difficulty curve is purely stage-based (see `level-design.md` §5): speeds,
frightened durations, and ghost behavior are fixed tables indexed by stage number. This
model works well for an arcade game, but a modern implementation can benefit from subtle
adaptive adjustments that respond to the player's skill level within a single stage.

**Constraints**:
- ROM-accurate baseline: All default values must match the classic arcade table
- Toggleable: Adaptive difficulty is OFF by default; activated via settings
- Subtle range: Adjustments are ±15% of baseline, never doubling/halving
- Observable: Difficulty factor `D(t)` is logged for debugging

### 10.2 Input Metrics (Performance Signals)

| Metric | Source | Unit | Description |
|--------|--------|:----:|-------------|
| `pelletsPerMinute` | Dot collection rate | dots/min | Dots eaten in the last 60s sliding window |
| `ghostCatches` | Death counter | count | Times Pac-Man died in current stage |
| `frightenedUsage` | Ghost-eat counter | count | Ghosts eaten during frightened in current stage |
| `survivalTime` | Game timer | seconds | Time since last death (or stage start) |
| `scoreEfficiency` | Score / dots eaten | pts/dot | Ratio of points earned to collectibles consumed |

### 10.3 Output Parameters (Difficulty Modifiers)

| Parameter | Baseline | Adjusted Range | Effect |
|------------|:--------:|:--------------:|--------|
| `ghostSpeedMultiplier` | 0.75 (stage 1) | 0.64–0.86 | Higher = faster ghosts |
| `frightenedDurationModifier` | 1.0 (6000ms base) | 0.85–1.15 | Lower = shorter fright |
| `fruitSpawnThreshold` | dots eaten (stage table) | ±10% | Lower = fruit appears sooner |
| `ghostHouseReleaseModifier` | 1.0 (dot-based) | 0.85–1.15 | Lower = ghosts released sooner |

### 10.4 Difficulty Function

```
D(t) = 1.0 + w1·normalize(pelletsPerMinute, 8, 16)
           + w2·normalize(ghostCatches, 0, 3)
           + w3·normalize(survivalTime, 30, 120)

Where:
  D(t) = difficulty factor at time t (range: ~0.85 to ~1.15)
  normalize(value, min, max) = clamp((value - min) / (max - min), 0, 1)
  w1 = 0.10  // collection efficiency weight
  w2 = 0.05  // death penalty weight (dying often = lower difficulty = easier)
  w3 = 0.05  // survival bonus weight (alive longer = higher difficulty = harder)

  Note: ghostCatches is INVERTED in effect — more deaths → lower D(t) → easier game.
  D(t) is recalculated every 5 seconds using sliding window metrics.
```

### 10.5 Application Rules

1. `D(t)` is computed every 5 seconds using a sliding window of the last 60 seconds
2. Smooth transitions: `D_effective` lerps toward `D(t)` at 0.1/second (avoids jumps)
3. Stage boundaries reset: `D(t)` resets to 1.0 at each new stage start
4. Ghost speed = `stageSpeedTable[stage] × D_effective × modeSpeedMultiplier`
5. Frightened duration = `stageFrightTable[stage] × D_effective`

### 10.6 Future Enhancements

- Player profile learning: Adjust weights (w1, w2, w3) based on long-term play patterns
- Difficulty presets: "Easy" (D capped at 0.9), "Normal" (0.85–1.15), "Hard" (D floored at 1.1)
  - Replay difficulty overlay: Show D(t) curve in post-game replay analysis

---

## 11. Replayability Design Vision

> **Status**: Design direction for future implementation. Not yet implemented.
> **Purpose**: Define the long-term vision for extending Pac-Man replayability beyond
> the classic single-pattern experience.

### 11.1 Design Constraints

All replayability features must satisfy these constraints:
- **ROM-accurate baseline**: Default gameplay matches classic Pac-Man exactly
- **Toggleable**: Every feature is OFF by default; activated via settings menu
- **Fair difficulty**: No pay-to-win, no unfair AI advantages; changes affect both sides
- **Transparent**: Players can see what modifiers are active and their effects

### 11.2 Procedural Level Variation

Generate modified dot layouts while preserving maze structure:

| Modifier | Description | Implementation Approach |
|----------|-------------|----------------------|
| Dot shuffle | Randomly relocate dots within passable tiles (maintain total count) | Constraint solver: assign N dots to M passable tiles uniformly |
| Power pellet reposition | Move power pellets to different quadrant positions | Ensure ≥1 pellet per maze quadrant |
| Ghost house timing offset | Vary initial release delays by ±30% | Per-stage random seed applied to release timer multipliers |
| Tunnel speed variation | Modify tunnel speed zone (+/- 20%) | Affects MAP_COLS wrap speed for Pac-Man and ghosts |

### 11.3 Unlockable Content

Rewards for progression that add variety without breaking balance:

| Unlock | Condition | Effect |
|--------|-----------|--------|
| **Ghost AI Profiles** | Clear stage 5+ | Alternate ghost personalities (e.g., "Aggressive Inky" — always flanks, "Cowardly Clyde" — scatter threshold reduced to 4 tiles) |
| **Speed Modifiers** | Achieve score milestones | Pac-Man speed ±10%, ghost speed ±10% (player chooses one) |
| **Visual Themes** | Clear stages 3, 7, 12 | Alternate maze color palettes (neon, pastel, monochrome, retro-green) |
| **Classic Layouts** | Clear all stages | Original Pac-Man level layouts (levels 2-4 from arcade) |

### 11.4 Challenge Modes

Separate game modes with distinct win conditions:

| Mode | Win Condition | Time Limit | Key Rules |
|------|--------------|:----------:|-----------|
| **Time Trial** | Clear stage N as fast as possible | 3 min/stage | No lives; instant game over on death |
| **Survival** | Survive as long as possible | ∞ | Score = survival time × 10; ghosts accelerate every 30s |
| **Pac-Attack** | Eat all ghosts in one fright period | ∞ | Dots give no points; only ghost eating scores; power pellets respawn |
| **No Power** | Clear stage without power pellets | ∞ | No power pellets on map; frightened mode never activates |

### 11.5 Implementation Priority

1. **Phase 1** (post-MVP): Visual themes + speed modifiers (lowest risk, highest visual impact)
2. **Phase 2**: Procedural dot variation + ghost house timing offsets
3. **Phase 3**: Ghost AI profiles (requires extensive balancing)
4. **Phase 4**: Challenge modes (each mode is a separate game loop configuration)
5. **Phase 5**: Classic layout imports (requires level data from arcade ROM analysis)
