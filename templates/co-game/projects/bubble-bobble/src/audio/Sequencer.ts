// Lookahead scheduler for sample-accurate BGM timing.
//
// A `setInterval` "pump" runs at a short, fixed rate purely to check whether
// it's time to schedule the next step(s). Actual note-start times are
// computed from an injectable current-time getter plus a lookahead window,
// so notes are scheduled ahead of playback time (via e.g. `osc.start(when)`)
// rather than started synchronously at tick time. This keeps timing stable
// even under timer jitter or background-tab throttling.

export type SequencerTickCallback = (stepIndex: number, when: number) => void;

const DEFAULT_PUMP_INTERVAL_MS = 25;
const DEFAULT_LOOKAHEAD_SECONDS = 0.1;

export class Sequencer {
  private readonly getCurrentTime: () => number;
  private readonly pumpIntervalMs: number;
  private readonly lookaheadSeconds: number;

  private timerId: ReturnType<typeof setInterval> | null = null;
  private onTick: SequencerTickCallback | null = null;
  private stepDurationSeconds: number = 0.2;
  private nextStepTime: number = 0;
  private stepIndex: number = 0;
  public running: boolean = false;

  constructor(
    getCurrentTime: () => number,
    pumpIntervalMs: number = DEFAULT_PUMP_INTERVAL_MS,
    lookaheadSeconds: number = DEFAULT_LOOKAHEAD_SECONDS
  ) {
    this.getCurrentTime = getCurrentTime;
    this.pumpIntervalMs = pumpIntervalMs;
    this.lookaheadSeconds = lookaheadSeconds;
  }

  public start(onTick: SequencerTickCallback, stepDurationSeconds: number): void {
    this.stop();

    this.onTick = onTick;
    this.stepDurationSeconds = stepDurationSeconds;
    this.stepIndex = 0;
    this.nextStepTime = this.getCurrentTime();
    this.running = true;

    this.timerId = setInterval(() => this.pump(), this.pumpIntervalMs);
    // Schedule any steps that already fall within the lookahead window
    // immediately, so playback doesn't wait for the first pump tick.
    this.pump();
  }

  private pump(): void {
    if (!this.running || !this.onTick) return;

    const horizon = this.getCurrentTime() + this.lookaheadSeconds;
    while (this.nextStepTime < horizon) {
      this.onTick(this.stepIndex, this.nextStepTime);
      this.nextStepTime += this.stepDurationSeconds;
      this.stepIndex += 1;
    }
  }

  public stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.running = false;
    this.onTick = null;
  }

  public setStepDuration(stepDurationSeconds: number): void {
    this.stepDurationSeconds = stepDurationSeconds;
  }
}
