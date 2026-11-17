/**
 * Unit tests for scripts/lib/spec-landing.ts v1.0.0 — the pure detection core of the
 * dev-sync step-6.55 spec-registry dangling-reference gate (T-20261117-015, spec
 * docs/designs/2026-11-18-dev-sync-hunk-staging-design.md §3).
 *
 * The 2026-11-17 audit-fix landing shipped a registry hunk whose sync-auto-detection
 * entry had NO entry JSON in the commit (dangling reference); every pre-commit gate
 * passed and only push-time review caught it. These tests pin the pure logic so the
 * gate's fail-closed behavior cannot regress.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  SPEC_REGISTRY_PATH,
  danglingSpecRefs,
  parseRegistryEntries,
  requiredPathsForEntry,
  specEntryPath,
} from '../../scripts/lib/spec-landing.ts';

const registryJson = (specs: Array<Record<string, unknown>>): string =>
  JSON.stringify({ version: '1.0.0', specs });

describe('spec-landing (T-20261117-015 dangling-reference gate core)', () => {
  test('T1: path constants match the one-file-per-spec SSOT layout', () => {
    expect(SPEC_REGISTRY_PATH).toBe('docs/specs/registry.json');
    expect(specEntryPath('2026-11-18-foo-design')).toBe('docs/specs/entries/2026-11-18-foo-design.json');
  });

  test('T2: parseRegistryEntries round-trips ids and file targets', () => {
    const entries = parseRegistryEntries(
      registryJson([
        { id: 'a', title: 'a', file: 'docs/designs/a.md', status: 'implemented' },
        { id: 'b', title: 'b', file: 'docs/designs/b.md' },
      ]),
    );
    expect(entries).toEqual([
      { id: 'a', file: 'docs/designs/a.md' },
      { id: 'b', file: 'docs/designs/b.md' },
    ]);
  });

  test('T3: parseRegistryEntries tolerates entries without a file target', () => {
    const entries = parseRegistryEntries(registryJson([{ id: 'no-file' }]));
    expect(entries).toEqual([{ id: 'no-file', file: undefined }]);
  });

  test('T4: parseRegistryEntries fail-closed on malformed content', () => {
    expect(() => parseRegistryEntries('not json')).toThrow(/not valid JSON/);
    expect(() => parseRegistryEntries('[1,2]')).toThrow(/no top-level object/);
    expect(() => parseRegistryEntries('{"version":"1.0.0"}')).toThrow(/no "specs" array/);
    expect(() => parseRegistryEntries(registryJson(['str']))).toThrow(/non-object spec entry/);
    expect(() => parseRegistryEntries(registryJson([{ title: 'x' }]))).toThrow(/without an "id" string/);
    expect(() => parseRegistryEntries(registryJson([{ id: '' }]))).toThrow(/without an "id" string/);
  });

  test('T5: requiredPathsForEntry lists the entry JSON plus the file target', () => {
    expect(requiredPathsForEntry({ id: 'a', file: 'docs/designs/a.md' })).toEqual([
      'docs/specs/entries/a.json',
      'docs/designs/a.md',
    ]);
    // a registry whose file field points at the entry JSON itself must not duplicate
    expect(requiredPathsForEntry({ id: 'a', file: 'docs/specs/entries/a.json' })).toEqual([
      'docs/specs/entries/a.json',
    ]);
    expect(requiredPathsForEntry({ id: 'b' })).toEqual(['docs/specs/entries/b.json']);
  });

  test('T6: danglingSpecRefs names the entry JSON and the file target, annotated with the spec id', () => {
    const entries = [
      { id: 'landing-ok', file: 'docs/designs/landing-ok.md' },
      { id: 'dangling-entry', file: 'docs/designs/dangling-entry.md' },
    ];
    const inCommit = new Set([
      'docs/specs/entries/landing-ok.json',
      'docs/designs/landing-ok.md',
      'docs/designs/dangling-entry.md', // design file present, entry JSON missing — the incident shape
    ]);
    const dangling = danglingSpecRefs(entries, (p) => inCommit.has(p));
    expect(dangling).toEqual(['docs/specs/entries/dangling-entry.json (spec dangling-entry)']);
  });

  test('T7: danglingSpecRefs reports the file target too when the design doc is absent', () => {
    const entries = [{ id: 'x', file: 'docs/designs/x-design.md' }];
    const dangling = danglingSpecRefs(entries, () => false);
    expect(dangling).toEqual([
      'docs/specs/entries/x.json (spec x)',
      'docs/designs/x-design.md (spec x)',
    ]);
  });

  test('T8: a clean landing reports nothing', () => {
    const entries = [
      { id: 'a', file: 'docs/designs/a.md' },
      { id: 'b' },
    ];
    const inCommit = new Set([
      'docs/specs/entries/a.json',
      'docs/designs/a.md',
      'docs/specs/entries/b.json',
    ]);
    expect(danglingSpecRefs(entries, (p) => inCommit.has(p))).toEqual([]);
  });
});
