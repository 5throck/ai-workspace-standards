#!/usr/bin/env bun
// @version 1.0.0
/**
 * sync-template-deps.test.ts — Unit tests for dependency version sync logic
 *
 * Tests the pure alignment logic from scripts/sync-template-deps.ts.
 * No filesystem operations — all tests use in-memory package.json objects.
 */

import { describe, test, expect } from 'bun:test';
import { alignTemplateDeps, type DepDrift, type DepReportEntry } from '../../scripts/sync-template-deps';

describe('alignTemplateDeps', () => {
  test('shared key updated in place + key order preserved', () => {
    const rootPkg = {
      dependencies: {
        'js-yaml': '^5.3.0',
        'semver': '^7.8.5',
      },
      devDependencies: {},
    };

    const templatePkg = {
      dependencies: {
        'js-yaml': '^5.2.0', // Drift: should be ^5.3.0
        'semver': '^7.8.5',
      },
      devDependencies: {},
    };

    const beforeKeys = Object.keys(templatePkg.dependencies);
    const result = alignTemplateDeps(rootPkg, templatePkg);
    const afterKeys = Object.keys(templatePkg.dependencies);

    // Check drift detected and aligned
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0]).toEqual({
      key: 'js-yaml',
      section: 'dependencies',
      rootVersion: '^5.3.0',
      templateVersion: '^5.2.0',
    });

    // Check value updated in place
    expect(templatePkg.dependencies['js-yaml']).toBe('^5.3.0');

    // Check key order preserved
    expect(beforeKeys).toEqual(afterKeys);
  });

  test('root-only dep NOT added (listed in rootOnly)', () => {
    const rootPkg = {
      dependencies: {
        'js-yaml': '^5.3.0',
        'semver': '^7.8.5', // Root-only: should NOT be added to template
      },
      devDependencies: {},
    };

    const templatePkg = {
      dependencies: {
        'js-yaml': '^5.3.0',
      },
      devDependencies: {},
    };

    const result = alignTemplateDeps(rootPkg, templatePkg);

    // Check semver listed as root-only
    expect(result.rootOnly).toHaveLength(1);
    expect(result.rootOnly[0]).toEqual({
      key: 'semver',
      section: 'dependencies',
    });

    // Check semver NOT added to template
    expect('semver' in templatePkg.dependencies).toBe(false);
  });

  test('template-only dep NOT removed (listed in templateOnly)', () => {
    const rootPkg = {
      dependencies: {
        'js-yaml': '^5.3.0',
      },
      devDependencies: {},
    };

    const templatePkg = {
      dependencies: {
        'js-yaml': '^5.3.0',
        'template-specific-dep': '^1.0.0', // Template-only: should NOT be removed
      },
      devDependencies: {},
    };

    const result = alignTemplateDeps(rootPkg, templatePkg);

    // Check template-specific-dep listed as template-only
    expect(result.templateOnly).toHaveLength(1);
    expect(result.templateOnly[0]).toEqual({
      key: 'template-specific-dep',
      section: 'dependencies',
    });

    // Check dep still present in template
    expect('template-specific-dep' in templatePkg.dependencies).toBe(true);
    expect(templatePkg.dependencies['template-specific-dep']).toBe('^1.0.0');
  });

  test('already-in-sync → changed=[], enginesChanged=false', () => {
    const rootPkg = {
      dependencies: {
        'js-yaml': '^5.3.0',
      },
      devDependencies: {},
      engines: {
        bun: '>=1.0.0',
      },
    };

    const templatePkg = {
      dependencies: {
        'js-yaml': '^5.3.0',
      },
      devDependencies: {},
      engines: {
        bun: '>=1.0.0',
      },
    };

    const result = alignTemplateDeps(rootPkg, templatePkg);

    expect(result.changed).toHaveLength(0);
    expect(result.enginesChanged).toBe(false);
  });

  test('range format difference counts as drift', () => {
    const rootPkg = {
      dependencies: {
        'js-yaml': '5.3.0', // Exact version
      },
      devDependencies: {},
    };

    const templatePkg = {
      dependencies: {
        'js-yaml': '^5.3.0', // Caret range — different format
      },
      devDependencies: {},
    };

    const result = alignTemplateDeps(rootPkg, templatePkg);

    // Check drift detected (exact vs caret range is considered drift)
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].key).toBe('js-yaml');
  });

  test('devDependencies section drift detected', () => {
    const rootPkg = {
      dependencies: {},
      devDependencies: {
        '@types/node': '^26.2.0',
      },
    };

    const templatePkg = {
      dependencies: {},
      devDependencies: {
        '@types/node': '^20.0.0', // Drift: should be ^26.2.0
      },
    };

    const result = alignTemplateDeps(rootPkg, templatePkg);

    expect(result.changed).toHaveLength(1);
    expect(result.changed[0]).toEqual({
      key: '@types/node',
      section: 'devDependencies',
      rootVersion: '^26.2.0',
      templateVersion: '^20.0.0',
    });

    // Check value updated
    expect(templatePkg.devDependencies['@types/node']).toBe('^26.2.0');
  });

  test('engines shared field mismatch → enginesChanged=true and mutated', () => {
    const rootPkg = {
      dependencies: {},
      devDependencies: {},
      engines: {
        bun: '>=1.0.0',
        node: '>=18.0.0',
      },
    };

    const templatePkg = {
      dependencies: {},
      devDependencies: {},
      engines: {
        bun: '>=1.0.0',
        node: '>=16.0.0', // Drift: should be >=18.0.0
      },
    };

    const result = alignTemplateDeps(rootPkg, templatePkg);

    expect(result.enginesChanged).toBe(true);
    expect(templatePkg.engines.node).toBe('>=18.0.0');
  });
});
