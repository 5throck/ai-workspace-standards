# Game Mechanics

## Movement
- Player speed 56 px/s, ladder climb 40 px/s, gravity 320 px/s², jump impulse −160 px/s.
- Standing height interpolates on sloped girders (`platformHeightAt`), matching the 25m slopes.
- Jumping requires ground contact and is blocked while the hammer is held (arcade rule).

## Barrels
- Spawned by Donkey Kong at the top with interval `3s / difficulty` (±25% jitter); never on 100m.
- Roll at 48 px/s × difficulty, snap to girder surfaces, fall off edges, and descend ladders with
  probability `min(0.5, 0.2 + 0.1 × (round − 1))`.
- **Oil drum** (25m bottom-left): barrels that roll into it burn up and release a fireball
  (up to 3 concurrently), as in the arcade.

## Fireballs (50m / 75m / 100m)
- Patrol girders at 36 px/s, reverse at edges, and occasionally climb; count scales with round on 50m.

## Hammer
- Pickup grants 8 seconds. Overlaps destroy barrels (+300) and fireballs (+500).

## Scoring
| Event | Points |
|---|---|
| Barrel skipped (consecutive, arcade ladder) | +100 → +300 → +500 → +700 → +800 (cap) |
| Barrel smashed | +300 |
| Fireball smashed | +500 |
| Stage clear | +1000 |
| Time bonus (BONUS counter) | remaining seconds × 100 |

High score persists under `donkey-kong-highscore` (portal convention).

## Difficulty / rounds
- Round order 25m → 50m → 75m → 100m → wrap to 25m with round + 1.
- Difficulty multiplier `1 + 0.25 × (round − 1)` scales barrel interval, speed, and ladder-descend chance.
- 3 lives; death respawns at the stage start with barrels cleared. Timer expiry is lethal.
