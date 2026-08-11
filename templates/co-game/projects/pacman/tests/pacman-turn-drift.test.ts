/**
 * Pac-Man Turn Drift Bug Tests
 *
 * Validates that Pac-Man can execute perpendicular direction changes
 * (e.g., LEFT → DOWN) without being blocked by bounding-box drift.
 *
 * Root cause: When Pac-Man turns, its position may be offset by up to
 * ALIGNMENT_TOLERANCE (2px) from the tile center. The leading-edge
 * collision check probes with HALF_ENTITY_SIZE (7px), so a 2px drift
 * shifts the edge probe into an adjacent column that may be a wall.
 *
 * Fix: Call snapToGrid() when consuming a buffered turn in Pacman.update().
 */

import { describe, it, expect } from 'vitest';
import { TileType, Direction, GhostMode, GhostName } from '../src/config/types';
import type { MapData } from '../src/config/types';
import { Pacman } from '../src/entities/Pacman';
import { CollisionSystem } from '../src/engine/CollisionSystem';
import { TILE_SIZE, HUD_OFFSET_Y, PACMAN_BASE_SPEED, GHOST_HOUSE_EXIT_ROW, GHOST_HOUSE_ENTRY_COL, GHOST_HOUSE_ENTRY_ROW } from '../src/config/constants';
import { level1Data } from '../src/maps/level-1';
import { cloneMapData } from './helpers/test-utils';

function tileCenterPixel(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2 + HUD_OFFSET_Y,
  };
}

describe('Pac-Man Turn Drift Bug', () => {
  it('should allow LEFT→DOWN turn at col 6, row 20 even with 2px horizontal drift', () => {
    const map = cloneMapData(level1Data);
    const collision = new CollisionSystem();
    const pacman = new Pacman(collision);
    pacman.setMap(map);

    // Place Pac-Man at tile center of (6, 20)
    const start = tileCenterPixel(6, 20);
    pacman.position = { x: start.x, y: start.y };
    pacman.setDirection(Direction.LEFT, PACMAN_BASE_SPEED);

    // Move LEFT for 1 tick — position drifts 2px from center
    pacman.update(16.67);
    expect(pacman.position.x).toBe(start.x - PACMAN_BASE_SPEED); // 2px left of center

    // At this point Pac-Man is at x = 102 (center was 104). Drift = 2px.
    // Still within ALIGNMENT_TOLERANCE=2, so isGridAligned() returns true.

    // Player presses DOWN
    pacman.setNextDirection(Direction.DOWN);

    // Tick 2: should consume the turn and start moving down
    pacman.update(16.67);
    expect(pacman.direction).toBe(Direction.DOWN);
    expect(pacman.velocity.dy).toBeGreaterThan(0);

    // Verify Pac-Man actually moves downward over the next few ticks
    const yBefore = pacman.position.y;
    for (let i = 0; i < 5; i++) {
      pacman.update(16.67);
    }
    expect(pacman.position.y).toBeGreaterThan(yBefore);
  });

  it('should allow RIGHT→DOWN turn at col 21, row 20 even with 2px horizontal drift', () => {
    const map = cloneMapData(level1Data);
    const collision = new CollisionSystem();
    const pacman = new Pacman(collision);
    pacman.setMap(map);

    // Place Pac-Man at tile center of (21, 20)
    const start = tileCenterPixel(21, 20);
    pacman.position = { x: start.x, y: start.y };
    pacman.setDirection(Direction.RIGHT, PACMAN_BASE_SPEED);

    // Move RIGHT for 1 tick — drifts 2px right of center
    pacman.update(16.67);

    // Player presses DOWN
    pacman.setNextDirection(Direction.DOWN);

    // Tick 2: should consume the turn
    pacman.update(16.67);
    expect(pacman.direction).toBe(Direction.DOWN);

    // Verify movement continues downward
    const yBefore = pacman.position.y;
    for (let i = 0; i < 5; i++) {
      pacman.update(16.67);
    }
    expect(pacman.position.y).toBeGreaterThan(yBefore);
  });

  it('should snap position to grid center when executing a buffered turn', () => {
    const map = cloneMapData(level1Data);
    const collision = new CollisionSystem();
    const pacman = new Pacman(collision);
    pacman.setMap(map);

    const col = 6, row = 20;
    const center = tileCenterPixel(col, row);

    // Start exactly at center, move LEFT for 1 tick to create drift
    pacman.position = { x: center.x, y: center.y };
    pacman.setDirection(Direction.LEFT, PACMAN_BASE_SPEED);
    pacman.update(16.67);

    // Position should be 2px off-center
    expect(pacman.position.x).toBe(center.x - 2);
    expect(pacman.position.y).toBe(center.y);

    // Press DOWN and tick
    pacman.setNextDirection(Direction.DOWN);
    pacman.update(16.67);

    // After the turn, position should be snapped to grid center
    // (or at least the x should be at the tile center for the column)
    expect(pacman.position.x).toBe(center.x);
  });
});
