/**
 * Tunnel Wrapping Bug Test
 *
 * Verifies that Pac-Man can enter and traverse the tunnel
 * (left edge col 0 → right edge col 27 and vice versa).
 */
import { describe, it, expect } from 'vitest';
import { Direction, TileType, GhostMode, GhostName } from '../src/config/types';
import type { MapData } from '../src/config/types';
import {
  TILE_SIZE,
  HUD_OFFSET_Y,
  HALF_ENTITY_SIZE,
  MAP_COLS,
  PACMAN_BASE_SPEED,
  FIXED_DT,
} from '../src/config/constants';
import { level1Data } from '../src/maps/level-1';
import { CollisionSystem } from '../src/engine/CollisionSystem';
import { Pacman } from '../src/entities/Pacman';
import { cloneMapData } from './helpers/test-utils';

describe('Tunnel Wrapping', () => {
  it('CollisionSystem: getTileAtPixel should wrap columns at tunnel row', () => {
    const map = cloneMapData(level1Data);
    const collision = new CollisionSystem();

    // Left tunnel tile (col 0, row 14) pixel center: x=8, y=240
    const tunnelY = 14 * TILE_SIZE + TILE_SIZE / 2 + HUD_OFFSET_Y; // 240

    // Position at left tunnel tile center
    const leftCenterX = 0 * TILE_SIZE + TILE_SIZE / 2; // 8

    // Test: one step LEFT from col 0 center with speed 2.0
    // nextX - halfSize = (8 - 2.0) - 7 = -1.0 → getTileAtPixel(-1, ...) should wrap
    // to col 27 which is TUNNEL
    const nextX = leftCenterX - PACMAN_BASE_SPEED; // 8 - 2.0 = 6.0
    const tile = collision['getTileAtPixel'](nextX - HALF_ENTITY_SIZE, tunnelY, map);

    // Without wrapping fix: returns WALL
    // With wrapping fix: returns TUNNEL (wrapped col = ((-1 % 28) + 28) % 28 = 27)
    console.log(`Left tunnel check: nextX=${nextX}, edge=${nextX - HALF_ENTITY_SIZE}, tileType=${tile}, expected=TUNNEL(6)`);
    // This will FAIL with current code (WALL) and PASS with fix (TUNNEL)
    expect(tile).toBe(TileType.TUNNEL);
  });

  it('CollisionSystem: right tunnel edge should wrap to left', () => {
    const map = cloneMapData(level1Data);
    const collision = new CollisionSystem();

    const tunnelY = 14 * TILE_SIZE + TILE_SIZE / 2 + HUD_OFFSET_Y;
    const rightCenterX = 27 * TILE_SIZE + TILE_SIZE / 2; // 440

    // One step RIGHT from col 27 center
    const nextX = rightCenterX + PACMAN_BASE_SPEED; // 440 + 2.0 = 442.0
    const tile = collision['getTileAtPixel'](nextX + HALF_ENTITY_SIZE, tunnelY, map);

    console.log(`Right tunnel check: nextX=${nextX}, edge=${nextX + HALF_ENTITY_SIZE}, tileType=${tile}, expected=TUNNEL(6)`);
    expect(tile).toBe(TileType.TUNNEL);
  });

  it('Pacman can traverse left tunnel to right side', () => {
    const map = cloneMapData(level1Data);
    const collision = new CollisionSystem();
    const pacman = new Pacman(collision);
    pacman.setMap(map);

    // Place Pac-Man at left tunnel tile center
    pacman.reset({ col: 0, row: 14 });
    pacman.setDirection(Direction.LEFT, PACMAN_BASE_SPEED);

    const startX = pacman.position.x;
    console.log(`Start: x=${startX.toFixed(2)}, tile=(${pacman.tileCoord().col},${pacman.tileCoord().row})`);

    // Simulate movement until Pac-Man wraps or gets stuck
    let stuck = false;
    for (let tick = 0; tick < 30; tick++) {
      const prevX = pacman.position.x;
      pacman.update(FIXED_DT);
      const newX = pacman.position.x;

      if (Math.abs(newX - prevX) < 0.01) {
        stuck = true;
        console.log(`Stuck at tick ${tick}: x=${newX.toFixed(2)}`);
        break;
      }
      if (tick % 5 === 0) {
        console.log(`  tick ${tick}: x=${newX.toFixed(2)}, tile=(${pacman.tileCoord().col},${pacman.tileCoord().row})`);
      }
    }

    // After wrapping, Pac-Man should be on the right side (x > 400)
    if (!stuck) {
      console.log(`Final: x=${pacman.position.x.toFixed(2)}, tile=(${pacman.tileCoord().col},${pacman.tileCoord().row})`);
      expect(pacman.position.x).toBeGreaterThan(MAP_COLS * TILE_SIZE / 2);
    } else {
      // With current bug, Pac-Man gets stuck
      expect.fail('Pacman should not get stuck at tunnel entrance');
    }
  });
});
