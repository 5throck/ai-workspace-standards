/**
 * Pac-Man - Fixed-Timestep Game Loop
 *
 * Uses a fixed timestep (1000/60 ms) with an accumulator pattern.
 * Capping the accumulator at 100ms prevents a death-spiral when the
 * tab is backgrounded for a long period.
 *
 * Callbacks:
 *   onUpdate(dt: number)     - called once per fixed tick
 *   onRender(alpha?: number) - called once per requestAnimationFrame
 *                              alpha is the render interpolation factor (0.0–1.0)
 */
import { FIXED_DT, ACCUMULATOR_CAP } from '../config/constants';

export class GameLoop {
  private readonly fixedDt: number;
  private accumulator: number = 0;
  private lastTime: number = 0;
  private running: boolean = false;
  private rafId: number = 0;
  private readonly boundLoop: (time: number) => void;

  /** Called once per fixed timestep tick. */
  onUpdate: ((dt: number) => void) | null = null;

  /** Called once per animation frame. Receives optional render alpha for interpolation. */
  onRender: ((alpha: number) => void) | (() => void) | null = null;

  constructor() {
    this.fixedDt = FIXED_DT;
    this.boundLoop = (time: number) => this.loop(time);
  }

  /** Start the game loop (or resume after pause). */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.boundLoop);
  }

  /** Pause the loop - stops calling update/render but can be resumed. */
  pause(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /** Resume after pause. */
  resume(): void {
    this.start();
  }

  /** Stop the loop completely. */
  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.accumulator = 0;
    this.lastTime = 0;
  }

  /** Whether the loop is currently running. */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Interpolation factor between the last two physics states.
   * Ranges from 0.0 (just updated) to ~1.0 (about to update again).
   * Use this for smooth rendering between fixed timestep ticks.
   */
  get renderAlpha(): number {
    return this.accumulator / this.fixedDt;
  }

  // -- Internal ----------------------------------------------------------------

  private loop(currentTime: number): void {
    if (!this.running) return;

    const elapsed = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Cap accumulator to prevent spiral of death
    this.accumulator += Math.min(elapsed, ACCUMULATOR_CAP);

    // Fixed-timestep updates
    while (this.accumulator >= this.fixedDt) {
      this.onUpdate?.(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    // Variable-rate render with interpolation alpha
    const alpha = this.renderAlpha;
    const renderCallback = this.onRender;
    if (renderCallback) {
      renderCallback(alpha);
    }

    this.rafId = requestAnimationFrame(this.boundLoop);
  }
}
