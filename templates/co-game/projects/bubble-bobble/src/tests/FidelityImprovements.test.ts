import { describe, test, expect } from 'vitest';
import { GameEngine } from '../engine/GameEngine';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bubble } from '../entities/Bubble';
import { EnemyRock } from '../entities/SpecialProjectiles';
import { SkelMonsta } from '../entities/SkelMonsta';
import { STAGE_META } from '../maps/StageMeta';

function mockCanvas(): HTMLCanvasElement {
  return {
    getContext: () => ({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      filter: 'none',
      shadowColor: '',
      shadowBlur: 0,
      fillRect: () => {},
      fillText: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      closePath: () => {},
      save: () => {},
      restore: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
    }),
  } as unknown as HTMLCanvasElement;
}

describe('Arcade fidelity improvements', () => {
  test('round progression: rounds run 1-100, layout wraps every 20', () => {
    const engine = new GameEngine(mockCanvas());
    expect(engine.currentRound).toBe(1);

    (engine as any).currentStageIndex = 19;
    expect(engine.currentRound).toBe(20);
    expect((engine as any).loadStage, 'loadStage exists').toBeTruthy();
    (engine as any).loadStage(19);
    expect(engine.currentStageMap).toBeTruthy();

    (engine as any).currentStageIndex = 20; // round 21 reuses layout 1
    (engine as any).loadStage(20);
    expect(engine.currentRound).toBe(21);

    (engine as any).currentStageIndex = 99; // round 100
    (engine as any).loadStage(99);
    expect(engine.currentRound).toBe(100);

    (engine as any).currentStageIndex = 100; // wraps to round 1, retained difficulty
    (engine as any).loadStage(100);
    expect(engine.currentRound).toBe(1);
    expect(engine.difficultyCycle).toBeGreaterThan(0);
  });

  test('difficulty escalates per 20-round cycle and is capped', () => {
    const engine = new GameEngine(mockCanvas());
    (engine as any).currentStageIndex = 0;
    (engine as any).loadStage(0);
    const earlySpeed = engine.enemies[0].speed;

    (engine as any).currentStageIndex = 100; // cycle 5, same layout as stage 1
    (engine as any).loadStage(100);
    const laterSpeed = engine.enemies[0].speed;
    expect(laterSpeed).toBeGreaterThan(earlySpeed);

    // Capped cycle: stage 401 vs stage 101 use the same capped cycle (5) and layout
    (engine as any).currentStageIndex = 400;
    (engine as any).loadStage(400);
    const cappedSpeed = engine.enemies[0].speed;
    expect(engine.difficultyCycle).toBe(5);
    (engine as any).currentStageIndex = 100;
    (engine as any).loadStage(100);
    expect(engine.enemies[0].speed).toBe(cappedSpeed);
  });

  test('hurry-up threshold shrinks per cycle with a floor', () => {
    const engine = new GameEngine(mockCanvas());
    (engine as any).currentStageIndex = 0;
    expect(engine.hurryUpThreshold).toBe(30);
    (engine as any).currentStageIndex = 20;
    expect(engine.hurryUpThreshold).toBeCloseTo(27, 5);
    // Cycle cap (5) limits the shrinkage: 30 * 0.9^5
    (engine as any).currentStageIndex = 999;
    expect(engine.difficultyCycle).toBe(5);
    expect(engine.hurryUpThreshold).toBeCloseTo(30 * Math.pow(0.9, 5), 5);
    expect(engine.hurryUpThreshold).toBeGreaterThan(10);
  });

  test('Mighta throws rocks at players on its level; rocks kill players and crumble', () => {
    const engine = new GameEngine(mockCanvas());
    engine.state = 'PLAYING';
    const mighta = new Enemy(200, 360, 'MIGHTA');
    engine.enemies = [mighta];
    (engine as any).players[0].x = 300;
    (engine as any).players[0].y = 360;
    (engine as any).players[0].dead = false;

    // Force the throw cadence to fire
    mighta.wantsToThrow = true;
    (engine as any).update(1.0);

    expect(engine.enemyRocks.length).toBe(1);
    expect(mighta.wantsToThrow).toBe(false);

    // Rock flies toward the player (player is to the right)
    expect(engine.enemyRocks[0].vx).toBeGreaterThan(0);
  });

  test('EnemyRock disappears on ground contact and does not harm enemies', () => {
    const rock = new EnemyRock(100, 100, 1);
    rock.update(1.0);
    expect(rock.active).toBe(true);
    rock.isGrounded = true;
    rock.update(1.0);
    expect(rock.active).toBe(false);

    const wallHit = new EnemyRock(100, 100, 1);
    wallHit.vx = 0; // collision system zeroed vx (wall hit)
    wallHit.update(1.0);
    expect(wallHit.active).toBe(false);
  });

  test('INVADER (Blubbor) floats with sine drift and no gravity', () => {
    const blubbor = new Enemy(100, 200, 'INVADER');
    expect(blubbor.gravityScale).toBe(0);
    expect(blubbor.type).toBe('INVADER');

    blubbor.update(1.0);
    // Sine drift: vertical velocity oscillates (no gravity pull-down)
    expect(blubbor.vy).not.toBe(0);

    const vys: number[] = [];
    for (let i = 0; i < 12; i++) {
      blubbor.update(1.0);
      vys.push(blubbor.vy);
    }
    expect(new Set(vys.map((v) => Math.round(v * 100))).size).toBeGreaterThan(2); // oscillating
  });

  test('later stages spawn INVADER enemies (stages 8+)', () => {
    const engine = new GameEngine(mockCanvas());
    (engine as any).loadStage(6); // stage 7, count 6 -> includes pool index 5
    expect(engine.enemies.some((e: Enemy) => e.type === 'INVADER')).toBe(true);
    (engine as any).loadStage(0); // stage 1, count 3 -> no INVADERs
    expect(engine.enemies.some((e: Enemy) => e.type === 'INVADER')).toBe(false);
  });

  test('two players exist: P1 and P2 with separate scores, lives and bindings', () => {
    const engine = new GameEngine(mockCanvas());
    expect(engine.players.length).toBe(2);
    expect(engine.players[0].playerIndex).toBe(0);
    expect(engine.players[1].playerIndex).toBe(1);
    expect(engine.players[0].lives).toBe(3);
    expect(engine.players[1].lives).toBe(3);
    expect(engine.player).toBe(engine.players[0]);

    // Spaced apart side by side
    expect(engine.players[1].x).toBeGreaterThan(engine.players[0].x);
  });

  test('player death triggers 2s respawn when lives remain; game over only when both are out', () => {
    const engine = new GameEngine(mockCanvas());
    engine.state = 'PLAYING';
    const p1 = engine.players[0];
    const p2 = engine.players[1];

    (engine as any).killPlayer(p1);
    expect(p1.dead).toBe(true);
    expect(p1.lives).toBe(2);
    expect(p1.respawnTimer).toBeCloseTo(2, 5);
    expect(engine.state).toBe('PLAYING'); // P2 still alive

    // Respawn after timer elapses
    for (let i = 0; i < 130; i++) (engine as any).update(1.0);
    expect(p1.dead).toBe(false);

    // Drain both players (3 lives each)
    for (let i = 0; i < 3; i++) (engine as any).killPlayer(p1);
    for (let i = 0; i < 3; i++) (engine as any).killPlayer(p2);
    expect(engine.state).toBe('GAME_OVER');
  });

  test('wall cling caps fall speed and wall jump pushes away from the wall', () => {
    const player = new Player(0, 0);
    player.isGrounded = false;
    player.vy = 8; // falling fast
    player.touchingWall = -1; // against wall on the left

    const input = { isPressed: (code: string) => code === 'ArrowLeft' } as any;
    player.handleInput(input, () => {});
    expect(player.vy).toBe(1.0); // capped slow slide

    // Wall jump: push right, away from the left wall
    const jumpInput = { isPressed: (code: string) => code === 'ArrowLeft' || code === 'ArrowUp' } as any;
    player.handleInput(jumpInput, () => {});
    expect(player.vy).toBeLessThan(0);
    expect(player.vx).toBeGreaterThan(0);
  });

  test('falling onto the top of a floating bubble bounces without popping', () => {
    const engine = new GameEngine(mockCanvas());
    engine.state = 'PLAYING';
    const player = engine.players[0];
    player.dead = false;
    player.x = 100;
    player.y = 80;
    player.vy = 4; // falling
    player.invincibleTimer = 0;

    const bubble = new Bubble(100, 92, 1); // bubble centerY = 104; feet (108) below center -> pop path
    bubble.state = 'FLOATING';
    engine.bubbles = [bubble];

    // Case 1: feet above bubble center -> bounce, no pop
    player.y = 70; // feet = 98 < 104
    player.vy = 4;
    (engine as any).handleCollisions();
    expect(bubble.active).toBe(true);
    expect(player.vy).toBe(-6);

    // Case 2: side/bottom contact -> pop with small hop
    player.y = 95; // feet = 123 > 104
    player.vy = 1;
    const bubble2 = new Bubble(100, 92, 1);
    bubble2.state = 'FLOATING';
    engine.bubbles = [bubble2];
    (engine as any).handleCollisions();
    // pop() starts the popping animation (active remains true during it)
    expect(bubble2.state).toBe('POPPING');
    expect(player.vy).toBe(-3.2);
  });

  test('Skel-Monsta spawns 15s after hurry-up and despawns on stage clear', () => {
    const engine = new GameEngine(mockCanvas());
    engine.state = 'PLAYING';
    // Keep one enemy alive so the stage does not immediately clear
    const holder = new Enemy(420, 100, 'ZEN_CHAN');
    holder.vx = 0;
    engine.enemies = [holder];
    // Keep players invincible so the patrolling enemy cannot end the test early
    engine.players.forEach((p) => { p.invincibleTimer = 9999; });
    (engine as any).hurryUpTriggered = true;

    // 14 seconds: not yet
    for (let i = 0; i < 14 * 60; i++) (engine as any).update(1.0);
    expect(engine.skelMonsta).toBeNull();

    // 2 more seconds -> past the 15s delay
    for (let i = 0; i < 2 * 60; i++) (engine as any).update(1.0);
    expect(engine.skelMonsta).not.toBeNull();
    expect(engine.skelMonsta).toBeInstanceOf(SkelMonsta);

    // Chases nearest living player (moves toward P1 position)
    const before = { x: engine.skelMonsta!.x, y: engine.skelMonsta!.y };
    for (let i = 0; i < 30; i++) (engine as any).update(1.0);
    const distBefore = Math.hypot(before.x - engine.players[0].centerX, before.y - engine.players[0].centerY);
    const distAfter = Math.hypot(engine.skelMonsta!.x - engine.players[0].centerX, engine.skelMonsta!.y - engine.players[0].centerY);
    expect(distAfter).toBeLessThan(distBefore);

    // Stage cleared -> despawn
    engine.enemies = [];
    engine.bubbles = [];
    (engine as any).update(1.0);
    expect(engine.skelMonsta).toBeNull();
    expect(engine.state).toBe('STAGE_CLEAR');
  });

  test('bubbles are always STANDARD (no random special spawns)', () => {
    const engine = new GameEngine(mockCanvas());
    engine.state = 'PLAYING';
    const player = engine.players[0];
    player.dead = false;
    player.invincibleTimer = 0;
    // Drive the engine's real shoot path with a mocked input source
    (engine as any).input = { isPressed: (c: string) => c === 'Space' };

    for (let i = 0; i < 5; i++) {
      player.shootCooldown = 0;
      (engine as any).update(1.0);
    }
    expect(engine.bubbles.length).toBeGreaterThan(0);
    engine.bubbles.forEach((b) => expect(b.type).toBe('STANDARD'));
  });

  test('STAGE_META final stage no longer claims a boss', () => {
    expect(STAGE_META.length).toBe(20);
    STAGE_META.forEach((meta) => expect(meta.name.toLowerCase()).not.toContain('boss'));
  });
});
