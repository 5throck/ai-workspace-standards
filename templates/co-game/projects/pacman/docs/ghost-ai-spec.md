# Pac-Man — Ghost AI Specification

**Date**: 2026-06-27
**Author**: game-designer

---

## 1. Ghost Movement Rules

### 1.1 Target-Based Pathfinding

All ghosts use the same movement algorithm but with different targets:

1. At each **intersection** (tile with 3+ possible directions), the ghost evaluates all valid directions
2. **Valid direction**: any direction that is not a WALL and not the reverse of the current direction (no U-turns)
3. For each valid direction, calculate the **Euclidean distance** from the resulting tile to the current **target tile**
4. Choose the direction that **minimizes** the distance to the target
5. If two directions are equidistant, priority: UP > LEFT > DOWN > RIGHT

### 1.2 No U-Turn Rule

Ghosts **cannot** reverse direction EXCEPT:
- When the global mode changes from SCATTER to CHASE (or vice versa)
- When a power pellet is eaten (entering FRIGHTENED mode)
- When transitioning to EATEN mode

On mode change, the ghost immediately reverses direction.

### 1.3 Speed

| Ghost Mode | Speed (relative) | Notes |
|------------|:---:|-------|
| SCATTER | 75% | Slightly slower than Pac-Man |
| CHASE | 75% | Same as scatter |
| FRIGHTENED | 37.5% | Half of normal ghost speed |
| EATEN | 150% | 2x normal speed |
| IN_HOUSE | 50% | Slow movement inside house |
| TUNNEL | 40% | All ghosts slow in tunnel |

Speeds are modified per stage (see difficulty curve in level-design.md).

---

## 2. Individual Ghost AI

### 2.1 Blinky (Red) — Direct Chase

**Scatter Target**: Top-right corner, tile (25, -2)
**Chase Target**: Pac-Man's current tile

```
ALGORITHM: blinky_chase
  INPUT: blinky.tile, pacman.tile
  OUTPUT: target
  target.col ← pacman.tile.col
  target.row ← pacman.tile.row
  RETURN target
```
**Behavior**: Blinky always targets Pac-Man's exact position. He is the most aggressive ghost — simple, direct pursuit.

**Starting Position**: Tile (14, 11) — outside ghost house, already active
**Release Timing**: Immediate (no delay)

---

### 2.2 Pinky (Pink) — Ambush

**Scatter Target**: Top-left corner, tile (2, -2)
**Chase Target**: 4 tiles ahead of Pac-Man in Pac-Man's current direction

```
ALGORITHM: pinky_chase
  INPUT: pacman.tile, pacman.direction
  OUTPUT: target
  offset ← 4   // tiles ahead of Pac-Man
  // Direction → tile offset mapping
  CASE pacman.direction:
    UP:    target ← { col: pacman.tile.col - 4, row: pacman.tile.row - 4 }  // original bug preserved
    DOWN:  target ← { col: pacman.tile.col, row: pacman.tile.row + 4 }
    LEFT:  target ← { col: pacman.tile.col - 4, row: pacman.tile.row }
    RIGHT: target ← { col: pacman.tile.col + 4, row: pacman.tile.row }
  RETURN target
  // Note: UP case targets 4 tiles UP + 4 tiles LEFT (original Pac-Man bug).
  // This causes Pinky to overshoot upward corridors, creating an asymmetric
  // ambush pattern. Preserved for ROM-accurate behavior.
```

**Behavior**: Pinky targets 4 tiles ahead of Pac-Man. This creates an "ambush" pattern — if Pac-Man is moving toward Pinky's target, Pinky will be waiting at the destination. When Pac-Man faces UP, the target is 4 tiles UP and 4 tiles LEFT (the original Pac-Man bug, preserved for authenticity).

**Starting Position**: Tile (14, 14) — center of ghost house
**Release Timing**: 2 seconds after game start

---

### 2.3 Inky (Cyan) — Flanking

**Scatter Target**: Bottom-right corner, tile (27, 34)
**Chase Target**: Calculated using Blinky's position as a pivot

```
ALGORITHM: inky_chase
  INPUT: inky.tile, pacman.tile, pacman.direction, blinky.tile
  OUTPUT: target
  // Step 1: Calculate pivot (2 tiles ahead of Pac-Man)
  pivot ← pacman.tile + directionToOffset(pacman.direction, 2)
  // Step 2: Vector reflection of pivot through Blinky
  target.col ← 2 * blinky.tile.col - pivot.col
  target.row ← 2 * blinky.tile.row - pivot.row
  RETURN target
  // Note: If Blinky is at (14,11) and Pac-Man faces UP at (14,14) with
  // pivot at (12,12), Inky's target = (16, 10). This flanking behavior
  // is highly dependent on Blinky's position, making Inky unpredictable.

FUNCTION directionToOffset(dir, distance):
  CASE dir:
    UP:    RETURN { col: -distance, row: -distance }  // bug preserved
    DOWN:  RETURN { col: 0, row: distance }
    LEFT:  RETURN { col: -distance, row: 0 }
    RIGHT: RETURN { col: distance, row: 0 }
```

**Behavior**: Inky uses Blinky's position to create a flanking maneuver. The "pivot" is 2 tiles ahead of Pac-Man. Inky's target is the mirror image of the pivot point reflected through Blinky's position. This creates unpredictable flanking behavior — Inky can be far from Pac-Man or right on top of him, depending on Blinky's position.

**Starting Position**: Tile (12, 14) — left side of ghost house
**Release Timing**: 7 seconds after game start (or after 30 dots eaten)

---

### 2.4 Clyde (Orange) — Shy

**Scatter Target**: Bottom-left corner, tile (0, 34)
**Chase Target**: Pac-Man's position when far, scatter corner when close

```
ALGORITHM: clyde_chase
  INPUT: clyde.tile, pacman.tile, clyde.scatterTarget
  OUTPUT: target
  dx ← clyde.tile.col - pacman.tile.col
  dy ← clyde.tile.row - pacman.tile.row
  distance_sq ← dx * dx + dy * dy   // avoid sqrt for performance
  threshold_sq ← 8 * 8              // 64 (8-tile Euclidean threshold)
  IF distance_sq > threshold_sq THEN
    target ← pacman.tile               // Chase: target Pac-Man directly
  ELSE
    target ← clyde.scatterTarget      // Retreat: head to scatter corner
  END IF
  RETURN target
  // Scatter target: bottom-left corner (0, 34)
  // Note: Uses squared distance comparison to avoid unnecessary sqrt.
  // The oscillation threshold is exactly 8 tiles (Euclidean distance).
```

**Behavior**: Clyde has a split personality. When more than 8 tiles from Pac-Man, he chases like Blinky. When 8 tiles or closer, he retreats to his scatter corner. This creates an oscillating behavior — Clyde approaches, then retreats, then approaches again.

**Starting Position**: Tile (16, 14) — right side of ghost house
**Release Timing**: 12 seconds after game start (or after 60 dots eaten — whichever comes first)

---

## 3. Ghost House Management

### 3.1 Ghost House Layout

```
The ghost house is a rectangular enclosure in the center-bottom of the map.
- Width: 5 tiles (columns 10-14 or 12-16, depending on exact layout)
- Height: 2 tiles (rows 13-14)
- Door: 1 tile wide at top-center (column 13/14, row 12)
- Door tile type: GHOST_HOUSE_DOOR (passable only by ghosts in EATEN or LEAVING_HOUSE mode)
```

### 3.2 Release Order and Timing

| Ghost | Start Position | Release Condition | Notes |
|-------|---------------|-----------------|-------|
| Blinky | (14, 11) outside house | Immediate | Already outside, no house logic |
| Pinky | (14, 14) center | After 2 seconds | Moves up and exits door |
| Inky | (12, 14) left | After 30 dots eaten | Dot-based trigger (alternative: 7s) |
| Clyde | (16, 14) right | After 60 dots eaten | Dot-based trigger (alternative: 12s) |

### 3.3 Leaving House Behavior

When a ghost's release condition is met:
1. Ghost transitions to LEAVING_HOUSE mode
2. Ghost moves upward to the center of the house (column 14)
3. Ghost moves up through the door
4. Upon exiting, transitions to current global mode (SCATTER or CHASE)

### 3.4 Returning to House (EATEN Mode)

When a ghost is eaten:
1. Transition to EATEN mode
2. Ghost renders as eyes only (no body)
3. Ghost navigates back to ghost house using target-based pathfinding (target = ghost house entrance)
4. When reaching the door tile, transition to IN_HOUSE
5. Brief pause (~0.5s)
6. Transition to LEAVING_HOUSE, exit through door
7. Resume current global mode

---

## 4. Global Scatter/Chase Cycle

### 4.1 Cycle Definition

All non-frightened, non-eaten ghosts follow the same global mode cycle. The cycle is driven by a timer managed by `GhostHouseManager`.

```
Stage 1 Cycle:
  [SCATTER 7s] → [CHASE 20s] → [SCATTER 7s] → [CHASE 20s] → [SCATTER 5s] → [CHASE 20s] → [SCATTER 5s] → [CHASE ∞]
```

### 4.2 Cycle by Stage (Exact Numerical Values)

| Phase | Mode | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5+ |
|-------|------|:-------:|:-------:|:-------:|:-------:|:-------:|
| 1 | SCATTER | 7000ms | 7000ms | 7000ms | 7000ms | 5000ms |
| 2 | CHASE | 20000ms | 20000ms | 20000ms | 20000ms | 20000ms |
| 3 | SCATTER | 7000ms | 7000ms | 7000ms | 7000ms | 5000ms |
| 4 | CHASE | 20000ms | 20000ms | 20000ms | 20000ms | 20000ms |
| 5 | SCATTER | 5000ms | 5000ms | 5000ms | 5000ms | 5000ms |
| 6 | CHASE | 20000ms | 20000ms | 20000ms | 20000ms | 20000ms |
| 7 | SCATTER | 5000ms | 5000ms | 5000ms | 5000ms | 5000ms |
| 8+ | CHASE | ∞ | ∞ | ∞ | ∞ | ∞ |

**Cumulative mode-switch times by stage:**

| Stage | Scatter→Chase 1 | Chase→Scatter 2 | Scatter→Chase 3 | Chase→Scatter 4 | Scatter→Chase 5 | Permanent Chase |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | 7000ms | 27000ms | 34000ms | 54000ms | 59000ms | 79000ms |
| 5+ | 5000ms | 25000ms | 30000ms | 50000ms | 55000ms | 75000ms |

After the final scatter phase, ghosts remain in CHASE permanently for the rest of the stage.

### 4.3 Mode Change Behavior

When the timer triggers a SCATTER→CHASE or CHASE→SCATTER transition:
1. All ghosts in SCATTER or CHASE mode reverse direction immediately
2. Their target changes to the new mode's target
3. FRIGHTENED and EATEN ghosts are unaffected
4. When frightened/eaten ends, ghost returns to the current global mode

---

## 5. Frightened Mode Behavior

### 5.1 Random Movement

In FRIGHTENED mode:
- At each intersection, choose a RANDOM valid direction (not target-based)
- Same no-U-turn rule applies
- If only one valid direction (dead end), ghost reverses (exception to no-U-turn)
- If two valid directions, 50/50 random choice (excluding reverse)

### 5.2 Reversal on Fright Entry

When a power pellet is eaten, ALL non-frightened, non-eaten ghosts:
1. Immediately reverse their current direction
2. Transition to FRIGHTENED mode
3. Begin random movement at next intersection

### 5.3 Frightened Duration Override

If the global mode timer triggers a mode change (SCATTER↔CHASE) while ghosts are frightened:
- The mode change is "queued" but not applied until fright ends
- When fright ends, ghosts return to whatever the global mode was at that moment
- This prevents double-reversal bugs

### 5.4 Frightened Mode — Exact Numerical Parameters

| Parameter | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5-16 | Stage 17-19 | Stage 20+ | Unit |
|-----------|:-------:|:-------:|:-------:|:-------:|:----------:|:-----------:|:---------:|:----:|
| Frightened duration | 6000 | 5000 | 4000 | 3000 | 2000 | 1000 | 0 | ms |
| Ghost speed multiplier | 0.50 | 0.50 | 0.50 | 0.50 | 0.50 | 0.50 | N/A | × normal |
| Flash start threshold | 2000 | 2000 | 2000 | 2000 | 2000 | 2000 | N/A | ms before end |
| Flash interval | 200 | 200 | 200 | 200 | 200 | 200 | N/A | ms per toggle |
| Reverse on entry | yes | yes | yes | yes | yes | yes | no | — |
| Score multiplier reset | yes | yes | yes | yes | yes | yes | no | — |

**Flash behavior**: In the last 2000ms of frightened duration, ghosts alternate between blue body (`#2121DE`) and white body (`#FFFFFF`) every 200ms. The flash uses a linear toggle (not ease-in/out) for maximum visibility as a warning signal.

**Stage 20+ note**: Frightened duration of 0ms means power pellets have no effect — ghosts do not enter FRIGHTENED mode, no score multiplier, no flash. This is the "kill screen" difficulty cliff.

---

## 6. Scatter Targets Summary

| Ghost | Scatter Corner | Tile Coordinates |
|-------|---------------|-----------------|
| Blinky (Red) | Top-right | (25, -2) |
| Pinky (Pink) | Top-left | (2, -2) |
| Inky (Cyan) | Bottom-right | (27, 34) |
| Clyde (Orange) | Bottom-left | (0, 34) |

Note: Some scatter targets are intentionally outside the map bounds (-2 row for Pinky/Blinky, 34 row for Inky/Clyde). This causes ghosts to circle their corner in the nearest valid tiles.

---

## 7. Acceptance Criteria

- [ ] All 4 ghost AI patterns follow the target-based pathfinding algorithm
- [ ] No-U-turn rule enforced except on mode transitions
- [ ] Blinky directly targets Pac-Man's current tile
- [ ] Pinky targets 4 tiles ahead with UP bug (4 up + 4 left when facing up)
- [ ] Inky uses Blinky position for flanking calculation
- [ ] Clyde switches between chase and scatter at 8-tile threshold
- [ ] Ghost house release timing matches specification
- [ ] Scatter/chase cycle timer drives global mode transitions
- [ ] Frightened mode uses random movement at intersections
- [ ] Eaten ghosts return to house as eyes at 2x speed
- [ ] Mode changes reverse ghost direction
- [ ] Frightened duration matches per-stage difficulty curve
- [ ] Warning flash occurs in last 2 seconds of fright
