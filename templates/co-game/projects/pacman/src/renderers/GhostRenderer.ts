/**
 * Pac-Man - Ghost Renderer
 *
 * Procedural Canvas 2D rendering for ghost entities.
 * Draws dome + wavy bottom body, directional eyes, frightened face,
 * and eyes-only eaten state.
 * See asset-spec.md Section 2 for exact specifications.
 */
import { Direction } from '../config/types';

export class GhostRenderer {
  /**
   * Draw a normal ghost with dome body, wavy bottom, and directional eyes.
   * Ghost animation: 2 frames at 150ms each (300ms cycle) for wavy bottom offset.
   */
  drawNormal(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    direction: Direction,
    elapsed: number,
    size: number = 16,
  ): void {
    this.drawBody(ctx, x, y, color, elapsed, size);
    this.drawEyes(ctx, x, y, direction, '#2121DE');
  }

  /**
   * Draw a frightened ghost: blue body + white dots + wavy mouth.
   * warning: if true, flashes blue/white every 200ms.
   */
  drawFrightened(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    warning: boolean,
    elapsed: number,
    size: number = 16,
  ): void {
    const bodyColor = warning && Math.floor(elapsed / 200) % 2 === 1
      ? '#FFFFFF'
      : '#2121DE';

    this.drawBody(ctx, x, y, bodyColor, elapsed, size);

    // White dot eyes (small circles, no pupils)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 3, y - 3, 2, 0, Math.PI * 2);
    ctx.fill();

    // Wavy zigzag mouth
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const mouthY = y + 1;
    const mouthLeft = x - 5;
    ctx.moveTo(mouthLeft, mouthY);
    for (let i = 0; i < 5; i++) {
      const mx = mouthLeft + (i + 0.5) * 2;
      const my = i % 2 === 0 ? mouthY - 2 : mouthY + 2;
      ctx.lineTo(mx, my);
    }
    ctx.lineTo(mouthLeft + 10, mouthY);
    ctx.stroke();
  }

  /**
   * Draw an eaten ghost (eyes only, no body).
   * Eyes look in the specified direction.
   */
  drawEaten(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: Direction,
  ): void {
    this.drawEyes(ctx, x, y, direction, '#2121DE');
  }

  // -- Private Helpers --------------------------------------------------------

  /**
   * Draw the ghost body: dome (top semicircle) + rectangular body + wavy bottom.
   * Wavy bottom alternates animation frame for a "walking" effect.
   */
  private drawBody(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    elapsed: number,
    size: number,
  ): void {
    const radius = size / 2 - 1; // 7px
    const domeY = y - 2;
    const bodyBottom = y + radius;
    const waveDepth = 3;
    const waveOffset = Math.floor(elapsed / 150) % 2 === 0 ? 0 : 2;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, domeY, radius, Math.PI, 0, false); // dome
    ctx.lineTo(x + radius, bodyBottom); // right side

    // 3 waves from right to left
    const waveWidth = (radius * 2) / 3;
    for (let i = 0; i < 3; i++) {
      const start = x + radius - i * waveWidth;
      const end = x + radius - (i + 1) * waveWidth;
      const mid = (start + end) / 2;
      const depth = (i + waveOffset) % 2 === 0 ? waveDepth : 0;
      ctx.quadraticCurveTo(mid, bodyBottom - depth, end, bodyBottom);
    }

    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw ghost eyes: white ovals + colored pupils with directional offset.
   */
  private drawEyes(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: Direction,
    pupilColor: string,
  ): void {
    const offsets: Record<string, { dx: number; dy: number }> = {
      [Direction.UP]: { dx: 0, dy: -2 },
      [Direction.DOWN]: { dx: 0, dy: 2 },
      [Direction.LEFT]: { dx: -2, dy: 0 },
      [Direction.RIGHT]: { dx: 2, dy: 0 },
      [Direction.NONE]: { dx: 0, dy: 0 },
    };
    const off = offsets[direction] || offsets[Direction.NONE];

    // Left eye
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(x - 3, y - 4, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pupilColor;
    ctx.beginPath();
    ctx.arc(x - 3 + off.dx, y - 4 + off.dy, 2, 0, Math.PI * 2);
    ctx.fill();

    // Right eye
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(x + 3, y - 4, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pupilColor;
    ctx.beginPath();
    ctx.arc(x + 3 + off.dx, y - 4 + off.dy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
