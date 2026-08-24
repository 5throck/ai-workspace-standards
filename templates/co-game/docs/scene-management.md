# Scene-Management Convention over the ECS Core

> **Purpose**: Define the scene-graph convention for multi-level games built on the zero-dependency ECS core (`src/ecs/ecs-core.ts`). Phaser organizes games around Scenes; this document establishes the equivalent abstraction without adding a dependency — a Scene is a disciplined composition of `World`, `System` instances, and scene-scoped entities.
>
> **Scope**: 2D-casual games (the variant's stated scope). 3D or physics-heavy titles need a real engine; the ECS core's scope boundary is recorded in the backlog worksheet.

---

## 1. What a Scene Is Here

| Phaser concept | ECS-core equivalent |
|----------------|---------------------|
| `Scene` instance | One `World` instance + its registered `System` list + scene-scoped entities |
| `preload` / `create` | System `init?(world)` hooks, invoked when the scene enters |
| `update` (per frame) | `world.update(deltaTime)` driving each system's `update(world, dt)` |
| `shutdown` | `world.reset()` + system `destroy?(world)` hooks |

A **Scene** is therefore not a new class the engine provides — it is a convention object:

```typescript
import { World, type System } from "../ecs/ecs-core";

export interface Scene {
  readonly name: string;
  readonly world: World;          // one World per scene
  readonly systems: System[];     // registered on enter, removed on exit
  enter?(director: SceneDirector): void;   // build entities, register systems
  exit?(director: SceneDirector): void;    // flush teardown, persist what must survive
}
```

## 2. SceneDirector

A single director object owns the active scene and the cross-scene state. It is the ONLY mutable global.

```typescript
export class SceneDirector {
  private active?: Scene;
  /** Cross-scene state: scores, unlocks, settings. Plain serializable data. */
  public readonly state: Record<string, unknown> = {};

  public switchTo(next: Scene): void {
    if (this.active) {
      this.active.exit?.(this);
      this.active.world.reset();      // clears entities + components
      for (const s of this.active.systems) this.active.world.removeSystem(s);
    }
    this.active = next;
    for (const s of next.systems) next.world.addSystem(s);
    next.enter?.(this);
  }

  public tick(deltaTime: number): void {
    this.active?.world.update(deltaTime);
  }
}
```

Rules:

1. **One `World` per scene.** Never share a `World` between scenes — `reset()` semantics assume single ownership.
2. **Entities do not cross scenes.** Anything that must survive a transition goes through `director.state` (data), never as a live entity. Recreate entities in the next scene's `enter`.
3. **Deferred destruction is flushed by `reset()`.** Scenes that queue `destroyEntity(entity)` mid-frame rely on the director calling `reset()` on exit; never assume a queued-destroy entity still exists after the frame in which it was queued.
4. **The director's `tick` is the only `world.update` call site.** Systems never call `world.update` recursively.

## 3. File Layout

```
src/
  ecs/            # engine core — do not modify per-game
  scenes/
    boot.ts       # BootScene: asset/data prep, then switchTo(MenuScene)
    menu.ts       # MenuScene
    level.ts      # LevelScene: parameterized by level number from director.state
    game-over.ts  # GameOverScene
```

- One file per scene, exporting a `...Scene` factory or class implementing `Scene`.
- **Parameterized scenes beat duplicated scenes**: `LevelScene` takes its level number from `director.state.currentLevel` — do not fork `level-1.ts`, `level-2.ts`.
- Scene-specific components and systems live beside their scene file; systems shared across scenes live in `src/systems/`.

## 4. Transition Checklist

Every scene transition must, in order:

1. **Persist** — write what survives (score, unlocked level) to `director.state`.
2. **Exit hook** — run `exit()` for scene-specific cleanup that `reset()` does not cover (event listeners, audio loops, timers).
3. **Reset** — `world.reset()` clears entities/components; systems removed so `update` goes quiet.
4. **Enter** — next scene registers systems, then builds entities; System `init(world)` runs first, entity creation after.

A typical game flow: `BootScene → MenuScene → LevelScene(n) ↔ GameOverScene → MenuScene`, with `LevelScene` re-entered for retry/next level.

## 5. Stacked Scenes (Pause / Overlay)

The core supports one active scene. For pause overlays, use a **system-level freeze instead of scene stacking**: the overlay registers a `PauseSystem` that early-returns in the systems it should halt, or the director skips `tick` for the paused world while a DOM/dialog overlay handles input. Do NOT nest two `World.update` loops — the single-tick rule above is absolute.

## 6. Conformance Checklist

- [ ] Every scene owns exactly one `World`; no shared worlds
- [ ] No entity crosses a scene boundary — only `director.state` data
- [ ] Scene file per scene under `src/scenes/`, levels parameterized not duplicated
- [ ] Transitions follow persist → exit → reset → enter order
- [ ] Single `world.update` call site (the director's `tick`)
- [ ] `exit()` cleans what `reset()` cannot (listeners, audio, timers)

---

*Version 1.0.0 — 2026-08-25. Grounded in `src/ecs/ecs-core.ts` (World.reset / System init-update-destroy / deferred destroy) and the `arcade-puzzle-template.ts` system idiom.*
