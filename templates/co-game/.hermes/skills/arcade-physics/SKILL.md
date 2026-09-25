---
name: arcade-physics
description: >
  Minimal Arcade-class 2D physics over the zero-dependency ECS core: velocity integration,
  gravity, damping, and AABB collision detection plus response. Use when: implementing
  movement, gravity, or collision response on the ECS core; wiring the game loop system
  order; or fixing tunneling/clamping bugs.
version: 1.0.0
scope: co-game
status: active
owner: pm
last_reviewed: 2026-08-25
prerequisites: none
relates_to:
  - skill: research-analysis
    type: composes_with
  - skill: test-driven-development
    type: composes_with
  - skill: sound-synth
    type: follows
  - skill: documentation-writing
    type: composes_with
  - skill: code-review
    type: composes_with
metadata:
  type: implementation
  triggers:
    - arcade physics
    - movement system
    - gravity
    - velocity integration
    - collision response
    - AABB resolution
    - game loop order
---

# Skill: arcade-physics

## Context

Phaser ships two physics engines: Arcade and Matter. This skill provides the Arcade-class subset at the variant's 2D-casual scope: velocity integration, gravity, damping, AABB overlap detection, and collision response. Matter.js-class rigid-body dynamics (rotational dynamics, joints, stacking, continuous physics) are explicitly out of scope; the scope boundary in `docs/scene-management.md` already records that 3D or physics-heavy titles need a real engine.

The ECS template already provides the data model and the detection half:

| Provided by `src/ecs/arcade-puzzle-template.ts` | What it does |
|---|---|
| `Transform` (x, y, rotation, scale), `Velocity` (vx, vy), `BoundingBox` (width, height) | Components |
| `CollisionSystem` | O(n^2) AABB overlap detection; emits `CollisionEvent { entityA, entityB }` pairs into `activeCollisions`. Detection only; no resolution |
| `GridSystem` | Grid-to-world position sync for `GridPosition` entities |

This skill adds the two missing pieces: a `MovementSystem` that integrates `Velocity` into `Transform`, and collision response patterns that consume `CollisionSystem.activeCollisions`.

## When to Use

- Implementing entity movement, gravity, or jumping on the ECS core.
- Wiring system registration order in the fixed-timestep game loop.
- Resolving AABB overlaps: solid-wall separation, one-way platforms, tile leading-edge blocking.
- Debugging tunneling (entities passing through walls) or velocity clamping bugs.
- Writing deterministic unit tests for movement and collision code.

Do not use for rigid-body dynamics (rotation, joints, stacking). That is outside the 2D-casual scope recorded in `docs/scene-management.md`.

## Execution Steps

### Step 1: Add the MovementSystem

Copy this reference implementation into the game's systems directory (for example `src/systems/MovementSystem.ts`) and adjust import paths. All quantities are pixels and seconds: velocities in px/s, gravity in px/s^2, `dt` in seconds.

```typescript
import { World, type System } from "./ecs-core";
import { Transform, Velocity } from "./arcade-puzzle-template";

export interface MovementConfig {
  gravity: number;   // px/s^2 added to vy each step; 0 disables
  damping: number;   // per-second linear drag applied to both axes; 0 disables
  maxSpeed: number;  // px/s cap on velocity magnitude; Infinity disables
  maxDt: number;     // seconds; never integrate a dt larger than this
}

export const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  gravity: 0,
  damping: 0,
  maxSpeed: Infinity,
  maxDt: 1 / 60,
};

export class MovementSystem implements System {
  public name = "MovementSystem";

  constructor(private config: MovementConfig = DEFAULT_MOVEMENT_CONFIG) {}

  public update(world: World, deltaTime: number): void {
    // Clamp dt: never integrate more than one fixed step's worth of time.
    const dt = Math.min(deltaTime, this.config.maxDt);

    for (const entity of world.query(Transform, Velocity)) {
      const transform = world.getComponent(entity, Transform)!;
      const velocity = world.getComponent(entity, Velocity)!;

      // Semi-implicit Euler: update velocity BEFORE position.
      // This keeps a gravity-accelerated entity resting on a resolved
      // surface stable instead of sinking one gravity step per frame.
      velocity.vy += this.config.gravity * dt;

      if (this.config.damping > 0) {
        const drag = Math.max(0, 1 - this.config.damping * dt);
        velocity.vx *= drag;
        velocity.vy *= drag;
      }

      this.clampSpeed(velocity);

      transform.x += velocity.vx * dt;
      transform.y += velocity.vy * dt;
    }
  }

  private clampSpeed(velocity: Velocity): void {
    const speed = Math.hypot(velocity.vx, velocity.vy);
    if (speed > this.config.maxSpeed && speed > 0) {
      const scale = this.config.maxSpeed / speed;
      velocity.vx *= scale;
      velocity.vy *= scale;
    }
  }
}
```

Three rules from the implementation, restated because they are the common bug sources:

1. **Semi-implicit Euler order**: `vy += gravity * dt` comes BEFORE `y += vy * dt`. Explicit Euler (position first) accumulates energy and makes grounded entities jitter.
2. **dt clamp**: never integrate a `dt` larger than the fixed-timestep remainder. A single long frame after a tab stall must not teleport entities through walls (tunneling).
3. **Max-speed clamp** normalizes the velocity vector, not a single axis, so diagonal movement is not faster than axial movement.

### Step 2: Register systems in the fixed-timestep loop in this order

```text
input -> MovementSystem -> CollisionSystem -> response consumers -> render
```

- `MovementSystem` runs BEFORE `CollisionSystem` so detection sees post-integration positions; response consumers run AFTER `CollisionSystem` so they read a fresh `activeCollisions` array.
- Pass `dt` in SECONDS, not milliseconds. The house convention in `docs/co-game.context.md` (Game Development Specific Rules) uses `FIXED_DT = 1000/60 ms` with an accumulator; convert once at the call site: `world.update(FIXED_DT / 1000)`.
- `world.update()` executes systems in registration order. Deterministic ordering is what makes fixed-dt unit tests reproducible; register systems in the same order in every scene (see `docs/scene-management.md`).

### Step 3: Consume activeCollisions with the right response pattern

All four patterns read `CollisionSystem.activeCollisions` after the collision step.

**(a) Separation resolution (solid walls).** Push entity A out of entity B along the smaller overlap axis:

```typescript
import { World, type Entity } from "./ecs-core";
import { Transform, BoundingBox } from "./arcade-puzzle-template";

/** Push entityA out of entityB along the smaller overlap axis. */
function resolveSeparation(world: World, entityA: Entity, entityB: Entity): void {
  const tA = world.getComponent(entityA, Transform)!;
  const bA = world.getComponent(entityA, BoundingBox)!;
  const tB = world.getComponent(entityB, Transform)!;
  const bB = world.getComponent(entityB, BoundingBox)!;

  // Penetration depth per axis (positive while intersecting).
  const overlapX = Math.min(tA.x + bA.width - tB.x, tB.x + bB.width - tA.x);
  const overlapY = Math.min(tA.y + bA.height - tB.y, tB.y + bB.height - tA.y);

  if (overlapX < overlapY) {
    // Shallower penetration on X: push A toward the side its center is on.
    const aCenterX = tA.x + bA.width / 2;
    const bCenterX = tB.x + bB.width / 2;
    tA.x += aCenterX < bCenterX ? -overlapX : overlapX;
  } else {
    const aCenterY = tA.y + bA.height / 2;
    const bCenterY = tB.y + bB.height / 2;
    tA.y += aCenterY < bCenterY ? -overlapY : overlapY;
  }
}
```

After separating on an axis, zero the velocity component directed into the surface (for example `velocity.vx = 0` when A was pushed out horizontally while moving toward B).

Axis-decision table:

| Comparison | Resolution |
|---|---|
| `overlapX < overlapY` | Push A out horizontally; zero `vx` if directed into B |
| `overlapY < overlapX` | Push A out vertically; zero `vy` if directed into B |
| `overlapX == overlapY` (corner) | Resolve the axis of larger incoming velocity component; tie breaks to X by convention |

**(b) Tile-grid leading-edge checks.** For grid-locked games, prefer blocking entry over pushing out: before moving an entity, test the tile at its leading edge (position plus half-entity-size in the movement direction) and deny the movement when that tile is solid. The house example in `docs/co-game.context.md` (Game Development Specific Rules: 28x31 grid, 16px tiles, `HALF_ENTITY_SIZE = 7` leading-edge checks) shows the convention. Grid conventions are per-game: the grid dimensions, tile size, and any `HALF_ENTITY_SIZE`-style constant belong to the game's own constants file, not to this skill.

**(c) One-way platforms.** Apply vertical resolution only when the entity approaches from above:

```typescript
if (prevBottom <= platformTop + epsilon && velocity.vy >= 0) {
  transform.y = platformTop - boundingBox.height;
  velocity.vy = 0;
}
```

`prevBottom` is A's bottom edge in the previous fixed step. An entity jumping up from below passes through; an entity falling from above lands.

**(d) Event-only handling (pickups, triggers).** Consume the `CollisionEvent` without changing position: flag or destroy entityB (for example set `ScoreValue.collected`), add score, and trigger a sound via the `sound-synth` patterns. No separation.

### Step 4: Test with deterministic fixed-dt steps

- Advance the world N fixed steps in a loop (`for (let i = 0; i < N; i++) world.update(1 / 60)`) and assert exact positions computed from the config, not approximate ranges. With gravity `g` and step `dt`, velocity gains exactly `g * dt` per step; cumulative position offsets follow closed-form values the test can state precisely.
- Write pairwise resolution tests: two entities overlapping by a known offset, one fixed step, then assert the exact separated position and the zeroed velocity component.
- Keep systems under test free of `Math.random()` and `Date.now()` so runs are reproducible.
- Author these tests following the `test-driven-development` skill (red-green cycle, movement test written first).

## Output Format

Every implementation using this skill reports two artifacts:

1. The system registration order as a numbered list mirroring the loop order:

```text
1. InputSystem
2. MovementSystem
3. CollisionSystem
4. <Response consumers by name>
5. RenderSystem
```

2. The collision-response decision table filled in for the game's entity pairs:

| Situation | Decision rule | Resolution action |
|---|---|---|
| Solid wall | `overlapX < overlapY` | Push A out on X; zero `vx` directed into B |
| Solid wall | `overlapY < overlapX` | Push A out on Y; zero `vy` directed into B |
| One-way platform | `prevBottom <= platform top` and `vy >= 0` | Snap A on top, zero `vy`; otherwise pass through |
| Pickup / trigger | any overlap | No position change: flag or destroy B, add score, play SFX |
| Tile boundary (grid games) | leading-edge tile is solid | Block entry before integration |

## Related Skills

- `test-driven-development`: red-green discipline for the deterministic fixed-dt tests in Step 4.
- `code-review`: review checklist for system order and integration correctness.
- Scene-level structure (one `World` per scene, system registration on enter): see `docs/scene-management.md`.
