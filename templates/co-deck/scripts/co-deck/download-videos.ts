#!/usr/bin/env bun
// @version 1.1.0
// v1.1.0 (2026-11-16, spec docs/designs/2026-11-16-quickdl-external-design.md): QuickDL becomes a declared external (templates/co-deck/external-deps.json, id `quickdl`, pin v1.0.0, MIT) and this script is its single adapter — resolution order --quickdl-dir > CDK_QUICKDL_DIR > <project root>/external/quickdl > legacy ~/git/project/QuickDL; python from <dir>/.venv or CDK_QUICKDL_PYTHON; downloads staged in an OS temp dir (the clone is never written to); new `selftest` mode for the manifest compatibility_test.
// v1.0.1 (2026-11-15, spec docs/designs/2026-11-15-co-deck-deliverables-migration-design.md): doc-only — usage comments and path constants follow the fleet's deliverables/ consolidation (presentations/ → deliverables/); no logic change.
// download-videos.ts — offline video fetch for lecture decks (U-20261105-007).
//
// TypeScript port of the 2026-10-ai-industry-research engagement's
// download_all_videos.py (ADR-0036: template tooling is TypeScript). Reads the
// deck's slidedata.json, collects every `videoId`, and downloads
// `yt-<videoId>.mp4` into the shared video pool so the offline play-mode
// fallback of inject-video-players.ts can resolve a local file.
//
// Download engine: the QuickDL CLI — a declared external (external-deps.json id
// `quickdl`, installed by `bun scripts/external-deps.ts install --id quickdl`).
// This file is its only adapter. Resolution order: `--quickdl-dir <dir>` >
// `CDK_QUICKDL_DIR` > `<project root>/external/quickdl` > legacy
// `~/git/project/QuickDL`. Python: `<dir>/.venv/bin/python`, else
// `CDK_QUICKDL_PYTHON`. One-time setup after install:
//   python3 -m venv external/quickdl/.venv && external/quickdl/.venv/bin/pip install -r external/quickdl/requirements.txt
// Downloads are staged in an OS temp dir, so the read-only clone is never
// written to. If QuickDL is missing, every needed video already exists locally,
// or `--check-only` is passed, no download is attempted.
// `bun scripts/co-deck/download-videos.ts selftest` checks the resolved clone
// (cli.py, requirements.txt, MIT LICENSE) — the manifest compatibility_test.
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
//      `deliverables/assets/videos/yt-<id>.mp4` (the injector's default
//      assets root), never inside the project folder.
//
// Usage:
//   bun scripts/co-deck/download-videos.ts --project deliverables/<project>
//       [--slidedata <path>] [--assets-dir <dir>] [--quickdl-dir <dir>]
//       [--check-only] [--force]
//     --slidedata   slidedata SSOT (default: <project>/slidedata.json)
//     --assets-dir  video pool root (default: <project>/../assets/videos)
//     --check-only  report which videos are missing without downloading
//     --force       re-download even when a local file already exists

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, statSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
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

const scriptDir = resolve(dirname(import.meta.path));
const workspaceRoot = resolve(scriptDir, '../..');

// ── QuickDL resolution (single adapter for the `quickdl` external) ───────────
function resolveQuickdlDir(): string {
  if (argValue('--quickdl-dir')) return resolve(workspaceRoot, argValue('--quickdl-dir')!);
  if (process.env.CDK_QUICKDL_DIR) return resolve(process.env.CDK_QUICKDL_DIR);
  const external = join(workspaceRoot, 'external', 'quickdl');
  if (existsSync(join(external, 'cli.py'))) return external;
  return join(homedir(), 'git', 'project', 'QuickDL');
}
function resolveQuickdlPython(dir: string): string {
  const venv = join(dir, '.venv', 'bin', 'python');
  if (existsSync(venv)) return venv;
  return process.env.CDK_QUICKDL_PYTHON ? resolve(process.env.CDK_QUICKDL_PYTHON) : venv;
}

if (process.argv[2] === 'selftest') {
  const dir = resolveQuickdlDir();
  const problems: string[] = [];
  if (!existsSync(join(dir, 'cli.py'))) problems.push('cli.py missing');
  if (!existsSync(join(dir, 'requirements.txt'))) problems.push('requirements.txt missing');
  const lic = join(dir, 'LICENSE');
  if (!existsSync(lic) || !readFileSync(lic, 'utf-8').startsWith('MIT License')) problems.push('LICENSE is not MIT');
  if (problems.length) {
    console.error(`download-videos selftest: FAIL at ${dir} — ${problems.join('; ')}`);
    process.exit(1);
  }
  const py = resolveQuickdlPython(dir);
  console.log(`download-videos selftest: OK — QuickDL at ${dir}${existsSync(py) ? '' : ' (python not set up yet: see setup note in the header)'}`);
  process.exit(0);
}

const projectArg = argValue('--project');
if (!projectArg) {
  console.error('Usage: bun scripts/co-deck/download-videos.ts --project deliverables/<project> [--slidedata <path>] [--assets-dir <dir>] [--quickdl-dir <dir>] [--check-only] [--force]');
  process.exit(1);
}

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
const quickdlDir = resolveQuickdlDir();
const quickdlPython = resolveQuickdlPython(quickdlDir);
const quickdlCli = join(quickdlDir, 'cli.py');

if (!existsSync(quickdlPython) || !existsSync(quickdlCli)) {
  console.error(`download-videos: QuickDL not found at ${quickdlDir} (need cli.py + a python with its requirements).`);
  console.error('  Install it with `bun scripts/external-deps.ts install --id quickdl`, set up its venv (see header), or point to a clone via --quickdl-dir / CDK_QUICKDL_DIR (python: CDK_QUICKDL_PYTHON).');
  console.error(`  ${pending.length} video(s) remain missing: ${pending.map((id) => `yt-${id}`).join(', ')}`);
  process.exit(1);
}

mkdirSync(assetsDir, { recursive: true });
const quickdlTmp = mkdtempSync(join(tmpdir(), 'cdk-quickdl-'));

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
    try {
      renameSync(join(quickdlTmp, mp4s[0]), dest);
    } catch {
      // temp dir may sit on another filesystem (EXDEV) — copy then remove
      copyFileSync(join(quickdlTmp, mp4s[0]), dest);
      rmSync(join(quickdlTmp, mp4s[0]));
    }
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

try { rmSync(quickdlTmp, { recursive: true, force: true }); } catch { /* best effort */ }

console.log(`download-videos: done — ${ok} downloaded, ${videoIds.length - pending.length} already present, ${failed.length} failed`);
if (failed.length > 0) {
  console.error(`  failed: ${failed.map((id) => `yt-${id}`).join(', ')} (inject-video-players keeps the YouTube fallback for these)`);
  process.exit(2);
}
process.exit(0);
