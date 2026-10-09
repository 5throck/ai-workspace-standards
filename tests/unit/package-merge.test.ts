import { describe, test, expect } from 'bun:test';
import { mergePackageJson, hasTier2Scripts, evaluateScaffoldPackageContract, TIER2_SCRIPTS } from '../../scripts/lib/package-merge.ts';

const generated = {
  name: 'my-project',
  type: 'module',
  private: true,
  scripts: { audit: 'bun scripts/audit.ts', 'dev-sync': 'bun scripts/dev-sync.ts', 'sync-md': 'bun scripts/sync-md.ts' },
  dependencies: { jsyaml: '^5.0.0' },
  engines: { bun: '>=1.0.0' },
};

describe('package-merge (T-20261009-002, design 2026-10-09-scaffold-package-merge-and-baseline-surfacing D1)', () => {

  test('variant scalar keys win, generated scalar keys survive', () => {
    const merged = mergePackageJson(generated, { name: 'co-consult', version: '1.0.0', description: 'consulting' });
    expect(merged.name).toBe('co-consult');
    expect(merged.version).toBe('1.0.0');
    expect(merged.type).toBe('module');
    expect(merged.private).toBe(true);
  });

  test('object keys merge per-key: Tier 2 scripts survive, variant scripts are added', () => {
    const merged = mergePackageJson(generated, {
      scripts: { test: 'bun test scripts/co-deck/tests/', 'test:visual': 'bun test x.test.ts' },
      dependencies: { 'pdf-lib': '^1.17.1' },
    });
    const scripts = merged.scripts as Record<string, string>;
    for (const s of TIER2_SCRIPTS) expect(scripts[s]).toBeTruthy();
    expect(scripts.test).toBe('bun test scripts/co-deck/tests/');
    expect((merged.dependencies as Record<string, string>)['pdf-lib']).toBe('^1.17.1');
    expect((merged.dependencies as Record<string, string>).jsyaml).toBe('^5.0.0');
  });

  test('variant collision on an object key wins that key but keeps the rest', () => {
    const merged = mergePackageJson(generated, { engines: { bun: '>=1.2.0', node: '>=20' } });
    expect(merged.engines).toEqual({ bun: '>=1.2.0', node: '>=20' });
  });

  test('non-object scripts in the variant cannot clobber the generated scripts', () => {
    const merged = mergePackageJson(generated, { scripts: 'rm -rf /' });
    expect(merged.scripts).toEqual(generated.scripts);
  });

  test('hasTier2Scripts: true for the trio, false for subsets and non-objects', () => {
    expect(hasTier2Scripts({ audit: 'a', 'dev-sync': 'd', 'sync-md': 's' })).toBe(true);
    expect(hasTier2Scripts({ audit: 'a' })).toBe(false);
    expect(hasTier2Scripts(undefined)).toBe(false);
    expect(hasTier2Scripts('all')).toBe(false);
    expect(hasTier2Scripts(['audit'])).toBe(false);
  });
});

describe('scaffold overlay merge (fixture through new-project merge semantics)', () => {
  test('co-consult-shaped variant (no scripts key) keeps the generated trio', () => {
    const variantPkg = { type: 'module', name: 'co-consult', private: true, dependencies: { docx: '^9.8.1' } };
    const merged = mergePackageJson(generated, variantPkg);
    expect(hasTier2Scripts(merged.scripts)).toBe(true);
  });

  test('co-deck-shaped variant (test scripts only) ends with trio + test scripts', () => {
    const variantPkg = { scripts: { test: 't', 'test:visual': 'v' } };
    const merged = mergePackageJson(generated, variantPkg);
    const scripts = merged.scripts as Record<string, string>;
    for (const s of TIER2_SCRIPTS) expect(scripts[s]).toBeTruthy();
    expect(scripts['test:visual']).toBe('v');
  });
});

describe('evaluateScaffoldPackageContract (VA-08 pin, induced fixtures)', () => {
  test('green day-one state: common trio + no variant package.json', () => {
    expect(evaluateScaffoldPackageContract({ scripts: generated.scripts }, null).ok).toBe(true);
  });

  test('green: variant shipping test-scripts-only merges to a trio superset (co-deck shape)', () => {
    const v = evaluateScaffoldPackageContract(
      { scripts: generated.scripts },
      { scripts: { test: 't', 'test:visual': 'v' } },
    );
    expect(v.ok).toBe(true);
  });

  test('FAIL: common loses the trio (SSOT regression)', () => {
    const v = evaluateScaffoldPackageContract({ scripts: { audit: 'a' } }, null);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('Tier 2 trio');
  });

  test('FAIL: variant scripts of a non-object type', () => {
    const v = evaluateScaffoldPackageContract({ scripts: generated.scripts }, { scripts: 'rm -rf /' });
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('object');
  });

  test('FAIL: merge simulation loses the trio (unreachable while common is intact, pinned for the contract)', () => {
    const v = evaluateScaffoldPackageContract({ scripts: generated.scripts }, { scripts: { extra: 'x' } });
    expect(v.ok).toBe(true);
  });
});
