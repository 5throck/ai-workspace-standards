/**
 * Pac-Man - Input Manager
 *
 * Single-slot direction buffer with key-to-direction mapping.
 * Tracks currently-pressed keys for pause-toggle checks.
 */
import { Direction } from '../config/types';

/** Maps keyboard event key values to game Direction values. */
const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: Direction.UP,
  ArrowDown: Direction.DOWN,
  ArrowLeft: Direction.LEFT,
  ArrowRight: Direction.RIGHT,
  w: Direction.UP,
  W: Direction.UP,
  s: Direction.DOWN,
  S: Direction.DOWN,
  a: Direction.LEFT,
  A: Direction.LEFT,
  d: Direction.RIGHT,
  D: Direction.RIGHT,
};

/** Keys that toggle pause (P or Escape). */
const PAUSE_KEYS = new Set(['p', 'P', 'Escape']);

export class InputManager {
  /** Single-slot direction buffer for pre-turn input. */
  private bufferedInput: Direction = Direction.NONE;

  /** Currently-held keys (key down -> true, key up -> false). */
  private pressedKeys: Set<string> = new Set();

  /** Whether pause was requested this frame. Consumed by the game. */
  private pauseRequested: boolean = false;

  /** Bound handler so we can remove it on destroy. */
  private readonly boundKeyDown: (e: KeyboardEvent) => void;
  private readonly boundKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.boundKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.boundKeyUp = (e: KeyboardEvent) => this.handleKeyUp(e);
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  // -- Public API -----------------------------------------------------------

  /** Process a keydown event. Called automatically via listener. */
  handleKeyDown(e: KeyboardEvent): void {
    // Prevent arrow-key page scrolling
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
    }

    const dir = KEY_TO_DIRECTION[e.key];
    if (dir !== undefined) {
      this.bufferedInput = dir;
    }

    if (PAUSE_KEYS.has(e.key)) {
      this.pauseRequested = true;
    }

    this.pressedKeys.add(e.key);
  }

  /** Process a keyup event. Called automatically via listener. */
  handleKeyUp(e: KeyboardEvent): void {
    this.pressedKeys.delete(e.key);
  }

  /** Consume the buffered direction input (single-slot). Returns NONE if no input. */
  consumeInput(): Direction {
    const input = this.bufferedInput;
    this.bufferedInput = Direction.NONE;
    return input;
  }

  /** Check whether a specific key is currently held down. */
  isKeyPressed(key: string): boolean {
    return this.pressedKeys.has(key);
  }

  /** Consume the pause toggle flag. Returns true once per press. */
  consumePauseToggle(): boolean {
    if (this.pauseRequested) {
      this.pauseRequested = false;
      return true;
    }
    return false;
  }

  /** Remove event listeners. Call when the game shuts down. */
  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
  }
}