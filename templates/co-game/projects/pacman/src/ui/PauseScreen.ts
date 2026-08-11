/**
 * Pac-Man - Pause Screen
 *
 * Semi-transparent overlay with "PAUSED" text and resume instructions.
 * See ui-spec.md Section 1.3 for exact layout.
 */
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config/constants';

const FONT_FAMILY = "'Press Start 2P', 'Courier New', monospace";

export class PauseScreen {
  /**
   * Render the pause overlay on top of the frozen game frame.
   */
  render(ctx: CanvasRenderingContext2D): void {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // PAUSED text
    ctx.font = '12px ' + FONT_FAMILY;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 12);

    // PRESS P TO RESUME
    ctx.font = '8px ' + FONT_FAMILY;
    ctx.fillText('PRESS P TO RESUME', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 12);
  }
}
