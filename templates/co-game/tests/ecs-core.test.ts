import { describe, test, expect, beforeEach } from "bun:test";
import { World, type System } from "../src/ecs/ecs-core";

// Test Components
class Position {
  constructor(public x = 0, public y = 0) {}
}

class Velocity {
  constructor(public vx = 0, public vy = 0) {}
}

class Renderable {
  constructor(public color = "red") {}
}

describe("ECS Engine Core (templates/co-game/src/ecs/ecs-core.ts)", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe("Entity Lifecycle", () => {
    test("creates entities with incrementing unique IDs", () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      expect(e1).toBe(1);
      expect(e2).toBe(2);
      expect(world.hasEntity(e1)).toBe(true);
      expect(world.hasEntity(e2)).toBe(true);
      expect(world.entityCount).toBe(2);
    });

    test("destroys entity immediately", () => {
      const entity = world.createEntity();
      world.addComponent(entity, new Position(10, 20));
      expect(world.hasEntity(entity)).toBe(true);

      world.destroyEntity(entity, true);
      expect(world.hasEntity(entity)).toBe(false);
      expect(world.getComponent(entity, Position)).toBeUndefined();
      expect(world.entityCount).toBe(0);
    });

    test("destroys entity deferred", () => {
      const entity = world.createEntity();
      world.addComponent(entity, new Position(5, 5));

      world.destroyEntity(entity, false);
      expect(world.hasEntity(entity)).toBe(false);
      expect(world.query(Position)).toEqual([]);
      expect(world.entityCount).toBe(0);

      // Cleanup completes purge
      world.cleanup();
      expect(world.getComponent(entity, Position)).toBeUndefined();
    });

    test("resets world completely", () => {
      const e1 = world.createEntity();
      world.addComponent(e1, new Position(1, 1));
      world.reset();

      expect(world.entityCount).toBe(0);
      expect(world.hasEntity(e1)).toBe(false);
      const e2 = world.createEntity();
      expect(e2).toBe(1); // Reset entity ID counter
    });
  });

  describe("Component Attachment & Retrieval", () => {
    test("attaches and retrieves components", () => {
      const entity = world.createEntity();
      const pos = new Position(100, 200);
      const vel = new Velocity(1, -1);

      world.addComponent(entity, pos);
      world.addComponent(entity, vel);

      expect(world.hasComponent(entity, Position)).toBe(true);
      expect(world.hasComponent(entity, Velocity)).toBe(true);
      expect(world.hasComponent(entity, Renderable)).toBe(false);

      expect(world.getComponent(entity, Position)).toBe(pos);
      expect(world.getComponent(entity, Velocity)).toBe(vel);
      expect(world.getComponent(entity, Renderable)).toBeUndefined();
    });

    test("removes components", () => {
      const entity = world.createEntity();
      world.addComponent(entity, new Position(10, 10));
      expect(world.hasComponent(entity, Position)).toBe(true);

      const removed = world.removeComponent(entity, Position);
      expect(removed).toBe(true);
      expect(world.hasComponent(entity, Position)).toBe(false);
      expect(world.getComponent(entity, Position)).toBeUndefined();
    });

    test("throws error when adding component to non-existent entity", () => {
      expect(() => {
        world.addComponent(999, new Position());
      }).toThrow();
    });
  });

  describe("System Querying & Execution", () => {
    test("queries entities with matching components", () => {
      const e1 = world.createEntity();
      world.addComponent(e1, new Position(0, 0));
      world.addComponent(e1, new Velocity(1, 1));

      const e2 = world.createEntity();
      world.addComponent(e2, new Position(10, 10));

      const e3 = world.createEntity();
      world.addComponent(e3, new Position(20, 20));
      world.addComponent(e3, new Velocity(2, 2));
      world.addComponent(e3, new Renderable("blue"));

      expect(world.query(Position)).toEqual([e1, e2, e3]);
      expect(world.query(Position, Velocity)).toEqual([e1, e3]);
      expect(world.query(Position, Velocity, Renderable)).toEqual([e3]);
      expect(world.query(Renderable)).toEqual([e3]);
    });

    test("executes registered systems on update", () => {
      const entity = world.createEntity();
      world.addComponent(entity, new Position(0, 0));
      world.addComponent(entity, new Velocity(5, 10));

      let initCalled = false;
      let destroyCalled = false;

      const movementSystem: System = {
        name: "MovementSystem",
        init() {
          initCalled = true;
        },
        update(w, dt) {
          for (const e of w.query(Position, Velocity)) {
            const pos = w.getComponent(e, Position)!;
            const vel = w.getComponent(e, Velocity)!;
            pos.x += vel.vx * dt;
            pos.y += vel.vy * dt;
          }
        },
        destroy() {
          destroyCalled = true;
        },
      };

      world.addSystem(movementSystem);
      expect(initCalled).toBe(true);

      world.update(2.0);

      const pos = world.getComponent(entity, Position)!;
      expect(pos.x).toBe(10);
      expect(pos.y).toBe(20);

      world.removeSystem(movementSystem);
      expect(destroyCalled).toBe(true);
    });

    test("skips disabled systems", () => {
      const entity = world.createEntity();
      world.addComponent(entity, new Position(0, 0));

      let updateCount = 0;
      const testSystem: System = {
        enabled: false,
        update() {
          updateCount++;
        },
      };

      world.addSystem(testSystem);
      world.update(1.0);
      expect(updateCount).toBe(0);
    });
  });
});
