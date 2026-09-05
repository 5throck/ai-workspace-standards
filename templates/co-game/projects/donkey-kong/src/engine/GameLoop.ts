/** Fixed-timestep game loop. */
export class GameLoop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;

  constructor(
    private readonly step: (dt: number) => void,
    private readonly render: () => void,
    private readonly stepMs = 1000 / 60,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number): void => {
      if (!this.running) return;
      this.acc += now - this.last;
      this.last = now;
      let steps = 0;
      while (this.acc >= this.stepMs && steps < 5) {
        this.step(this.stepMs / 1000);
        this.acc -= this.stepMs;
        steps++;
      }
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  get isRunning(): boolean {
    return this.running;
  }
}
