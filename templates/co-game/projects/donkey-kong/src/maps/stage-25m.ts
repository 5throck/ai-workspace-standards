import type { StageDef } from './types';

/** Stage 1 — the classic girder climb with rolling barrels and two slopes. */
export const STAGE_25M: StageDef = {
  id: '25m',
  name: '25m GIRDER',
  kind: 'girder',
  timeLimit: 60,
  platforms: [
    { x: 0, y: 240, w: 224 },
    { x: 8, y: 240, w: 80, slope: 'down' },
    { x: 136, y: 240, w: 80, slope: 'up' },
    { x: 24, y: 208, w: 200 },
    { x: 0, y: 176, w: 200 },
    { x: 24, y: 144, w: 200 },
    { x: 0, y: 112, w: 200 },
    { x: 24, y: 80, w: 200 },
    { x: 40, y: 48, w: 144 },
  ],
  ladders: [
    { x: 24, y: 208, h: 32 },
    { x: 200, y: 208, h: 32, broken: true },
    { x: 176, y: 208, h: 32 },
    { x: 40, y: 176, h: 32 },
    { x: 150, y: 176, h: 32 },
    { x: 60, y: 144, h: 32 },
    { x: 190, y: 144, h: 32 },
    { x: 30, y: 112, h: 32 },
    { x: 170, y: 112, h: 32 },
    { x: 100, y: 80, h: 32 },
    { x: 200, y: 80, h: 32 },
  ],
  playerStart: { x: 40, y: 240 },
  dk: { x: 56, y: 48 },
  pauline: { x: 160, y: 48 },
  hammers: [
    { x: 120, y: 176 },
    { x: 60, y: 80 },
  ],
  oilDrum: { x: 8, y: 228 },
};
