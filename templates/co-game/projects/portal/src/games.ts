/**
 * Game registry — the single place to add a new game to the portal.
 *
 * `path` points to the game bundle copied into `public/games/<id>/` by
 * `bun run build:games`. `scoreKey` follows the `<game-id>-highscore`
 * localStorage convention agreed in the 2026-09-05 portal design meeting.
 */
export interface GameEntry {
  id: string;
  title: string;
  description: string;
  path: string;
  scoreKey: string;
  /** CSS color used as the card accent (arcade cabinet color). */
  accentColor: string;
  year: number;
}

export const GAMES: GameEntry[] = [
  {
    id: 'pacman',
    title: 'PAC-MAN',
    description: 'Eat all the dots while dodging four ghosts. Power pellets turn the tables.',
    path: 'games/pacman/index.html',
    scoreKey: 'pacman-highscore',
    accentColor: '#ffe600',
    year: 1980,
  },
  {
    id: 'bubble-bobble',
    title: 'BUBBLE BOBBLE',
    description: 'Bub the dragon traps enemies in bubbles and pops them into fruit.',
    path: 'games/bubble-bobble/index.html',
    scoreKey: 'bubble-bobble-highscore',
    accentColor: '#3ec6ff',
    year: 1986,
  },
  {
    id: 'donkey-kong',
    title: 'DONKEY KONG',
    description: 'Climb the girders, dodge the barrels, and rescue Pauline from the ape.',
    path: 'games/donkey-kong/index.html',
    scoreKey: 'donkey-kong-highscore',
    accentColor: '#f33',
    year: 1981,
  },
];
