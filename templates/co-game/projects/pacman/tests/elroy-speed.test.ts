import { describe, expect, it } from 'vitest';
import { Blinky } from '../src/entities/Blinky';
import { Pinky } from '../src/entities/Pinky';
import { CollisionSystem } from '../src/engine/CollisionSystem';
import { PACMAN_BASE_SPEED } from '../src/config/constants';

// CollisionSystem constructor signature guarded by tests/helpers in other suites;
// fall back to `as unknown as CollisionSystem` if it needs map data.
function makeCollision(): CollisionSystem {
  try {
    return new CollisionSystem();
  } catch {
    return new CollisionSystem(null as never);
  }
}

describe('ghost speed profile (arcade per-level table)', () => {
  it('normal speed follows the stage percentage', () => {
    const ghost = new Pinky(makeCollision());
    ghost.setSpeedProfile(0.8);
    // @ts-expect-error private via protected helper chain
    const speed = ghost['getCurrentSpeed']();
    expect(speed).toBeCloseTo(PACMAN_BASE_SPEED * 0.8, 5);
  });

  it('non-Blinky ghosts ignore Elroy levels', () => {
    const ghost = new Pinky(makeCollision());
    ghost.setSpeedProfile(0.75);
    ghost.setElroyLevel(2);
    const speed = ghost['getCurrentSpeed']();
    expect(speed).toBeCloseTo(PACMAN_BASE_SPEED * 0.75, 5);
  });

  it('Blinky speeds up in Cruise Elroy tiers (80% / 85%)', () => {
    const blinky = new Blinky(makeCollision());
    blinky.setSpeedProfile(0.75);
    blinky.setElroyLevel(0);
    const base = blinky['getCurrentSpeed']();
    blinky.setElroyLevel(1);
    const elroy1 = blinky['getCurrentSpeed']();
    blinky.setElroyLevel(2);
    const elroy2 = blinky['getCurrentSpeed']();
    expect(base).toBeCloseTo(PACMAN_BASE_SPEED * 0.75, 5);
    expect(elroy1).toBeCloseTo(PACMAN_BASE_SPEED * 0.8, 5);
    expect(elroy2).toBeCloseTo(PACMAN_BASE_SPEED * 0.85, 5);
  });
});
