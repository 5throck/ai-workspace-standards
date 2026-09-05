import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/games';

const projectRoot = join(__dirname, '..');

describe('game registry', () => {
  it('has unique ids and score keys following the <id>-highscore convention', () => {
    const ids = new Set(GAMES.map((g) => g.id));
    expect(ids.size).toBe(GAMES.length);
    for (const game of GAMES) {
      expect(game.scoreKey).toBe(`${game.id}-highscore`);
      expect(game.path).toBe(`games/${game.id}/index.html`);
    }
  });

  it('every registered game has a built bundle in public/games/<id>', () => {
    for (const game of GAMES) {
      const bundle = join(projectRoot, 'public', 'games', game.id, 'index.html');
      expect({ id: game.id, exists: existsSync(bundle) }).toEqual({
        id: game.id,
        exists: true,
      });
    }
  });
});
