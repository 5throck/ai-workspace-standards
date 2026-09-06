import type { StageDef } from './types';

/** Stage 2 — elevator shafts with fireballs instead of barrels. */
export const STAGE_50M: StageDef = {
  id: '50m',
  name: '50m ELEVATORS',
  kind: 'elevators',
  timeLimit: 60,
  platforms: [
    { x: 0, y: 240, w: 224 },
    { x: 0, y: 208, w: 56 },
    { x: 168, y: 208, w: 56 },
    { x: 0, y: 176, w: 56 },
    { x: 168, y: 176, w: 56 },
    { x: 0, y: 144, w: 56 },
    { x: 168, y: 144, w: 56 },
    { x: 0, y: 112, w: 56 },
    { x: 168, y: 112, w: 56 },
    { x: 0, y: 80, w: 56 },
    { x: 168, y: 80, w: 56 },
    { x: 0, y: 48, w: 224 },
  ],
  ladders: [
    { x: 20, y: 208, h: 32 },
    { x: 200, y: 176, h: 32 },
    { x: 20, y: 144, h: 32 },
    { x: 200, y: 112, h: 32 },
    { x: 20, y: 80, h: 32 },
  ],
  elevators: [
    { x: 72, w: 40, y: 64, h: 144, speed: 24, phase: 0 },
    { x: 120, w: 40, y: 64, h: 144, speed: 20, phase: 0.5 },
    { x: 96, w: 40, y: 64, h: 144, speed: 28, phase: 0.25 },
  ],
  playerStart: { x: 24, y: 240 },
  dk: { x: 64, y: 48 },
  pauline: { x: 160, y: 48 },
  hammers: [{ x: 32, y: 144 }],
};
