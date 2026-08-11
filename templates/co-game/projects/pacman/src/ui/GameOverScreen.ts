/**
 * Pac-Man - Game Over Screen
 *
 * Displays "GAME OVER" text, final score, and restart instructions.
 * "PRESS ENTER TO RESTART" appears after 3 seconds.
 * See ui-spec.md Section 1.5 for exact layout.
 */
import { CANVAS_WIDTH, HUD_HEIGHT, GAME_OVER_DELAY } from '../config/constants';

const FONT_FAMILY = "'Press Start 2P', 'Courier New', monospace";

export class GameOverScreen {
  /**
   * Render the game over screen.
   * @param ctx - Canvas rendering context
   * @param score - Final score
   * @param highScore - High score
   * @param stage - Stage reached
   * @param elapsed - Time in ms since entering GAME_OVER state
   */
  render(
    ctx: CanvasRenderingContext2D,
    score: number,
    _highScore: number,
    stage: number,
    elapsed: number,
  ): void {
    // GAME OVER text at classic arcade position
    // y = 16 (HUD) + 17 * 16 (tile) = 288
    ctx.font = '16px ' + FONT_FAMILY;
    ctx.fillStyle = '#FF0000';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, HUD_HEIGHT + 17 * 16);

    // Final score
    ctx.font = '8px ' + FONT_FAMILY;
    ctx.fillStyle = '#FFFFFF';
    const scoreStr = 'SCORE: ' + String(score).padStart(6, '0');
    ctx.fillText(scoreStr, CANVAS_WIDTH / 2, HUD_HEIGHT + 17 * 16 + 20);

    // Stage reached
    ctx.fillText('STAGE: ' + String(stage), CANVAS_WIDTH / 2, HUD_HEIGHT + 17 * 16 + 32);

    // PRESS ENTER TO RESTART appears after 3 seconds
    if (elapsed >= GAME_OVER_DELAY) {
      // Blinking text (500ms on/off)
      if (Math.floor(elapsed / 500) % 2 === 0) {
        ctx.font = '10px ' + FONT_FAMILY;
        ctx.fillText('PRESS ENTER TO RESTART', CANVAS_WIDTH / 2, HUD_HEIGHT + 17 * 16 + 52);
      }
    }
  }
}
