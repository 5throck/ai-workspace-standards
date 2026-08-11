// Centralizes per-entity sprite-frame selection so entities don't each carry
// their own ad-hoc Date.now()-based frame math. Maps a named animation state
// to an ordered list of sprite keys, a playback rate (fps), and whether the
// sequence loops or holds on its last frame.

export interface AnimationDefinition {
  frames: string[];
  fps: number;
  loop: boolean;
}

export class AnimationController {
  private definitions: Record<string, AnimationDefinition>;
  private currentState: string = '';
  private stateStartTime: number = 0;

  constructor(definitions: Record<string, AnimationDefinition>, initialState?: string) {
    this.definitions = definitions;
    if (initialState) {
      this.currentState = initialState;
      this.stateStartTime = Date.now();
    }
  }

  /** Switch the active animation state. Resets the frame timer only when the state actually changes. */
  public setState(state: string): void {
    if (this.currentState === state) return;
    this.currentState = state;
    this.stateStartTime = Date.now();
  }

  public getState(): string {
    return this.currentState;
  }

  /** Returns the sprite key that should be drawn for the current state at this moment. */
  public getFrameKey(): string {
    const def = this.definitions[this.currentState];
    if (!def || def.frames.length === 0) return '';
    if (def.frames.length === 1) return def.frames[0];

    const elapsedMs = Date.now() - this.stateStartTime;
    const frameDurationMs = 1000 / def.fps;
    let index = Math.floor(elapsedMs / frameDurationMs);

    if (def.loop) {
      index = ((index % def.frames.length) + def.frames.length) % def.frames.length;
    } else {
      index = Math.min(index, def.frames.length - 1);
    }

    return def.frames[index];
  }
}
