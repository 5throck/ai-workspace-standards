export class InputHandler {
  private keys: { [key: string]: boolean } = {};

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        this.keys[e.code] = true;
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
      });
    }
  }

  public isPressed(code: string): boolean {
    return !!this.keys[code];
  }

  // Clear all states (useful on screen transition or pause)
  public clear(): void {
    this.keys = {};
  }
}
