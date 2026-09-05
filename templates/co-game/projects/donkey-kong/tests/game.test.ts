import { describe, expect, it } from 'vitest';
import { Barrel } from '../src/entities/Barrel';
import { Game } from '../src/game';
import { HIGHSCORE_KEY, ScoreSystem, skipBonus } from '../src/systems/ScoreSystem';
import { SPRITES } from '../src/assets/sprites';
import { PALETTE } from '../src/assets/palette';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('ScoreSystem', () => {
  it('uses the portal high-score key convention', () => {
    expect(HIGHSCORE_KEY).toBe('donkey-kong-highscore');
  });

  it('persists a new high score to storage', () => {
    const storage = new MemoryStorage();
    const score = new ScoreSystem(storage as unknown as Storage);
    score.add(500);
    expect(storage.getItem(HIGHSCORE_KEY)).toBe('500');
  });

  it('falls back safely when storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('no');
      },
      setItem: () => {
        throw new Error('no');
      },
    };
    const score = new ScoreSystem(throwing as unknown as Storage);
    expect(() => score.add(100)).not.toThrow();
    expect(score.highScore).toBe(100);
  });

  it('adds the remaining bonus counter (100 per second) on clear', () => {
    const score = new ScoreSystem(null);
    score.addTimeBonus(12.4);
    expect(score.score).toBe(1200);
  });

  it('escalates the skip bonus ladder and caps it (arcade values)', () => {
    expect([skipBonus(0), skipBonus(1), skipBonus(2), skipBonus(3), skipBonus(4), skipBonus(9)]).toEqual([
      100, 300, 500, 700, 800, 800,
    ]);
  });
});

describe('Game lifecycle', () => {
  it('starts on 25m in the ready phase with 3 lives', () => {
    const game = new Game();
    expect(game.phase).toBe('ready');
    expect(game.lives).toBe(3);
    expect(game.stage.id).toBe('25m');
  });

  it('plays through: ready → playing, and dies on lethal hits', () => {
    const game = new Game();
    game.update(2); // ready countdown elapses
    expect(game.phase).toBe('playing');
    game.lives = 1;
    (game as unknown as { kill: () => void }).kill();
    expect(game.phase).toBe('gameOver');
  });

  it('scores a hammer smash on a barrel', () => {
    const game = new Game();
    game.phase = 'playing';
    game.update(0.5);
    game.player.pickHammer(5);
    game.barrels.length = 0;
    game.barrels.push(new Barrel({ x: game.player.x, y: game.player.y }, 1));
    game.update(1 / 60);
    expect(game.score.score).toBeGreaterThanOrEqual(300);
  });

  it('spawns a lightning fire on 100m when the bolt timer elapses', () => {
    const game = new Game();
    game.phase = 'playing';
    game.stage = game.stages.load(3); // 100m
    const firesBefore = game.fireballs.length;
    game.lightningTimer = 0.05;
    game.update(0.1);
    expect(game.lightningFlash).toBeGreaterThan(0);
    expect(game.fireballs.length).toBe(firesBefore + 1);
  });

  it('clears the stage when the player overlaps Pauline', () => {
    const game = new Game();
    game.phase = 'playing';
    game.player.x = game.pauline.x;
    game.player.y = game.pauline.y;
    game.update(1 / 60);
    expect(game.phase).toBe('stageClear');
    game.update(2);
    expect(game.stages.stage.id).toBe('50m');
  });
});

describe('sprite assets', () => {
  it('defines rectangular grids with palette-backed colors', () => {
    const all = { ...SPRITES };
    for (const [name, sprite] of Object.entries(all)) {
      const width = sprite.rows[0].length;
      for (const row of sprite.rows) {
        expect(row.length, `${name} row width`).toBe(width);
      }
      for (const key of Object.values(sprite.colors)) {
        expect(PALETTE[key], `${name} color ${key}`).toBeDefined();
      }
    }
  });
});
