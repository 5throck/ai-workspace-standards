import type { StageDef } from './types';

/** Stage 3 — long sloped girders crossed with moving lifts. */
export const STAGE_75M: StageDef = {
  id: '75m',
  name: '75m SLOPES',
  kind: 'lifts',
  timeLimit: 70,
  platforms: [
    { x: 0, y: 240, w: 224 },
    { x: 0, y: 200, w: 200, slope: 'up' },
    { x: 24, y: 160, w: 200, slope: 'down' },
    { x: 0, y: 120, w: 200, slope: 'up' },
    { x: 24, y: 80, w: 176, slope: 'down' },
    { x: 48, y: 48, w: 128 },
  ],
  ladders: [
    { x: 210, y: 200, h: 40 },
    { x: 12, y: 160, h: 40 },
    { x: 210, y: 120, h: 40 },
    { x: 12, y: 80, h: 40 },
  ],
  elevators: [
    { x: 60, w: 36, y: 88, h: 144, speed: 22, phase: 0.1 },
    { x: 140, w: 36, y: 88, h: 144, speed: 26, phase: 0.6 },
  ],
  playerStart: { x: 24, y: 240 },
  dk: { x: 64, y: 48 },
  pauline: { x: 152, y: 48 },
  hammers: [
    { x: 110, y: 160 },
    { x: 60, y: 80 },
  ],
};
