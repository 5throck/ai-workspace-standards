/**
 * Reads high scores from localStorage using the per-game key convention.
 * All failures (unavailable storage, malformed values) fall back to null.
 */
export interface ScoreStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const MAX_RECENT = 10;

export class ScoreAdapter {
  private store: ScoreStore;

  constructor(store: ScoreStore = localStorage) {
    this.store = store;
  }

  read(gameId: string): number | null {
    try {
      const raw = this.store.getItem(`${gameId}-highscore`);
      if (raw === null) return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  write(gameId: string, score: number): void {
    try {
      this.store.setItem(`${gameId}-highscore`, String(score));
    } catch {
      /* storage unavailable — scores stay session-only */
    }
  }
}

/** localStorage key the portal itself uses for recent-play ordering. */
export const RECENT_KEY = 'portal-recent';

export function readRecentGames(store: ScoreStore = localStorage): string[] {
  try {
    const raw = store.getItem(RECENT_KEY);
    const parsed = raw === null ? [] : (JSON.parse(raw) as unknown);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function pushRecentGame(gameId: string, store: ScoreStore = localStorage): void {
  try {
    const recent = readRecentGames(store).filter((id) => id !== gameId);
    recent.unshift(gameId);
    store.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    /* storage unavailable */
  }
}
