import { describe, expect, it } from 'vitest';
import { Player } from '../src/entities/Player';
import { platformHeightAt } from '../src/maps/types';

const p = (over: Partial<Parameters<typeof platformHeightAt>[0]> = {}) => ({
  x: 0,
  y: 100,
  w: 50,
  ...over,
});

describe('platform height', () => {
  it('returns null outside the girder span', () => {
    expect(platformHeightAt(p(), -5)).toBeNull();
    expect(platformHeightAt(p(), 100)).toBeNull();
  });

  it('returns the girder height on flat girders', () => {
    expect(platformHeightAt(p(), 25)).toBe(100);
  });

  it('interpolates height on sloped girders', () => {
    expect(platformHeightAt(p({ slope: 'up' }), 0)).toBe(100);
    expect(platformHeightAt(p({ slope: 'up' }), 40)).toBe(120);
    // 'down' slopes descend left→right: 100 + (50-40)/2 at x=40.
    expect(platformHeightAt(p({ slope: 'down' }), 40)).toBe(105);
  });
});

describe('player movement', () => {
  const floor = p();
  const ladder = { x: 20, y: 60, h: 40 };

  it('falls onto the girder and stands on it', () => {
    const player = new Player({ x: 25, y: 50 });
    player.input.right = false;
    for (let i = 0; i < 60; i++) player.update(1 / 60, [floor], []);
    expect(player.onGround).toBe(true);
    expect(player.y + player.h).toBeCloseTo(100, 0);
  });

  it('climbs up when overlapping a ladder and pressing up', () => {
    const player = new Player({ x: 24, y: 96 });
    player.input.up = true;
    const before = player.y;
    player.update(1 / 60, [floor, p({ y: 60 })], [ladder]);
    expect(player.state).toBe('climb');
    expect(player.y).toBeLessThan(before);
  });

  it('jumps only from the ground', () => {
    const player = new Player({ x: 25, y: 86 });
    for (let i = 0; i < 60; i++) player.update(1 / 60, [floor], []);
    player.input.jump = true;
    player.update(1 / 60, [floor], []);
    const takeoffVy = player.vy;
    expect(takeoffVy).toBeLessThan(0);
    // Airborne jump input must not relaunch: vy only decays by gravity.
    player.input.jump = false;
    player.update(1 / 60, [floor], []);
    player.input.jump = true;
    player.update(1 / 60, [floor], []);
    expect(player.vy).toBeGreaterThan(takeoffVy);
  });

  it('cannot jump while carrying the hammer', () => {
    const player = new Player({ x: 25, y: 86 });
    for (let i = 0; i < 60; i++) player.update(1 / 60, [floor], []);
    player.pickHammer(5);
    player.input.jump = true;
    player.update(1 / 60, [floor], []);
    expect(player.y).toBeGreaterThanOrEqual(86 - 4);
  });

  it('expires the hammer over time', () => {
    const player = new Player({ x: 25, y: 96 });
    player.pickHammer(1);
    for (let i = 0; i < 70; i++) player.update(1 / 60, [floor], []);
    expect(player.hasHammer).toBe(false);
  });
});
