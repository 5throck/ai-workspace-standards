import { platformHeightAt, type Ladder, type Platform, type Vec } from '../maps/types';
import { EntityBase } from './EntityBase';

/**
 * Blue fireball (50m/75m). Patrols a girder, occasionally descends ladders,
 * and can climb back up.
 */
export class Fireball extends EntityBase {
  dir: 1 | -1 = 1;
  private wanderTimer = 0;
  private climbTimer = 0;

  constructor(pos: Vec) {
    super(pos, 12, 12);
  }

  update(dt: number, platforms: Platform[], ladders: Ladder[], rng: () => number = Math.random): void {
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 1 + rng() * 2;
      if (rng() < 0.3) this.dir = this.dir === 1 ? -1 : 1;
      if (rng() < 0.2) this.climbTimer = 1.5;
    }

    if (this.climbTimer > 0) {
      this.climbTimer -= dt;
      this.y -= 30 * dt;
    } else {
      this.x += this.dir * 36 * dt;
    }

    // Snap to nearest surface; reverse at edges; climb down ladders.
    let snapped = false;
    for (const p of platforms) {
      const ground = platformHeightAt(p, this.cx);
      if (ground !== null && Math.abs(this.y + this.h - ground) < 8) {
        this.y = ground - this.h;
        snapped = true;
      }
    }
    if (!snapped) {
      if (this.climbTimer > 0) {
        // Fell off while climbing: drop until a surface catches us.
        this.y += 30 * dt;
      } else {
        this.dir = this.dir === 1 ? -1 : 1;
        this.x += this.dir * 36 * dt;
      }
      for (const l of ladders) {
        if (Math.abs(this.cx - (l.x + 8)) < 6 && rng() < 0.02) this.climbTimer = 0;
      }
    }
  }
}
