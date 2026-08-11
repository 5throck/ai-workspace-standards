/**
 * ScoreSystem Integration Tests
 *
 * Tests ScoreSystem behavior in isolation (with mocked storage)
 * and validates the StorageAdapter abstraction, score event emission,
 * ghost eating multiplier, extra life detection, and reset behavior.
 */
import { describe, it, expect, vi } from 'vitest';
import { ScoreSystem, type StorageAdapter } from '../src/systems/ScoreSystem';

/** In-memory storage adapter for testing. */
function createMockStorage(initial: Record<string, string> = {}): StorageAdapter {
  const store = { ...initial };
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  };
}

describe('ScoreSystem', () => {
  describe('constructor', () => {
    it('loads high score from storage on initialization', () => {
      const storage = createMockStorage({ 'pacman-highscore': '15000' });
      const system = new ScoreSystem(storage);
      expect(system.highScore).toBe(15000);
    });

    it('defaults high score to 0 when no saved value exists', () => {
      const system = new ScoreSystem(createMockStorage());
      expect(system.highScore).toBe(0);
    });

    it('handles invalid stored high score gracefully', () => {
      const storage = createMockStorage({ 'pacman-highscore': 'not-a-number' });
      const system = new ScoreSystem(storage);
      expect(system.highScore).toBe(0);
    });
  });

  describe('addScore', () => {
    it('increments score by the given points', () => {
      const system = new ScoreSystem(createMockStorage());
      system.addScore(10, 'dot');
      expect(system.score).toBe(10);
      system.addScore(50, 'power_pellet');
      expect(system.score).toBe(60);
    });

    it('updates high score when score exceeds it', () => {
      const storage = createMockStorage({ 'pacman-highscore': '100' });
      const system = new ScoreSystem(storage);
      system.addScore(200, 'fruit');
      expect(system.highScore).toBe(200);
      expect(storage.setItem).toHaveBeenCalledWith('pacman-highscore', '200');
    });

    it('does not update high score when score is lower', () => {
      const storage = createMockStorage({ 'pacman-highscore': '500' });
      const system = new ScoreSystem(storage);
      system.addScore(50, 'dot');
      expect(system.highScore).toBe(500);
      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('fires onScoreChange callback with points and type', () => {
      const system = new ScoreSystem(createMockStorage());
      const listener = vi.fn();
      system.onScoreChange = listener;

      system.addScore(10, 'dot');
      expect(listener).toHaveBeenCalledWith(10, 'dot');
      expect(listener).toHaveBeenCalledTimes(1);

      system.addScore(200, 'ghost');
      expect(listener).toHaveBeenCalledWith(200, 'ghost');
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('ghost eating multiplier', () => {
    it('returns 200 for the first ghost eaten', () => {
      const system = new ScoreSystem(createMockStorage());
      expect(system.eatGhost()).toBe(200);
      expect(system.score).toBe(200);
    });

    it('cascades through 200, 400, 800, 1600', () => {
      const system = new ScoreSystem(createMockStorage());
      expect(system.eatGhost()).toBe(200);
      expect(system.eatGhost()).toBe(400);
      expect(system.eatGhost()).toBe(800);
      expect(system.eatGhost()).toBe(1600);
    });

    it('returns 0 after all 4 ghosts eaten in one fright period', () => {
      const system = new ScoreSystem(createMockStorage());
      system.eatGhost(); // 200
      system.eatGhost(); // 400
      system.eatGhost(); // 800
      system.eatGhost(); // 1600
      expect(system.eatGhost()).toBe(0);
      expect(system.score).toBe(3000); // sum of 200+400+800+1600
    });

    it('resets the multiplier when resetGhostEatingCounter is called', () => {
      const system = new ScoreSystem(createMockStorage());
      system.eatGhost(); // 200
      system.eatGhost(); // 400
      system.resetGhostEatingCounter();
      expect(system.eatGhost()).toBe(200); // back to first ghost
    });
  });

  describe('checkExtraLife', () => {
    it('returns true when score reaches 10000', () => {
      const system = new ScoreSystem(createMockStorage());
      system.addScore(10000, 'dot');
      expect(system.checkExtraLife()).toBe(true);
    });

    it('returns true only once per game', () => {
      const system = new ScoreSystem(createMockStorage());
      system.addScore(10000, 'dot');
      expect(system.checkExtraLife()).toBe(true);
      expect(system.checkExtraLife()).toBe(false);
      system.addScore(5000, 'ghost');
      expect(system.checkExtraLife()).toBe(false);
    });

    it('does not award extra life below 10000', () => {
      const system = new ScoreSystem(createMockStorage());
      system.addScore(9999, 'dot');
      expect(system.checkExtraLife()).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets score to 0 but preserves high score', () => {
      const storage = createMockStorage({ 'pacman-highscore': '5000' });
      const system = new ScoreSystem(storage);
      system.addScore(3000, 'dot');
      system.eatGhost();
      expect(system.score).toBe(3200);

      system.reset();
      expect(system.score).toBe(0);
      expect(system.highScore).toBe(5000);
    });

    it('resets ghost eating counter and extra life flag', () => {
      const system = new ScoreSystem(createMockStorage());
      system.eatGhost(); // 200
      system.addScore(10000, 'dot');
      system.checkExtraLife(); // true

      system.reset();
      expect(system.eatGhost()).toBe(200); // counter reset
      expect(system.checkExtraLife()).toBe(false); // flag reset (score is 0)
    });
  });
});
