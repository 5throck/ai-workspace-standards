/**
 * Pac-Man - Start Screen
 *
 * Displays the classic start screen with title, maze walls only,
 * and blinking "PRESS ENTER TO START" text.
 * See ui-spec.md Section 1.1 for exact layout.
 */
import { HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config/constants';
import { MazeRenderer } from '../renderers/MazeRenderer';

const FONT_FAMILY = "'Press Start 2P', 'Courier New', monospace";

export class StartScreen {
  /**
   * Render the start screen.
   * @param ctx - Canvas rendering context
   * @param mazeRenderer - MazeRenderer instance for drawing wall outlines
   * @param tiles - 2D tile array
   * @param highScore - Current high score to display
   * @param elapsed - Time in ms for blinking text animation
   */
  render(
    ctx: CanvasRenderingContext2D,
    mazeRenderer: MazeRenderer,
    tiles: import('../config/types').TileType[][],
    highScore: number,
    elapsed: number,
  ): void {
    // PAC-MAN title at top center
    ctx.fillStyle = '#FFFF00';
    ctx.font = '16px ' + FONT_FAMILY;
    ctx.textAlign = 'center';
    ctx.fillText('PAC-MAN', CANVAS_WIDTH / 2, 96);

    // Maze walls only (no dots/pellets)
    mazeRenderer.drawWallsOnly(ctx, tiles, HUD_HEIGHT);

    // Bottom score display
    ctx.font = '8px ' + FONT_FAMILY;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText('1UP', 8, CANVAS_HEIGHT - 12);
    ctx.textAlign = 'center';
    ctx.fillText('HIGH SCORE', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 12);

    const highScoreStr = String(highScore).padStart(6, '0');
    ctx.textAlign = 'right';
    ctx.fillText(highScoreStr, CANVAS_WIDTH - 8, CANVAS_HEIGHT - 12);

    // PRESS ENTER TO START blinking text
    // 500ms on / 500ms off
    if (Math.floor(elapsed / 500) % 2 === 0) {
      ctx.font = '10px ' + FONT_FAMILY;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('PRESS ENTER TO START', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 36);
    }
  }
}
