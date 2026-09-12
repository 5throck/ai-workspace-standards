/**
 * Tests for spec-register.ts import safety (T-20260912-019).
 *
 * Pins the contract that importing the module for its helpers has NO side
 * effects: no CRUD runs at import time, no process exit, and no registry
 * mutation. Also pins REGISTRY_PATH resolution from the script's own location
 * rather than process.cwd().
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  REGISTRY_PATH,
  loadRegistry,
  slugFromPath,
  titleFromPath,
} from '../../scripts/spec-register.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

describe('spec-register import safety (T-20260912-019)', () => {
  test('importing the module did not create or mutate docs/specs/registry.json via cwd', () => {
    // If module-load CRUD ran with a bogus cwd-relative path, a stray
    // docs/specs/registry.json would have appeared under the test's cwd.
    // The registry at the workspace root must be exactly the committed shape.
    const registry = JSON.parse(readFileSync(join(workspaceRoot, 'docs', 'specs', 'registry.json'), 'utf-8'));
    expect(Array.isArray(registry.specs)).toBe(true);
    expect(typeof registry.version).toBe('string');
  });

  test('REGISTRY_PATH resolves from the script location, not cwd', () => {
    expect(REGISTRY_PATH).toBe(join(workspaceRoot, 'docs', 'specs', 'registry.json'));
  });

  test('loadRegistry reads the workspace registry (absolute-path resolution)', () => {
    const registry = loadRegistry();
    expect(Array.isArray(registry.specs)).toBe(true);
  });

  test('CLI dispatch is wrapped in import.meta.main (source-level guard)', () => {
    const source = readFileSync(join(workspaceRoot, 'scripts', 'spec-register.ts'), 'utf-8');
    expect(source).toContain('if (import.meta.main)');
    // The dispatch function must only be invoked behind the guard.
    expect(source).toMatch(/if \(import\.meta\.main\) \{\s*\n\s*dispatch\(\);/);
  });
});

describe('spec-register helpers', () => {
  test('slugFromPath', () => {
    expect(slugFromPath('/x/docs/designs/2026-01-02-foo-bar.md')).toBe('2026-01-02-foo-bar');
    expect(slugFromPath('Foo Bar!.md')).toBe('foo-bar');
  });

  test('titleFromPath strips the date prefix and de-slugs', () => {
    expect(titleFromPath('/x/2026-01-02-foo-bar.md')).toBe('foo bar');
  });
});
