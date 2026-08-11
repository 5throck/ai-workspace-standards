/**
 * Pac-Man - Pac-Man Renderer
 *
 * Procedural Canvas 2D rendering for the Pac-Man entity.
 * Renders the classic yellow pie shape with mouth animation,
 * directional rotation, and death animation.
 * See asset-spec.md Section 1 for exact specifications.
 */
import { Direction } from '../config/types';

export class PacmanRenderer {
  /** Draw Pac-Man in normal mode with mouth animation. */
  drawNormal(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: Direction,
    elapsed: number,
    size: number = 16,
  ): void {
    const radius = size / 2;
    // 2-frame mouth animation: 200ms cycle (100ms per frame)
    const frame = Math.floor(elapsed / 100) % 2;

    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();

    if (frame === 0) {
      // Open mouth based on direction
      const mouthAngle = Math.PI / 6; // 30 degrees
      switch (direction) {
        case Direction.RIGHT:
          ctx.arc(x, y, radius, mouthAngle, -mouthAngle + Math.PI * 2, false);
          break;
        case Direction.LEFT:
          ctx.arc(x, y, radius, Math.PI + mouthAngle, Math.PI - mouthAngle, false);
          break;
        case Direction.UP:
          ctx.arc(x, y, radius, Math.PI / 2 + mouthAngle, Math.PI / 2 - mouthAngle, false);
          break;
        case Direction.DOWN:
          ctx.arc(x, y, radius, -Math.PI / 2 + mouthAngle, -Math.PI / 2 - mouthAngle, false);
          break;
        default:
          ctx.arc(x, y, radius, mouthAngle, -mouthAngle + Math.PI * 2, false);
          break;
      }
      ctx.lineTo(x, y);
    } else {
      // Full circle (mouth closed)
      ctx.arc(x, y, radius, 0, Math.PI * 2, false);
    }

    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw Pac-Man death animation.
   * 8 frames over 1500ms. Mouth opens from 30 degrees to 240 degrees.
   * The pac-man shape shrinks clockwise until only a small arc remains.
   */
  drawDying(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    elapsed: number,
    size: number = 16,
  ): void {
    const radius = size / 2;
    const progress = Math.min(elapsed / 1500, 1);

    if (progress >= 1) {
      // Death animation complete, don't draw
      return;
    }

    // Death animation: 8 frames
    const frame = Math.min(Math.floor(progress * 8), 7);
    const mouthHalfAngle = (30 + frame * 30) * (Math.PI / 180);

    // Arc from mouthHalfAngle to -mouthHalfAngle (wrapping around the bottom)
    // This creates the classic "peeling away" effect
    const startAngle = mouthHalfAngle;
    const endAngle = Math.PI * 2 - mouthHalfAngle;

    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle, false);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  }
}
