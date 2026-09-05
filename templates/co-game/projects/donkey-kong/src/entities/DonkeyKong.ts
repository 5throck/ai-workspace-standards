import type { Vec } from '../maps/types';
import { EntityBase } from './EntityBase';

/** Donkey Kong at the top of the stage; periodically hurls a barrel. */
export class DonkeyKong extends EntityBase {
  throwTimer = 2;
  throwAnim = 0;

  constructor(pos: Vec) {
    super(pos, 32, 28);
  }

  /** Returns true when a barrel should spawn this frame. */
  update(dt: number, interval: number, rng: () => number = Math.random): boolean {
    this.throwTimer -= dt;
    if (this.throwAnim > 0) this.throwAnim -= dt;
    if (this.throwTimer <= 0) {
      this.throwTimer = interval * (0.75 + rng() * 0.5);
      this.throwAnim = 0.4;
      return true;
    }
    return false;
  }
}
