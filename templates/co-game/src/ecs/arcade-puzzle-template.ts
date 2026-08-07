/**
 * @file arcade-puzzle-template.ts
 * @description Reference Arcade & Puzzle ECS components and systems for 2D Canvas games.
 * Built on top of ecs-core.ts for co-game variant agents (arcade-designer, puzzle-designer, game-developer).
 */

import { World, type System, type Entity } from "./ecs-core";

// ==========================================
// 1. Core Arcade / Puzzle Components
// ==========================================

export class Transform {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public rotation: number = 0,
    public scale: number = 1
  ) {}
}

export class Velocity {
  constructor(
    public vx: number = 0,
    public vy: number = 0
  ) {}
}

export class BoundingBox {
  constructor(
    public width: number = 32,
    public height: number = 32
  ) {}
}

export class GridPosition {
  constructor(
    public col: number = 0,
    public row: number = 0,
    public tileSize: number = 32
  ) {}
}

export class ScoreValue {
  constructor(
    public points: number = 100,
    public collected: boolean = false
  ) {}
}

export class Health {
  constructor(
    public current: number = 100,
    public max: number = 100
  ) {}
}

// ==========================================
// 2. Systems: Collision, Grid & Score
// ==========================================

export interface CollisionEvent {
  entityA: Entity;
  entityB: Entity;
}

export class CollisionSystem implements System {
  public name = "CollisionSystem";
  public activeCollisions: CollisionEvent[] = [];

  public update(world: World, _deltaTime: number): void {
    this.activeCollisions = [];
    const entities = world.query(Transform, BoundingBox);

    for (let i = 0; i < entities.length; i++) {
      const eA = entities[i];
      const tA = world.getComponent(eA, Transform)!;
      const bA = world.getComponent(eA, BoundingBox)!;

      for (let j = i + 1; j < entities.length; j++) {
        const eB = entities[j];
        const tB = world.getComponent(eB, Transform)!;
        const bB = world.getComponent(eB, BoundingBox)!;

        if (
          tA.x < tB.x + bB.width &&
          tA.x + bA.width > tB.x &&
          tA.y < tB.y + bB.height &&
          tA.y + bA.height > tB.y
        ) {
          this.activeCollisions.push({ entityA: eA, entityB: eB });
        }
      }
    }
  }
}

export class GridSystem implements System {
  public name = "GridSystem";

  public update(world: World, _deltaTime: number): void {
    for (const entity of world.query(GridPosition, Transform)) {
      const grid = world.getComponent(entity, GridPosition)!;
      const transform = world.getComponent(entity, Transform)!;
      transform.x = grid.col * grid.tileSize;
      transform.y = grid.row * grid.tileSize;
    }
  }
}

export class ScoreManager {
  private currentScore = 0;

  public get score(): number {
    return this.currentScore;
  }

  public addScore(amount: number): void {
    this.currentScore += amount;
  }

  public reset(): void {
    this.currentScore = 0;
  }
}
