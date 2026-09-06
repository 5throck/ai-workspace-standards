import { Barrel } from './entities/Barrel';
import { DonkeyKong } from './entities/DonkeyKong';
import { Fireball } from './entities/Fireball';
import { Hammer } from './entities/Hammer';
import { MovingPlatform } from './entities/MovingPlatform';
import { Pauline } from './entities/Pauline';
import { Player, type InputState } from './entities/Player';
import type { StageDef } from './maps/types';
import { SCORE_SMASH_BARREL, SCORE_SMASH_FIREBALL, STAGE_CLEAR_BONUS, ScoreSystem, skipBonus } from './systems/ScoreSystem';
import { StageManager } from './systems/StageManager';

export type GamePhase = 'ready' | 'playing' | 'dying' | 'stageClear' | 'gameOver';

export interface GameCallbacks {
  onDeath?: () => void;
  onStageClear?: () => void;
  onGameOver?: () => void;
  onSfx?: (name: 'jump' | 'hammer' | 'smash' | 'death' | 'clear') => void;
}

/**
 * Pure game-state coordinator for one playthrough: owns the stage entities
 * and applies the rules (collisions, scoring, lives, progression).
 * Rendering and input are wired externally via `player.input`.
 */
export class Game {
  phase: GamePhase = 'ready';
  lives = 3;
  stage: StageDef;
  player: Player;
  dk: DonkeyKong;
  pauline: Pauline;
  barrels: Barrel[] = [];
  fireballs: Fireball[] = [];
  elevators: MovingPlatform[] = [];
  hammers: Hammer[] = [];
  phaseTimer = 1;
  /** Consecutive barrels skipped without landing — drives the bonus ladder. */
  private skipStreak = 0;
  /** 100m only: countdown to DK's lightning stomp (spawns a fire). */
  lightningTimer = 8;
  /** Visible flash duration after the bolt strikes. */
  lightningFlash = 0;

  readonly stages = new StageManager();
  readonly score = new ScoreSystem();
  private cb: GameCallbacks;

  constructor(cb: GameCallbacks = {}) {
    this.cb = cb;
    this.stage = this.stages.load(0);
    this.player = new Player(this.stage.playerStart);
    this.dk = new DonkeyKong(this.stage.dk);
    this.pauline = new Pauline(this.stage.pauline);
    this.spawnStageEntities();
  }

  private spawnStageEntities(): void {
    const s = this.stage;
    this.elevators = (s.elevators ?? []).map((e) => new MovingPlatform(e));
    this.hammers = s.hammers.map((h) => new Hammer(h));
    this.fireballs = [];
    for (let i = 0; i < this.stages.fireballCount(); i++) {
      const start = s.platforms[Math.min(2 + i, s.platforms.length - 1)];
      this.fireballs.push(new Fireball({ x: start.x + 60, y: start.y - 12 }));
    }
    this.barrels = [];
  }

  get input(): InputState {
    return this.player.input;
  }

  startPlay(): void {
    this.phase = 'playing';
  }

  private setPhase(phase: GamePhase, timer: number): void {
    this.phase = phase;
    this.phaseTimer = timer;
  }

  update(dt: number): void {
    switch (this.phase) {
      case 'ready':
      case 'dying':
      case 'stageClear':
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.afterPause();
        return;
      case 'gameOver':
        return;
      case 'playing':
        break;
    }

    this.stages.tick(dt);
    if (this.stages.timeUp) return this.kill();

    // 100m: DK stomps and lightning runs down the right cable, igniting a fire.
    if (this.stage.kind === 'final') {
      if (this.lightningFlash > 0) this.lightningFlash -= dt;
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 8 / this.stages.difficulty;
        this.lightningFlash = 0.4;
        this.fireballs.push(new Fireball({ x: 10, y: 228 }));
        this.cb.onSfx?.('smash');
      }
    }

    for (const e of this.elevators) e.update(dt);
    const elevatorYs = this.elevators.map((e) => e.y);
    const prevY = this.player.y;
    this.player.update(dt, this.stage.platforms, this.stage.ladders, elevatorYs);

    if (this.player.state === 'jump' && prevY - this.player.y > 2) this.cb.onSfx?.('jump');

    // Hammer pickups.
    for (const h of this.hammers) {
      if (!h.taken && this.player.overlaps(h)) {
        h.taken = true;
        this.player.pickHammer(8);
        this.cb.onSfx?.('hammer');
      }
    }

    // DK throws barrels (not on the final stage).
    const interval = this.stages.barrelInterval();
    if (Number.isFinite(interval) && this.dk.update(dt, interval)) {
      const dir = this.dk.cx > 112 ? -1 : 1;
      this.barrels.push(new Barrel({ x: this.dk.cx, y: this.dk.y + 20 }, dir));
    }

    const speedMul = this.stages.barrelSpeed();
    const drum = this.stage.oilDrum;
    for (const b of this.barrels) {
      const before = b.x;
      b.update(dt * speedMul, this.stage.platforms, this.stage.ladders, Math.random, this.stages.ladderChance());
      const moved = Math.abs(b.x - before);
      // "Skip" bonus: barrel passes fully below the player's feet once.
      if (!b.skipped && this.player.onGround && b.y > this.player.y + this.player.h && moved > 0) {
        b.skipped = true;
        this.score.add(skipBonus(this.skipStreak++));
      }
      // Arcade oil drum: barrels burn up and release a fireball.
      if (drum && b.x < drum.x + 20 && b.y > drum.y - 24) {
        b.dead = true;
        if (this.fireballs.length < 3) {
          this.fireballs.push(new Fireball({ x: drum.x + 4, y: drum.y - 12 }));
        }
      }
      if (this.player.overlaps(b)) {
        if (this.player.hasHammer) {
          b.dead = true;
          this.score.add(SCORE_SMASH_BARREL);
          this.cb.onSfx?.('smash');
        } else {
          return this.kill();
        }
      }
    }
    this.barrels = this.barrels.filter((b) => !b.dead && b.y < 260);

    for (const f of this.fireballs) {
      f.update(dt, this.stage.platforms, this.stage.ladders);
      if (this.player.overlaps(f)) {
        if (this.player.hasHammer) {
          f.dead = true;
          this.score.add(SCORE_SMASH_FIREBALL);
          this.cb.onSfx?.('smash');
        } else {
          return this.kill();
        }
      }
    }
    this.fireballs = this.fireballs.filter((f) => !f.dead);

    // Stage clear on reaching Pauline.
    if (this.player.overlaps(this.pauline)) {
      this.score.add(STAGE_CLEAR_BONUS);
      this.score.addTimeBonus(this.stages.timeLeft);
      this.cb.onSfx?.('clear');
      this.setPhase('stageClear', 1.5);
    }
  }

  private kill(): void {
    this.lives -= 1;
    this.cb.onSfx?.('death');
    if (this.lives <= 0) {
      this.setPhase('gameOver', 0);
      this.cb.onGameOver?.();
    } else {
      this.setPhase('dying', 1.2);
    }
  }

  private afterPause(): void {
    if (this.phase === 'stageClear') {
      this.stage = this.stages.next();
      this.resetStageEntities();
      this.cb.onStageClear?.();
    } else if (this.phase === 'dying') {
      this.player.x = this.stage.playerStart.x;
      this.player.y = this.stage.playerStart.y;
      this.player.vy = 0;
      this.player.hammerTimer = 0;
      this.barrels = [];
      this.skipStreak = 0;
      this.setPhase('playing', 0);
    } else {
      this.setPhase('playing', 0);
    }
  }

  /** Full reload of the current stage (fresh round / after game over restart). */
  restart(): void {
    this.lives = 3;
    this.score.reset();
    this.stages.round = 1;
    this.stage = this.stages.load(0);
    this.resetStageEntities();
    this.setPhase('ready', 1);
  }

  private resetStageEntities(): void {
    this.player.x = this.stage.playerStart.x;
    this.player.y = this.stage.playerStart.y;
    this.player.vy = 0;
    this.player.hammerTimer = 0;
    this.dk = new DonkeyKong(this.stage.dk);
    this.pauline = new Pauline(this.stage.pauline);
    this.spawnStageEntities();
    this.skipStreak = 0;
    this.lightningTimer = 8;
    this.lightningFlash = 0;
    this.setPhase('ready', 1);
  }
}
