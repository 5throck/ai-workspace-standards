/**
 * Pac-Man - HUD Renderer
 *
 * Draws the heads-up display: score, high score, stage number,
 * and lives indicators. See ui-spec.md Section 2 for exact layout.
 */
import { CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT } from '../config/constants';

const FONT_FAMILY = "'Press Start 2P', 'Courier New', monospace";

export class HUDRenderer {
  /**
   * Draw the full HUD: top bar (scores, stage) + bottom lives bar.
   * Score formatting: 6-digit zero-padded.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    score: number,
    highScore: number,
    stage: number,
    lives: number,
  ): void {
    this.drawTopBar(ctx, score, highScore, stage);
    this.drawLives(ctx, lives);
  }

  /** Draw the top HUD bar with score, high score, and stage. */
  private drawTopBar(
    ctx: CanvasRenderingContext2D,
    score: number,
    highScore: number,
    stage: number,
  ): void {
    // HUD background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);

    ctx.font = '8px ' + FONT_FAMILY;
    ctx.fillStyle = '#FFFFFF';

    // 1UP label
    ctx.textAlign = 'left';
    ctx.fillText('1UP', 4, 10);

    // Score value (6-digit zero-padded)
    const scoreStr = String(score).padStart(6, '0');
    ctx.fillText(scoreStr, 32, 10);

    // HIGH SCORE label
    ctx.textAlign = 'center';
    ctx.fillText('HIGH SCORE', CANVAS_WIDTH / 2, 10);

    // High score value
    const highScoreStr = String(highScore).padStart(6, '0');
    ctx.fillText(highScoreStr, CANVAS_WIDTH / 2 + 60, 10);

    // STAGE label
    ctx.textAlign = 'right';
    ctx.fillText('STAGE', CANVAS_WIDTH - 28, 10);

    // Stage number
    ctx.fillText(String(stage), CANVAS_WIDTH - 4, 10);
  }

  /**
   * Draw lives icons at the bottom of the screen.
   * Display count = max(0, lives - 1). Max 5 displayed.
   * Each life is a small yellow Pac-Man circle with a mouth.
   */
  private drawLives(
    ctx: CanvasRenderingContext2D,
    lives: number,
  ): void {
    const displayCount = Math.max(0, Math.min(lives - 1, 5));
    const y = CANVAS_HEIGHT - 8;

    ctx.fillStyle = '#FFFF00';
    for (let i = 0; i < displayCount; i++) {
      const x = 9 + i * 16;
      // Small Pac-Man icon (circle with mouth)
      ctx.beginPath();
      ctx.arc(x, y, 5, Math.PI / 6, -Math.PI / 6 + Math.PI * 2, false);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
    }
  }
}
