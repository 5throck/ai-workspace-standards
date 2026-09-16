/**
 * Tests for the T-20260916-010 version-manifest generation contract
 * (helpers/scaffold-markers.ts §2.5): the pure invoke-decision helper shared
 * by new-project.ts §7.8 (post-delivery generation) and upgrade-project.ts
 * (post-upgrade regeneration), plus the data invariants that keep the
 * generator deliverable.
 *
 * Pins:
 * 1. decideManifestGeneration: generate only when the generator exists AND
 *    bun is available; each missing precondition maps to its own skip reason.
 * 2. The generator ships from templates/common (so every scaffolded project
 *    carries its own copy — the §7.8 step runs the project's generator, not
 *    the workspace's).
 * 3. No variant template ships a docs/VERSION_MANIFEST.md (the retired stub
 *    class stays retired — mirrors the validate-templates
 *    `variant-version-manifest` arm).
 * 4. lib/upgrade-policy classifies docs/VERSION_MANIFEST.md as regenerated
 *    (import the lib and resolve the claim directly).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  VERSION_MANIFEST_RELPATH,
  VERSION_MANIFEST_GENERATOR_RELPATH,
  decideManifestGeneration,
} from '../../scripts/helpers/scaffold-markers.ts';
import { resolveClaim } from '../../scripts/lib/upgrade-policy.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

describe('decideManifestGeneration', () => {
  test('generates only with generator + bun', () => {
    expect(decideManifestGeneration(true, true)).toEqual({ action: 'generate' });
  });

  test('missing generator maps to skip-missing-generator', () => {
    expect(decideManifestGeneration(false, true)).toEqual({ action: 'skip-missing-generator' });
  });

  test('missing bun maps to skip-no-bun', () => {
    expect(decideManifestGeneration(true, false)).toEqual({ action: 'skip-no-bun' });
  });

  test('missing generator wins over missing bun (names the structural gap)', () => {
    expect(decideManifestGeneration(false, false)).toEqual({ action: 'skip-missing-generator' });
  });
});

describe('data invariants behind the contract', () => {
  test('the generator ships from templates/common so every project has its own copy', () => {
    expect(existsSync(join(workspaceRoot, 'templates', 'common', VERSION_MANIFEST_GENERATOR_RELPATH)))
      .toBe(true);
  });

  test('no variant template ships docs/VERSION_MANIFEST.md (stub class retired, T-20260916-010)', () => {
    const templatesDir = join(workspaceRoot, 'templates');
    const variants = readdirSync(templatesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith('co-'))
      .map((e) => e.name);
    expect(variants.length).toBe(13);
    for (const variant of variants) {
      expect(existsSync(join(templatesDir, variant, VERSION_MANIFEST_RELPATH))).toBe(false);
    }
  });

  test('the manifest relpath is REGENERATED (never template-delivered)', () => {
    expect(resolveClaim(VERSION_MANIFEST_RELPATH, 'co-develop').policy).toBe('REGENERATED');
  });
});
