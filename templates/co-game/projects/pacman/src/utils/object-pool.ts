/**
 * Generic ObjectPool for reusing objects instead of constant create/destroy cycles.
 * Reduces GC pressure during high-frequency scenarios (e.g., dot collection, particle effects).
 *
 * Usage:
 *   const pool = new ObjectPool<Dot>(
 *     (i) => new Dot(i),    // factory — called when pool is empty
 *     (d) => d.reset(),     // reset — called before returning to pool
 *     240                   // initialSize — pre-allocate (optional, default 0)
 *   );
 *   const dot = pool.get();
 *   pool.release(dot);
 */

export class ObjectPool<T> {
  private readonly _factory: (index: number) => T;
  private readonly _reset: (obj: T) => void;
  private readonly available: T[] = [];
  private readonly active: Set<T> = new Set();
  private created = 0;

  constructor(
    factory: (index: number) => T,
    reset: (obj: T) => void,
    initialSize = 0,
  ) {
    this._factory = factory;
    this._reset = reset;
    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory(this.created++));
    }
  }

  /** Get an object from the pool (creates new if empty). Increments activeCount. */
  get(): T {
    const obj = this.available.length > 0
      ? this.available.pop()!
      : this._factory(this.created++);
    this.active.add(obj);
    return obj;
  }

  /** Return an object to the pool after calling the reset function. */
  release(obj: T): void {
    if (!this.active.has(obj)) return;
    this.active.delete(obj);
    this._reset(obj);
    this.available.push(obj);
  }

  /** Release all active objects back to the pool. */
  clear(): void {
    for (const obj of this.active) {
      this._reset(obj);
      this.available.push(obj);
    }
    this.active.clear();
  }

  /** Number of objects currently in use. */
  get activeCount(): number {
    return this.active.size;
  }

  /** Number of objects available for reuse. */
  get availableCount(): number {
    return this.available.length;
  }
}
