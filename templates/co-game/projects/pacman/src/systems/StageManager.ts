/**
 * Pac-Man - Stage Manager
 *
 * Tracks the current game stage and provides stage-dependent configuration:
 * speed multipliers, frightened duration, and scatter/chase cycle definitions.
 * Uses difficulty tables from constants.ts / level-design.md.
 */
import {
  PACMAN_SPEED_PERCENTAGE,
  GHOST_SPEED_PERCENTAGE,
  GHOST_FRIGHT_SPEED_PERCENTAGE,
  GHOST_TUNNEL_SPEED_PERCENTAGE,
  FRIGHTENED_DURATIONS,
  SCATTER_CHASE_CYCLES_STAGE_1,
  SCATTER_CHASE_CYCLES_STAGE_2_4,
  SCATTER_CHASE_CYCLES_STAGE_5,
  FRUIT_PROGRESSION,
} from '../config/constants';
import type { ScatterChaseCycle, FruitType } from '../config/types';

export interface StageConfig {
  pacmanSpeed: number;
  ghostSpeed: number;
  frightSpeed: number;
  tunnelSpeed: number;
  frightDuration: number;
  scatterChaseCycles: ScatterChaseCycle[];
  fruitType: FruitType;
  fruitPoints: number;
}

export class StageManager {
  currentStage: number = 1;

  /** Get the stage configuration for the current stage number. */
  getStageConfig(): StageConfig {
    const stage = this.currentStage;

    // Get speed percentages with safe fallback for stages beyond defined tables
    const pacmanPct = PACMAN_SPEED_PERCENTAGE[stage] ?? PACMAN_SPEED_PERCENTAGE[20] ?? 1.0;
    const ghostPct = GHOST_SPEED_PERCENTAGE[stage] ?? GHOST_SPEED_PERCENTAGE[20] ?? 1.0;
    const frightPct = GHOST_FRIGHT_SPEED_PERCENTAGE[stage] ?? GHOST_FRIGHT_SPEED_PERCENTAGE[20] ?? 0.6;
    const tunnelPct = GHOST_TUNNEL_SPEED_PERCENTAGE[stage] ?? GHOST_TUNNEL_SPEED_PERCENTAGE[20] ?? 0.55;

    // Get frightened duration (0 for stage 21+)
    const frightDuration = stage >= 21 ? 0 : (FRIGHTENED_DURATIONS[stage] ?? 0);

    // Get scatter/chase cycles based on stage range
    let scatterChaseCycles: ScatterChaseCycle[];
    if (stage === 1) {
      scatterChaseCycles = SCATTER_CHASE_CYCLES_STAGE_1;
    } else if (stage >= 2 && stage <= 4) {
      scatterChaseCycles = SCATTER_CHASE_CYCLES_STAGE_2_4;
    } else {
      scatterChaseCycles = SCATTER_CHASE_CYCLES_STAGE_5;
    }

    // Arcade fruit progression bands: most fruits repeat across 2 levels.
    const FRUIT_BANDS = [0, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7] as const;
    const bandIndex = Math.min(stage, FRUIT_BANDS.length) - 1;
    const fruitIndex = FRUIT_BANDS[Math.max(bandIndex, 0)];
    const fruit = FRUIT_PROGRESSION[fruitIndex];

    return {
      pacmanSpeed: pacmanPct,
      ghostSpeed: ghostPct,
      frightSpeed: frightPct,
      tunnelSpeed: tunnelPct,
      frightDuration,
      scatterChaseCycles,
      fruitType: fruit.fruit,
      fruitPoints: fruit.points,
    };
  }

  /** Advance to the next stage. */
  nextStage(): void {
    this.currentStage++;
  }

  /** Reset to stage 1. */
  reset(): void {
    this.currentStage = 1;
  }
}
