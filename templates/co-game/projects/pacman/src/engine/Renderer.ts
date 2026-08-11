/**
 * Pac-Man - Canvas Renderer
 *
 * Thin wrapper around CanvasRenderingContext2D.
 * Provides a clear() helper and exposes the raw context for
 * all drawing operations performed by the renderers module.
 */

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D rendering context from canvas.');
    }
    this.ctx = ctx;
  }

  /** Clear the entire canvas to transparent black. */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Get the underlying 2D context for drawing. */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /** Get the canvas element. */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}