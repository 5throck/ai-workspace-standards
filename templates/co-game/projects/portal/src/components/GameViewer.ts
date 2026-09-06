import type { GameEntry } from '../games';

/** Fullscreen game viewer with an iframe launcher and a portal-return control. */
export function createGameViewer(
  game: GameEntry,
  onExit: () => void,
): { root: HTMLElement; refresh: (game: GameEntry) => void } {
  const root = document.createElement('section');
  root.className = 'game-viewer';
  root.hidden = true;

  const bar = document.createElement('div');
  bar.className = 'game-viewer__bar';

  const title = document.createElement('span');
  title.className = 'game-viewer__title';
  title.textContent = game.title;

  const back = document.createElement('button');
  back.className = 'game-viewer__back';
  back.textContent = '◄ BACK TO PORTAL';
  back.addEventListener('click', onExit);

  bar.append(title, back);

  const frame = document.createElement('iframe');
  frame.className = 'game-viewer__frame';
  frame.title = game.title;
  // Keyboard input requires the iframe document itself to hold focus;
  // focusing it on load removes the "dead keys until second click" issue.
  frame.addEventListener('load', () => {
    frame.contentWindow?.focus();
  });

  root.append(bar, frame);

  const refresh = (target: GameEntry): void => {
    // Reassigning src reloads the game so a session starts fresh on re-entry.
    title.textContent = target.title;
    frame.title = target.title;
    frame.src = `${target.path}?t=${Date.now()}`;
  };

  return { root, refresh };
}
