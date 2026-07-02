// theme-browser-smoke.test.ts — compatibility matrix tests (builder-side).
//
// This file covers:
//   1. Incompatible theme×style pairs: verify buildThemeDeck() rejects them
//   2. Compatible/partial pairs: verify buildThemeDeck() produces valid HTML
//   3. Compatibility matrix summary
//
// Browser smoke tests (Playwright) are in theme-browser-smoke.browser.mjs,
// run via Node.js because bun has issues with Playwright subprocess handling.
//
// Run all smoke tests:
//   bun run test:smoke
// Run only builder tests:
//   bun test scripts/co-deck/tests/theme-browser-smoke.test.ts
// Run only browser tests:
//   node scripts/co-deck/tests/theme-browser-smoke.browser.mjs

import { test, describe, expect } from 'bun:test';
import { buildThemeDeck } from '../lib/theme-builder.js';
import { loadThemePackage } from '../lib/theme-contract.js';
import {
  listThemeDirs,
  listStyleDirs,
} from '../lib/theme-utils.js';
import { existsSync, mkdirSync, readdirSync, rmSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';

// ── Workspace root & paths ─────────────────────────────────────────────

// tests/ is 3 levels deep from workspace root (scripts/co-deck/tests/).
const root = resolve(dirname(import.meta.path), '../../..');
const slideDataPath = join(dirname(import.meta.path), 'fixtures', 'theme-deck', 'slide-data.json');
const smokeProjectDir = join(root, 'presentations', '_smoke_test');

// Read fixture slide data
const SLIDE_DATA = JSON.parse(readFileSync(slideDataPath, 'utf-8')) as any[];

// ── Compatibility matrix discovery ────────────────────────────────────

const themes = listThemeDirs(root).sort();
const styles = listStyleDirs(root).sort();

interface MatrixEntry {
  theme: string;
  style: string;
  status: 'compatible' | 'partial' | 'incompatible';
  reason?: string;
}

function discoverMatrix(): MatrixEntry[] {
  const result: MatrixEntry[] = [];
  for (const theme of themes) {
    const { pkg } = loadThemePackage(root, theme);
    if (!pkg) continue;
    const meta = pkg.metadata;

    for (const style of styles) {
      // Check incompatible
      if (Array.isArray(meta.incompatible_styles)) {
        const match = meta.incompatible_styles.find(
          (e: any) => (typeof e === 'string' ? e : e.name) === style,
        );
        if (match) {
          result.push({
            theme,
            style,
            status: 'incompatible',
            reason: typeof match === 'object' && match.reason ? match.reason : undefined,
          });
          continue;
        }
      }

      // Check partial
      if (Array.isArray(meta.partial_styles)) {
        const match = meta.partial_styles.find(
          (e: any) => (typeof e === 'string' ? e : e.name) === style,
        );
        if (match) {
          result.push({
            theme,
            style,
            status: 'partial',
            reason: typeof match === 'object' && match.reason ? match.reason : undefined,
          });
          continue;
        }
      }

      // Otherwise compatible
      result.push({ theme, style, status: 'compatible' });
    }
  }
  return result;
}

const matrix = discoverMatrix();

// ── Ensure smoke project dir exists ────────────────────────────────────

if (!existsSync(smokeProjectDir)) {
  mkdirSync(smokeProjectDir, { recursive: true });
}

// ── Incompatible pairs: builder rejection ─────────────────────────────

describe('incompatible theme×style pairs — builder rejection', () => {
  const incompatible = matrix.filter((e) => e.status === 'incompatible');

  if (incompatible.length === 0) {
    test('no incompatible pairs found', () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const entry of incompatible) {
    test(`should reject ${entry.theme} + ${entry.style}`, () => {
      const result = buildThemeDeck({
        root,
        projectPath: smokeProjectDir,
        theme: entry.theme,
        style: entry.style,
        title: `Smoke ${entry.theme} ${entry.style}`,
        slideData: SLIDE_DATA,
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('incompatible'))).toBe(true);
      expect(result.html).toBe('');
    });
  }
});

// ── Compatible/partial pairs: builder produces valid HTML ────────────

describe('compatible/partial theme×style pairs — builder produces HTML', () => {
  const compatibleAndPartial = matrix.filter(
    (e) => e.status === 'compatible' || e.status === 'partial',
  );

  for (const entry of compatibleAndPartial) {
    const statusLabel = entry.status === 'partial' ? ' [PARTIAL]' : '';
    test(`${entry.theme} + ${entry.style}${statusLabel}`, () => {
      const result = buildThemeDeck({
        root,
        projectPath: smokeProjectDir,
        theme: entry.theme,
        style: entry.style,
        title: `Smoke ${entry.theme} ${entry.style}`,
        slideData: SLIDE_DATA,
        outputPath: join(smokeProjectDir, `smoke_${entry.theme}_${entry.style}.html`),
      });

      // Builder should succeed (partial pairs have warnings, not errors)
      expect(result.errors).toHaveLength(0);
      expect(result.html).not.toBe('');
      expect(result.outputPath).toContain(`smoke_${entry.theme}_${entry.style}.html`);

      // Verify key HTML content
      expect(result.html).toContain('<title>');
      expect(result.html).toContain('const slideData =');

      // Verify data-theme and data-style attributes
      expect(result.html).toContain(`data-theme="${entry.theme}"`);
      expect(result.html).toContain(`data-style="${entry.style}"`);

      // No INJECT markers remaining
      expect(result.html).not.toContain('<!-- INJECT:');
    });
  }
});

// ── Clean up generated smoke test HTML files ───────────────────────────

describe('cleanup: smoke test output files', () => {
  test('remove generated smoke HTML files', () => {
    if (existsSync(smokeProjectDir)) {
      try {
        const entries = readdirSync(smokeProjectDir);
        for (const entry of entries) {
          if (entry.startsWith('smoke_') && entry.endsWith('.html')) {
            rmSync(join(smokeProjectDir, entry));
          }
        }
      } catch {
        // best-effort cleanup
      }
    }
    expect(true).toBe(true);
  });
});

// ── Summary: print matrix status ──────────────────────────────────────

describe('compatibility matrix summary', () => {
  test(`matrix: ${matrix.length} total pairs`, () => {
    const compatible = matrix.filter((e) => e.status === 'compatible').length;
    const partial = matrix.filter((e) => e.status === 'partial').length;
    const incompatible = matrix.filter((e) => e.status === 'incompatible').length;

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║         Theme × Style Compatibility Matrix Summary          ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Themes: ${themes.join(', ').padEnd(52)}║`);
    console.log(`║  Styles: ${styles.join(', ').padEnd(52)}║`);
    console.log(
      `║  Total: ${String(matrix.length).padEnd(4)}  ✅ compatible: ${String(compatible).padEnd(2)}  ⚠️ partial: ${String(partial).padEnd(2)}  ❌ incompatible: ${String(incompatible).padEnd(1)}  ║`,
    );
    console.log('╠══════════════════════════════════════════════════════════════╣');

    for (const theme of themes) {
      const themeEntries = matrix.filter((e) => e.theme === theme);
      const cells = themeEntries.map((e) => {
        if (e.status === 'compatible') return '✅ ';
        if (e.status === 'partial') return '⚠️ ';
        return '❌ ';
      });
      console.log(`║  ${theme.padEnd(16)} ${cells.join('')}  ║`);
    }

    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    expect(matrix.length).toBeGreaterThan(0);
    expect(compatible).toBeGreaterThan(0);
  });
});
