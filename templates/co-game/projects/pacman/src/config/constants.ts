/**
 * Pac-Man — Game Constants
 * All magic numbers and configuration values used throughout the game.
 */

import {
  GhostMode,
  GhostName,
  FruitType,
} from './types';
import type {
  ScatterTarget,
  ScatterChaseCycle,
} from './types';

// === Canvas & Tile Dimensions ===

export const CANVAS_WIDTH = 448;
export const CANVAS_HEIGHT = 496;
export const TILE_SIZE = 16;
export const MAP_COLS = 28;
export const MAP_ROWS = 31;

// === HUD Layout ===
// The HUD occupies a 16px strip above the maze

export const HUD_HEIGHT = 16;
export const HUD_SCORE_X = 8;
export const HUD_SCORE_Y = 0;
export const HUD_HIGHSCORE_X = 168;
export const HUD_HIGHSCORE_Y = 0;
export const HUD_LIVES_X = 8;
export const HUD_LIVES_Y = CANVAS_HEIGHT - 16;
export const HUD_STAGE_X = 168;
export const HUD_STAGE_Y = CANVAS_HEIGHT - 16;
export const HUD_OFFSET_Y = HUD_HEIGHT; // vertical offset to translate maze to pixel coords

// === Ghost House Geometry ===
// Tile coordinates for ghost house center, exit, and entry positions.
// Derived from the classic 28×31 Pac-Man maze layout.

export const GHOST_HOUSE_CENTER_COL = 14; // center column of ghost house
export const GHOST_HOUSE_EXIT_ROW = 11; // row where ghosts snap after leaving house
export const GHOST_HOUSE_ENTRY_COL = 14; // column where eaten ghosts re-enter
export const GHOST_HOUSE_ENTRY_ROW = 14; // row inside the house where eaten ghosts arrive

// === Tunnel Speed Zone ===
// Columns where ghosts move at reduced tunnel speed.

export const TUNNEL_SPEED_ZONE_LEFT = 5; // cols 0–5 = slow zone
export const TUNNEL_SPEED_ZONE_RIGHT = 22; // cols 22–27 = slow zone

// === Game Speeds (pixels per update tick at 60fps) ===

export const PACMAN_BASE_SPEED = 2.0; // 1 tile in 8 ticks = ~8 tiles/sec
export const GHOST_BASE_SPEED = 1.5; // 75% of Pac-Man base speed
export const GHOST_FRIGHTENED_SPEED = 0.75; // 50% of ghost normal speed
export const GHOST_EATEN_SPEED = 3.0; // 2x ghost normal speed
export const GHOST_IN_HOUSE_SPEED = 0.75; // 50% of ghost normal speed
export const GHOST_TUNNEL_SPEED = 0.6; // 40% of ghost normal speed

// Speed percentages per stage (fraction of maximum engine speed)
export const PACMAN_SPEED_PERCENTAGE: Record<number, number> = {
  1: 0.80,
  2: 0.90,
  3: 0.90,
  4: 0.90,
  5: 0.95,
  6: 0.95,
  7: 0.95,
  8: 0.95,
  9: 1.00,
  10: 1.00,
  11: 1.00,
  12: 1.00,
  13: 1.00,
  14: 1.00,
  15: 1.00,
  16: 1.00,
  17: 1.00,
  18: 1.00,
  19: 1.00,
  20: 1.00,
};

export const GHOST_SPEED_PERCENTAGE: Record<number, number> = {
  1: 0.75,
  2: 0.85,
  3: 0.85,
  4: 0.90,
  5: 0.90,
  6: 0.90,
  7: 0.95,
  8: 0.95,
  9: 0.95,
  10: 0.95,
  11: 0.95,
  12: 0.95,
  13: 0.95,
  14: 0.95,
  15: 0.95,
  16: 0.95,
  17: 1.00,
  18: 1.00,
  19: 1.00,
  20: 1.00,
};

export const GHOST_FRIGHT_SPEED_PERCENTAGE: Record<number, number> = {
  1: 0.50,
  2: 0.55,
  3: 0.55,
  4: 0.60,
  5: 0.60,
  6: 0.60,
  7: 0.60,
  8: 0.60,
  9: 0.60,
  10: 0.60,
  11: 0.60,
  12: 0.60,
  13: 0.60,
  14: 0.60,
  15: 0.60,
  16: 0.60,
  17: 0.60,
  18: 0.60,
  19: 0.60,
  20: 0.60,
};

export const GHOST_TUNNEL_SPEED_PERCENTAGE: Record<number, number> = {
  1: 0.40,
  2: 0.45,
  3: 0.45,
  4: 0.50,
  5: 0.50,
  6: 0.50,
  7: 0.50,
  8: 0.50,
  9: 0.55,
  10: 0.55,
  11: 0.55,
  12: 0.55,
  13: 0.55,
  14: 0.55,
  15: 0.55,
  16: 0.55,
  17: 0.55,
  18: 0.55,
  19: 0.55,
  20: 0.55,
};

// === Scoring ===

export const DOT_POINTS = 10;
export const POWER_PELLET_POINTS = 50;
export const GHOST_POINTS: readonly [number, number, number, number] = [200, 400, 800, 1600];
export const EXTRA_LIFE_SCORE = 10000;

// === Lives ===

export const INITIAL_LIVES = 3;

// === Collision ===

export const ALIGNMENT_TOLERANCE = 2; // pixels from tile center considered aligned
export const HALF_ENTITY_SIZE = 7; // half the bounding box size for leading-edge checks

// === Animation Timings (milliseconds) ===

export const PACMAN_MOUTH_FRAME_DURATION = 100; // mouth open/close cycle per frame
export const PACMAN_MOUTH_TOTAL_FRAMES = 3; // open, mid, closed
export const DEATH_ANIMATION_DURATION = 1500; // death animation total
export const DEATH_TOTAL_FRAMES = 12; // number of frames in death animation
export const GHOST_FRIGHT_FLASH_DURATION = 200; // blue/white alternation in warning flash
export const GHOST_FRIGHT_WARNING_START = 2000; // last 2 seconds of fright = warning
export const GHOST_EYES_FRAME_DURATION = 150; // eyes direction frame interval
export const MAZE_FLASH_DURATION = 1000; // level-complete maze flash
export const FRUIT_DISPLAY_DURATION = 10000; // how long fruit stays visible

// === Power Pellet / Frightened Mode ===

// Arcade-faithful fright durations in ms (level → duration; 0 from level 17).
export const FRIGHTENED_DURATIONS: Record<number, number> = {
  1: 6000,
  2: 5000,
  3: 4000,
  4: 3000,
  5: 2000,
  6: 5000,
  7: 2000,
  8: 2000,
  9: 1000,
  10: 5000,
  11: 2000,
  12: 1000,
  13: 1000,
  14: 3000,
  15: 1000,
  16: 1000,
  17: 0,
  18: 1000,
  19: 0,
  20: 0,
};

// === Cruise Elroy (Blinky) dot thresholds by level (1–2, 3–4, 5+) ===
export const ELROY_DOT_THRESHOLDS: Record<number, [number, number]> = {
  1: [20, 10],
  2: [30, 15],
  3: [40, 20],
  4: [40, 20],
  5: [40, 20],
};

// READY! display duration at stage start.
export const READY_DURATION = 2000;

// === Game Loop ===

export const FIXED_DT = 1000 / 60; // ~16.67ms per tick
export const ACCUMULATOR_CAP = 100; // max ms to accumulate before capping

// === Respawn ===

export const RESPAWN_PAUSE_DURATION = 2000; // 2s pause after death before respawn

// === Ghost House Release Timers (milliseconds) ===

export const INKY_RELEASE_DOTS = 30; // personal counter: dots since Pinky left
export const CLYDE_RELEASE_DOTS = 60; // personal counter: dots since Inky left
// Global counter after a life is lost (arcade level-1 values).
export const GLOBAL_RELEASE_DOTS: Record<string, number> = {
  PINKY: 7,
  INKY: 17,
  CLYDE: 32,
};
export const GHOST_HOUSE_PAUSE_DURATION = 500; // 0.5s pause when eaten ghost returns

// === Scatter/Chase Cycles (milliseconds) ===

export const SCATTER_CHASE_CYCLES_STAGE_1: ScatterChaseCycle[] = [
  { mode: GhostMode.SCATTER, duration: 7000 },
  { mode: GhostMode.CHASE, duration: 20000 },
  { mode: GhostMode.SCATTER, duration: 7000 },
  { mode: GhostMode.CHASE, duration: 20000 },
  { mode: GhostMode.SCATTER, duration: 5000 },
  { mode: GhostMode.CHASE, duration: 20000 },
  { mode: GhostMode.SCATTER, duration: 5000 },
  { mode: GhostMode.CHASE, duration: Infinity },
];

export const SCATTER_CHASE_CYCLES_STAGE_2_4: ScatterChaseCycle[] = [
  { mode: GhostMode.SCATTER, duration: 7000 },
  { mode: GhostMode.CHASE, duration: 20000 },
  { mode: GhostMode.SCATTER, duration: 7000 },
  { mode: GhostMode.CHASE, duration: 20000 },
  { mode: GhostMode.SCATTER, duration: 5000 },
  { mode: GhostMode.CHASE, duration: 20000 },
  { mode: GhostMode.SCATTER, duration: 5000 },
  { mode: GhostMode.CHASE, duration: Infinity },
];

export const SCATTER_CHASE_CYCLES_STAGE_5: ScatterChaseCycle[] = [
  { mode: GhostMode.SCATTER, duration: 5000 },
  { mode: GhostMode.CHASE, duration: 20000 },
  { mode: GhostMode.SCATTER, duration: 5000 },
  { mode: GhostMode.CHASE, duration: 20000 },
  { mode: GhostMode.SCATTER, duration: 5000 },
  { mode: GhostMode.CHASE, duration: 20000 },
  { mode: GhostMode.SCATTER, duration: 5000 },
  { mode: GhostMode.CHASE, duration: Infinity },
];

// === Scatter Targets ===

export const SCATTER_TARGETS: Record<GhostName, ScatterTarget> = {
  [GhostName.BLINKY]: { col: 25, row: -2 },
  [GhostName.PINKY]: { col: 2, row: -2 },
  [GhostName.INKY]: { col: 27, row: 34 },
  [GhostName.CLYDE]: { col: 0, row: 34 },
};

// === Ghost AI ===

export const PINKY_TARGET_OFFSET = 4; // tiles ahead of Pac-Man
export const INKY_PIVOT_OFFSET = 2; // tiles ahead of Pac-Man for pivot
export const CLYDE_CHASE_THRESHOLD = 8; // tiles; switch to scatter if closer

// === Fruit Progression ===

export const FRUIT_PROGRESSION: Array<{ fruit: FruitType; points: number }> = [
  { fruit: FruitType.CHERRY, points: 100 },
  { fruit: FruitType.STRAWBERRY, points: 300 },
  { fruit: FruitType.ORANGE, points: 500 },
  { fruit: FruitType.APPLE, points: 700 },
  { fruit: FruitType.MELON, points: 1000 },
  { fruit: FruitType.GALAXIAN, points: 2000 },
  { fruit: FruitType.BELL, points: 3000 },
  { fruit: FruitType.KEY, points: 5000 },
];

// === Game Over ===

export const GAME_OVER_DELAY = 3000; // ms before "PRESS ENTER TO RESTART" appears
