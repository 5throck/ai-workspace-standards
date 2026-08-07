import { describe, test, expect, beforeEach } from "bun:test";
import { World } from "../src/ecs/ecs-core";
import {
  Transform,
  Velocity,
  BoundingBox,
  GridPosition,
  ScoreValue,
  CollisionSystem,
  GridSystem,
  ScoreManager,
} from "../src/ecs/arcade-puzzle-template";

describe("Arcade & Puzzle ECS Extensions (templates/co-game/src/ecs/arcade-puzzle-template.ts)", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  test("GridSystem syncs grid col/row to transform coordinates", () => {
    const gridSys = new GridSystem();
    world.addSystem(gridSys);

    const entity = world.createEntity();
    world.addComponent(entity, new GridPosition(3, 4, 32));
    world.addComponent(entity, new Transform(0, 0));

    world.update(0.016);

    const t = world.getComponent(entity, Transform)!;
    expect(t.x).toBe(96);
    expect(t.y).toBe(128);
  });

  test("CollisionSystem detects AABB box overlaps", () => {
    const colSys = new CollisionSystem();
    world.addSystem(colSys);

    const player = world.createEntity();
    world.addComponent(player, new Transform(10, 10));
    world.addComponent(player, new BoundingBox(32, 32));

    const item = world.createEntity();
    world.addComponent(item, new Transform(20, 20));
    world.addComponent(item, new BoundingBox(32, 32));

    const distantObj = world.createEntity();
    world.addComponent(distantObj, new Transform(200, 200));
    world.addComponent(distantObj, new BoundingBox(32, 32));

    world.update(0.016);

    expect(colSys.activeCollisions.length).toBe(1);
    expect(colSys.activeCollisions[0].entityA).toBe(player);
    expect(colSys.activeCollisions[0].entityB).toBe(item);
  });

  test("ScoreManager accumulates score correctly", () => {
    const scoreMgr = new ScoreManager();
    expect(scoreMgr.score).toBe(0);

    const item = new ScoreValue(150);
    scoreMgr.addScore(item.points);
    expect(scoreMgr.score).toBe(150);

    scoreMgr.reset();
    expect(scoreMgr.score).toBe(0);
  });
});
