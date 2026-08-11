import { describe, it, expect, vi } from 'vitest';
import { ObjectPool } from '../src/utils/object-pool';

interface MockObj {
  id: number;
  value: string;
  active: boolean;
}

describe('ObjectPool', () => {
  it('creates objects via factory when pool is empty', () => {
    const pool = new ObjectPool<MockObj>(
      (i) => ({ id: i, value: `obj-${i}`, active: true }),
      (obj) => { obj.active = false; },
    );
    const obj = pool.get();
    expect(obj.active).toBe(true);
    expect(obj.id).toBe(0);
    expect(pool.activeCount).toBe(1);
    expect(pool.availableCount).toBe(0);
  });

  it('reuses objects from pool after release', () => {
    const pool = new ObjectPool<MockObj>(
      (i) => ({ id: i, value: `obj-${i}`, active: true }),
      (obj) => { obj.active = false; obj.value = 'reset'; },
    );
    const obj1 = pool.get();
    pool.release(obj1);
    expect(obj1.active).toBe(false);
    expect(obj1.value).toBe('reset');
    expect(pool.availableCount).toBe(1);

    const obj2 = pool.get();
    expect(obj2).toBe(obj1); // same object reused
    expect(pool.availableCount).toBe(0);
    expect(pool.activeCount).toBe(1);
  });

  it('pre-allocates initialSize objects', () => {
    const pool = new ObjectPool<MockObj>(
      (i) => ({ id: i, value: `obj-${i}`, active: true }),
      () => {},
      5,
    );
    expect(pool.availableCount).toBe(5);
    expect(pool.activeCount).toBe(0);
  });

  it('creates new objects when pool is exhausted', () => {
    const pool = new ObjectPool<MockObj>(
      (i) => ({ id: i, value: `obj-${i}`, active: true }),
      () => {},
      2,
    );
    const a = pool.get(); // from pre-allocated pool
    const b = pool.get(); // from pre-allocated pool
    const c = pool.get(); // new — pool empty
    expect(pool.activeCount).toBe(3);
    expect(pool.availableCount).toBe(0);
    expect(c.id).toBe(2); // third factory call
  });

  it('clear releases all active objects', () => {
    const resetFn = vi.fn();
    const pool = new ObjectPool<MockObj>(
      (i) => ({ id: i, value: `obj-${i}`, active: true }),
      resetFn,
    );
    const a = pool.get();
    const b = pool.get();
    expect(pool.activeCount).toBe(2);
    pool.clear();
    expect(pool.activeCount).toBe(0);
    expect(pool.availableCount).toBe(2);
    expect(resetFn).toHaveBeenCalledTimes(2);
  });

  it('ignores release of unknown objects', () => {
    const pool = new ObjectPool<MockObj>(
      (i) => ({ id: i, value: `obj-${i}`, active: true }),
      () => {},
    );
    const fake = { id: 999, value: 'fake', active: true };
    pool.release(fake); // should not throw
    expect(pool.activeCount).toBe(0);
    expect(pool.availableCount).toBe(0);
  });

  it('maintains object identity across multiple cycles', () => {
    const pool = new ObjectPool<MockObj>(
      (i) => ({ id: i, value: `obj-${i}`, active: true }),
      () => {},
    );
    const obj1 = pool.get();
    pool.release(obj1);
    const obj2 = pool.get();
    expect(obj1).toBe(obj2);
    pool.release(obj2);
    const obj3 = pool.get();
    expect(obj1).toBe(obj3);
  });
});
