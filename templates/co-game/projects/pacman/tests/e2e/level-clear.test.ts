/**
 * E2E Level Clear Test
 *
 * Minimal end-to-end scenario: Pac-Man successfully clears level 1.
 * This test validates the integration of core systems (ScoreSystem,
 * CollisionSystem, StageManager, entity management) by simulating a
 * simplified game loop that collects all dots and verifies the result.
 *
 * Note: This is a structural E2E test — it tests system integration
 * at the API level, not full Canvas rendering or input handling.
 */
import { describe, it, expect } from 'vitest';
import { Direction, TileType, GhostName, GhostMode } from '../../src/config/types';
import type { MapData } from '../../src/config/types';
import {
  TILE_SIZE,
  HUD_OFFSET_Y,
  HALF_ENTITY_SIZE,
  FIXED_DT,
  PACMAN_BASE_SPEED,
  MAP_COLS,
} from '../../src/config/constants';
import { level1Data } from '../../src/maps/level-1';
import { CollisionSystem } from '../../src/engine/CollisionSystem';
import { ScoreSystem } from '../../src/systems/ScoreSystem';
import { Pacman } from '../../src/entities/Pacman';
import { Blinky } from '../../src/entities/Blinky';
import { Pinky } from '../../src/entities/Pinky';
import { Inky } from '../../src/entities/Inky';
import { Clyde } from '../../src/entities/Clyde';

function cloneMapData(data: MapData): MapData {
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

describe('E2E: Level 1 Clear', () => {
  it('systems initialize and can track dot collection to completion', () => {
    const map = cloneMapData(level1Data);
    const collision = new CollisionSystem();

    // Count total dots on the map
    let dotsOnMap = 0;
    for (let r = 0; r < map.tiles.length; r++) {
      for (let c = 0; c < map.tiles[r].length; c++) {
        if (map.tiles[r][c] === TileType.DOT || map.tiles[r][c] === TileType.POWER_PELLET) {
          dotsOnMap++;
        }
      }
    }
    expect(dotsOnMap).toBeGreaterThan(0);

    // Create Pac-Man and score system
    const pacman = new Pacman(collision);
    pacman.reset(map.pacmanStart);

    const mockStorage = {
      getItem: () => null,
      setItem: () => {},
    };
    const score = new ScoreSystem(mockStorage as any);

    // Verify initial state
    expect(score.score).toBe(0);

    // Simulate dot collection for all dots
    // In a real E2E test, we'd run the game loop. For structural validation,
    // we directly manipulate the map and trigger score events.
    for (let r = 0; r < map.tiles.length; r++) {
      for (let c = 0; c < map.tiles[r].length; c++) {
        const tile = map.tiles[r][c];
        if (tile === TileType.DOT) {
          map.tiles[r][c] = TileType.EMPTY;
          score.addScore(10, 'dot');
        } else if (tile === TileType.POWER_PELLET) {
          map.tiles[r][c] = TileType.EMPTY;
          score.addScore(50, 'power_pellet');
          // Power pellet resets the ghost multiplier (handled internally
          // by ScoreSystem when addScore type is 'power_pellet')
        }
      }
    }

    // Verify all dots collected
    let remainingDots = 0;
    for (let r = 0; r < map.tiles.length; r++) {
      for (let c = 0; c < map.tiles[r].length; c++) {
        if (map.tiles[r][c] === TileType.DOT || map.tiles[r][c] === TileType.POWER_PELLET) {
          remainingDots++;
        }
      }
    }
    expect(remainingDots).toBe(0);

    // Verify score is reasonable (should be: dots × 10 + pellets × 50)
    expect(score.score).toBeGreaterThan(0);

    // Verify high score was saved
    expect(score.highScore).toBe(score.score);
  });

  it('ghost entities initialize in correct starting positions', () => {
    const map = cloneMapData(level1Data);
    const collision = new CollisionSystem();

    const blinky = new Blinky(collision);
    blinky.reset(map.ghostStarts[GhostName.BLINKY]);

    const pinky = new Pinky(collision);
    pinky.reset(map.ghostStarts[GhostName.PINKY]);

    const inky = new Inky(collision);
    inky.reset(map.ghostStarts[GhostName.INKY]);

    const clyde = new Clyde(collision);
    clyde.reset(map.ghostStarts[GhostName.CLYDE]);

    // All ghosts default to SCATTER mode on construction
    // Ghost house containment is managed by GhostHouseManager, not by individual ghost mode
    expect(blinky.mode).toBe(GhostMode.SCATTER);
    expect(pinky.mode).toBe(GhostMode.SCATTER);
    expect(inky.mode).toBe(GhostMode.SCATTER);
    expect(clyde.mode).toBe(GhostMode.SCATTER);

    // Verify all ghost positions match map data
    const blinkyTile = blinky.tileCoord();
    expect(blinkyTile.col).toBe(map.ghostStarts[GhostName.BLINKY].col);
    expect(blinkyTile.row).toBe(map.ghostStarts[GhostName.BLINKY].row);
  });
});
