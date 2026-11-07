/**
 * Tests for scripts/helpers/external-deps-reconcile.ts — the upgrade-project.ts
 * EXTERNAL DEPS reconcile core (design docs/designs/2026-11-07-external-deps-standard-design.md
 * §2 item 8, §5.6, Addendum A.3).
 *
 * Pins the data-loss fix: project-only entries survive the reconcile, the
 * written schema_version is never a hard-coded literal, the seed is
 * authoritative per id while the operative pin/commit is preserved, and a
 * non-JSON project file is never overwritten.
 *
 * Pure function — no filesystem, no network.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { reconcileExternalDepsManifest } from '../../scripts/helpers/external-deps-reconcile.ts';
import { parseExternalDepsManifest, EXTERNAL_DEPS_SCHEMA_VERSION, type ExternalDepsManifest } from '../../scripts/lib/external-deps.ts';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

function seedWith(entries: Array<Record<string, unknown>>): ExternalDepsManifest {
  return parseExternalDepsManifest(JSON.stringify({ schema_version: EXTERNAL_DEPS_SCHEMA_VERSION, dependencies: entries }), 'seed');
}

function seedEntry(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    repo: `https://github.com/example/${id}`,
    pin: 'v1.0.0',
    install: 'git clone --depth 1 --branch {pin} {repo} {dir}',
    install_dir: `external/${id}`,
    consumer: `seed consumer for ${id}`,
    propagation: 'never',
    ...extra,
  };
}

describe('reconcileExternalDepsManifest — project-only entries are never dropped', () => {
  test('a valid project-only entry is preserved in the document AND joins the pass', () => {
    const seed = seedWith([seedEntry('ppt-master')]);
    const project = JSON.stringify({
      schema_version: 1,
      notes: 'legacy top-level key forces the reconcile path',
      dependencies: [seedEntry('ppt-master'), seedEntry('local-tool', { pin: 'v2.0.0' })],
    });
    const r = reconcileExternalDepsManifest(project, seed);
    expect(r.ok).toBe(true);
    expect(r.document.dependencies.map((d) => (d as { id: string }).id)).toEqual(['ppt-master', 'local-tool']);
    expect(r.manifest.dependencies.map((d) => d.id)).toEqual(['ppt-master', 'local-tool']);
    expect(r.preservedProjectOnly).toEqual(['local-tool']);
    expect(r.invalidProjectOnly).toEqual([]);
    expect(r.manifest.dependencies[1].pin).toBe('v2.0.0');
  });

  test('an invalid project-only entry is kept VERBATIM in the document but excluded from the pass', () => {
    const seed = seedWith([seedEntry('ppt-master')]);
    const legacy = { id: 'legacy-tool', repo: 'https://github.com/example/legacy-tool', install_path: 'vendor/legacy-tool', license: 'MIT' };
    const project = JSON.stringify({ schema_version: 1, dependencies: [legacy] });
    const r = reconcileExternalDepsManifest(project, seed);
    expect(r.ok).toBe(true);
    expect(r.document.dependencies).toContainEqual(legacy);
    expect(r.manifest.dependencies.map((d) => d.id)).toEqual(['ppt-master']);
    expect(r.invalidProjectOnly.map((e) => e.id)).toEqual(['legacy-tool']);
    expect(r.invalidProjectOnly[0].reason).toContain('unknown field');
  });

  test('an id-less project entry is kept verbatim and reported by index', () => {
    const seed = seedWith([]);
    const project = JSON.stringify({ schema_version: 7, dependencies: [{ repo: 'https://github.com/x/y' }] });
    const r = reconcileExternalDepsManifest(project, seed);
    expect(r.document.dependencies).toEqual([{ repo: 'https://github.com/x/y' }]);
    expect(r.invalidProjectOnly[0].id).toBe('entry[0]');
  });
});

describe('reconcileExternalDepsManifest — seed authority and operative state', () => {
  test('seed wins per id; the project pin and commit survive; non-schema keys are reported', () => {
    const seed = seedWith([seedEntry('ppt-master', { commit: SHA_A })]);
    const project = JSON.stringify({
      schema_version: 1,
      dependencies: [{ ...seedEntry('ppt-master'), pin: 'v0.9.0', commit: SHA_B, consumer: 'stale', excluded_packages: ['x'] }],
    });
    const r = reconcileExternalDepsManifest(project, seed);
    const dep = r.manifest.dependencies[0];
    expect(dep.pin).toBe('v0.9.0');
    expect(dep.commit).toBe(SHA_B);
    expect(dep.consumer).toBe('seed consumer for ppt-master');
    expect(r.droppedLegacyKeys).toEqual(['excluded_packages']);
  });

  test('a malformed project commit is not carried over (seed commit kept)', () => {
    const seed = seedWith([seedEntry('ppt-master', { commit: SHA_A })]);
    const project = JSON.stringify({ schema_version: 1, dependencies: [{ id: 'ppt-master', commit: 'not-a-sha' }] });
    expect(reconcileExternalDepsManifest(project, seed).manifest.dependencies[0].commit).toBe(SHA_A);
  });
});

describe('reconcileExternalDepsManifest — schema_version and safety', () => {
  test('the written schema_version is the seed schema, not a literal, and the result re-parses', () => {
    const seed = seedWith([seedEntry('ppt-master')]);
    const project = JSON.stringify({ schema_version: 99, dependencies: [seedEntry('ppt-master'), seedEntry('local-tool')] });
    const r = reconcileExternalDepsManifest(project, seed);
    expect(r.document.schema_version).toBe(seed.schema_version);
    // With only valid entries the written document parses cleanly — the reconcile converges.
    expect(() => parseExternalDepsManifest(JSON.stringify(r.document), 'reconciled')).not.toThrow();
  });

  test('a project $comment is preserved', () => {
    const seed = seedWith([]);
    const r = reconcileExternalDepsManifest(JSON.stringify({ $comment: 'keep me', schema_version: 0, dependencies: [] }), seed);
    expect(r.document.$comment).toBe('keep me');
  });

  test('a project file that is not valid JSON is NOT overwritten (ok=false)', () => {
    const seed = seedWith([seedEntry('ppt-master')]);
    const r = reconcileExternalDepsManifest('{ "dependencies": [ broken', seed);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('not valid JSON');
  });

  test('a duplicate project-only id is kept verbatim but only the first joins the pass', () => {
    const seed = seedWith([]);
    const project = JSON.stringify({ schema_version: 0, dependencies: [seedEntry('dup'), seedEntry('dup', { pin: 'v9.9.9' })] });
    const r = reconcileExternalDepsManifest(project, seed);
    expect(r.document.dependencies).toHaveLength(2);
    expect(r.manifest.dependencies).toHaveLength(1);
    expect(r.invalidProjectOnly[0].reason).toContain('duplicate id');
  });
});
