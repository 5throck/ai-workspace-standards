/**
 * Pac-Man - Generic State Machine
 *
 * Manages transitions between string-typed states with enter/exit callbacks.
 * Used for both game state (GameState) and entity modes (GhostMode).
 *
 * Supports:
 * - Typed transition events with metadata (from, to, trigger)
 * - Wildcard transitions ('*' matches any current state)
 * - Backward-compatible callbacks (zero-arg callbacks still work)
 */
export interface TransitionEvent<TState extends string> {
  from: TState;
  to: TState;
  trigger?: string;
}

export type StateChangeCallback<TState extends string> =
  | ((event: TransitionEvent<TState>) => void)
  | (() => void);

export class StateMachine<TState extends string> {
  private current: TState;
  private transitions: Map<string, Set<TState>> = new Map();
  private onEnter: Map<TState, Array<StateChangeCallback<TState>>> = new Map();
  private onExit: Map<TState, Array<StateChangeCallback<TState>>> = new Map();

  constructor(initial: TState) {
    this.current = initial;
  }

  /** Register a valid transition from one state to another. Use '*' for wildcard (any from-state). */
  addTransition(from: TState | '*', to: TState): void {
    const key = from as string;
    if (!this.transitions.has(key)) {
      this.transitions.set(key, new Set());
    }
    this.transitions.get(key)!.add(to);
  }

  /**
   * Attempt a state transition. Returns true if successful.
   * Fires exit callbacks for the old state and enter callbacks for the new state.
   * Always passes the TransitionEvent to callbacks; zero-arg callbacks safely ignore it.
   */
  transition(to: TState, trigger?: string): boolean {
    const key = this.current as string;
    const allowed = this.transitions.get(key) ?? new Set();
    const wildcard = this.transitions.get('*') ?? new Set();
    if (!allowed.has(to) && !wildcard.has(to)) {
      return false;
    }

    const event: TransitionEvent<TState> = { from: this.current, to, trigger };

    // Fire exit callbacks for current state
    const exitCbs = this.onExit.get(this.current);
    if (exitCbs) {
      for (const cb of exitCbs) {
        (cb as (event: TransitionEvent<TState>) => void)(event);
      }
    }

    this.current = to;

    // Fire enter callbacks for new state
    const enterCbs = this.onEnter.get(this.current);
    if (enterCbs) {
      for (const cb of enterCbs) {
        (cb as (event: TransitionEvent<TState>) => void)(event);
      }
    }

    return true;
  }

  /** Register a callback that fires when entering a specific state. */
  onStateEnter(state: TState, callback: StateChangeCallback<TState>): void {
    if (!this.onEnter.has(state)) {
      this.onEnter.set(state, []);
    }
    this.onEnter.get(state)!.push(callback);
  }

  /** Register a callback that fires when exiting a specific state. */
  onStateExit(state: TState, callback: StateChangeCallback<TState>): void {
    if (!this.onExit.has(state)) {
      this.onExit.set(state, []);
    }
    this.onExit.get(state)!.push(callback);
  }

  /** Get the current state. */
  get state(): TState {
    return this.current;
  }

  /** Reset to a specific state (clears all timers/state, does not fire callbacks). */
  reset(initial: TState): void {
    this.current = initial;
  }
}
