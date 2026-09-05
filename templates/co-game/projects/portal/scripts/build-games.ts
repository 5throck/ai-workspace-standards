/**
 * Builds each registered game (vite build) and copies its dist/ into the
 * portal's public/games/<id>/ so the portal serves all games from one origin.
 *
 * Usage: bun run build:games [gameId ...]
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAMES = [
  { id: 'pacman' },
  { id: 'bubble-bobble' },
  { id: 'donkey-kong' },
] as const;

const here = dirname(fileURLToPath(import.meta.url));
const projectsDir = join(here, '..', '..');
const portalPublic = join(here, '..', 'public', 'games');

const requested = process.argv.slice(2);
const targets = requested.length > 0 ? GAMES.filter((g) => requested.includes(g.id)) : GAMES;
const unknown = requested.filter((id) => !GAMES.some((g) => g.id === id));
if (unknown.length > 0) {
  console.error(`Unknown game id(s): ${unknown.join(', ')}`);
  process.exit(1);
}

mkdirSync(portalPublic, { recursive: true });

let failed = false;
for (const { id } of targets) {
  const projectDir = join(projectsDir, id);
  if (!existsSync(join(projectDir, 'package.json'))) {
    console.error(`✗ ${id}: no package.json at ${projectDir}`);
    failed = true;
    continue;
  }

  console.log(`▸ building ${id}...`);
  const result = spawnSync('bun', ['run', 'build'], { cwd: projectDir, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`✗ ${id}: build failed`);
    failed = true;
    continue;
  }

  const dist = join(projectDir, 'dist');
  if (!existsSync(dist)) {
    console.error(`✗ ${id}: dist/ missing after build`);
    failed = true;
    continue;
  }

  const dest = join(portalPublic, id);
  rmSync(dest, { recursive: true, force: true });
  cpSync(dist, dest, { recursive: true });
  console.log(`✓ ${id} → public/games/${id}/`);
}

process.exit(failed ? 1 : 0);
