import { DK_SPRITES, SPRITES, drawSprite } from '../assets/sprites';
import { PALETTE } from '../assets/palette';
import { TILE, VIEW_H, VIEW_W, type StageDef } from '../maps/types';
import type { MovingPlatform } from '../entities/MovingPlatform';
import type { Barrel } from '../entities/Barrel';
import type { Hammer } from '../entities/Hammer';
import type { Player } from '../entities/Player';
import type { Game } from '../game';

/** Draws the arcade frame: stage geometry, entities, HUD. */
export class Renderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  private scale = 2;

  setScale(scale: number): void {
    this.scale = scale;
  }

  draw(game: Game): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.fillStyle = PALETTE.black;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.drawStage(game.stage);
    if (game.stage.oilDrum) this.drawOilDrum(game.stage.oilDrum);
    if (game.lightningFlash > 0) this.drawLightning();
    for (const e of game.elevators) this.drawElevator(e);
    for (const h of game.hammers) if (!h.taken) this.drawHammer(h);
    this.drawDK(game);
    drawSprite(ctx, SPRITES.pauline, game.pauline.x, game.pauline.y);
    // Pauline's blinking plea, as on the arcade marquee girder.
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      ctx.fillStyle = PALETTE.paulinePink;
      ctx.font = '8px monospace';
      ctx.fillText('HELP!', game.pauline.x - 8, game.pauline.y - 6);
    }
    for (const b of game.barrels) this.drawBarrel(b);
    for (const f of game.fireballs) drawSprite(ctx, SPRITES.fireball, f.x, f.y);
    if (game.phase === 'dying') {
      this.drawDeath(game);
    } else if (game.phase !== 'gameOver') {
      this.drawPlayer(game.player);
    }
    this.drawHud(game);
    ctx.restore();
  }

  private drawStage(stage: StageDef): void {
    const ctx = this.ctx;
    // Girders: red beams with rivet line (25m girder look).
    for (const p of stage.platforms) {
      ctx.fillStyle = PALETTE.girderRed;
      if (p.slope) {
        for (let i = 0; i < p.w; i++) {
          const y = p.y + (p.slope === 'up' ? i : p.w - i) * 0.5;
          ctx.fillRect(p.x + i, y, 1, 8);
        }
      } else {
        ctx.fillRect(p.x, p.y, p.w, 8);
        ctx.fillStyle = PALETTE.girderPink;
        ctx.fillRect(p.x, p.y + 2, p.w, 1);
      }
    }
    // Ladders: yellow rails + rungs.
    ctx.fillStyle = PALETTE.ladderYellow;
    for (const l of stage.ladders) {
      if (l.broken) continue;
      ctx.fillRect(l.x + 1, l.y, 2, l.h);
      ctx.fillRect(l.x + 13, l.y, 2, l.h);
      for (let rung = l.y + 4; rung < l.y + l.h; rung += 8) {
        ctx.fillRect(l.x + 1, rung, 14, 2);
      }
    }
  }

  /** Zig-zag bolt down the right-side cable (100m). */
  private drawLightning(): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.uiWhite;
    let y = 48;
    let x = 206;
    while (y < 240) {
      ctx.fillRect(x, y, 3, 12);
      y += 12;
      x += x > 202 ? -6 : 6;
    }
    // Flame at the bottom where the cable lands.
    ctx.fillStyle = PALETTE.girderRed;
    ctx.fillRect(4, 224, 16, 16);
  }

  private drawOilDrum(pos: { x: number; y: number }): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.oilGray;
    ctx.fillRect(pos.x, pos.y, 16, 12);
    ctx.fillStyle = PALETTE.black;
    ctx.fillRect(pos.x + 1, pos.y + 3, 14, 1);
    ctx.fillRect(pos.x + 1, pos.y + 8, 14, 1);
  }

  private drawElevator(e: MovingPlatform): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.girderRed;
    ctx.fillRect(e.x, e.y, e.w, 6);
    ctx.fillStyle = PALETTE.girderPink;
    ctx.fillRect(e.x, e.y + 2, e.w, 1);
  }

  private drawBarrel(b: Barrel): void {
    drawSprite(this.ctx, SPRITES.barrel, b.x, b.y);
  }

  private drawHammer(h: Hammer): void {
    drawSprite(this.ctx, SPRITES.hammer, h.x, h.y);
  }

  /** Death animation: Jumpman tumbles up then falls while spinning. */
  private drawDeath(game: Game): void {
    const elapsed = 1.2 - game.phaseTimer;
    const rise = elapsed < 0.4 ? elapsed * 60 : (0.8 - Math.abs(0.4 - elapsed)) * 30;
    const y = game.player.y - Math.max(0, rise);
    const frame = Math.floor(elapsed * 10) % 2 === 0;
    drawSprite(this.ctx, frame ? SPRITES.jumpmanClimb : SPRITES.jumpmanIdle, game.player.x - 2, y, 2, frame);
  }

  private drawPlayer(player: Player): void {
    const ctx = this.ctx;
    const hammer = player.hasHammer;
    let sprite = SPRITES.jumpmanIdle;
    if (player.state === 'climb') sprite = SPRITES.jumpmanClimb;
    else if (player.state === 'run' || player.state === 'hammer') {
      sprite = Math.floor(performance.now() / 120) % 2 === 0 ? SPRITES.jumpmanRun1 : SPRITES.jumpmanRun2;
    }
    drawSprite(ctx, sprite, player.x - 2, player.y - 2, 2, player.facing === -1);
    if (hammer) {
      const hx = player.facing === 1 ? player.x + 10 : player.x - 12;
      drawSprite(ctx, SPRITES.hammer, hx, player.y - 8, 2);
    }
  }

  private drawDK(game: Game): void {
    const dk = game.dk;
    const sprite = dk.throwAnim > 0 ? DK_SPRITES.throw : DK_SPRITES.idle;
    const frame = Math.floor(performance.now() / 400) % 8 === 0 ? DK_SPRITES.beat : sprite;
    drawSprite(this.ctx, frame, dk.x, dk.y, 2);
  }

  private drawHud(game: Game): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.uiWhite;
    ctx.font = '8px monospace';
    ctx.fillText(`1UP ${String(game.score.score).padStart(6, '0')}`, 8, 12);
    ctx.fillStyle = PALETTE.uiYellow;
    ctx.fillText(`HI ${String(game.score.highScore).padStart(6, '0')}`, 84, 12);
    ctx.fillStyle = PALETTE.uiWhite;
    // Arcade BONUS counts down in 100-point steps.
    ctx.fillText(`BONUS ${String(Math.ceil(game.stages.timeLeft) * 100).padStart(4, '0')}`, 148, 12);
    for (let i = 0; i < game.lives; i++) {
      drawSprite(ctx, SPRITES.jumpmanIdle, 8 + i * 18, VIEW_H - 14, 1);
    }
    ctx.fillStyle = PALETTE.uiWhite;
    ctx.fillText(`L=${game.stages.stage.id} R=${game.stages.round}`, 160, VIEW_H - 6);
    if (game.phase === 'ready') {
      ctx.fillText('READY!', VIEW_W / 2 - TILE * 2, VIEW_H / 2);
    } else if (game.phase === 'stageClear') {
      ctx.fillText('STAGE CLEAR!', VIEW_W / 2 - 28, VIEW_H / 2);
    } else if (game.phase === 'gameOver') {
      ctx.fillText('GAME OVER', VIEW_W / 2 - 26, VIEW_H / 2);
    }
  }
}
