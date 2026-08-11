import { describe, test, expect } from 'vitest';
import { GameEngine } from '../engine/GameEngine';
import { Bubble } from '../entities/Bubble';
import { WaterWave } from '../entities/SpecialProjectiles';
import { Item } from '../entities/Item';

describe('Sprint A Enhancements', () => {
  test('Chain Pop BFS queue schedules cascade delay', () => {
    // Mock canvas to satisfy GameEngine initialization in Node environment
    const canvas = {
      getContext: () => ({
        scale: () => {},
        fillStyle: '',
        fillRect: () => {},
        fillText: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
      })
    } as unknown as HTMLCanvasElement;
    
    const engine = new GameEngine(canvas);
    
    // Spawn bubbles close to each other
    const b1 = new Bubble(10, 100, 1);
    b1.state = 'FLOATING';
    const b2 = new Bubble(20, 100, 1);
    b2.state = 'FLOATING';
    const b3 = new Bubble(30, 100, 1);
    b3.state = 'FLOATING';
    
    engine.bubbles = [b1, b2, b3];
    
    // Trigger chain pop starting at b1
    (engine as any).triggerChainPop(b1);
    
    const popQueue = (engine as any).popQueue;
    expect(popQueue.length).toBe(3);
    
    // Checks staggered delays: b1 (delay = 0), b2 (delay = 0), b3 (delay = 2)
    expect(popQueue[0].bubble).toBe(b1);
    expect(popQueue[0].delay).toBe(0);
    expect(popQueue[1].bubble).toBe(b2);
    expect(popQueue[1].delay).toBe(0);
    expect(popQueue[2].bubble).toBe(b3);
    expect(popQueue[2].delay).toBe(2);
  });

  test('WaterWave projectile slides along platform and reverses on wall hit', () => {
    const wave = new WaterWave(10, 10, 1);
    expect(wave.vx).toBe(wave.speed);
    
    // Simulate hitting a wall (vx is reset to 0 by collision system)
    wave.isGrounded = true;
    wave.vx = 0;
    wave.update(1.0);
    
    expect(wave.direction).toBe(-1);
    expect(wave.vx).toBe(-wave.speed);
  });

  test('Stage 3 and Stage 4 load correct map structures and enemies', () => {
    const canvas = {
      getContext: () => ({
        scale: () => {},
        fillStyle: '',
        fillRect: () => {},
        fillText: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
      })
    } as unknown as HTMLCanvasElement;
    
    const engine = new GameEngine(canvas);
    
    // Load Stage 3
    (engine as any).loadStage(2);
    expect(engine.enemies.length).toBe(4);
    expect(engine.enemies[0].type).toBe('ZEN_CHAN');
    expect(engine.enemies[1].type).toBe('MIGHTA');
    
    // Load Stage 4 (enemy composition now comes from the shared
    // ENEMY_SPAWN_POOL/STAGE_META lookup introduced in Sprint 4, rather than
    // a per-stage hardcoded list).
    (engine as any).loadStage(3);
    expect(engine.enemies.length).toBe(4);
    expect(engine.enemies[0].type).toBe('ZEN_CHAN');
    expect(engine.enemies[2].type).toBe('ZEN_CHAN');
  });

  test('Bubble-on-bubble horizontal repulsion pushes overlapping bubbles apart', () => {
    const canvas = {
      getContext: () => ({
        scale: () => {},
        fillStyle: '',
        fillRect: () => {},
        fillText: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
      })
    } as unknown as HTMLCanvasElement;
    
    const engine = new GameEngine(canvas);
    engine.state = 'PLAYING';
    
    const b1 = new Bubble(100, 100, 1);
    b1.state = 'FLOATING';
    b1.vx = 0;
    
    const b2 = new Bubble(105, 100, 1); // overlap horizontally by 5px
    b2.state = 'FLOATING';
    b2.vx = 0;
    
    engine.bubbles = [b1, b2];
    
    // Run single frame update containing the repulsion pass
    (engine as any).update(1.0);
    
    // b1 is pushed left (vx < 0), b2 is pushed right (vx > 0)
    expect(b1.vx).toBeLessThan(0);
    expect(b2.vx).toBeGreaterThan(0);
  });

  test('Item bounces when hitting the ground in the game loop', () => {
    const canvas = {
      getContext: () => ({
        scale: () => {},
        fillStyle: '',
        fillRect: () => {},
        fillText: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
      })
    } as unknown as HTMLCanvasElement;

    const engine = new GameEngine(canvas);
    engine.state = 'PLAYING';
    (engine as any).loadStage(0); // Load Stage 1

    // Place item falling down towards the bottom platform
    const item = new Item(100, 411, 'APPLE');
    item.vy = 4; // Falling down fast
    item.isGrounded = false;
    item.bounces = 0;
    engine.items = [item];

    // Run game update step which executes item physics
    (engine as any).update(1.0);

    // It should have hit the ground and bounced up (negative vy)
    expect(item.bounces).toBe(1);
    expect(item.vy).toBeLessThan(0);
    expect(item.isGrounded).toBe(false);
  });
});
