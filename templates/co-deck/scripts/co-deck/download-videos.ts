#!/usr/bin/env bun
// @version 1.0.0
// download-videos.ts — offline video fetch for lecture decks (U-20261105-007).
//
// TypeScript port of the 2026-10-ai-industry-research engagement's
// download_all_videos.py (ADR-0036: template tooling is TypeScript). Reads the
// deck's slidedata.json, collects every `videoId`, and downloads
// `yt-<videoId>.mp4` into the shared video pool so the offline play-mode
// fallback of inject-video-players.ts can resolve a local file.
//
// Download engine: the QuickDL CLI (external optional tool). Configure with
// `--quickdl-dir <dir>` or the `CDK_QUICKDL_DIR` environment variable; default
// is `~/git/project/QuickDL`. QuickDL must contain `cli.py` and a `.venv`
// python. If QuickDL is missing, every needed video already exists locally, or
// `--check-only` is passed, no download is attempted.
//
// Contract:
//   1. IDEMPOTENT — a destination file larger than MIN_VALID_BYTES is skipped;
//      re-running never re-downloads a good file.
//   2. Per-item failure tolerance — one failed video does not abort the rest;
//      the summary reports failures. Exit codes:
//      0 = all videos present (downloaded or skipped); 1 = fatal (bad args,
//      missing slidedata, QuickDL missing while downloads are needed);
//      2 = at least one download failed (caller may WARN and continue — the
//      injector keeps the YouTube fallback for missed files).
//   3. Portable output — videos land in the shared pool
//      `presentations/assets/videos/yt-<id>.mp4` (the injector's default
//      assets root), never inside the project folder.
//
// Usage:
//   bun scripts/co-deck/download-videos.ts --project presentations/<project>
//       [--slidedata <path>] [--assets-dir <dir>] [--quickdl-dir <dir>]
//       [--check-only] [--force]
//     --slidedata   slidedata SSOT (default: <project>/slidedata.json)
//     --assets-dir  video pool root (default: <project>/../assets/videos)
//     --check-only  report which videos are missing without downloading
//     --force       re-download even when a local file already exists

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, normalize, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const MIN_VALID_BYTES = 100_000;

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const projectArg = argValue('--project');
if (!projectArg) {
  console.error('Usage: bun scripts/co-deck/download-videos.ts --project presentations/<project> [--slidedata <path>] [--assets-dir <dir>] [--quickdl-dir <dir>] [--check-only] [--force]');
  process.exit(1);
}

const scriptDir = resolve(dirname(import.meta.path));
const workspaceRoot = resolve(scriptDir, '../..');
const projectPath = resolve(workspaceRoot, projectArg);

const slidedataPath = argValue('--slidedata') ? resolve(workspaceRoot, argValue('--slidedata')!) : join(projectPath, 'slidedata.json');
if (!existsSync(slidedataPath)) {
  console.error(`download-videos: slidedata not found at ${slidedataPath}`);
  process.exit(1);
}
const slides: Array<Record<string, unknown>> = JSON.parse(readFileSync(slidedataPath, 'utf-8'));

const assetsDir = argValue('--assets-dir')
  ? resolve(workspaceRoot, argValue('--assets-dir')!)
  : normalize(join(projectPath, '..', 'assets', 'videos'));

// Collect unique videoIds in slide order (a video may appear on several slides).
const videoIds: string[] = [];
for (const s of slides) {
  const id = s?.videoId;
  if (typeof id === 'string' && id && !videoIds.includes(id)) videoIds.push(id);
}

console.log(`download-videos: ${videoIds.length} unique video(s) referenced by ${projectArg}`);
if (videoIds.length === 0) {
  console.log('download-videos: nothing to do — no videoId in slidedata');
  process.exit(0);
}

const destFor = (id: string) => join(assetsDir, `yt-${id}.mp4`);
const pending = videoIds.filter((id) => {
  if (hasFlag('--force')) return true;
  const p = destFor(id);
  return !existsSync(p) || statSync(p).size <= MIN_VALID_BYTES;
});

if (hasFlag('--check-only')) {
  for (const id of videoIds) {
    const p = destFor(id);
    const ok = existsSync(p) && statSync(p).size > MIN_VALID_BYTES;
    console.log(`  ${ok ? 'OK  ' : 'MISS'} yt-${id}.mp4`);
  }
  console.log(`download-videos: ${pending.length} missing, ${videoIds.length - pending.length} present (--check-only, nothing downloaded)`);
  process.exit(0);
}

if (pending.length === 0) {
  console.log(`download-videos: all ${videoIds.length} video(s) already present in ${assetsDir}`);
  process.exit(0);
}

// ── QuickDL resolution ────────────────────────────────────────────────────────
const quickdlDir = argValue('--quickdl-dir')
  ? resolve(workspaceRoot, argValue('--quickdl-dir')!)
  : process.env.CDK_QUICKDL_DIR
    ? resolve(process.env.CDK_QUICKDL_DIR)
    : join(homedir(), 'git', 'project', 'QuickDL');
const quickdlPython = join(quickdlDir, '.venv', 'bin', 'python');
const quickdlCli = join(quickdlDir, 'cli.py');
const quickdlTmp = join(quickdlDir, 'downloads');

if (!existsSync(quickdlPython) || !existsSync(quickdlCli)) {
  console.error(`download-videos: QuickDL not found at ${quickdlDir} (need cli.py + .venv/bin/python).`);
  console.error('  Install/point it via --quickdl-dir <dir> or the CDK_QUICKDL_DIR environment variable.');
  console.error(`  ${pending.length} video(s) remain missing: ${pending.map((id) => `yt-${id}`).join(', ')}`);
  process.exit(1);
}

mkdirSync(assetsDir, { recursive: true });
if (!existsSync(quickdlTmp)) mkdirSync(quickdlTmp, { recursive: true });

let ok = 0;
const failed: string[] = [];
for (const [i, id] of pending.entries()) {
  const dest = destFor(id);
  console.log(`  [${i + 1}/${pending.length}] downloading ${id}`);
  const res = spawnSync(quickdlPython, [quickdlCli, `https://www.youtube.com/watch?v=${id}`, '--output', quickdlTmp], {
    encoding: 'utf-8',
    timeout: 600_000,
  });
  // Pick the most recently modified mp4 in the QuickDL staging dir.
  const mp4s = existsSync(quickdlTmp)
    ? readdirSync(quickdlTmp).filter((f) => f.endsWith('.mp4')).sort((a, b) => statSync(join(quickdlTmp, b)).mtimeMs - statSync(join(quickdlTmp, a)).mtimeMs)
    : [];
  if (res.status === 0 && mp4s.length > 0) {
    renameSync(join(quickdlTmp, mp4s[0]), dest);
    // Clean residual staging files (m4a, fxxx partials) for this id.
    for (const f of readdirSync(quickdlTmp)) {
      if (f.includes(id)) {
        try { rmSync(join(quickdlTmp, f)); } catch { /* best effort */ }
      }
    }
    console.log(`    -> yt-${id}.mp4 (${Math.round(statSync(dest).size / 1024 / 1024)}MB)`);
    ok++;
  } else {
    failed.push(id);
    console.error(`    -> FAILED ${id}`);
  }
}

console.log(`download-videos: done — ${ok} downloaded, ${videoIds.length - pending.length} already present, ${failed.length} failed`);
if (failed.length > 0) {
  console.error(`  failed: ${failed.map((id) => `yt-${id}`).join(', ')} (inject-video-players keeps the YouTube fallback for these)`);
  process.exit(2);
}
process.exit(0);
