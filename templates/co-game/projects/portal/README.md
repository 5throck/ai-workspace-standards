# co-game Arcade Portal

Runs every game in `projects/` from a single arcade-style hub: game cards,
per-game high scores, and a fullscreen launcher.

## Run

```bash
bun install
bun run build:games   # build each game and copy bundles into public/games/
bun run dev           # open the printed localhost URL
bun run test          # vitest (score adapter, registry consistency)
```

## Features

- **Game list** — one card per registered game (title, description, year, accent color).
- **High scores** — each card and the score board show the game's saved high score,
  read via `ScoreAdapter` from localStorage using the `<game-id>-highscore` convention.
- **Launcher** — PLAY opens the game fullscreen in an iframe (keyboard focus is
  handed to the game automatically); "BACK TO PORTAL" returns and refreshes scores.
- **Recent play** — the most recently played game floats to the front of the list.

## Adding a game

1. Build the game so it works under a relative base (`base: './'` in its vite config).
2. Append an entry to `src/games.ts` (`id`, `title`, `description`, `path`,
   `scoreKey`, `accentColor`, `year`).
3. The registry consistency test requires `public/games/<id>/index.html` to exist —
   run `bun run build:games <id>`.

Architecture decisions were made in the 2026-09-05 agent meeting
(`memory/2026-09-05-game-portal-design.md`): build-bundles-over-proxies,
single-origin iframe launcher, `<game-id>-highscore` keys, registry-driven cards.
