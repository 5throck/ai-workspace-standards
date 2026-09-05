import type { StageDef } from './types';

/** Stage 4 — the rooftop finale; reach Pauline to complete the round. */
export const STAGE_100M: StageDef = {
  id: '100m',
  name: '100m ROOFTOP',
  kind: 'final',
  timeLimit: 60,
  platforms: [
    { x: 0, y: 240, w: 224 },
    { x: 64, y: 208, w: 96 },
    { x: 0, y: 176, w: 96 },
    { x: 128, y: 176, w: 96 },
    { x: 64, y: 144, w: 96 },
    { x: 0, y: 112, w: 96 },
    { x: 128, y: 112, w: 96 },
    { x: 0, y: 48, w: 224 },
  ],
  ladders: [
    { x: 100, y: 208, h: 32 },
    { x: 80, y: 176, h: 32 },
    { x: 160, y: 176, h: 32 },
    { x: 100, y: 144, h: 32 },
    { x: 80, y: 112, h: 32 },
    { x: 160, y: 112, h: 32 },
    { x: 40, y: 112, h: 64 },
    { x: 190, y: 112, h: 64 },
  ],
  playerStart: { x: 24, y: 240 },
  dk: { x: 100, y: 48 },
  pauline: { x: 150, y: 48 },
  hammers: [{ x: 110, y: 176 }],
};
