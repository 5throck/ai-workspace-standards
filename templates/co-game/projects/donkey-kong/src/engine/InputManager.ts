export type GameAction = 'left' | 'right' | 'up' | 'down' | 'jump';

const KEY_MAP: Record<string, GameAction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyZ: 'jump',
  Space: 'jump',
};

/** Keyboard input mapped to game actions. */
export class InputManager {
  readonly state: Record<GameAction, boolean> = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const action = KEY_MAP[e.code];
    if (action) {
      this.state[action] = true;
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const action = KEY_MAP[e.code];
    if (action) {
      this.state[action] = false;
      e.preventDefault();
    }
  };

  attach(target: HTMLElement | Window = window): void {
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
  }

  detach(target: HTMLElement | Window = window): void {
    target.removeEventListener('keydown', this.onKeyDown as EventListener);
    target.removeEventListener('keyup', this.onKeyUp as EventListener);
  }
}
