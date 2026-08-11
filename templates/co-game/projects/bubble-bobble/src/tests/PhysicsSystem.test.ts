import { describe, test, expect } from 'vitest';
import { PhysicsSystem, GRAVITY, TERMINAL_VELOCITY, SCREEN_WIDTH, SCREEN_HEIGHT } from '../systems/PhysicsSystem';
import { EntityBase } from '../entities/EntityBase';

class MockEntity extends EntityBase {
  update(_dt: number): void {}
  draw(_ctx: CanvasRenderingContext2D): void {}
}

describe('PhysicsSystem', () => {
  test('should apply gravity to dynamic entity that is not grounded', () => {
    const entity = new MockEntity(10, 10, 16, 16);
    entity.isGrounded = false;
    entity.vy = 0;

    PhysicsSystem.applyGravity(entity, 1.0);
    expect(entity.vy).toBe(GRAVITY);

    PhysicsSystem.applyGravity(entity, 2.0);
    expect(entity.vy).toBe(GRAVITY + GRAVITY * 2.0);
  });

  test('should clamp falling speed to terminal velocity', () => {
    const entity = new MockEntity(10, 10, 16, 16);
    entity.isGrounded = false;
    entity.vy = TERMINAL_VELOCITY - 0.05;

    PhysicsSystem.applyGravity(entity, 1.0);
    expect(entity.vy).toBe(TERMINAL_VELOCITY);
  });

  test('should reset vertical velocity to 0 when grounded', () => {
    const entity = new MockEntity(10, 10, 16, 16);
    entity.isGrounded = true;
    entity.vy = 2.0;

    PhysicsSystem.applyGravity(entity, 1.0);
    expect(entity.vy).toBe(0);
  });

  test('should handle horizontal and vertical screen wrapping', () => {
    // Left boundary wrap
    const entity = new MockEntity(-17, 10, 16, 16);
    PhysicsSystem.handleScreenWrap(entity);
    expect(entity.x).toBe(SCREEN_WIDTH);

    // Right boundary wrap
    entity.x = SCREEN_WIDTH + 1;
    PhysicsSystem.handleScreenWrap(entity);
    expect(entity.x).toBe(-16);

    // Bottom wrap to top
    entity.y = SCREEN_HEIGHT + 1;
    PhysicsSystem.handleScreenWrap(entity);
    expect(entity.y).toBe(-16);
  });
});
