import { describe, expect, it } from 'vitest';
import { Barrel } from '../src/entities/Barrel';
import { MovingPlatform } from '../src/entities/MovingPlatform';
import { StageManager } from '../src/systems/StageManager';
import { STAGES } from '../src/maps';
import { STAGE_25M } from '../src/maps/stage-25m';

describe('barrels', () => {
  const floor = { x: 0, y: 100, w: 200 };
  const lower = { x: 0, y: 160, w: 400 };

  it('rolls along a girder in its direction', () => {
    const barrel = new Barrel({ x: 50, y: 90 }, 1);
    const before = barrel.x;
    barrel.update(1 / 60, [floor], []);
    expect(barrel.x).toBeGreaterThan(before);
    expect(barrel.state).toBe('rolling');
  });

  it('falls when it runs off the girder edge', () => {
    const barrel = new Barrel({ x: 190, y: 90 }, 1);
    for (let i = 0; i < 120 && barrel.state === 'rolling'; i++) barrel.update(1 / 60, [floor, lower], []);
    expect(barrel.state).toBe('falling');
  });

  it('descends a ladder with certainty when rng is forced', () => {
    const ladder = { x: 100, y: 100, h: 60 };
    const barrel = new Barrel({ x: 100, y: 90 }, 1);
    const forced = () => 0; // always below ladderChance
    for (let i = 0; i < 30 && barrel.state === 'rolling'; i++) {
      barrel.update(1 / 60, [floor, lower], [ladder], forced, 0.9);
    }
    expect(barrel.state).toBe('falling');
    expect(barrel.x).toBe(ladder.x + 2);
  });
});

describe('moving platforms', () => {
  it('patrols between top and bottom bounds', () => {
    const e = new MovingPlatform({ x: 50, w: 40, y: 64, h: 144, speed: 200 });
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 600; i++) {
      e.update(1 / 60);
      min = Math.min(min, e.y);
      max = Math.max(max, e.y);
    }
    expect(min).toBeGreaterThanOrEqual(63.9);
    expect(max).toBeLessThanOrEqual(64 + 144);
  });

  it('starts at its configured phase', () => {
    const a = new MovingPlatform({ x: 50, w: 40, y: 64, h: 144, speed: 20, phase: 0 });
    const b = new MovingPlatform({ x: 50, w: 40, y: 64, h: 144, speed: 20, phase: 0.5 });
    expect(a.y).toBeCloseTo(64, 5);
    expect(b.y).toBeGreaterThan(a.y);
  });
});

describe('stage progression', () => {
  it('loads the four stages in arcade order', () => {
    const sm = new StageManager();
    expect(sm.load(0).id).toBe('25m');
    expect(sm.next().id).toBe('50m');
    expect(sm.next().id).toBe('75m');
    expect(sm.next().id).toBe('100m');
  });

  it('wraps to 25m and raises difficulty after 100m', () => {
    const sm = new StageManager();
    sm.load(3);
    const before = sm.difficulty;
    const stage = sm.next();
    expect(stage.id).toBe('25m');
    expect(sm.round).toBe(2);
    expect(sm.difficulty).toBeGreaterThan(before);
  });

  it('exposes stage spawn rules by kind', () => {
    const sm = new StageManager();
    sm.load(0);
    expect(sm.fireballCount()).toBe(0);
    sm.load(1);
    expect(sm.fireballCount()).toBeGreaterThan(0);
    sm.load(3);
    expect(Number.isFinite(sm.barrelInterval())).toBe(false); // no barrels on 100m
  });

  it('registry holds every stage exactly once', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['25m', '50m', '75m', '100m']);
    expect(STAGE_25M.platforms.length).toBeGreaterThan(5);
  });
});
