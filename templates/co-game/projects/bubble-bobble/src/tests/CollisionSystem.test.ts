import { describe, test, expect } from 'vitest';
import { CollisionSystem, TileMap } from '../systems/CollisionSystem';
import { EntityBase } from '../entities/EntityBase';

class MockEntity extends EntityBase {
  update(_dt: number): void {}
  draw(_ctx: CanvasRenderingContext2D): void {}
}

describe('CollisionSystem', () => {
  test('AABB overlap check', () => {
    const e1 = new MockEntity(0, 0, 10, 10);
    const e2 = new MockEntity(5, 5, 10, 10);
    const e3 = new MockEntity(20, 20, 10, 10);

    expect(CollisionSystem.checkAABB(e1, e2)).toBe(true);
    expect(CollisionSystem.checkAABB(e1, e3)).toBe(false);
  });

  test('Map collisions - landing on solid ground', () => {
    // 32 columns x 28 rows tilemap
    const grid = new Array(32 * 28).fill(0);
    // Let's place solid tiles (1) on row 10 (top edge = 10 * 16 = 160)
    for (let c = 0; c < 32; c++) {
      grid[10 * 32 + c] = 1;
    }

    const map = new TileMap(grid);
    // Entity placed at x=16, y=145, height=16. Bottom is 161.
    // If it falls, it should land on row 10 (top is 10 * 16 = 160).
    const entity = new MockEntity(16, 145, 16, 16);
    entity.vy = 5;

    // Previous Y bottom was 140 + 16 = 156 (above solid top 160)
    // Actually let's simulate falling from above (y=145 -> bottom 161)
    CollisionSystem.resolveMapCollisions(entity, map, 140);

    expect(entity.y).toBe(160 - 16); // Should snap to y = 144
    expect(entity.vy).toBe(0);
    expect(entity.isGrounded).toBe(true);
  });

  test('Map collisions - pass through one-way platform from below, land from above', () => {
    const grid = new Array(32 * 28).fill(0);
    // Row 10 is one-way platform (2) (top edge = 10 * 16 = 160)
    for (let c = 0; c < 32; c++) {
      grid[10 * 32 + c] = 2;
    }
    const map = new TileMap(grid);

    const entity = new MockEntity(16, 150, 16, 16);
    // Case 1: Jumping up through the platform (vy = -4)
    entity.vy = -4;
    CollisionSystem.resolveMapCollisions(entity, map, 160);
    expect(entity.y).toBe(150); // No change, passes through

    // Case 2: Falling down onto platform (vy = 3)
    entity.y = 145; // bottom is 161 (intersects platform top at 160)
    entity.vy = 3;
    // Previous bottom was 141 + 16 = 157 (above platform top 160)
    CollisionSystem.resolveMapCollisions(entity, map, 141);
    expect(entity.y).toBe(144); // Snaps to top of platform
    expect(entity.isGrounded).toBe(true);
  });
});
