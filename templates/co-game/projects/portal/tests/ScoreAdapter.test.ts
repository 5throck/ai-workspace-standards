import { describe, expect, it } from 'vitest';
import { ScoreAdapter, readRecentGames, pushRecentGame, type ScoreStore } from '../src/ScoreAdapter';

class MemoryStore implements ScoreStore {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('ScoreAdapter', () => {
  it('reads a stored high score by game id', () => {
    const store = new MemoryStore();
    store.setItem('pacman-highscore', '12345');
    expect(new ScoreAdapter(store).read('pacman')).toBe(12345);
  });

  it('returns null when no score exists', () => {
    expect(new ScoreAdapter(new MemoryStore()).read('pacman')).toBeNull();
  });

  it('falls back to null on malformed values', () => {
    const store = new MemoryStore();
    store.setItem('pacman-highscore', 'not-a-number');
    expect(new ScoreAdapter(store).read('pacman')).toBeNull();
  });

  it('falls back to null when storage throws', () => {
    const throwing: ScoreStore = {
      getItem: () => {
        throw new Error('unavailable');
      },
      setItem: () => {
        throw new Error('unavailable');
      },
    };
    expect(new ScoreAdapter(throwing).read('pacman')).toBeNull();
    expect(() => new ScoreAdapter(throwing).write('pacman', 10)).not.toThrow();
  });

  it('round-trips a written score', () => {
    const adapter = new ScoreAdapter(new MemoryStore());
    adapter.write('bubble-bobble', 999);
    expect(adapter.read('bubble-bobble')).toBe(999);
  });
});

describe('recent games', () => {
  it('returns empty list with no storage entry', () => {
    expect(readRecentGames(new MemoryStore())).toEqual([]);
  });

  it('moves the most recent game to the front without duplicates', () => {
    const store = new MemoryStore();
    pushRecentGame('pacman', store);
    pushRecentGame('bubble-bobble', store);
    pushRecentGame('pacman', store);
    expect(readRecentGames(store)).toEqual(['pacman', 'bubble-bobble']);
  });

  it('ignores corrupted recent data', () => {
    const store = new MemoryStore();
    store.setItem('portal-recent', '{broken json');
    expect(readRecentGames(store)).toEqual([]);
  });
});
