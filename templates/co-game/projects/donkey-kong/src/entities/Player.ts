import { platformHeightAt, type Ladder, type Platform, type Vec } from '../maps/types';
import { EntityBase } from './EntityBase';

export const PLAYER_SPEED = 56;
export const CLIMB_SPEED = 40;
export const GRAVITY = 320;
export const JUMP_VY = -160;

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
}

function defaultInput(): InputState {
  return { left: false, right: false, up: false, down: false, jump: false };
}

export type PlayerState = 'idle' | 'run' | 'climb' | 'jump' | 'hammer';

export class Player extends EntityBase {
  state: PlayerState = 'idle';
  facing: 1 | -1 = 1;
  onGround = false;
  vy = 0;
  climbingLadder: Ladder | null = null;
  hammerTimer = 0;
  input: InputState = defaultInput();

  private jumpLatch = false;

  constructor(pos: Vec) {
    super(pos, 12, 14);
  }

  get hasHammer(): boolean {
    return this.hammerTimer > 0;
  }

  pickHammer(duration = 8): void {
    this.hammerTimer = duration;
  }

  update(dt: number, platforms: Platform[], ladders: Ladder[], elevatorsY: number[] = []): void {
    if (this.hasHammer) {
      this.hammerTimer = Math.max(0, this.hammerTimer - dt);
      this.state = 'hammer';
    }

    const ladder = this.findLadder(ladders);
    if (ladder && (this.input.up || this.input.down)) {
      this.state = 'climb';
      this.climbingLadder = ladder;
      this.x = ladder.x + 2 - this.w / 2 + 4;
      const dir = this.input.up ? -1 : 1;
      this.y += dir * CLIMB_SPEED * dt;
      // Leave the ladder when clear of its span.
      if (this.y + this.h < ladder.y || this.y > ladder.y + ladder.h) {
        this.climbingLadder = null;
        this.state = 'idle';
      }
    } else {
      this.climbingLadder = null;
      this.moveHorizontal(dt);
      this.moveVertical(dt, platforms, elevatorsY);
    }

    if (!this.hasHammer && this.state !== 'climb') {
      this.state =
        !this.onGround
          ? 'jump'
          : this.input.left || this.input.right
            ? 'run'
            : 'idle';
    }
  }

  private findLadder(ladders: Ladder[]): Ladder | null {
    for (const l of ladders) {
      if (l.broken) continue;
      const withinX = Math.abs(this.cx - (l.x + 8)) < 8;
      const withinY = this.y + this.h > l.y && this.y < l.y + l.h;
      if (withinX && withinY) return l;
    }
    return null;
  }

  private moveHorizontal(dt: number): void {
    if (this.input.left) {
      this.x -= PLAYER_SPEED * dt;
      this.facing = -1;
    }
    if (this.input.right) {
      this.x += PLAYER_SPEED * dt;
      this.facing = 1;
    }
  }

  private moveVertical(dt: number, platforms: Platform[], elevatorsY: number[]): void {
    // Jump (blocked while carrying the hammer, per arcade rules).
    if (this.input.jump && this.onGround && !this.hasHammer && !this.jumpLatch) {
      this.vy = JUMP_VY;
      this.onGround = false;
      this.state = 'jump';
    }
    this.jumpLatch = this.input.jump;

    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;

    this.onGround = false;
    const foot = this.y + this.h;
    for (const p of platforms) {
      const ground = platformHeightAt(p, this.cx);
      if (ground === null) continue;
      if (this.vy >= 0 && foot >= ground - 2 && foot <= ground + this.vy * dt + 4) {
        this.y = ground - this.h;
        this.vy = 0;
        this.onGround = true;
        break;
      }
    }
    for (const ey of elevatorsY) {
      if (this.vy >= 0 && foot >= ey - 2 && foot <= ey + this.vy * dt + 4) {
        this.y = ey - this.h;
        this.vy = 0;
        this.onGround = true;
        break;
      }
    }
  }
}
