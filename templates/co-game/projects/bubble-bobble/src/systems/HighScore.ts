/**
 * High-score persistence using the portal key convention
 * (`<game-id>-highscore`), agreed in the 2026-09-05 portal design meeting.
 */
export const HIGHSCORE_KEY = 'bubble-bobble-highscore';

export function loadHighScore(): number {
  try {
    const raw = localStorage.getItem(HIGHSCORE_KEY);
    const value = raw === null ? 0 : Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): void {
  try {
    if (score > loadHighScore()) {
      localStorage.setItem(HIGHSCORE_KEY, String(score));
    }
  } catch {
    /* storage unavailable — scores stay session-only */
  }
}
