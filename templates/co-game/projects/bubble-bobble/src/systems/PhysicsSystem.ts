import { EntityBase } from '../entities/EntityBase';

export const SCREEN_WIDTH = 512;
export const SCREEN_HEIGHT = 448;
export const GRAVITY = 0.4; // pixels per frame^2 at 60fps (2x for 16px tile scale)
export const TERMINAL_VELOCITY = 9.0;

export class PhysicsSystem {
  public static applyGravity(entity: EntityBase, dt: number): void {
    // Normal update steps are frame-rate normalized (dt is roughly 1.0 at 60fps)
    if (!entity.isGrounded) {
      entity.vy += GRAVITY * entity.gravityScale * dt;
      if (entity.vy > TERMINAL_VELOCITY) {
        entity.vy = TERMINAL_VELOCITY;
      }
    } else {
      entity.vy = 0;
    }
  }

  public static updatePosition(entity: EntityBase, dt: number): void {
    entity.x += entity.vx * dt;
    entity.y += entity.vy * dt;
  }

  public static handleScreenWrap(entity: EntityBase): void {
    // Horizontal wrapping
    if (entity.x + entity.width < 0) {
      entity.x = SCREEN_WIDTH;
    } else if (entity.x > SCREEN_WIDTH) {
      entity.x = -entity.width;
    }

    // Vertical wrapping (specifically falling through bottom screen wraps to top)
    if (entity.y > SCREEN_HEIGHT) {
      entity.y = -entity.height;
      entity.isGrounded = false;
    } else if (entity.y + entity.height < -20) { // arbitrary buffer to prevent locking near top
      entity.y = SCREEN_HEIGHT;
      entity.isGrounded = false;
    }
  }
}
