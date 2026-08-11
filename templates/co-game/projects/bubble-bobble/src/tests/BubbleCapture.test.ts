import { describe, test, expect } from 'vitest';
import { Bubble } from '../entities/Bubble';
import { Enemy } from '../entities/Enemy';
import { CollisionSystem } from '../systems/CollisionSystem';

describe('Bubble capture and escape loops', () => {
  test('Bubble shooting state captures active enemy on collision', () => {
    const bubble = new Bubble(10, 10, 1);
    const enemy = new Enemy(12, 10, 'ZEN_CHAN');

    expect(bubble.state).toBe('SHOOTING');
    expect(enemy.active).toBe(true);

    // Collision check
    const isColliding = CollisionSystem.checkAABB(bubble, enemy);
    expect(isColliding).toBe(true);

    if (isColliding && bubble.state === 'SHOOTING') {
      bubble.trap(enemy);
    }

    expect(bubble.state).toBe('ENEMY_TRAPPED');
    expect(bubble.trappedEnemy).toBe(enemy);
    expect(enemy.active).toBe(false);
  });

  test('Bubble enemy trapped state pops and escapes angry enemy on timeout', () => {
    const bubble = new Bubble(10, 10, 1);
    const enemy = new Enemy(10, 10, 'ZEN_CHAN');

    bubble.trap(enemy);
    expect(bubble.state).toBe('ENEMY_TRAPPED');

    // Simulate 5 seconds passing (trapTimer = 5.0)
    bubble.update(5.1 * 60); // 5.1 seconds in update frames

    expect(bubble.state).toBe('POPPING');
    expect(bubble.trappedEnemy).toBeNull();
    expect(enemy.active).toBe(true);
    expect(enemy.isAngry).toBe(true);
  });
});
