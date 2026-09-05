import type { GameEntry } from '../games';

export interface GameCardCallbacks {
  onPlay: (game: GameEntry) => void;
}

/** Arcade-cabinet themed card: pixel logo block, description, high score, PLAY. */
export function createGameCard(
  game: GameEntry,
  highScore: number | null,
  callbacks: GameCardCallbacks,
): HTMLElement {
  const card = document.createElement('article');
  card.className = 'game-card';
  card.style.setProperty('--accent', game.accentColor);
  card.dataset.gameId = game.id;

  const logo = document.createElement('div');
  logo.className = 'game-card__logo';
  logo.textContent = game.title;

  const meta = document.createElement('div');
  meta.className = 'game-card__meta';

  const desc = document.createElement('p');
  desc.className = 'game-card__desc';
  desc.textContent = game.description;

  const score = document.createElement('p');
  score.className = 'game-card__score';
  score.textContent = highScore !== null ? `HI-SCORE ${formatScore(highScore)}` : 'HI-SCORE ——';
  score.dataset.role = 'highscore';

  meta.append(desc, score);

  const footer = document.createElement('div');
  footer.className = 'game-card__footer';

  const year = document.createElement('span');
  year.className = 'game-card__year';
  year.textContent = `© ${game.year}`;

  const play = document.createElement('button');
  play.className = 'game-card__play';
  play.textContent = '▶ PLAY';
  play.addEventListener('click', () => callbacks.onPlay(game));

  footer.append(year, play);
  card.append(logo, meta, footer);
  return card;
}

export function formatScore(score: number): string {
  return score.toLocaleString('en-US');
}
