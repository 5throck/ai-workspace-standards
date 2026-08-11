/**
 * Shared Test Utilities
 *
 * Common helpers used across multiple test files to avoid duplication.
 * Every utility here replaces a locally-defined copy that was
 * previously duplicated in ghost-exit, pacman-turn-drift, and
 * tunnel-wrapping tests.
 */
import { GhostName } from '../../src/config/types';
import type { MapData } from '../../src/config/types';

/**
 * Deep-clone a MapData object to prevent mutation between tests.
 * Handles nested structures (tiles[][], ghostStarts, pacmanStart, fruitSpawn).
 */
export function cloneMapData(data: MapData): MapData {
  return {
    tiles: data.tiles.map(row => [...row]),
    pacmanStart: { ...data.pacmanStart },
    ghostStarts: {
      [GhostName.BLINKY]: { ...data.ghostStarts[GhostName.BLINKY] },
      [GhostName.PINKY]: { ...data.ghostStarts[GhostName.PINKY] },
      [GhostName.INKY]: { ...data.ghostStarts[GhostName.INKY] },
      [GhostName.CLYDE]: { ...data.ghostStarts[GhostName.CLYDE] },
    },
    fruitSpawn: { ...data.fruitSpawn },
    tunnelRow: data.tunnelRow,
    totalDots: data.totalDots,
  };
}
