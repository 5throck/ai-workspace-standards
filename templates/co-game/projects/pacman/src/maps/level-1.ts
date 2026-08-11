/**
 * Pac-Man — Level 1 Map Data
 * ROM-accurate classic 28×31 Pac-Man maze layout.
 *
 * Based on the original Pac-Man arcade ROM data from:
 *   https://github.com/lackoftrack27/Pac-Man-Master-Museum
 *
 * Tile values:
 *   0 = EMPTY, 1 = WALL, 2 = DOT, 3 = POWER_PELLET,
 *   4 = GHOST_HOUSE_DOOR, 5 = GHOST_HOUSE, 6 = TUNNEL, 7 = FRUIT_SPAWN
 */

import { TileType, GhostName } from '../config/types';
import type { MapData } from '../config/types';

/**
 * Level 1 - Classic Pac-Man Maze (28 columns × 31 rows)
 *
 * Layout notes:
 *   - Left-right mirror symmetry around columns 13–14.
 *   - Tunnel at cols 0 & 27, row 14.
 *   - Ghost house: door row 12 (cols 13–14), interior rows 13–15 (cols 11–16).
 *   - Blinky starts above the door (col 14, row 11).
 *   - Pinky starts inside the house (col 13, row 14).
 *   - Inky starts inside the house (col 11, row 14).
 *   - Clyde starts inside the house (col 15, row 14).
 *   - Pac-Man starts below the ghost block (col 14, row 23).
 *   - Fruit spawns at the Pac-Man start row (col 14, row 23).
 *   - Total: 240 dots + 4 power pellets = 244 collectibles.
 */
const LEVEL_1: TileType[][] = [
  // Row 0 — top border
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Row 1
  [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
  // Row 2
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  // Row 3 — power pellets
  [1,3,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,3,1],
  // Row 4
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  // Row 5 — long corridor
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  // Row 6 — twin boxes top
  [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
  // Row 7 — twin boxes bottom
  [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
  // Row 8 — pre-ghost-block
  [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
  // Row 9 — ghost block top
  [1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1],
  // Row 10 — ghost block side
  [0,0,0,0,0,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,0,0,0,0,0],
  // Row 11 — ghost block corridor (Blinky starts here)
  [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
  // Row 12 — ghost house door
  [0,0,0,0,0,1,2,1,1,0,1,1,1,4,4,1,1,1,0,1,1,2,1,0,0,0,0,0],
  // Row 13 — ghost house interior (top)
  [1,1,1,1,1,1,2,1,1,0,1,5,5,5,5,5,5,1,0,1,1,2,1,1,1,1,1,1],
  // Row 14 — tunnel row / ghost house interior (mid)
  [6,0,0,0,0,0,2,0,0,0,1,5,5,5,5,5,5,1,0,0,0,2,0,0,0,0,0,6],
  // Row 15 — ghost house interior (bottom)
  [1,1,1,1,1,1,2,1,1,0,1,5,5,5,5,5,5,1,0,1,1,2,1,1,1,1,1,1],
  // Row 16 — ghost block bottom
  [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
  // Row 17 — lower corridor
  [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
  // Row 18 — lower T top
  [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
  // Row 19 — lower T bottom
  [1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1],
  // Row 20 — long corridor
  [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
  // Row 21 — T-section walls top
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  // Row 22 — T-section walls bottom
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  // Row 23 — power pellets / Pac-Man start / fruit spawn
  [1,3,2,2,1,1,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,1,1,2,2,3,1],
  // Row 24 — bottom T-section top
  [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
  // Row 25 — bottom T-section bottom
  [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
  // Row 26 — pre-bottom boxes
  [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
  // Row 27 — bottom box walls top
  [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
  // Row 28 — bottom box walls bottom
  [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
  // Row 29 — bottom corridor
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  // Row 30 — bottom border
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

export const level1Data: MapData = {
  tiles: LEVEL_1,
  pacmanStart: { col: 14, row: 23 },
  ghostStarts: {
    [GhostName.BLINKY]: { col: 14, row: 11 },
    [GhostName.PINKY]:  { col: 13, row: 14 },
    [GhostName.INKY]:   { col: 11, row: 14 },
    [GhostName.CLYDE]:  { col: 15, row: 14 },
  },
  fruitSpawn: { col: 14, row: 23 },
  tunnelRow: 14,
  totalDots: 240,
};
