/**
 * Tests for the spec-registry entries-as-SSOT mechanism (T-20261005-005,
 * spec docs/designs/2026-10-05-spec-registry-entries-projection-design.md)
 * and the canonical-order predicate it retained from T-20261005-002.
 *
 * docs/specs/entries/<id>.json is the SSOT (one file per spec) and
 * docs/specs/registry.json is a committed generated projection. Concurrent
 * registrations now write disjoint entry files — the judgment content can
 * never conflict; the only residual conflict surface is the projection, whose
 * resolution is one mechanical command (--regenerate).
 *
 * Pins:
 * 1. Upsert + regenerate round-trip keeps the projection sorted.
 * 2. Migration splits a legacy projection into entry files, idempotently.
 * 3. Regeneration is deterministic (byte-identical output).
 * 4. THE CONCURRENT-WRITER PIN: same-gap writers produce disjoint entry files
 *    and the union regenerates deterministically.
 * 5. canonicalOrderViolation still names the first offending pair.
 */

import { describe, test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  canonicalOrderViolation,
  entryPath,
  readEntryFiles,
  regenerateProjection,
  writeEntryFile,
} from '../../scripts/spec-register.ts';

const entry = (id: string) => ({
  id,
  title: id,
  file: `docs/designs/${id}.md`,
  status: 'implemented' as const,
  source: 'manual' as const,
  created: '2026-10-05',
  last_updated: '2026-10-05',
});

function scratch(): { entriesDir: string; registryPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'spec-registry-entries-'));
  return { entriesDir: join(dir, 'entries'), registryPath: join(dir, 'registry.json') };
}

describe('entries model', () => {
  test('upsert + regenerate round-trip keeps the projection sorted', () => {
    const s = scratch();
    writeEntryFile(entry('2026-10-02-b'), s.entriesDir);
    writeEntryFile(entry('2026-10-01-a'), s.entriesDir);
    const registry = regenerateProjection(s);
    expect(registry.specs.map(e => e.id)).toEqual(['2026-10-01-a', '2026-10-02-b']);
    const onDisk = JSON.parse(readFileSync(s.registryPath, 'utf-8'));
    expect(onDisk.specs.map((e: { id: string }) => e.id)).toEqual(['2026-10-01-a', '2026-10-02-b']);
  });

  test('migration splits a legacy projection into entry files, idempotently', () => {
    const s = scratch();
    const legacy = { version: '1.0.0', specs: [entry('2026-10-01-a'), entry('2026-10-02-b')] };
    writeFileSync(s.registryPath, JSON.stringify(legacy, null, 2) + '\n', 'utf-8');
    regenerateProjection(s); // no entries yet → migrates the legacy projection
    expect(readdirSync(s.entriesDir).filter(f => f.endsWith('.json')).length).toBe(2);
    const first = readFileSync(s.registryPath, 'utf-8');
    const second = regenerateProjection(s);
    expect(second.specs.length).toBe(2);
    expect(readFileSync(s.registryPath, 'utf-8')).toBe(first);
  });

  test('union regeneration never drops file-only entries (2026-10-05 recovery pin)', () => {
    const s = scratch();
    writeEntryFile(entry('2026-10-01-a'), s.entriesDir);
    // A projection that only knows one entry while two entry files exist — the
    // incident shape caught live during this design's first registration (a
    // fallback-ordered migration erased the pre-existing entries pre-commit).
    writeFileSync(s.registryPath, JSON.stringify({ version: '1.0.0', specs: [entry('2026-10-01-a')] }, null, 2) + '\n', 'utf-8');
    writeEntryFile(entry('2026-10-02-b'), s.entriesDir);
    const registry = regenerateProjection(s);
    expect(registry.specs.map(e => e.id)).toEqual(['2026-10-01-a', '2026-10-02-b']);
  });

  test('a conflicted projection (merge markers) is discarded and rebuilt from files', () => {
    const s = scratch();
    writeEntryFile(entry('2026-10-05-aaa'), s.entriesDir);
    writeEntryFile(entry('2026-10-05-bbb'), s.entriesDir);
    writeFileSync(s.registryPath, [
      '<<<<<<< HEAD',
      JSON.stringify({ version: '1.0.0', specs: [entry('2026-10-05-aaa')] }, null, 2),
      '=======',
      JSON.stringify({ version: '1.0.0', specs: [entry('2026-10-05-bbb')] }, null, 2),
      '>>>>>>> pr-b',
      '',
    ].join('\n'), 'utf-8');
    const registry = regenerateProjection(s);
    expect(registry.specs.map(e => e.id)).toEqual(['2026-10-05-aaa', '2026-10-05-bbb']);
    expect(() => JSON.parse(readFileSync(s.registryPath, 'utf-8'))).not.toThrow();
  });

  test('regeneration is deterministic (byte-identical output)', () => {
    const s = scratch();
    writeEntryFile(entry('2026-10-02-b'), s.entriesDir);
    writeEntryFile(entry('2026-10-01-a'), s.entriesDir);
    regenerateProjection(s);
    const first = readFileSync(s.registryPath, 'utf-8');
    regenerateProjection(s);
    expect(readFileSync(s.registryPath, 'utf-8')).toBe(first);
  });

  test('upserting an existing id refreshes the same file (no duplicates)', () => {
    const s = scratch();
    writeEntryFile(entry('2026-10-01-a'), s.entriesDir);
    writeEntryFile({ ...entry('2026-10-01-a'), status: 'approved' }, s.entriesDir);
    const registry = regenerateProjection(s);
    expect(registry.specs.length).toBe(1);
    expect(registry.specs[0].status).toBe('approved');
    expect(existsSync(entryPath('2026-10-01-a', s.entriesDir))).toBe(true);
  });
});

describe('concurrent-writer merge model (file level)', () => {
  test('THE PIN: same-gap writers produce disjoint files; the union regenerates', () => {
    const s = scratch();
    // Writer A and B each touch exactly one entry file — never the same file,
    // even for same-gap alphabetical neighbors (the #1425 residual case).
    const fileA = entryPath('2026-10-05-aaa', s.entriesDir);
    const fileB = entryPath('2026-10-05-bbb', s.entriesDir);
    expect(fileA).not.toBe(fileB);
    writeEntryFile(entry('2026-10-05-aaa'), s.entriesDir); // branch A's change
    writeEntryFile(entry('2026-10-05-bbb'), s.entriesDir); // branch B's change
    const registry = regenerateProjection(s);
    expect(registry.specs.map(e => e.id)).toEqual(['2026-10-05-aaa', '2026-10-05-bbb']);
    expect(readEntryFiles(s.entriesDir).length).toBe(2);
  });
});

describe('canonicalOrderViolation (retained from T-20261005-002)', () => {
  test('returns null for sorted input and names the first offending pair otherwise', () => {
    expect(canonicalOrderViolation([entry('a'), entry('b')])).toBeNull();
    const msg = canonicalOrderViolation([entry('a'), entry('z'), entry('m')]);
    expect(msg).toContain('"m"');
    expect(msg).toContain('"z"');
  });
});
