/**
 * Tests for scripts/lib/fleet.ts v1.0.0 (design
 * docs/designs/2026-11-07-fleet-membership-ssot-design.md §4-§5, §9.1,
 * DEC-20261107-01) — the fleet membership SSOT helpers:
 * loadFleetRegistry (absent-file = historical behavior, malformed =
 * fail-closed), fleetExclusions / excludedFleetIds, isFleetMember,
 * listFleetProjects (sorted Projects/<name> paths), isFleetProjectPath,
 * exclusionForName / exclusionNotice. All fixtures are mkdtempSync
 * workspaces — no real Projects/ dependency.
 */

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  exclusionForName,
  exclusionNotice,
  excludedFleetIds,
  fleetExclusions,
  isFleetMember,
  isFleetProjectPath,
  listFleetProjects,
  loadFleetRegistry,
  validateFleetRegistryPayload,
} from '../../scripts/lib/fleet.ts';

function makeWorkspace(opts?: { projects?: string[]; files?: string[]; registry?: string }): string {
  const root = mkdtempSync(join(tmpdir(), 'fleet-membership-'));
  for (const p of opts?.projects ?? []) mkdirSync(join(root, 'Projects', p), { recursive: true });
  for (const f of opts?.files ?? []) {
    mkdirSync(join(root, 'Projects'), { recursive: true });
    writeFileSync(join(root, 'Projects', f), 'plain file, not a directory');
  }
  if (opts?.registry !== undefined) {
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs', 'fleet-membership.json'), opts.registry);
  }
  return root;
}

const VALID_REGISTRY = JSON.stringify({
  version: 1,
  excluded: [
    {
      id: 'co-excluded-tool',
      reason: 'standalone tool distribution, not a template variant project',
      decided: '2026-11-07',
      decision_ref: 'DEC-20261107-01',
    },
  ],
});

const suites: string[] = [];
void suites; // individual tests clean their own fixtures

describe('loadFleetRegistry (§4 failure semantics)', () => {
  test('absent file → {ok:false, error:"absent-file"} (consumers proceed with zero exclusions)', () => {
    const root = makeWorkspace();
    try {
      const result = loadFleetRegistry(root);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('absent-file');
      // the historical-behavior wrappers surface absence as zero exclusions
      expect(fleetExclusions(root)).toEqual([]);
      expect(excludedFleetIds(root).size).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('valid file parses all four fields and drops unknown keys', () => {
    const root = makeWorkspace({
      registry: JSON.stringify({
        version: 1,
        _comment: 'future-proof note',
        excluded: [{ id: 'co-excluded-tool', reason: 'r', decided: '2026-11-07', decision_ref: 'DEC-20261107-01', futureKey: 42 }],
      }),
    });
    try {
      const result = loadFleetRegistry(root);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.registry.version).toBe(1);
        expect(result.registry.excluded).toEqual([
          { id: 'co-excluded-tool', reason: 'r', decided: '2026-11-07', decision_ref: 'DEC-20261107-01' },
        ]);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  const malformedCases: Array<[string, string, RegExp]> = [
    ['bad version', JSON.stringify({ version: 2, excluded: [] }), /version must be 1/],
    ['non-array excluded', JSON.stringify({ version: 1, excluded: {} }), /'excluded' must be an array/],
    ['bad id shape (no co- prefix)', JSON.stringify({ version: 1, excluded: [{ id: 'foo', reason: 'r', decided: '2026-11-07', decision_ref: 'DEC-20261107-01' }] }), /id must match/],
    ['bad id shape (uppercase)', JSON.stringify({ version: 1, excluded: [{ id: 'CO-X', reason: 'r', decided: '2026-11-07', decision_ref: 'DEC-20261107-01' }] }), /id must match/],
    ['bad id shape (over-long)', JSON.stringify({ version: 1, excluded: [{ id: `co-${'a'.repeat(50)}`, reason: 'r', decided: '2026-11-07', decision_ref: 'DEC-20261107-01' }] }), /id must match/],
    ['empty reason', JSON.stringify({ version: 1, excluded: [{ id: 'co-x', reason: '  ', decided: '2026-11-07', decision_ref: 'DEC-20261107-01' }] }), /reason must be a non-empty string/],
    ['bad decided (slashes)', JSON.stringify({ version: 1, excluded: [{ id: 'co-x', reason: 'r', decided: '2026/11/07', decision_ref: 'DEC-20261107-01' }] }), /decided must be a valid YYYY-MM-DD/],
    ['bad decided (impossible calendar date)', JSON.stringify({ version: 1, excluded: [{ id: 'co-x', reason: 'r', decided: '2026-02-31', decision_ref: 'DEC-20261107-01' }] }), /decided must be a valid YYYY-MM-DD/],
    ['bad decision_ref (ticket id)', JSON.stringify({ version: 1, excluded: [{ id: 'co-x', reason: 'r', decided: '2026-11-07', decision_ref: 'T-20261107-001' }] }), /decision_ref must match/],
    ['duplicate id', JSON.stringify({ version: 1, excluded: [{ id: 'co-x', reason: 'r', decided: '2026-11-07', decision_ref: 'DEC-20261107-01' }, { id: 'co-x', reason: 'r2', decided: '2026-11-07', decision_ref: 'DEC-20261107-02' }] }), /duplicate exclusion id/],
    ['invalid JSON', '{not json', /not valid JSON/],
  ];

  for (const [label, registry, detailRe] of malformedCases) {
    test(`malformed (${label}) → {ok:false, error:"malformed"} with a useful detail`, () => {
      const root = makeWorkspace({ registry });
      try {
        const result = loadFleetRegistry(root);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBe('malformed');
          expect(result.detail).toMatch(detailRe);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  test('fleetExclusions THROWS on a malformed file (fail-closed contract, §4)', () => {
    const root = makeWorkspace({ registry: JSON.stringify({ version: 9, excluded: [] }) });
    try {
      expect(() => fleetExclusions(root)).toThrow(/Malformed fleet registry/);
      expect(() => excludedFleetIds(root)).toThrow(/Malformed fleet registry/);
      expect(() => listFleetProjects(root)).toThrow(/Malformed fleet registry/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('validateFleetRegistryPayload directly accepts the shipped docs/fleet-membership.json shape', () => {
    const shippedRoot = join(import.meta.dir, '..', '..');
    const shipped = JSON.parse(readFileSync(join(shippedRoot, 'docs', 'fleet-membership.json'), 'utf-8')) as unknown;
    const result = validateFleetRegistryPayload(shipped);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.registry.excluded[0]?.id).toBe('co-abap-plugin');
  });
});

describe('listFleetProjects / isFleetMember (§5 membership derivation)', () => {
  test('member included; excluded id dropped; non-co- directory dropped; plain file dropped; output sorted', () => {
    const root = makeWorkspace({
      projects: ['co-real', 'co-excluded-tool', 'co-alpha', 'not-a-member'],
      files: ['co-loose-file'],
      registry: VALID_REGISTRY,
    });
    try {
      expect(listFleetProjects(root)).toEqual(['Projects/co-alpha', 'Projects/co-real']);
      expect(isFleetMember('co-real', excludedFleetIds(root))).toBe(true);
      expect(isFleetMember('co-excluded-tool', excludedFleetIds(root))).toBe(false);
      expect(isFleetMember('not-a-member', excludedFleetIds(root))).toBe(false);
      // default exclusions parameter: absence of a registry in THIS test's cwd
      // must not matter — pass the set explicitly for hot-loop use.
      expect(isFleetMember('co-real', new Set())).toBe(true);
      expect(isFleetMember('plain')).toBe(false); // no co- prefix → never a member
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('Projects/ absent → []', () => {
    const root = makeWorkspace({ registry: VALID_REGISTRY });
    try {
      expect(listFleetProjects(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('absent registry keeps the historical glob behavior (16+1 rollout proof, §10)', () => {
    const root = makeWorkspace({ projects: ['co-real', 'co-excluded-tool'] });
    try {
      // no docs/fleet-membership.json on disk
      expect(listFleetProjects(root)).toEqual(['Projects/co-excluded-tool', 'Projects/co-real']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('isFleetProjectPath (path-form guard for B-class tools, §6)', () => {
  test('absolute path and repo-relative path of a member → true', () => {
    const root = makeWorkspace({ projects: ['co-real', 'co-excluded-tool'], registry: VALID_REGISTRY });
    try {
      expect(isFleetProjectPath(join(root, 'Projects', 'co-real'), root)).toBe(true);
      expect(isFleetProjectPath('Projects/co-real', root)).toBe(true);
      // trailing separator is normalized by resolve()
      expect(isFleetProjectPath(join(root, 'Projects', 'co-real') + '/', root)).toBe(true);
      // excluded member → false
      expect(isFleetProjectPath(join(root, 'Projects', 'co-excluded-tool'), root)).toBe(false);
      // non-member name → false
      expect(isFleetProjectPath(join(root, 'Projects', 'other'), root)).toBe(false);
      // outside Projects/ → false
      expect(isFleetProjectPath(join(root, 'templates', 'co-real'), root)).toBe(false);
      // the workspace root itself → false
      expect(isFleetProjectPath(root, root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('bare name is rejected — it is a path guard, not a name guard', () => {
    const root = makeWorkspace({ projects: ['co-real'], registry: VALID_REGISTRY });
    try {
      expect(isFleetProjectPath('co-real', root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('malformed registry → throws (callers refuse fail-closed, §6.2)', () => {
    const root = makeWorkspace({ projects: ['co-real'], registry: '{broken' });
    try {
      expect(() => isFleetProjectPath(join(root, 'Projects', 'co-real'), root)).toThrow(/Malformed fleet registry/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('exclusionForName / exclusionNotice (§6.3/§6.4/§6.7 surfaces)', () => {
  test('exclusionForName returns the record for an excluded name, null otherwise', () => {
    const root = makeWorkspace({ registry: VALID_REGISTRY });
    try {
      const row = exclusionForName('co-excluded-tool', root);
      expect(row?.decision_ref).toBe('DEC-20261107-01');
      expect(exclusionForName('co-real', root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('exclusionNotice emits the exact §6.7 WARN line for an excluded member path only', () => {
    const root = makeWorkspace({ projects: ['co-excluded-tool', 'co-real'], registry: VALID_REGISTRY });
    try {
      expect(exclusionNotice(join(root, 'Projects', 'co-excluded-tool'), root)).toBe(
        'co-excluded-tool is not a fleet member (docs/fleet-membership.json) — proceeding read-only',
      );
      expect(exclusionNotice(join(root, 'Projects', 'co-real'), root)).toBeNull();
      expect(exclusionNotice('co-excluded-tool', root)).toBeNull(); // bare name is not a path
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
