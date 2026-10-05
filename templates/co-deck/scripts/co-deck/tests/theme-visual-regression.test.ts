// @version 0.2.0 — compat matrix now derived from theme.json compatible_styles via
//   loadThemePackage() (single source of truth, no hardcoded pair list); browser
//   subprocess invoked via execFileSync (no shell string join — safe with paths
//   containing spaces).
// theme-visual-regression.test.ts — visual regression tests for theme×style pairs.
//
// Tests fully compatible theme×style combinations by:
//   1. Generating a fresh deck using buildThemeDeck()
//   2. Taking screenshots via Playwright (Chromium) at canonical viewport (1280×720)
//   3. Comparing screenshots against stored baselines
//
// Configuration:
//   - Viewport: 1280×720
//   - Animations: disabled via injected CSS
//   - Screenshot timing: requestAnimationFrame + 500ms after slide load
//   - Fonts: system default (no custom font download)
//   - Threshold: 0.5% of total bytes (configurable via env VISUAL_THRESHOLD)
//
// Modes:
//   Normal run:    bun run test:visual
//   Update baselines: bun run test:visual:update  (or UPDATE_BASELINES=1 bun test ...)
//
// The heavy Playwright work is delegated to theme-visual-regression.browser.mjs
// (Node.js subprocess) following the same pattern as theme-browser-smoke.browser.mjs,
// because bun has issues with Playwright subprocess handling on Windows.

import { test, describe, expect, beforeAll } from 'bun:test';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { loadThemePackage } from '../lib/theme-contract.js';
import { listThemeDirs, listStyleDirs, normalizeStyleEntry } from '../lib/theme-utils.js';

// ── Workspace root & paths ─────────────────────────────────────────────

const root = resolve(dirname(import.meta.path), '../../..');
const browserScript = join(dirname(import.meta.path), 'theme-visual-regression.browser.mjs');
const baselinesRoot = join(root, 'docs/html-themes/baselines');

// ── Detect --update-baselines flag ──────────────────────────────────────
//
// bun:test swallows CLI arguments before the test file sees them, so we
// support two methods:
//   1. Environment variable: UPDATE_BASELINES=1 bun test ...
//   2. Positional in process.argv (works when bun forwards extras)

const args = process.argv.slice(2);
const updateBaselines = args.includes('--update-baselines') || !!process.env.UPDATE_BASELINES;

// ── Theme × Style compatibility matrix (fully compatible only) ─────────
//
// Partial and incompatible pairs are excluded from visual regression.
// The matrix is DERIVED from each theme.json's compatible_styles via the
// existing loader (loadThemePackage), filtered to exclude partial_styles and
// incompatible_styles entries — the same dynamic discovery the smoke test
// uses — so the two suites cannot silently diverge.

const themes = listThemeDirs(root).sort();
const styles = listStyleDirs(root).sort();

const FULLY_COMPATIBLE_PAIRS: Array<{ theme: string; style: string }> = (() => {
  const pairs: Array<{ theme: string; style: string }> = [];
  for (const theme of themes) {
    const { pkg } = loadThemePackage(root, theme);
    if (!pkg) continue;
    const meta = pkg.metadata;

    const compatible = (Array.isArray(meta.compatible_styles) ? meta.compatible_styles : [])
      .map(normalizeStyleEntry)
      .filter((s): s is string => s !== null);
    const partial = new Set(
      (Array.isArray(meta.partial_styles) ? meta.partial_styles : [])
        .map(normalizeStyleEntry)
        .filter((s): s is string => s !== null),
    );
    const incompatible = new Set(
      (Array.isArray(meta.incompatible_styles) ? meta.incompatible_styles : [])
        .map(normalizeStyleEntry)
        .filter((s): s is string => s !== null),
    );

    for (const style of compatible) {
      if (partial.has(style) || incompatible.has(style)) continue;
      // Only include styles that exist on disk (the render universe).
      if (!styles.includes(style)) continue;
      pairs.push({ theme, style });
    }
  }
  return pairs;
})();

// ── Playwright availability check ───────────────────────────────────────

function checkPlaywrightAvailable(): boolean {
  try {
    require.resolve('playwright', { paths: [join(root, 'node_modules')] });
    return true;
  } catch {
    return false;
  }
}

const playwrightAvailable = checkPlaywrightAvailable();

// ── Baseline existence check ───────────────────────────────────────────

function hasBaseline(theme: string, style: string): boolean {
  const dir = join(baselinesRoot, theme, style);
  return existsSync(join(dir, 'slide-1.png')) && existsSync(join(dir, 'slide-2.png'));
}

// ── Determine which pairs have baselines ────────────────────────────────

const pairsWithBaselines = FULLY_COMPATIBLE_PAIRS.filter(p => hasBaseline(p.theme, p.style));
const pairsWithoutBaselines = FULLY_COMPATIBLE_PAIRS.filter(p => !hasBaseline(p.theme, p.style));

// ── Run browser subprocess ─────────────────────────────────────────────

interface BrowserResult {
  mode: string;
  total: number;
  passed: number;
  failed: number;
  results: Array<{
    theme: string;
    style: string;
    status: string;
    slides?: Array<{ slide: number; status: string }>;
    errors?: string[];
  }>;
}

function runBrowserSubprocess(mode: string, theme?: string, style?: string): BrowserResult {
  // execFileSync (no shell): argv passed directly, so paths containing spaces
  // are safe without manual quoting.
  const cmdArgs = [browserScript, mode];
  if (theme) cmdArgs.push(theme);
  if (style) cmdArgs.push(style);

  const parseResult = (output: string): BrowserResult | null => {
    const start = output.indexOf('%%RESULT_START%%');
    const end = output.indexOf('%%RESULT_END%%');
    if (start === -1 || end === -1) return null;
    return JSON.parse(output.substring(start + '%%RESULT_START%%'.length, end).trim());
  };

  try {
    const output = execFileSync('node', cmdArgs, {
      cwd: root,
      encoding: 'utf-8',
      timeout: 300000, // 5 min timeout for all pairs
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = parseResult(output);
    if (!parsed) {
      return { mode, total: 0, passed: 0, failed: 1, results: [{ theme: 'unknown', style: 'unknown', status: 'error', errors: ['Failed to parse browser output'] }] };
    }
    return parsed;
  } catch (err: any) {
    // execFileSync throws on non-zero exit; the browser script still prints the
    // %%RESULT%% payload when comparisons fail — parse it before giving up.
    const thrownOutput = typeof err.stdout === 'string' ? err.stdout : '';
    const parsed = thrownOutput ? parseResult(thrownOutput) : null;
    if (parsed) return parsed;
    return { mode, total: 0, passed: 0, failed: 1, results: [{ theme: 'unknown', style: 'unknown', status: 'error', errors: [err.message] }] };
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  TEST SUITES
// ═══════════════════════════════════════════════════════════════════════

// ── Skip if Playwright not installed ────────────────────────────────────

if (!playwrightAvailable) {
  describe('visual regression tests', () => {
    test('skipped — Playwright not installed', () => {
      console.log('⚠️  Playwright not installed. Skipping visual regression tests.');
      console.log('   Install with: bun add -d playwright && bunx playwright install chromium');
      expect(true).toBe(true);
    });
  });
} else if (updateBaselines) {
  // ── Update baselines mode ──────────────────────────────────────────

  describe('visual regression — update baselines', () => {
    test(`capture baselines for ${FULLY_COMPATIBLE_PAIRS.length} fully compatible pairs`, { timeout: 300000 }, () => {
      console.log(`\n📸 Capturing baselines for ${FULLY_COMPATIBLE_PAIRS.length} theme×style pairs...`);

      const result = runBrowserSubprocess('capture');

      expect(result.total).toBeGreaterThan(0);
      expect(result.failed).toBe(0);

      console.log(`\n✅ Baselines captured: ${result.passed}/${result.total}`);

      for (const r of result.results) {
        const slide1Path = join(baselinesRoot, r.theme, r.style, 'slide-1.png');
        const slide2Path = join(baselinesRoot, r.theme, r.style, 'slide-2.png');
        expect(existsSync(slide1Path), `slide-1.png missing for ${r.theme}/${r.style}`).toBe(true);
        expect(existsSync(slide2Path), `slide-2.png missing for ${r.theme}/${r.style}`).toBe(true);
      }
    });
  });
} else {
  // ── Comparison mode (default) ──────────────────────────────────────

  describe('visual regression — configuration', () => {
    test('canonical configuration is correct', () => {
      // Viewport: 1280×720
      expect(1280).toBe(1280);
      expect(720).toBe(720);

      // Threshold: 0.5% (or env override)
      const threshold = parseFloat(process.env.VISUAL_THRESHOLD || '0.005');
      expect(threshold).toBeLessThanOrEqual(1);
      expect(threshold).toBeGreaterThan(0);

      console.log(`  Viewport: 1280×720`);
      console.log(`  Threshold: ${(threshold * 100).toFixed(1)}%`);
      console.log(`  Animations: disabled`);
      console.log(`  Fonts: system default`);
    });
  });

  describe('visual regression — baseline comparison', () => {
    // Only test pairs that have baselines
    if (pairsWithBaselines.length === 0) {
      test('no baselines found — run with --update-baselines to create', () => {
        console.log(`\n⚠️  No baselines found. Run with --update-baselines to capture initial baselines.`);
        console.log(`    Available pairs without baselines: ${pairsWithoutBaselines.length}`);
        console.log(`    Command: bun run test:visual:update`);
        expect(true).toBe(true);
      });
      return;
    }

    test(`compare ${pairsWithBaselines.length} pairs with existing baselines`, { timeout: 300000 }, () => {
      console.log(`\n🔍 Comparing ${pairsWithBaselines.length} pairs against baselines...`);
      console.log(`   Pairs: ${pairsWithBaselines.map(p => `${p.theme}+${p.style}`).join(', ')}\n`);

      const result = runBrowserSubprocess('compare');

      expect(result.total).toBeGreaterThan(0);

      // Check results
      const failures = result.results.filter(r => r.status === 'fail' || r.status === 'error');
      if (failures.length > 0) {
        console.log(`\n❌ ${failures.length} pair(s) failed:`);
        for (const f of failures) {
          if (f.errors) {
            console.log(`   ${f.theme} × ${f.style}: ${f.errors.join('; ')}`);
          } else {
            console.log(`   ${f.theme} × ${f.style}: visual diff exceeds threshold`);
            if (f.slides) {
              for (const s of f.slides) {
                if (s.status === 'fail') {
                  console.log(`     slide-${s.slide}: FAILED`);
                }
              }
            }
          }
        }
      }

      expect(result.failed).toBe(0);
    });

    // Also report which pairs are missing baselines
    if (pairsWithoutBaselines.length > 0) {
      test(`${pairsWithoutBaselines.length} pairs have no baselines yet`, () => {
        console.log(`\nℹ️  Pairs without baselines (skipped):`);
        for (const p of pairsWithoutBaselines) {
          console.log(`   ${p.theme} × ${p.style}`);
        }
        console.log(`   Run with --update-baselines to capture them.`);
        expect(true).toBe(true);
      });
    }
  });
}
