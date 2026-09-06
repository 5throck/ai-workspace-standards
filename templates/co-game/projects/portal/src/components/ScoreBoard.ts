import type { GameEntry } from '../games';
import { formatScore } from './GameCard';

/** Sorted high-score board across all registered games. */
export function createScoreBoard(
  games: GameEntry[],
  scores: Map<string, number | null>,
): HTMLElement {
  const root = document.createElement('section');
  root.className = 'score-board';

  const heading = document.createElement('h2');
  heading.className = 'score-board__title';
  heading.textContent = 'HIGH SCORES';

  const list = document.createElement('ol');
  list.className = 'score-board__list';

  const ranked = [...games].sort((a, b) => (scores.get(b.id) ?? -1) - (scores.get(a.id) ?? -1));
  for (const game of ranked) {
    const item = document.createElement('li');
    item.className = 'score-board__item';
    item.style.setProperty('--accent', game.accentColor);

    const name = document.createElement('span');
    name.textContent = game.title;

    const score = document.createElement('span');
    const value = scores.get(game.id);
    score.textContent = value !== null && value !== undefined ? formatScore(value) : '——';

    item.append(name, score);
    list.append(item);
  }

  root.append(heading, list);
  return root;
}
