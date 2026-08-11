/**
 * Ghost House Exit — Consolidated Regression Test
 *
 * Replaces ghost-exit-simulation.test.ts, ghost-exit-full-sim.test.ts, and
 * ghost-exit-exact-sim.test.ts (three near-duplicate files left over from
 * debugging GhostBase.updateHouseMovement() / GhostHouseManager release
 * timing). This file preserves every uniquely-asserted case from all three:
 *   - Individual ghost exit (Pinky/Inky/Clyde)
 *   - Multi-ghost sequential exit without blocking
 *   - Release-threshold boundary (Inky 29/30 dots, Clyde 59/60 dots)
 *   - Slow dot-eating-rate exit
 *   - Exit correctness after a death/respawn cycle (gameTime/dotsEaten NOT
 *     reset, mirroring main.ts's respawnEntities() behavior)
 *
 * See memory/meeting-2026-07-01-pacman-diagnosis.md for why this
 * consolidation happened, and projects/pacman/docs/architecture.md §9 for
 * the HUD_OFFSET_Y coordinate convention used in the exitY calculations below.
 */
import { describe, it, expect } from 'vitest';
import { GhostMode, GhostName, Direction } from '../src/config/types';
import type { MapData } from '../src/config/types';
import { TILE_SIZE, HUD_OFFSET_Y, FIXED_DT, GHOST_HOUSE_PAUSE_DURATION } from '../src/config/constants';
import { level1Data } from '../src/maps/level-1';
import { CollisionSystem } from '../src/engine/CollisionSystem';
import { Blinky } from '../src/entities/Blinky';
import { Pinky } from '../src/entities/Pinky';
import { Inky } from '../src/entities/Inky';
import { Clyde } from '../src/entities/Clyde';
import { GhostHouseManager } from '../src/systems/GhostHouseManager';
import { cloneMapData } from './helpers/test-utils';

const EXIT_Y = 11 * TILE_SIZE + TILE_SIZE / 2 + HUD_OFFSET_Y;

function makeGhosts(map: MapData, collision: CollisionSystem) {
  const ghosts = [new Blinky(collision), new Pinky(collision), new Inky(collision), new Clyde(collision)];
  for (const ghost of ghosts) ghost.setMap(map);

  const names = [GhostName.BLINKY, GhostName.PINKY, GhostName.INKY, GhostName.CLYDE];
  ghosts[0].reset(map.ghostStarts[GhostName.BLINKY]);
  ghosts[0].setMode(GhostMode.SCATTER);
  ghosts[0].setDirection?.(Direction.LEFT, 1.5);
  for (let i = 1; i < ghosts.length; i++) {
    ghosts[i].reset(map.ghostStarts[names[i]]);
    ghosts[i].setMode(GhostMode.IN_HOUSE);
  }
  return ghosts;
}

/** Mirrors the exact updatePlaying() order of operations in main.ts. */
function simulateGame(tickCount: number, dotsPerTick: number, cycles = [
  { mode: GhostMode.SCATTER, duration: 7000 },
  { mode: GhostMode.CHASE, duration: 20000 },
]) {
  const map = cloneMapData(level1Data);
  const collision = new CollisionSystem();
  const ghosts = makeGhosts(map, collision);
  const ghostHouse = new GhostHouseManager();
  ghostHouse.setScatterChaseCycles(cycles);

  let gameTime = 0;
  let dotsEaten = 0;
  let pauseTimer = 0;
  const events: string[] = [];

  for (let tick = 0; tick < tickCount; tick++) {
    gameTime += FIXED_DT;
    if (dotsEaten < map.totalDots && tick > 0) {
      dotsEaten = Math.min(dotsEaten + dotsPerTick, map.totalDots);
    }

    ghostHouse.updateGameInfo(gameTime, dotsEaten);
    ghostHouse.update(FIXED_DT);

    for (const ghost of ghosts) {
      if (ghost.getMode() === GhostMode.IN_HOUSE && ghostHouse.shouldRelease(ghost.name)) {
        ghost.setMode(GhostMode.LEAVING_HOUSE);
        events.push(`[tick ${tick}] RELEASE: ${ghost.name}`);
      }
    }

    if (pauseTimer > 0) {
      pauseTimer -= FIXED_DT;
      if (pauseTimer > 0) {
        for (const ghost of ghosts) {
          ghost.updatePacmanInfo({ col: 14, row: 20 }, Direction.LEFT);
          ghost.update(FIXED_DT);
        }
        continue;
      }
    }

    const globalMode = ghostHouse.getGlobalMode();
    for (const ghost of ghosts) {
      const mode = ghost.getMode();
      if ((mode === GhostMode.SCATTER || mode === GhostMode.CHASE) && mode !== globalMode) {
        ghost.setMode(globalMode);
      }
      ghost.updatePacmanInfo({ col: 14, row: 20 }, Direction.LEFT);
    }

    for (const ghost of ghosts) ghost.update(FIXED_DT);

    for (const ghost of ghosts) {
      if (ghost.getMode() === GhostMode.LEAVING_HOUSE && ghost.position.y <= EXIT_Y) {
        events.push(`[tick ${tick}] EXIT: ${ghost.name}`);
        ghost.setMode(ghostHouse.getGlobalMode());
      }
    }

    for (const ghost of ghosts) {
      if (ghost.getMode() === GhostMode.EATEN) {
        const tile = ghost.tileCoord();
        if (tile.row === 14 && tile.col === 14) {
          ghost.setMode(GhostMode.IN_HOUSE);
          pauseTimer = GHOST_HOUSE_PAUSE_DURATION;
          events.push(`[tick ${tick}] EATEN_RETURN: ${ghost.name}`);
        }
      }
    }
  }

  return { events, gameTime, dotsEaten, ghosts, ghostHouse };
}

describe('Ghost House Exit — individual ghosts', () => {
  it('Pinky exits within 240 ticks of release', () => {
    const map = cloneMapData(level1Data);
    const collision = new CollisionSystem();
    const ghost = new Pinky(collision);
    ghost.setMap(map);
    ghost.reset(map.ghostStarts[GhostName.PINKY]);
    ghost.setMode(GhostMode.IN_HOUSE);

    for (let tick = 0; tick < 240; tick++) {
      if (ghost.getMode() === GhostMode.IN_HOUSE && tick >= 120) {
        ghost.setMode(GhostMode.LEAVING_HOUSE);
      }
      ghost.update(FIXED_DT);
      if (ghost.getMode() === GhostMode.LEAVING_HOUSE && ghost.position.y <= EXIT_Y) {
        ghost.setMode(GhostMode.SCATTER);
        return;
      }
    }
    expect.fail('Pinky should have exited within 240 ticks');
  });

  it('Inky exits when released immediately', () => {
    const map = cloneMapData(level1Data);
    const collision = new CollisionSystem();
    const ghost = new Inky(collision);
    ghost.setMap(map);
    ghost.reset(map.ghostStarts[GhostName.INKY]);
    ghost.setMode(GhostMode.LEAVING_HOUSE);

    for (let tick = 0; tick < 200; tick++) {
      ghost.update(FIXED_DT);
      if (ghost.getMode() === GhostMode.LEAVING_HOUSE && ghost.position.y <= EXIT_Y) {
        ghost.setMode(GhostMode.SCATTER);
        return;
      }
    }
    expect.fail('Inky should have exited within 200 ticks');
  });

  it('Clyde exits when released immediately', () => {
    const map = cloneMapData(level1Data);
    const collision = new CollisionSystem();
    const ghost = new Clyde(collision);
    ghost.setMap(map);
    ghost.reset(map.ghostStarts[GhostName.CLYDE]);
    ghost.setMode(GhostMode.LEAVING_HOUSE);

    for (let tick = 0; tick < 200; tick++) {
      ghost.update(FIXED_DT);
      if (ghost.getMode() === GhostMode.LEAVING_HOUSE && ghost.position.y <= EXIT_Y) {
        ghost.setMode(GhostMode.SCATTER);
        return;
      }
    }
    expect.fail('Clyde should have exited within 200 ticks');
  });
});

describe('Ghost House Exit — release timing boundaries', () => {
  it('Inky releases exactly at 30 dots eaten, not before', () => {
    const ghostHouse = new GhostHouseManager();
    ghostHouse.updateGameInfo(0, 29);
    expect(ghostHouse.shouldRelease(GhostName.INKY)).toBe(false);
    ghostHouse.updateGameInfo(0, 30);
    expect(ghostHouse.shouldRelease(GhostName.INKY)).toBe(true);
  });

  it('Clyde releases exactly at 60 dots eaten, not before', () => {
    const ghostHouse = new GhostHouseManager();
    ghostHouse.updateGameInfo(0, 59);
    expect(ghostHouse.shouldRelease(GhostName.CLYDE)).toBe(false);
    ghostHouse.updateGameInfo(0, 60);
    expect(ghostHouse.shouldRelease(GhostName.CLYDE)).toBe(true);
  });
});

describe('Ghost House Exit — full game flow simulation', () => {
  it('all non-Blinky ghosts exit sequentially without blocking each other (fast eating)', () => {
    const { events } = simulateGame(300, 1);
    const exited = events.filter(e => e.includes('EXIT:'));
    expect(exited.some(e => e.includes(GhostName.PINKY))).toBe(true);
    expect(exited.some(e => e.includes(GhostName.INKY))).toBe(true);
    expect(exited.some(e => e.includes(GhostName.CLYDE))).toBe(true);
  });

  it('all ghosts exit even with slow dot-eating rate (1 dot per 3 ticks)', () => {
    const { events } = simulateGame(1800, 0.33);
    expect(events.some(e => e.includes('EXIT: PINKY') || e.includes(`EXIT: ${GhostName.PINKY}`))).toBe(true);
    expect(events.some(e => e.includes('EXIT: INKY') || e.includes(`EXIT: ${GhostName.INKY}`))).toBe(true);
    expect(events.some(e => e.includes('EXIT: CLYDE') || e.includes(`EXIT: ${GhostName.CLYDE}`))).toBe(true);
  });

  it('ghosts still exit correctly after a death/respawn cycle (gameTime/dotsEaten not reset)', () => {
    const map = cloneMapData(level1Data);
    const collision = new CollisionSystem();
    let ghosts = makeGhosts(map, collision);
    const ghostHouse = new GhostHouseManager();
    ghostHouse.setScatterChaseCycles([
      { mode: GhostMode.SCATTER, duration: 7000 },
      { mode: GhostMode.CHASE, duration: 20000 },
    ]);

    let gameTime = 0;
    let dotsEaten = 0;
    let exitedCount = 0;

    // Phase 1: play until 3 ghosts have exited.
    for (let tick = 0; tick < 600 && exitedCount < 3; tick++) {
      gameTime += FIXED_DT;
      dotsEaten = Math.min(dotsEaten + 1, map.totalDots);
      ghostHouse.updateGameInfo(gameTime, dotsEaten);
      ghostHouse.update(FIXED_DT);

      for (const ghost of ghosts) {
        if (ghost.getMode() === GhostMode.IN_HOUSE && ghostHouse.shouldRelease(ghost.name)) {
          ghost.setMode(GhostMode.LEAVING_HOUSE);
        }
      }
      const globalMode = ghostHouse.getGlobalMode();
      for (const ghost of ghosts) {
        const mode = ghost.getMode();
        if ((mode === GhostMode.SCATTER || mode === GhostMode.CHASE) && mode !== globalMode) {
          ghost.setMode(globalMode);
        }
        ghost.updatePacmanInfo({ col: 14, row: 20 }, Direction.LEFT);
      }
      for (const ghost of ghosts) ghost.update(FIXED_DT);
      for (const ghost of ghosts) {
        if (ghost.getMode() === GhostMode.LEAVING_HOUSE && ghost.position.y <= EXIT_Y) {
          ghost.setMode(ghostHouse.getGlobalMode());
          exitedCount++;
        }
      }
    }

    // Phase 2: simulate death/respawn — reset ghosts + stage, but NOT gameTime/dotsEaten
    // (this matches main.ts's respawnEntities() behavior exactly).
    for (const ghost of ghosts) {
      const start = map.ghostStarts[ghost.name];
      ghost.reset(start);
      ghost.setMode(ghost.name === GhostName.BLINKY ? GhostMode.SCATTER : GhostMode.IN_HOUSE);
    }
    ghostHouse.resetStage();
    ghostHouse.setScatterChaseCycles([
      { mode: GhostMode.SCATTER, duration: 7000 },
      { mode: GhostMode.CHASE, duration: 20000 },
    ]);

    // Phase 3: continue playing — all 3 house ghosts should exit again.
    exitedCount = 0;
    for (let tick = 0; tick < 600 && exitedCount < 3; tick++) {
      gameTime += FIXED_DT;
      dotsEaten = Math.min(dotsEaten + 1, map.totalDots);
      ghostHouse.updateGameInfo(gameTime, dotsEaten);
      ghostHouse.update(FIXED_DT);

      for (const ghost of ghosts) {
        if (ghost.getMode() === GhostMode.IN_HOUSE && ghostHouse.shouldRelease(ghost.name)) {
          ghost.setMode(GhostMode.LEAVING_HOUSE);
        }
      }
      const globalMode = ghostHouse.getGlobalMode();
      for (const ghost of ghosts) {
        const mode = ghost.getMode();
        if ((mode === GhostMode.SCATTER || mode === GhostMode.CHASE) && mode !== globalMode) {
          ghost.setMode(globalMode);
        }
        ghost.updatePacmanInfo({ col: 14, row: 20 }, Direction.LEFT);
      }
      for (const ghost of ghosts) ghost.update(FIXED_DT);
      for (const ghost of ghosts) {
        if (ghost.getMode() === GhostMode.LEAVING_HOUSE && ghost.position.y <= EXIT_Y) {
          ghost.setMode(ghostHouse.getGlobalMode());
          exitedCount++;
        }
      }
    }

    expect(exitedCount).toBe(3);
  });
});
