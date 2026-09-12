/**
 * Tests for validate-templates.ts exists→declared manifest reconciliation
 * (Checks B-03r / B-03a, T-20260912-014).
 *
 * Pins both the pure helpers and the real-tree state after the manifest fixes:
 * every previously-undeclared instance (co-game validate-asset-manifest.ts,
 * co-deck watch-deck.ts, pm in the five beta rosters) must now reconcile clean.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  findUndeclaredAgents,
  findUndeclaredScripts,
} from '../../scripts/validate-templates.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const templatesDir = join(workspaceRoot, 'templates');

function variantJson(variant: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(templatesDir, variant, 'variant.json'), 'utf-8'));
}

describe('findUndeclaredScripts (B-03r)', () => {
  test('co-game validate-asset-manifest.ts is now declared (real instance from T-20260912-014)', () => {
    const raw = variantJson('co-game');
    const local = (raw.script_manifest as { local: Array<{ path: string }> }).local.map(e => e.path);
    expect(findUndeclaredScripts(join(templatesDir, 'co-game'), local)).toEqual([]);
  });

  test('co-deck watch-deck.ts is now declared', () => {
    const raw = variantJson('co-deck');
    const local = (raw.script_manifest as { local: Array<{ path: string }> }).local.map(e => e.path);
    expect(findUndeclaredScripts(join(templatesDir, 'co-deck'), local)).toEqual([]);
  });

  test('an undeclared top-level script is reported with its variant-relative path', () => {
    // Declare everything EXCEPT bundle-html.ts and watch for exactly that gap.
    const local = ['scripts/co-game/validate-asset-manifest.ts'];
    expect(findUndeclaredScripts(join(templatesDir, 'co-game'), local)).toEqual([
      'scripts/co-game/bundle-html.ts',
    ]);
  });

  test('lib/ and tests/ support trees and SCRIPTS.md are out of scope', () => {
    // co-deck declares no lib/ or tests/ files — the helper must not flag them.
    const local = (variantJson('co-deck').script_manifest as { local: Array<{ path: string }> })
      .local.map(e => e.path);
    const undeclared = findUndeclaredScripts(join(templatesDir, 'co-deck'), local);
    expect(undeclared.every(p => !p.includes('/lib/') && !p.includes('/tests/'))).toBe(true);
    expect(undeclared).toEqual([]);
  });
});

describe('findUndeclaredAgents (B-03a)', () => {
  test('every variant with a top-level pm.md declares it (incl. the five fixed beta variants)', () => {
    for (const variant of ['co-safety', 'co-export', 'co-hr', 'co-news', 'co-price']) {
      const agents = variantJson(variant).agents as Array<{ name: string }>;
      expect(agents.map(a => a.name)).toContain('pm');
      expect(findUndeclaredAgents(join(templatesDir, variant), agents)).toEqual([]);
    }
  });

  test('undeclared top-level agent files are reported; README files never are', () => {
    const agents = variantJson('co-safety').agents as Array<{ name: string }>;
    // Remove safety-workflow-manager from the declared set → exactly that gap.
    const partial = agents.filter(a => a.name !== 'safety-workflow-manager');
    expect(findUndeclaredAgents(join(templatesDir, 'co-safety'), partial)).toEqual([
      'agents/safety-workflow-manager.md',
    ]);
  });

  test('nested agents/domains/ and agents/_shared/ trees are out of scope', () => {
    // co-safety holds 12 files under _shared/ and a domains/ tree; declaring only
    // the top-level roster must produce no findings for the nested trees.
    const agents = variantJson('co-safety').agents as Array<{ name: string }>;
    const undeclared = findUndeclaredAgents(join(templatesDir, 'co-safety'), agents);
    expect(undeclared.filter(p => p.includes('_shared') || p.includes('domains'))).toEqual([]);
  });
});
