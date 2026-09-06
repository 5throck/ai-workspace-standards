import type { Vec } from '../maps/types';
import { EntityBase } from './EntityBase';

/** Pickup hammer. Disappears when taken; grants timed smashing power. */
export class Hammer extends EntityBase {
  taken = false;

  constructor(pos: Vec) {
    super(pos, 12, 12);
  }

  update(): void {}
}
