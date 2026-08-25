// @version 0.1.0
// watch-deck.ts — live-reload authoring loop for theme deck builds.
//
// Runs an initial build, then watches the project directory for changes
// to .md, .json, .css, .html, .js, .ts files and triggers rebuilds.
// Debounced (300ms default) to avoid rebuild storms during save bursts.
// Survives build errors — continues watching so authoring loop isn't broken.
//
// Usage:
//   bun scripts/co-deck/watch-deck.ts --project presentations/<project>
//   bun scripts/co-deck/watch-deck.ts --project presentations/<project> --slide-data path/to/data.json
//   bun scripts/co-deck/watch-deck.ts --project presentations/<project> --output output.html --interval 500
//   bun scripts/co-deck/watch-deck.ts --project presentations/<project> --once
//
// Flags:
//   --project    (required) path to project directory
//   --slide-data optional path to slidedata.json (default: <project>/slidedata.json)
//   --output     optional output HTML path (default: <project>/lecture_v1.html)
//   --interval   debounce interval in ms (default: 300, min: 100)
//   --once       run single build and exit (for CI/testing)

import * as fs from 'fs';
import { existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { resolveWorkspaceRoot, getCliArg } from './lib/theme-utils.js';

// Resolve workspace root — this file is at scripts/co-deck/watch-deck.ts (2 levels up).
const ROOT = resolveWorkspaceRoot(import.meta.path);

// --- Types ---

interface WatchOptions {
  project: string;
  slideData?: string;
  output?: string;
  interval: number;
  once: boolean;
}

// --- CLI parsing ---

function parseArgs(): WatchOptions {
  const projectArg = getCliArg('--project');
  const slideDataArg = getCliArg('--slide-data');
  const outputArg = getCliArg('--output');
  const intervalArg = getCliArg('--interval') || '300';
  const onceFlag = process.argv.includes('--once');

  if (!projectArg) {
    console.error('Error: --project <path> is required');
    console.error('Usage: bun scripts/co-deck/watch-deck.ts --project presentations/<project>');
    process.exit(1);
  }

  const projectPath = resolve(ROOT, projectArg);
  if (!existsSync(projectPath)) {
    console.error(`Error: project directory does not exist: ${projectPath}`);
    process.exit(1);
  }

  const interval = Math.max(100, parseInt(intervalArg, 10));
  if (isNaN(interval)) {
    console.error(`Error: --interval must be a number (got: ${intervalArg})`);
    process.exit(1);
  }

  return {
    project: projectPath,
    slideData: slideDataArg ? resolve(ROOT, slideDataArg) : undefined,
    output: outputArg ? resolve(ROOT, outputArg) : undefined,
    interval,
    once: onceFlag,
  };
}

// --- Build runner ---

function runBuild(options: WatchOptions): { exitCode: number; stdout: string; stderr: string } {
  const buildScript = resolve(dirname(import.meta.path), 'build-theme-deck.ts');
  const args = ['bun', buildScript, '--project', options.project];

  if (options.slideData) {
    args.push('--slide-data', options.slideData);
  }
  if (options.output) {
    args.push('--output', options.output);
  }

  // Use Bun.spawn with buffered output
  const proc = Bun.spawnSync(args);

  const stdout = proc.stdout.toString();
  const stderr = proc.stderr.toString();
  const exitCode = proc.exitCode || 0;

  return { exitCode, stdout, stderr };
}

// --- Once mode (single build) ---

function runOnce(options: WatchOptions): void {
  const result = runBuild(options);
  process.stdout.write(result.stdout);
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exit(result.exitCode);
}

// --- Watch mode ---

function getWatchExtensions(): string[] {
  return ['.md', '.json', '.css', '.html', '.js', '.ts'];
}

async function watchMode(options: WatchOptions): Promise<void> {
  const watchedPath = options.project;
  const watchedPathLower = watchedPath.toLowerCase();
  const outputPathLower = (options.output || join(options.project, 'lecture_v1.html')).toLowerCase();

  console.log(`[watch] watching: ${watchedPath}`);
  console.log(`[watch] debounce: ${options.interval}ms`);
  console.log(`[watch] Press Ctrl+C to stop.`);

  let buildCount = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const buildAndReport = (): void => {
    buildCount++;
    const startTime = Date.now();
    const result = runBuild(options);
    const elapsed = Date.now() - startTime;
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });

    if (result.exitCode === 0) {
      const outputHint = options.output || '<project>/lecture_v1.html';
      console.log(`[watch] rebuild #${buildCount} - ${timeStr} - exit ${result.exitCode} - ${outputHint} (${elapsed}ms)`);
    } else {
      console.error(`[watch] rebuild #${buildCount} - ${timeStr} - exit ${result.exitCode} - BUILD FAILED (${elapsed}ms)`);
      if (result.stderr) {
        process.stderr.write(result.stderr);
      }
      console.log('[watch] continuing to watch despite build error...');
    }
  };

  // Initial build
  buildAndReport();

  // Setup SIGINT handler
  process.on('SIGINT', () => {
    console.log('[watch] stopped.');
    process.exit(0);
  });

  // Watch implementation with recursive/fallback support
  const targetExtensions = getWatchExtensions();

  // Shared event handler: filter by extension, ignore the builder's own output, debounce.
  const onWatchEvent = (baseDir: string, filename: string | null): void => {
    if (!filename) return;

    const filepath = resolve(baseDir, filename);
    const filepathLower = filepath.toLowerCase();

    // Ignore output file events to avoid rebuild loop
    if (filepathLower === outputPathLower) {
      return;
    }

    // Check if file has watched extension
    const hasExtension = targetExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
    if (!hasExtension) {
      return;
    }

    // Debounce
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(buildAndReport, options.interval);
  };

  try {
    // Try recursive watch first
    fs.watch(watchedPath, { recursive: true }, (_event, filename) => {
      onWatchEvent(watchedPath, filename);
    });

    console.log('[watch] mode: recursive');

    // Keep process alive
    await new Promise<void>(() => {});
  } catch (err) {
    if ((err as any).message?.includes('recursive')) {
      console.log('[watch] mode: fallback (non-recursive, per-subdirectory)');

      // Fallback: non-recursive watch on the project dir and every nested subdirectory.
      const watchedDirs: string[] = [];
      const walkDirs = (dir: string): void => {
        watchedDirs.push(dir);
        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return; // Unreadable dir: watch what we have so far
        }
        for (const entry of entries) {
          if (entry.isDirectory()) {
            walkDirs(resolve(dir, entry.name));
          }
        }
      };
      walkDirs(watchedPath);

      for (const dir of watchedDirs) {
        try {
          fs.watch(dir, (_event, filename) => {
            onWatchEvent(dir, filename);
          });
        } catch {
          // Skip directories that can't be watched
        }
      }

      // Keep process alive
      await new Promise<void>(() => {});
    } else {
      throw err;
    }
  }
}

// --- Main ---

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.once) {
    runOnce(options);
  } else {
    await watchMode(options);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
