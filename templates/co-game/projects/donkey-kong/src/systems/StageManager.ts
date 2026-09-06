import { STAGES, type StageDef } from '../maps';

/**
 * Loads stages in arcade order (25m → 50m → 75m → 100m), tracks the round,
 * and scales difficulty (barrel rate/speed, fireball count) per round.
 */
export class StageManager {
  index = 0;
  round = 1;
  timeLeft = 0;

  get stage(): StageDef {
    return STAGES[this.index % STAGES.length];
  }

  /** Difficulty multiplier applied to speeds and spawn rates. */
  get difficulty(): number {
    return 1 + (this.round - 1) * 0.25;
  }

  load(index: number): StageDef {
    this.index = ((index % STAGES.length) + STAGES.length) % STAGES.length;
    this.timeLeft = this.stage.timeLimit;
    return this.stage;
  }

  /** Advances to the next stage; wraps increment the round. */
  next(): StageDef {
    const nextIndex = this.index + 1;
    if (nextIndex % STAGES.length === 0) this.round += 1;
    return this.load(nextIndex);
  }

  tick(dt: number): void {
    this.timeLeft = Math.max(0, this.timeLeft - dt);
  }

  get timeUp(): boolean {
    return this.timeLeft <= 0;
  }

  /** Barrel throw interval in seconds for the current stage/round. */
  barrelInterval(): number {
    const base = this.stage.kind === 'final' ? Number.POSITIVE_INFINITY : 3 / this.difficulty;
    return base;
  }

  fireballCount(): number {
    if (this.stage.kind === 'elevators') return 1 + Math.floor(this.round / 2);
    if (this.stage.kind === 'lifts') return 1;
    return this.stage.kind === 'final' ? 1 : 0;
  }

  /** Barrel speed multiplier for rolling barrels. */
  barrelSpeed(): number {
    return this.difficulty;
  }

  /** Probability a barrel takes a ladder down. */
  ladderChance(): number {
    return Math.min(0.5, 0.2 + (this.round - 1) * 0.1);
  }
}
