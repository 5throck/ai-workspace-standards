/**
 * Regression guard for the 2026-08-28 co-safety template promotion gap: templates/co-safety
 * was missing workflows/, regulations/, evidence-models/, and industry-profiles/ entirely
 * (684 files) despite dozens of its own skills and docs/co-safety.context.md referencing
 * them, because Projects/co-safety/_ORIGIN.md's "manual copy required" Phase B step was
 * never carried out. Also covers the two follow-up fixes: upgrade-project.ts's generic
 * VARIANT ASSET DIRS SYNC pass (so existing projects can receive such directories via
 * `upgrade-project`, not just fresh scaffolds) and prune-country-scoped-assets.ts's new
 * "dirs" registry category (so regulations/KR is pruned from region-neutral scaffolds).
 *
 * @version 1.0.0
 */
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..');
const coSafetyDir = join(workspaceRoot, 'templates', 'co-safety');

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) count += countFiles(full);
    else count++;
  }
  return count;
}

describe('templates/co-safety asset directory completeness', () => {
  const REQUIRED_DIRS = ['workflows', 'regulations', 'evidence-models', 'industry-profiles'];

  for (const dirName of REQUIRED_DIRS) {
    test(`${dirName}/ exists and is non-empty`, () => {
      const dirPath = join(coSafetyDir, dirName);
      expect(existsSync(dirPath)).toBe(true);
      expect(countFiles(dirPath)).toBeGreaterThan(0);
    });
  }

  test('docs/co-safety.context.md directory diagram directories all resolve on disk', () => {
    // The context file documents these 4 directories as part of co-safety's structure;
    // if any of them ever go missing again, the doc itself becomes the regression signal.
    const contextPath = join(coSafetyDir, 'docs', 'co-safety.context.md');
    expect(existsSync(contextPath)).toBe(true);
    for (const dirName of REQUIRED_DIRS) {
      expect(existsSync(join(coSafetyDir, dirName))).toBe(true);
    }
  });
});

describe('prune-country-scoped-assets.ts "dirs" registry', () => {
  const schemaPath = join(workspaceRoot, 'docs', 'workspace-schema.json');
  const pruneScript = join(workspaceRoot, 'scripts', 'helpers', 'prune-country-scoped-assets.ts');

  test('registered dirs point to real paths under at least one variant template', () => {
    const schema = JSON.parse(require('node:fs').readFileSync(schemaPath, 'utf-8'));
    const dirs: Record<string, string> = schema.country_scoped_assets?.dirs ?? {};
    expect(Object.keys(dirs).length).toBeGreaterThan(0);
    for (const relPath of Object.keys(dirs)) {
      // At least one variant template should actually carry this path (sanity check
      // against a typo'd or stale registry entry).
      const variants = readdirSync(join(workspaceRoot, 'templates')).filter(d => d.startsWith('co-'));
      const foundInAny = variants.some(v => existsSync(join(workspaceRoot, 'templates', v, relPath)));
      expect(foundInAny).toBe(true);
    }
  });

  test('region-neutral prune removes registered dir, keeps unregistered sibling', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'prune-dirs-'));
    try {
      mkdirSync(join(tmp, 'regulations', 'KR'), { recursive: true });
      mkdirSync(join(tmp, 'regulations', 'international'), { recursive: true });
      writeFileSync(join(tmp, 'regulations', 'KR', 'test.yaml'), 'x: 1\n');
      writeFileSync(join(tmp, 'regulations', 'international', 'test.yaml'), 'y: 1\n');

      const result = spawnSync('bun', [pruneScript, tmp, 'none'], { encoding: 'utf-8' });
      expect(result.status).toBe(0);
      expect(existsSync(join(tmp, 'regulations', 'KR'))).toBe(false);
      expect(existsSync(join(tmp, 'regulations', 'international'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('KR-targeted prune keeps the KR-scoped dir', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'prune-dirs-'));
    try {
      mkdirSync(join(tmp, 'regulations', 'KR'), { recursive: true });
      writeFileSync(join(tmp, 'regulations', 'KR', 'test.yaml'), 'z: 1\n');

      const result = spawnSync('bun', [pruneScript, tmp, 'KR'], { encoding: 'utf-8' });
      expect(result.status).toBe(0);
      expect(existsSync(join(tmp, 'regulations', 'KR'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('upgrade-project.ts VARIANT ASSET DIRS SYNC', () => {
  const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');

  test('dry-run reports NEW for co-safety asset dirs missing from an existing project', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'upgrade-asset-dirs-'));
    try {
      spawnSync('git', ['init', '-q'], { cwd: tmp });
      // Minimal project skeleton: template-version.txt pins variant=co-safety with no
      // country (region-neutral) so the run doesn't need a full scaffold to proceed.
      mkdirSync(join(tmp, '.claude'), { recursive: true });
      writeFileSync(
        join(tmp, '.claude', 'template-version.txt'),
        'variant=co-safety\nversion=0.0.0\ncountry=none\n'
      );

      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', 'co-safety', '--dry-run', '--yes'],
        { encoding: 'utf-8', timeout: 120000 }
      );

      expect(result.status).toBe(0);
      const out = result.stdout ?? '';
      expect(out).toContain('VARIANT ASSET DIRS');
      for (const dirName of ['workflows', 'regulations', 'evidence-models', 'industry-profiles']) {
        expect(out).toContain(`NEW    ${dirName}/`);
      }
      // Dry-run must not have written anything.
      expect(existsSync(join(tmp, 'workflows'))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30000);
});
