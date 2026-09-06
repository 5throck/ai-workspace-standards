import type { ElevatorDef } from '../maps/types';

/** Vertically patrolling platform (elevator / lift). */
export class MovingPlatform {
  x: number;
  w: number;
  top: number;
  bottom: number;
  speed: number;
  y: number;
  private dir = 1;

  constructor(def: ElevatorDef) {
    this.x = def.x;
    this.w = def.w;
    this.top = def.y;
    this.bottom = def.y + def.h;
    this.speed = def.speed;
    const phase = def.phase ?? 0;
    const span = this.bottom - this.top;
    this.y = this.top + span * phase;
    this.dir = phase >= 0.5 ? -1 : 1;
  }

  update(dt: number): void {
    this.y += this.dir * this.speed * dt;
    if (this.y <= this.top) {
      this.y = this.top;
      this.dir = 1;
    } else if (this.y + 8 >= this.bottom) {
      this.y = this.bottom - 8;
      this.dir = -1;
    }
  }
}
