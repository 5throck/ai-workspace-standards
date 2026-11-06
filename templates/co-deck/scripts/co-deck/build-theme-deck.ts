// @version 0.2.1
// build-theme-deck.ts — CLI wrapper for deterministic theme deck builder.
//
// Reads a project's lecture-profile.md for theme/style/title,
// reads slidedata.json (or --slide-data path), calls buildThemeDeck(),
// and writes the output HTML file.
//
// U-20261105-007: after a successful build the video pipeline runs in the
// documented order — build → (optional --download-videos) → inject-video-players
// — so a rebuild can no longer silently drop the video players. The injector is
// idempotent (marker-based), so running it on every build is always safe.
//
// Usage:
//   bun scripts/co-deck/build-theme-deck.ts --project presentations/<project>
//   bun scripts/co-deck/build-theme-deck.ts --project presentations/<project> --slide-data path/to/data.json
//   bun scripts/co-deck/build-theme-deck.ts --project presentations/<project> --output output.html --version v2
//   bun scripts/co-deck/build-theme-deck.ts --project presentations/<project> --download-videos

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { spawnSync } from 'child_process';
import { buildThemeDeck } from './lib/theme-builder.js';
import { getCliArg, resolveWorkspaceRoot } from './lib/theme-utils.js';
import { readJson } from './lib/theme-utils.js';

// Resolve workspace root — this file is at scripts/co-deck/build-theme-deck.ts (2 levels up).
const ROOT = resolveWorkspaceRoot(import.meta.path);

function parseYamlFrontmatter(content: string): Record<string, any> {
  // Split on --- delimiters, take the block between the first two --- lines.
  const lines = content.split('\n');
  const startIdx = lines.findIndex((l) => l.trim() === '---');
  if (startIdx < 0) return {};
  const endIdx = lines.indexOf('---', startIdx + 1);
  if (endIdx < 0) return {};
  const yamlBlock = lines.slice(startIdx + 1, endIdx).join('\n');

  // Simple YAML parser: handles top-level key: value and nested structures
  // using 2-space indentation. No arrays, no multi-line strings needed here.
  const result: Record<string, any> = {};
  const stack: { obj: Record<string, any>; indent: number }[] = [
    { obj: result, indent: -1 },
  ];

  for (const line of yamlBlock.split('\n')) {
    if (!line.trim()) continue;
    const indent = line.search(/\S/);
    const match = line.match(/^(\s*)([\w._-]+):\s*(.*)$/);
    if (!match) continue;

    const keyIndent = match[1].length;
    const key = match[2].trim();
    let value = match[3].trim();

    // Pop stack to find the correct parent level
    while (stack.length > 1 && stack[stack.length - 1].indent >= keyIndent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    // Parse value
    if (value === '' || value === '|' || value === '>') {
      // Nested object follows
      const newObj: Record<string, any> = {};
      parent[key] = newObj;
      stack.push({ obj: newObj, indent: keyIndent });
    } else if (value === 'true') {
      parent[key] = true;
    } else if (value === 'false') {
      parent[key] = false;
    } else if (/^-?\d+$/.test(value)) {
      parent[key] = parseInt(value, 10);
    } else if (/^-?\d+\.\d+$/.test(value)) {
      parent[key] = parseFloat(value);
    } else if (value.startsWith('"') && value.endsWith('"')) {
      parent[key] = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      parent[key] = value.slice(1, -1);
    } else {
      parent[key] = value;
    }
  }

  return result;
}

function main(): void {
  // Parse CLI args
  const projectArg = getCliArg('--project');
  const slideDataArg = getCliArg('--slide-data');
  const outputArg = getCliArg('--output');
  const versionArg = getCliArg('--version');

  if (!projectArg) {
    console.error('Error: --project <path> is required');
    console.error('Usage: bun build-theme-deck.ts --project presentations/<project>');
    process.exit(1);
  }

  // Resolve project path relative to workspace root if not absolute
  const projectPath = resolve(ROOT, projectArg);

  // Read lecture-profile.md
  const profilePath = join(projectPath, 'lecture-profile.md');
  if (!existsSync(profilePath)) {
    console.error(`Error: lecture-profile.md not found at ${profilePath}`);
    process.exit(1);
  }

  const profileContent = readFileSync(profilePath, 'utf-8');
  const frontmatter = parseYamlFrontmatter(profileContent);

  // Extract presentation config
  const presentation = frontmatter.presentation || {};
  const theme = presentation.theme;
  const style = presentation.style;
  const tocStyle = presentation.tocStyle;
  const title = presentation.title || '';

  if (!theme) {
    console.error('Error: presentation.theme not found in lecture-profile.md');
    process.exit(1);
  }
  if (!style) {
    console.error('Error: presentation.style not found in lecture-profile.md');
    process.exit(1);
  }

  // Read slide data
  let slideDataPath = slideDataArg
    ? resolve(ROOT, slideDataArg)
    : join(projectPath, 'slidedata.json');

  if (!existsSync(slideDataPath)) {
    console.error(`Error: slide data not found at ${slideDataPath}`);
    process.exit(1);
  }

  const slideData = readJson<any[]>(slideDataPath);
  if (!slideData || !Array.isArray(slideData)) {
    console.error(`Error: slide data at ${slideDataPath} is not a valid JSON array`);
    process.exit(1);
  }

  // Build the deck
  const result = buildThemeDeck({
    root: ROOT,
    projectPath,
    theme,
    style,
    tocStyle,
    title,
    slideData,
    outputPath: outputArg ? resolve(ROOT, outputArg) : undefined,
    version: versionArg,
  });

  // Report errors
  for (const w of result.warnings) {
    console.warn(`WARNING: ${w}`);
  }
  for (const e of result.errors) {
    console.error(`ERROR: ${e}`);
  }

  if (result.errors.length > 0) {
    process.exit(1);
  }

  // Write output
  writeFileSync(result.outputPath, result.html, 'utf-8');
  console.log(`Built: ${result.outputPath}`);

  runVideoPipeline(projectPath, slideDataPath, result.outputPath, slideData);
}

// ── Video pipeline (U-20261105-007): build → (download) → inject ─────────────

function runVideoPipeline(projectPath: string, slideDataPath: string, outputPath: string, slideData: any[]): void {
  const scriptDir = dirname(import.meta.path);

  // Optional offline pre-fetch — runs BEFORE injection so the injector can bind
  // local mp4 fallbacks for the videos it just downloaded.
  if (process.argv.includes('--download-videos')) {
    const args = ['scripts/co-deck/download-videos.ts', '--project', projectPath, '--slidedata', slideDataPath];
    const res = spawnSync('bun', args, { encoding: 'utf-8', cwd: resolve(scriptDir, '../..') });
    if (res.status === 0) {
      console.log('download-videos: offline videos ready');
    } else if (res.status === 2) {
      // Per-item download failures — non-fatal, the injector keeps YouTube fallbacks.
      console.warn('WARNING: download-videos reported failed downloads; affected slides fall back to the YouTube play mode');
    } else {
      console.error(`ERROR: download-videos failed (exit ${res.status})`);
      if (res.stderr) console.error(res.stderr.trim());
      process.exit(1);
    }
  }

  // Post-build injection — skip cleanly when no slide carries a videoId so
  // video-less decks are untouched.
  const hasVideos = Array.isArray(slideData) && slideData.some((s) => s && typeof s === 'object' && typeof s.videoId === 'string' && s.videoId);
  if (!hasVideos) return;

  // The injector path lives on its own line: validate-variant-claims check [p]
  // walks every quoted segment of a script-dir-anchored join/resolve call, so
  // a join() line must carry only path segments (no CLI args).
  const injectScript = join(scriptDir, 'inject-video-players.ts');
  const res = spawnSync('bun', [injectScript, outputPath, '--slidedata', slideDataPath], { encoding: 'utf-8' });
  if (res.status === 0) {
    console.log('inject-video-players: players injected after build (idempotent — re-run always safe)');
  } else {
    // The deck itself is valid; a failed injection is loudly reported but does
    // not discard the build. The injector can be re-run manually at any time.
    console.warn(`WARNING: inject-video-players exited ${res.status} — players not injected, re-run: bun scripts/co-deck/inject-video-players.ts ${outputPath} --slidedata ${slideDataPath}`);
    if (res.stderr) console.warn(res.stderr.trim());
  }
}

main();
