import { GAMES, type GameEntry } from './games';
import { ScoreAdapter, pushRecentGame, readRecentGames } from './ScoreAdapter';
import { createGameCard } from './components/GameCard';
import { createGameViewer } from './components/GameViewer';
import { createScoreBoard } from './components/ScoreBoard';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app root element missing');
const root: HTMLElement = app;

const scores = new ScoreAdapter();
const viewer = createGameViewer({ id: '', title: '', description: '', path: '', scoreKey: '', accentColor: '', year: 0 }, exitGame);
root.append(viewer.root);

function renderPortal(): void {
  root.innerHTML = '';
  document.body.dataset.view = 'portal';
  root.append(viewer.root);

  const header = document.createElement('header');
  header.className = 'portal-header';
  const title = document.createElement('h1');
  title.className = 'portal-header__title';
  title.textContent = 'CO-GAME ARCADE';
  const tagline = document.createElement('p');
  tagline.className = 'portal-header__tagline';
  tagline.textContent = 'INSERT COIN — PICK A CABINET';
  header.append(title, tagline);

  const grid = document.createElement('section');
  grid.className = 'game-grid';

  const recent = readRecentGames();
  const ordered = [...GAMES].sort(
    (a, b) => indexOrMax(recent, a.id) - indexOrMax(recent, b.id),
  );

  for (const game of ordered) {
    grid.append(createGameCard(game, scores.read(game.id), { onPlay: startGame }));
  }

  root.append(header, grid, createScoreBoard(GAMES, collectScores()));
}

function collectScores(): Map<string, number | null> {
  return new Map(GAMES.map((g) => [g.id, scores.read(g.id)]));
}

function indexOrMax(list: string[], id: string): number {
  const i = list.indexOf(id);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

function startGame(game: GameEntry): void {
  pushRecentGame(game.id);
  viewer.root.hidden = false;
  viewer.refresh(game);
  document.body.dataset.view = 'game';
}

function exitGame(): void {
  viewer.root.hidden = true;
  renderPortal();
}

renderPortal();
