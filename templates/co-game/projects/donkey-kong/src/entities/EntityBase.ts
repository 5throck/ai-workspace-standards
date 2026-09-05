import type { Vec } from '../maps/types';

/** Base for all game entities: bounds, overlap tests. Logic lives in subclasses. */
export abstract class EntityBase {
  x: number;
  y: number;
  w: number;
  h: number;
  dead = false;

  constructor(pos: Vec, w: number, h: number) {
    this.x = pos.x;
    this.y = pos.y;
    this.w = w;
    this.h = h;
  }

  get cx(): number {
    return this.x + this.w / 2;
  }

  overlaps(other: EntityBase): boolean {
    return (
      this.x < other.x + other.w &&
      this.x + this.w > other.x &&
      this.y < other.y + other.h &&
      this.y + this.h > other.y
    );
  }
}
