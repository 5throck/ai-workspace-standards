/**
 * Pac-Man - Score System
 *
 * Manages score accumulation, high score tracking, ghost eating multipliers,
 * and extra life detection.
 */
import { GHOST_POINTS, EXTRA_LIFE_SCORE } from '../config/constants';
import type { ScoreEvent } from '../config/types';

/** Abstract storage interface for persisting high scores. */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Default storage adapter using browser localStorage. */
const defaultStorage: StorageAdapter = {
  getItem: (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key, value) => {
    try { localStorage.setItem(key, value); } catch { /* no-op */ }
  },
};

export class ScoreSystem {
  score: number = 0;
  highScore: number = 0;
  private ghostsEatenInFright: number = 0;
  private extraLifeAwarded: boolean = false;
  private storage: StorageAdapter;

  /** Optional callback fired when score changes. */
  onScoreChange?: (points: number, type: ScoreEvent['type']) => void;

  constructor(storage?: StorageAdapter) {
    this.storage = storage ?? defaultStorage;
    // Restore high score from storage
    const saved = this.storage.getItem('pacman-highscore');
    if (saved) {
      this.highScore = parseInt(saved, 10) || 0;
    }
  }

  /** Add points to the current score and update high score. */
  addScore(points: number, type: ScoreEvent['type']): void {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }
    this.onScoreChange?.(points, type);
  }

  /** Persist high score to storage. */
  private saveHighScore(): void {
    this.storage.setItem('pacman-highscore', String(this.highScore));
  }

  /** Reset the ghost eating counter (called when a new fright period starts). */
  resetGhostEatingCounter(): void {
    this.ghostsEatenInFright = 0;
  }

  /**
   * Get the points for the next ghost eaten during a fright period.
   * Returns 200, 400, 800, or 1600 based on how many ghosts have been eaten.
   * If 4 ghosts already eaten in this fright period, returns 0.
   */
  getNextGhostPoints(): number {
    if (this.ghostsEatenInFright >= 4) {
      return 0;
    }
    return GHOST_POINTS[this.ghostsEatenInFright];
  }

  /**
   * Called when a ghost is eaten during fright.
   * Returns the points awarded and increments the counter.
   */
  eatGhost(): number {
    const points = this.getNextGhostPoints();
    if (points > 0) {
      this.ghostsEatenInFright++;
      this.addScore(points, 'ghost');
    }
    return points;
  }

  /**
   * Check if score has crossed the extra life threshold (10000).
   * Returns true once per game (per reset cycle).
   */
  checkExtraLife(): boolean {
    if (!this.extraLifeAwarded && this.score >= EXTRA_LIFE_SCORE) {
      this.extraLifeAwarded = true;
      return true;
    }
    return false;
  }

  /** Reset score system (new game). Preserves high score. */
  reset(): void {
    this.score = 0;
    this.ghostsEatenInFright = 0;
    this.extraLifeAwarded = false;
  }
}
