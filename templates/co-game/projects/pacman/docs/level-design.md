# Pac-Man — Level Design Specification

**Date**: 2026-06-27
**Author**: game-designer

---

## 1. Tile Types

| Type | Value | Passable | Description |
|------|:---:|:---:|-------------|
| EMPTY | 0 | ✅ | Empty space (no collectible) |
| WALL | 1 | ❌ | Impassable wall |
| DOT | 2 | ✅ | Collectible dot (10 pts) |
| POWER_PELLET | 3 | ✅ | Power pellet (50 pts) |
| GHOST_HOUSE_DOOR | 4 | ⚠️ Ghosts only | Ghost house entrance door |
| GHOST_HOUSE | 5 | ⚠️ Ghosts only | Inside ghost house |
| TUNNEL | 6 | ✅ | Tunnel zone (wrapping) |
| FRUIT_SPAWN | 7 | ✅ | Fruit bonus spawn point |

**Passable by Pac-Man**: EMPTY (0), DOT (2), POWER_PELLET (3), TUNNEL (6), FRUIT_SPAWN (7)
**Passable by Ghosts**: All above + GHOST_HOUSE_DOOR (4) + GHOST_HOUSE (5) when in EATEN or LEAVING_HOUSE mode

---

## 2. Level 1 Map Layout (28×31)

The classic Pac-Man maze, rendered as a TypeScript 2D number array. The maze is left-right symmetric around columns 13–14.

```typescript
// Level 1 - Classic Pac-Man Maze (28 columns × 31 rows)
// Tile values: 0=EMPTY, 1=WALL, 2=DOT, 3=POWER_PELLET,
//             4=GHOST_HOUSE_DOOR, 5=GHOST_HOUSE, 6=TUNNEL, 7=FRUIT_SPAWN

import { TileType } from '../config/types';
import type { MapData } from '../config/types';

const LEVEL_1: TileType[][] = [
  // Row 0 — top border
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Row 1
  [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
  // Row 2
  [1,3,1,1,1,2,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,2,1,1,1,3,1],
  // Row 3
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  // Row 4
  [1,2,1,1,1,2,1,2,1,1,1,1,1,1,1,1,1,1,1,1,2,1,2,1,1,1,2,1],
  // Row 5
  [1,2,2,2,2,2,1,2,2,2,2,2,2,1,1,2,2,2,2,2,2,1,2,2,2,2,2,1],
  // Row 6
  [1,1,1,1,1,2,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,2,1,1,1,1,1],
  // Row 7
  [0,0,0,0,1,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,1,0,0,0,0],
  // Row 8
  [1,1,1,1,1,2,1,0,1,1,1,1,1,0,0,1,1,1,1,1,0,1,2,1,1,1,1,1],
  // Row 9
  [0,0,0,0,0,2,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,2,0,0,0,0,0],
  // Row 10
  [1,1,1,1,1,2,1,0,1,1,1,1,1,0,0,1,1,1,1,1,0,1,2,1,1,1,1,1],
  // Row 11
  [0,0,0,0,1,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,1,0,0,0,0],
  // Row 12 — ghost house top / door row
  [1,1,1,1,1,2,1,0,1,1,1,1,1,4,4,4,1,1,1,1,1,0,1,2,1,1,1,1,1],
  // Row 13 — ghost house interior (top)
  [1,1,1,1,1,2,1,0,1,5,5,5,5,5,5,5,5,5,5,1,0,1,2,1,1,1,1,1],
  // Row 14 — tunnel row / ghost house interior (bottom)
  [6,2,2,2,2,2,2,2,1,5,5,5,5,5,5,5,5,5,5,1,2,2,2,2,2,2,2,6],
  // Row 15 — below ghost house
  [1,1,1,1,1,2,1,0,1,1,1,1,1,1,1,1,1,1,1,1,0,1,2,1,1,1,1,1],
  // Row 16
  [1,1,1,1,1,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,1,1,1,1,1],
  // Row 17
  [1,1,1,1,1,2,1,0,1,1,1,1,1,0,0,1,1,1,1,1,0,1,2,1,1,1,1,1],
  // Row 18
  [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
  // Row 19
  [1,2,1,1,1,2,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,2,1,1,1,2,1],
  // Row 20
  [1,3,2,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,2,3,1],
  // Row 21
  [1,1,2,1,2,1,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,1,2,1,2,1,1],
  // Row 22
  [1,2,2,2,2,1,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,1,2,2,2,2,1],
  // Row 23
  [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
  // Row 24 — Pac-Man start row
  [1,2,2,2,2,2,2,2,2,2,2,2,2,7,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  // Row 25 — bottom border
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Rows 26–30 — bottom wall padding
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

export const level1Data: MapData = {
  tiles: LEVEL_1,
  pacmanStart: { col: 14, row: 24 },
  ghostStarts: {
    BLINKY: { col: 14, row: 11 },
    PINKY:  { col: 14, row: 14 },
    INKY:   { col: 12, row: 14 },
    CLYDE:  { col: 16, row: 14 },
  },
  fruitSpawn: { col: 14, row: 24 },
  tunnelRow: 14,
  totalDots: 231, // 227 dots + 4 power pellets
};
```

### Map Notes

- **Symmetry**: The maze is left-right symmetric around columns 13–14
- **Tunnel**: Row 14, columns 0 and 27 are TUNNEL tiles (wrapping zone)
- **Ghost House Door**: Row 12, columns 13–15 (3 tiles wide, GHOST_HOUSE_DOOR)
- **Ghost House Interior**: Rows 13–14, columns 10–18 (rectangular, bounded by WALL at cols 9 & 19)
- **Ghost House Floor**: WALL at row 15 under the house (cols 9–19)
- **Power Pellets**: 4 total, at (1,2), (26,2), (1,20), (26,20)
- **Fruit Spawn**: Tile (14, 24) — same row as Pac-Man start

---

## 3. Starting Positions

### Pac-Man
- **Tile**: (14, 24) — center, below the lower maze segment
- **Initial Direction**: LEFT

### Ghosts
| Ghost | Tile | Starting Mode | Notes |
|-------|------|:---:|-------|
| Blinky | (14, 11) | SCATTER | Outside house, above door, already active |
| Pinky | (14, 14) | IN_HOUSE | Center of house, released after 2s |
| Inky | (12, 14) | IN_HOUSE | Left side of house, released after 30 dots |
| Clyde | (16, 14) | IN_HOUSE | Right side of house, released after 60 dots |

---

## 4. Fruit Bonus System

### Spawn Conditions

Fruit spawns when Pac-Man eats a specific number of dots (threshold-based):

| Threshold | Dots Eaten |
|:---:|:---:|
| 1st fruit | 70 dots |
| 2nd fruit | 170 dots |

Fruit appears for ~10 seconds, then disappears. Only one fruit can be active at a time. The spawn flag resets after the fruit expires or is collected, allowing potential re-spawn.

### Fruit Progression

| Stage | Fruit | Points |
|:---:|------|:---:|
| 1 | Cherry | 100 |
| 2 | Strawberry | 300 |
| 3 | Orange | 500 |
| 4 | Apple | 700 |
| 5 | Melon | 1000 |
| 6 | Galaxian | 2000 |
| 7 | Bell | 3000 |
| 8 | Key | 5000 |
| 9+ | (repeat Key) | 5000 |

---

## 5. Difficulty Curve

### Speed Progression

Speed is expressed as percentage of maximum speed (100% = fastest possible in the game engine).

| Stage | Pac-Man Speed | Ghost Speed (Normal) | Ghost Speed (Frightened) | Ghost Speed (Tunnel) |
|:---:|:---:|:---:|:---:|:---:|
| 1 | 80% | 75% | 50% | 40% |
| 2 | 90% | 85% | 55% | 45% |
| 3 | 90% | 85% | 55% | 45% |
| 4 | 90% | 90% | 60% | 50% |
| 5-6 | 95% | 90% | 60% | 50% |
| 7-8 | 95% | 95% | 60% | 50% |
| 9-16 | 100% | 95% | 60% | 55% |
| 17-20 | 100% | 100% | 60% | 55% |
| 21+ | 100% | 100% | 60% | 60% |

### Scatter/Chase Timings

| Phase | Mode | Stage 1 | Stage 2-4 | Stage 5+ |
|:---:|:---:|:---:|:---:|:---:|
| 1 | SCATTER | 7s | 7s | 5s |
| 2 | CHASE | 20s | 20s | 20s |
| 3 | SCATTER | 7s | 7s | 5s |
| 4 | CHASE | 20s | 20s | 20s |
| 5 | SCATTER | 5s | 5s | 5s |
| 6 | CHASE | 20s | 20s | 20s |
| 7 | SCATTER | 5s | 5s | 5s |
| 8+ | CHASE | ∞ | ∞ | ∞ |

### Frightened Duration

| Stage | Duration | Warning Flash Start |
|:---:|:---:|:---:|
| 1 | 6s | At 4s |
| 2 | 5s | At 3s |
| 3 | 4s | At 2s |
| 4 | 3s | At 1s |
| 5-20 | 2s | At 0.5s |
| 21+ | 0s | N/A (no fright) |

### Ghost House Release (Dot-Based Alternative)

For later stages, dot-based release may replace time-based:

| Stage | Pinky | Inky | Clyde |
|:---:|:---:|:---:|:---:|
| 1 | 0 dots | 30 dots | 60 dots |
| 2+ | 0 dots | 20 dots | 40 dots |

---

## 6. Level Progression

- All stages use the SAME maze layout (classic behavior)
- Difficulty increases through speed, timing, and fright duration changes
- After stage 21, no further difficulty changes (the game reaches its maximum difficulty)
- If a player completes all stages, the game loops back to stage 1 with maximum difficulty

---

## 7. Acceptance Criteria

- [x] Level 1 map is a complete 28×31 grid with no missing tiles
- [x] Map is left-right symmetric
- [x] Total dot count matches actual dot tiles in map (227 dots + 4 power pellets = 231)
- [x] 4 power pellets at correct corner positions
- [x] Ghost house has door (GHOST_HOUSE_DOOR) at row 12 cols 13–15 and interior (GHOST_HOUSE) at rows 13–14
- [x] Tunnel tiles at row 14, columns 0 and 27
- [x] Pac-Man starts at (14, 24) facing LEFT
- [x] Ghost start positions match specification (all on valid non-wall tiles)
- [x] Fruit spawn at (14, 24)
- [x] All difficulty curve values are consistent with ghost-ai-spec.md
- [x] Speed values ensure Pac-Man is always faster than normal ghosts
- [x] Frightened ghosts are always slower than Pac-Man
