# Donkey Kong

Classic Donkey Kong (1981) arcade clone — HTML5 Canvas + Vanilla TypeScript.

## Run

```bash
bun install
bun run dev      # play at the printed localhost URL
bun run test     # vitest unit/integration tests
bun run build    # production bundle (also consumed by the portal)
```

## Controls

| Key | Action |
|---|---|
| ← → | Move |
| ↑ / ↓ | Climb ladders |
| SPACE / Z | Jump (disabled while carrying the hammer) |

## Game rules

- 4 stages per round in arcade order: **25m (girders) → 50m (elevators) → 75m (slopes + lifts) → 100m (rooftop)**. Clearing 100m wraps to 25m with a higher difficulty (barrel rate/speed, ladder-descend chance, fireball count).
- Donkey Kong hurls barrels that roll along girders, fall off edges, and may randomly descend ladders. The 50m/75m/100m stages add patrolling fireballs.
- The **hammer** grants 8 seconds of smashing power (barrel +300, fireball +500); jumping is blocked while carrying it, as in the arcade.
- Scoring: barrel skipped +100, stage clear +1000, +10 per remaining second.
- 3 lives; high score persists to localStorage under `donkey-kong-highscore` (the portal convention).

## Architecture

- `src/maps/` — stage tile data (girders with slopes, ladders, elevator defs) + `StageManager`
- `src/entities/` — Player, Barrel, Fireball, MovingPlatform, DonkeyKong, Pauline, Hammer
- `src/engine/` — fixed-timestep GameLoop, InputManager, Canvas Renderer
- `src/assets/` — arcade-fidelity palette + hand-drawn pixel-grid sprites (no ROM data)

Design docs: see `docs/game-mechanics.md` and `docs/level-design.md`.
