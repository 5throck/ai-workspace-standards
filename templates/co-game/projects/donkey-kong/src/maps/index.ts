import { STAGE_25M } from './stage-25m';
import { STAGE_50M } from './stage-50m';
import { STAGE_75M } from './stage-75m';
import { STAGE_100M } from './stage-100m';
import type { StageDef } from './types';

/** Arcade round order: 25m → 50m → 75m → 100m → back to 25m (harder). */
export const STAGES: StageDef[] = [STAGE_25M, STAGE_50M, STAGE_75M, STAGE_100M];

export * from './types';
