import { describe, expect, it } from 'vitest';
import { GhostHouseManager } from '../src/systems/GhostHouseManager';
import { GhostName } from '../src/config/types';

describe('ghost house release rules (arcade counters)', () => {
  it('Pinky leaves immediately, Inky needs 30 dots since Pinky, Clyde 60 since Inky', () => {
    const gh = new GhostHouseManager();
    gh.updateGameInfo(0, 0);
    expect(gh.shouldRelease(GhostName.BLINKY)).toBe(true);
    expect(gh.shouldRelease(GhostName.PINKY)).toBe(true);

    gh.markReleased(GhostName.PINKY);
    gh.updateGameInfo(0, 29);
    expect(gh.shouldRelease(GhostName.INKY)).toBe(false);
    gh.updateGameInfo(0, 30);
    expect(gh.shouldRelease(GhostName.INKY)).toBe(true);

    gh.markReleased(GhostName.INKY);
    gh.updateGameInfo(0, 89); // 60 dots since Inky at 29
    expect(gh.shouldRelease(GhostName.CLYDE)).toBe(false);
    gh.updateGameInfo(0, 91); // 62 since Inky
    expect(gh.shouldRelease(GhostName.CLYDE)).toBe(true);
  });

  it('after a life is lost, the global counter takes over (7/17/32)', () => {
    const gh = new GhostHouseManager();
    gh.notifyLifeLost();
    gh.updateGameInfo(0, 0);
    expect(gh.shouldRelease(GhostName.PINKY)).toBe(false);
    gh.updateGameInfo(0, 7);
    expect(gh.shouldRelease(GhostName.PINKY)).toBe(true);
    gh.updateGameInfo(0, 16);
    expect(gh.shouldRelease(GhostName.INKY)).toBe(false);
    gh.updateGameInfo(0, 17);
    expect(gh.shouldRelease(GhostName.INKY)).toBe(true);
    gh.updateGameInfo(0, 31);
    expect(gh.shouldRelease(GhostName.CLYDE)).toBe(false);
    gh.updateGameInfo(0, 32);
    expect(gh.shouldRelease(GhostName.CLYDE)).toBe(true);
  });

  it('resetStage returns to personal counters', () => {
    const gh = new GhostHouseManager();
    gh.notifyLifeLost();
    gh.resetStage();
    gh.updateGameInfo(0, 0);
    expect(gh.shouldRelease(GhostName.PINKY)).toBe(true);
  });
});
