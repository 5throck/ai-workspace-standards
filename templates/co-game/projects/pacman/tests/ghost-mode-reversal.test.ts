/**
 * GhostBase.setMode() — Mode-Reversal Rule Regression Test
 *
 * Locks in the CURRENT (pre-refactor) reversal behavior of setMode() before
 * it is replaced with an explicit (prevMode, newMode) -> shouldReverse
 * transition table. See memory/meeting-2026-07-01-pacman-diagnosis.md for
 * why: the existing nested-if logic is implicit and had no test coverage.
 *
 * Current behavior, read directly from GhostBase.setMode():
 *   - prevMode === FRIGHTENED -> never reverse (early return), regardless
 *     of newMode. This includes FRIGHTENED -> EATEN, which does NOT reverse
 *     because the early return happens before the EATEN check.
 *   - prevMode is SCATTER or CHASE, newMode is FRIGHTENED/SCATTER/CHASE
 *     -> reverse.
 *   - newMode === EATEN (from any prevMode other than FRIGHTENED) -> reverse.
 *   - Any other combination (e.g. IN_HOUSE -> LEAVING_HOUSE,
 *     LEAVING_HOUSE -> SCATTER/CHASE) -> no reverse.
 */
import { describe, it, expect } from 'vitest';
import { Direction, GhostMode } from '../src/config/types';
import { oppositeDirection } from '../src/entities/EntityBase';
import { CollisionSystem } from '../src/engine/CollisionSystem';
import { Blinky } from '../src/entities/Blinky';

function makeGhost() {
  const ghost = new Blinky(new CollisionSystem());
  ghost.direction = Direction.UP;
  ghost.velocity = { dx: 0, dy: -1 };
  return ghost;
}

describe('GhostBase.setMode() reversal rules', () => {
  it('reverses on SCATTER -> CHASE', () => {
    const ghost = makeGhost();
    ghost.mode = GhostMode.SCATTER;
    ghost.setMode(GhostMode.CHASE);
    expect(ghost.direction).toBe(oppositeDirection(Direction.UP));
  });

  it('reverses on CHASE -> SCATTER', () => {
    const ghost = makeGhost();
    ghost.mode = GhostMode.CHASE;
    ghost.setMode(GhostMode.SCATTER);
    expect(ghost.direction).toBe(oppositeDirection(Direction.UP));
  });

  it('reverses entering FRIGHTENED from SCATTER or CHASE', () => {
    const ghost = makeGhost();
    ghost.mode = GhostMode.CHASE;
    ghost.setMode(GhostMode.FRIGHTENED);
    expect(ghost.direction).toBe(oppositeDirection(Direction.UP));
  });

  it('does NOT reverse when leaving FRIGHTENED (back to SCATTER)', () => {
    const ghost = makeGhost();
    ghost.mode = GhostMode.FRIGHTENED;
    ghost.setMode(GhostMode.SCATTER);
    expect(ghost.direction).toBe(Direction.UP);
  });

  it('does NOT reverse when leaving FRIGHTENED into EATEN (early-return takes precedence)', () => {
    const ghost = makeGhost();
    ghost.mode = GhostMode.FRIGHTENED;
    ghost.setMode(GhostMode.EATEN);
    expect(ghost.direction).toBe(Direction.UP);
  });

  it('reverses on EATEN entry from CHASE', () => {
    const ghost = makeGhost();
    ghost.mode = GhostMode.CHASE;
    ghost.setMode(GhostMode.EATEN);
    expect(ghost.direction).toBe(oppositeDirection(Direction.UP));
  });

  it('does NOT reverse on IN_HOUSE -> LEAVING_HOUSE', () => {
    const ghost = makeGhost();
    ghost.mode = GhostMode.IN_HOUSE;
    ghost.setMode(GhostMode.LEAVING_HOUSE);
    expect(ghost.direction).toBe(Direction.UP);
  });

  it('does NOT reverse on LEAVING_HOUSE -> SCATTER', () => {
    const ghost = makeGhost();
    ghost.mode = GhostMode.LEAVING_HOUSE;
    ghost.setMode(GhostMode.SCATTER);
    expect(ghost.direction).toBe(Direction.UP);
  });
});
