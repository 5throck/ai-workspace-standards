/**
 * Score tracking with the portal high-score key convention
 * (`donkey-kong-highscore`), agreed in the 2026-09-05 portal design meeting.
 */
export const HIGHSCORE_KEY = 'donkey-kong-highscore';

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SCORE_BARREL_SKIP = 100;
export const SCORE_SMASH_BARREL = 300;
export const SCORE_SMASH_FIREBALL = 500;
export const STAGE_CLEAR_BONUS = 1000;

/**
 * Arcade-faithful skip bonus ladder: each barrel skipped without touching
 * the ground is worth more than the last (100 → 300 → 500 → 700 → 800, cap).
 */
export const SKIP_LADDER = [100, 300, 500, 700, 800] as const;

export function skipBonus(level: number): number {
  return SKIP_LADDER[Math.min(level, SKIP_LADDER.length - 1)];
}

export class ScoreSystem {
  score = 0;
  highScore = 0;
  private storage: Storage | null;

  constructor(storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage) {
    this.storage = storage;
    this.highScore = this.readHighScore();
  }

  add(points: number): void {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.writeHighScore();
    }
  }

  /** Stage-clear bonus: the remaining BONUS counter (100 points per second left). */
  addTimeBonus(secondsLeft: number): void {
    this.add(Math.max(0, Math.floor(secondsLeft)) * 100);
  }

  reset(): void {
    this.score = 0;
  }

  private readHighScore(): number {
    try {
      const raw = this.storage?.getItem(HIGHSCORE_KEY) ?? null;
      const value = raw === null ? 0 : Number(raw);
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  private writeHighScore(): void {
    try {
      this.storage?.setItem(HIGHSCORE_KEY, String(this.highScore));
    } catch {
      /* storage unavailable */
    }
  }
}
