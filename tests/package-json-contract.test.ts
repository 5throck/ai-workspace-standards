#!/usr/bin/env bun
// @version 1.0.0
// package-json-contract.test.ts — Contract tests for templates/common/package.json (SSOT)
//
// Validates that the template package.json maintains structural integrity.
// This prevents regressions when modifying the single source of truth
// that new-project.ts uses to generate project package.json files.
// Previously managed by merge-package-scripts.ts (now deprecated).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';

const pkgPath = join(import.meta.dir, '..', 'templates', 'common', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

describe('templates/common/package.json (SSOT contract)', () => {
  test('has required top-level fields', () => {
    expect(pkg.name).toBeDefined();
    expect(pkg.type).toBe('module');
    expect(pkg.scripts).toBeDefined();
    expect(pkg.devDependencies).toBeDefined();
    expect(pkg.engines).toBeDefined();
  });

  test('includes scripts previously managed by merge-package-scripts.ts', () => {
    const mergeScripts = ['audit', 'dev-sync', 'sync-md'] as const;
    for (const key of mergeScripts) {
      expect(pkg.scripts[key]).toBeDefined();
      expect(pkg.scripts[key]).toContain('bun scripts/');
    }
  });

  test('devDependencies includes js-yaml (runtime requirement for audit.ts, merge-frontmatter.ts)', () => {
    expect(pkg.devDependencies['js-yaml']).toBeDefined();
    expect(pkg.devDependencies['@types/js-yaml']).toBeDefined();
  });

  test('engines requires bun >= 1.0.0', () => {
    expect(pkg.engines.bun).toBeDefined();
  });
});
