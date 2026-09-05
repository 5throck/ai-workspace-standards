export interface Vec {
  x: number;
  y: number;
}

/** A horizontal girder. Sloped girders interpolate the standing height. */
export interface Platform {
  x: number;
  y: number;
  w: number;
  slope?: 'up' | 'down';
}

export interface Ladder {
  x: number;
  y: number;
  h: number;
  broken?: boolean;
}

/** Vertical moving platform (50m elevators, 75m lifts). */
export interface ElevatorDef {
  x: number;
  w: number;
  y: number;
  h: number;
  speed: number;
  phase?: number;
}

export type StageKind = 'girder' | 'elevators' | 'lifts' | 'final';

export interface StageDef {
  id: string;
  name: string;
  kind: StageKind;
  timeLimit: number;
  platforms: Platform[];
  ladders: Ladder[];
  elevators?: ElevatorDef[];
  playerStart: Vec;
  dk: Vec;
  pauline: Vec;
  hammers: Vec[];
  /** Oil drum: barrels that reach it burn into fireballs (classic 25m). */
  oilDrum?: Vec;
}

export const TILE = 16;
export const VIEW_W = 224;
export const VIEW_H = 256;

/** Standing height on a platform at position x (accounts for slopes). */
export function platformHeightAt(p: Platform, x: number): number | null {
  if (x < p.x - 1 || x > p.x + p.w + 1) return null;
  if (p.slope === 'up') return p.y + (x - p.x) * 0.5;
  if (p.slope === 'down') return p.y + (p.w - (x - p.x)) * 0.5;
  return p.y;
}

export function aabb(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
