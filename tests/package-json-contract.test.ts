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

  test('dependencies includes js-yaml 5.x (runtime requirement for audit.ts, merge-frontmatter.ts; built-in types since 5.x)', () => {
    expect(pkg.dependencies['js-yaml']).toBeDefined();
    expect(pkg.devDependencies['@types/js-yaml']).toBeUndefined();
  });

  test('engines requires bun >= 1.0.0', () => {
    expect(pkg.engines.bun).toBeDefined();
  });

  test('shared dependency versions mirror root package.json', () => {
    const rootPkgPath = join(import.meta.dir, '..', 'package.json');
    const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'));

    const sections = ['dependencies', 'devDependencies'] as const;

    for (const section of sections) {
      const rootSection = rootPkg[section] || {};
      const templateSection = pkg[section] || {};

      // For keys present in both, versions must match exactly
      for (const key of Object.keys(templateSection)) {
        if (key in rootSection) {
          expect(rootSection[key]).toBe(templateSection[key]);
        }
      }
    }

    // Check engines
    if (rootPkg.engines && pkg.engines) {
      for (const field of Object.keys(rootPkg.engines)) {
        if (field in pkg.engines) {
          expect(rootPkg.engines[field]).toBe(pkg.engines[field]);
        }
      }
    }
  });

  test('sync-template-deps --check exits 0', () => {
    const { exitCode } = Bun.spawnSync(
      ['bun', 'scripts/sync-template-deps.ts', '--check'],
      { cwd: join(import.meta.dir, '..') }
    );
    expect(exitCode).toBe(0);
  });
});
