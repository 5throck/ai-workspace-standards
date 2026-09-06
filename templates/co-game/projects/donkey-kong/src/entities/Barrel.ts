import { platformHeightAt, type Ladder, type Platform, type Vec } from '../maps/types';
import { EntityBase } from './EntityBase';

export type BarrelState = 'rolling' | 'falling';

/**
 * Rolling barrel. Rolls along its current girder; when it reaches the edge
 * it falls to the next one. While rolling it may randomly take a ladder down
 * (probability scaled by difficulty).
 */
export class Barrel extends EntityBase {
  state: BarrelState = 'rolling';
  dir: 1 | -1 = 1;
  vy = 0;
  /** Scored once when the player "skips" over this barrel. */
  skipped = false;
  private rollDistance = 0;

  constructor(pos: Vec, dir: 1 | -1) {
    super(pos, 12, 10);
    this.dir = dir;
  }

  update(
    dt: number,
    platforms: Platform[],
    ladders: Ladder[],
    rng: () => number = Math.random,
    ladderChance = 0.25,
  ): void {
    if (this.state === 'falling') {
      this.vy += 320 * dt;
      this.y += this.vy * dt;
      for (const p of platforms) {
        const ground = platformHeightAt(p, this.cx);
        if (ground !== null && this.y + this.h >= ground) {
          this.y = ground - this.h;
          this.state = 'rolling';
          this.vy = 0;
          break;
        }
      }
      return;
    }

    const dx = this.dir * 48 * dt;
    this.x += dx;
    this.rollDistance += Math.abs(dx);
    // Snap onto the girder surface (slopes included).
    for (const p of platforms) {
      const ground = platformHeightAt(p, this.cx);
      if (ground !== null && Math.abs(this.y + this.h - ground) < 6) {
        this.y = ground - this.h;
        break;
      }
    }

    // Edge of the girder → start falling.
    let onSurface = false;
    for (const p of platforms) {
      const ground = platformHeightAt(p, this.cx);
      if (ground !== null && Math.abs(this.y + this.h - ground) < 8) onSurface = true;
    }
    if (!onSurface) {
      this.state = 'falling';
      return;
    }

    // Randomly descend a ladder the barrel is passing.
    if (this.rollDistance > 4) {
      for (const l of ladders) {
        if (l.broken) continue;
        if (Math.abs(this.cx - (l.x + 8)) < 6 && this.y + this.h < l.y + l.h) {
          if (rng() < ladderChance) {
            this.state = 'falling';
            this.x = l.x + 2;
          }
          this.rollDistance = 0;
          break;
        }
      }
    }
  }
}
