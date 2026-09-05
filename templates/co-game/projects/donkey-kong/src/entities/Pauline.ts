import type { Vec } from '../maps/types';
import { EntityBase } from './EntityBase';

/** Pauline — reach her to clear the stage. */
export class Pauline extends EntityBase {
  constructor(pos: Vec) {
    super(pos, 12, 16);
  }
  update(): void {}
}
