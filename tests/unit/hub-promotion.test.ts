#!/usr/bin/env bun
// hub-promotion.test.ts — unit contract for scripts/hub-promotion.ts
// (design docs/designs/2026-11-01-hub-consolidation-design.md §hub-promotion).
//
// Coverage: manifest parsing/validation (path containment, enum fields, dest
// under templates/), repo-grounded validation (sources exist, registry enums,
// hub_variant match), suite idempotency ("already promoted" no-op), dry-run
// writes NOTHING, --apply swaps assets + contract updates + registry entries
// into BOTH schema copies byte-identically, post-swap validator failure rolls
// every swapped file back and writes the failure marker (which then blocks
// re-runs until removed). The validator is injected (ValidatorRunner seam) so
// the suite never spawns the real battery — FILE_TIME_BUDGETS stays well under
// the 60s ceiling on mkdtempSync fixtures.
//
// @version 1.0.1
// v1.0.1: snapshot() keys normalized to forward slashes (win32 join produces
// backslash keys, which the POSIX-only '/.pipeline-state/' residue filter
// missed — the windows-latest CI failure); no change on POSIX.
import { describe, test, expect, afterAll } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseSuiteManifest,
  validateSuiteAgainstRepo,
  isSafeRepoPath,
  upsertRegistryEntriesInText,
  contractEntryPresent,
  promoteSuite,
  type SuiteManifest,
} from '../../scripts/hub-promotion.ts';

const CLEANUPS: string[] = [];
afterAll(() => {
  for (const dir of CLEANUPS) rmSync(dir, { recursive: true, force: true });
});

function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'hub-promo-test-'));
  CLEANUPS.push(root);
  // minimal schema pair (root: with CONSTITUTION rootAllowlist; L1: sanctioned delta)
  const topology = {
    description: 'test registry',
    version: '1.0.0',
    domains: ['co-develop', 'co-design', 'co-security'],
    categories: ['variant-identity', 'hub-doctrine', 'hub-escalation', 'incident-escalation'],
    hubs: [],
    entries: [],
    known_unregistered_duplicates: [],
  };
  const rootSchema = { version: '1.9.0', rootAllowlist: { files: ['CONSTITUTION.md', 'AGENTS.md'] }, _notes: {}, hub_topology: topology };
  const l1Schema = {
    version: '1.9.0',
    rootAllowlist: { files: ['AGENTS.md'] },
    _notes: { root_allowlist_divergence: 'intentional' },
    hub_topology: topology,
  };
  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, 'docs', 'templates'), { recursive: true });
  mkdirSync(join(root, 'templates', 'common', 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'workspace-schema.json'), JSON.stringify(rootSchema, null, 2) + '\n');
  writeFileSync(join(root, 'templates', 'common', 'docs', 'workspace-schema.json'), JSON.stringify(l1Schema, null, 2) + '\n');
  writeFileSync(join(root, 'docs', 'templates', 'common-contract.json'), JSON.stringify({ common_skills: {}, common_agents: {} }));

  // hub + consumer variants
  for (const v of ['co-security', 'co-design']) {
    mkdirSync(join(root, 'templates', v), { recursive: true });
    writeFileSync(join(root, 'templates', v, 'variant.json'), JSON.stringify({
      name: v, description: `${v} fixture variant`, status: 'stable', version: '1.0.0',
      lifecycle: { statusSince: '2026-01-01', lastTransition: 'initial' },
      agents: [], skills: [],
    }, null, 4) + '\n');
  }
  // L3 source asset + dest parent dir
  mkdirSync(join(root, 'Projects', 'co-security', 'skills', 'threat-review'), { recursive: true });
  writeFileSync(join(root, 'Projects', 'co-security', 'skills', 'threat-review', 'SKILL.md'), '---\nname: threat-review\n---\n\ncanonical content v1.1.0\n');
  mkdirSync(join(root, 'templates', 'co-security', 'skills'), { recursive: true });
  return root;
}

function writeManifest(root: string, manifest: Record<string, unknown>): string {
  const dir = join(root, 'docs', 'hub-suites');
  mkdirSync(dir, { recursive: true });
  const p = join(dir, 'test-suite.suite.json');
  writeFileSync(p, JSON.stringify(manifest, null, 2) + '\n');
  return 'docs/hub-suites/test-suite.suite.json';
}

const REGISTRY_ROW = {
  asset: 'threat-review',
  domain: 'co-security',
  hub_variant: 'co-security',
  category: 'hub-doctrine',
  verticals: ['co-design'],
  origin: 'hub project',
  canonical_path: 'skills/threat-review/SKILL.md',
  version: '1.1.0',
  consumers: [{ variant: 'co-design', minimum_version: '1.0.0' }],
  hub_remote: 'git@github.com:org/co-security.git',
  state_ref: '.pipeline-state/hub-co-security.state.json',
};

function baseManifest(): SuiteManifest {
  return {
    suite: 'test-suite',
    hub_variant: 'co-security',
    assets: [{ source: 'Projects/co-security/skills/threat-review/SKILL.md', dest: 'templates/co-security/skills/threat-review/SKILL.md', kind: 'skill', name: 'threat-review' }],
    contract_updates: [{ variant: 'co-security', type: 'roster', list: 'skills', entry: { name: 'threat-review', file: 'skills/threat-review/SKILL.md', version: '1.1.0' } }],
    registry_entries: [REGISTRY_ROW],
  };
}

const OK_VALIDATOR = () => ({ ok: true, output: '' });
const FAIL_VALIDATOR = () => ({ ok: false, output: '[FAIL] something broke\n' });

// ── Manifest parsing ──────────────────────────────────────────────────────

describe('parseSuiteManifest', () => {
  test('accepts a valid manifest', () => {
    const res = parseSuiteManifest(JSON.stringify(baseManifest()));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.manifest.suite).toBe('test-suite');
  });

  test('rejects invalid JSON', () => {
    const res = parseSuiteManifest('{ not json');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]).toContain('not valid JSON');
  });

  test('rejects missing suite/hub_variant and empty assets', () => {
    const res = parseSuiteManifest(JSON.stringify({ assets: [] }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some(e => e.includes('"suite"'))).toBe(true);
      expect(res.errors.some(e => e.includes('"hub_variant"'))).toBe(true);
      expect(res.errors.some(e => e.includes('"assets"'))).toBe(true);
    }
  });

  test('rejects traversal and absolute paths, and dest outside templates/', () => {
    const m = baseManifest();
    m.assets = [
      { source: '../escape/SKILL.md', dest: 'templates/co-security/skills/x/SKILL.md', kind: 'skill', name: 'x' },
      { source: '/abs/SKILL.md', dest: 'templates/co-security/skills/y/SKILL.md', kind: 'skill', name: 'y' },
      { source: 'Projects/co-security/a.md', dest: 'docs/not-templates/a.md', kind: 'file', name: 'a' },
    ];
    const res = parseSuiteManifest(JSON.stringify(m));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some(e => e.includes('traversal-free'))).toBe(true);
      expect(res.errors.some(e => e.includes('under templates/'))).toBe(true);
    }
  });

  test('isSafeRepoPath rejects dot segments and backslashes', () => {
    expect(isSafeRepoPath('templates/co-security/skills/x/SKILL.md')).toBe(true);
    expect(isSafeRepoPath('templates/../etc/passwd')).toBe(false);
    expect(isSafeRepoPath('/etc/passwd')).toBe(false);
    expect(isSafeRepoPath('a\\b')).toBe(false);
    expect(isSafeRepoPath('a//b')).toBe(false);
  });
});

// ── Repo-grounded validation ──────────────────────────────────────────────

describe('validateSuiteAgainstRepo', () => {
  test('flags a missing source file', () => {
    const root = makeFixture();
    const m = baseManifest();
    m.assets[0]!.source = 'Projects/co-security/skills/absent/SKILL.md';
    const errors = validateSuiteAgainstRepo(m, root);
    expect(errors.some(e => e.includes('source does not exist'))).toBe(true);
  });

  test('flags registry rows with bad enums, non-semver versions, and hub_variant mismatch', () => {
    const root = makeFixture();
    const m = baseManifest();
    m.registry_entries = [
      { ...REGISTRY_ROW, domain: 'co-unknown', version: 'not-semver', hub_variant: 'co-design' },
    ];
    const errors = validateSuiteAgainstRepo(m, root);
    expect(errors.some(e => e.includes('not in hub_topology.domains'))).toBe(true);
    expect(errors.some(e => e.includes('not MAJOR.MINOR.PATCH semver'))).toBe(true);
    expect(errors.some(e => e.includes('does not match the manifest hub_variant'))).toBe(true);
  });
});

// ── End-to-end suite semantics on fixtures ────────────────────────────────

describe('promoteSuite', () => {
  test('dry-run writes nothing and reports the plan', () => {
    const root = makeFixture();
    const manifestPath = writeManifest(root, baseManifest());
    const before = snapshot(root);
    const res = promoteSuite({ rootDir: root, manifestPath, apply: false, runValidator: OK_VALIDATOR });
    expect(res.ok).toBe(true);
    expect(res.dryRun).toBe(true);
    expect(res.actions.some(a => a.includes('DRY-RUN'))).toBe(true);
    expect(snapshot(root)).toEqual(before); // byte-for-byte untouched
  });

  test('--apply swaps assets, contract updates, and registry entries into BOTH schema copies; re-run is an already-promoted no-op', () => {
    const root = makeFixture();
    const manifestPath = writeManifest(root, baseManifest());

    const first = promoteSuite({ rootDir: root, manifestPath, apply: true, runValidator: OK_VALIDATOR });
    expect(first.errors).toEqual([]);
    expect(first.ok).toBe(true);

    // asset landed with source content
    expect(readFileSync(join(root, 'templates/co-security/skills/threat-review/SKILL.md'), 'utf-8')).toContain('canonical content v1.1.0');
    // contract entry upserted
    const vj = JSON.parse(readFileSync(join(root, 'templates/co-security/variant.json'), 'utf-8'));
    expect(vj.skills.some((s: { name: string }) => s.name === 'threat-review')).toBe(true);
    // registry entries present and IDENTICAL in both copies
    const rootSchema = JSON.parse(readFileSync(join(root, 'docs/workspace-schema.json'), 'utf-8'));
    const l1Schema = JSON.parse(readFileSync(join(root, 'templates/common/docs/workspace-schema.json'), 'utf-8'));
    expect(rootSchema.hub_topology.entries).toHaveLength(1);
    expect(JSON.stringify(rootSchema.hub_topology.entries)).toEqual(JSON.stringify(l1Schema.hub_topology.entries));
    expect(rootSchema.hub_topology.entries[0].asset).toBe('threat-review');
    // sanctioned L1 delta preserved (rootAllowlist CONSTITUTION entry NOT copied over)
    expect(l1Schema.rootAllowlist.files).not.toContain('CONSTITUTION.md');
    expect(l1Schema._notes.root_allowlist_divergence).toBeDefined();
    // staging cleaned up on success
    expect(existsSync(join(root, '.pipeline-state/hub-promotion'))).toBe(false);

    // idempotent re-run
    const second = promoteSuite({ rootDir: root, manifestPath, apply: true, runValidator: OK_VALIDATOR });
    expect(second.ok).toBe(true);
    expect(second.alreadyPromoted).toBe(true);
    expect(second.actions.some(a => a.includes('already promoted'))).toBe(true);
  });

  test('post-swap validator failure rolls every swapped file back and writes the blocking marker', () => {
    const root = makeFixture();
    const manifestPath = writeManifest(root, baseManifest());
    const before = snapshot(root);

    const res = promoteSuite({ rootDir: root, manifestPath, apply: true, runValidator: FAIL_VALIDATOR });
    expect(res.ok).toBe(false);
    expect(res.markerPath).toBeDefined();
    expect(existsSync(res.markerPath!)).toBe(true);
    // previous state fully restored — the ONLY intended residue is the
    // gitignored .pipeline-state failure marker, which the snapshot excludes
    expect(withoutPipelineState(snapshot(root))).toEqual(withoutPipelineState(before));
    expect(readFileSync(join(root, 'templates/co-security/variant.json'), 'utf-8')).not.toContain('threat-review');

    // the marker blocks re-runs until diagnosed and removed
    const blocked = promoteSuite({ rootDir: root, manifestPath, apply: true, runValidator: OK_VALIDATOR });
    expect(blocked.ok).toBe(false);
    expect(blocked.errors[0]).toContain('failure marker exists');
  });

  test('invalid manifest fails before any write, without a marker', () => {
    const root = makeFixture();
    const manifestPath = writeManifest(root, { suite: 'BAD SUITE', hub_variant: 'co-security', assets: [] });
    const before = snapshot(root);
    const res = promoteSuite({ rootDir: root, manifestPath, apply: true, runValidator: OK_VALIDATOR });
    expect(res.ok).toBe(false);
    expect(snapshot(root)).toEqual(before);
    expect(res.markerPath).toBeUndefined();
  });
});

// ── Registry textual upsert ───────────────────────────────────────────────

describe('upsertRegistryEntriesInText', () => {
  test('preserves the file byte-for-byte outside the hub_topology section and is idempotent', () => {
    const root = makeFixture();
    const schemaPath = join(root, 'docs/workspace-schema.json');
    const original = readFileSync(schemaPath, 'utf-8');
    const prefix = original.slice(0, original.indexOf('"hub_topology"'));

    const once = upsertRegistryEntriesInText(original, [REGISTRY_ROW as never]);
    expect(once.slice(0, once.indexOf('"hub_topology"'))).toEqual(prefix); // untouched head
    expect(once.endsWith('}\n')).toBe(true);
    const twice = upsertRegistryEntriesInText(once, [REGISTRY_ROW as never]);
    expect(twice).toEqual(once); // same row → same bytes (upsert, not append)

    // version update replaces in place, never duplicates
    const bumped = upsertRegistryEntriesInText(once, [{ ...REGISTRY_ROW, version: '1.2.0' } as never]);
    const parsed = JSON.parse(bumped);
    expect(parsed.hub_topology.entries).toHaveLength(1);
    expect(parsed.hub_topology.entries[0].version).toBe('1.2.0');
  });

  test('rendering root and L1 through the same function yields identical sections', () => {
    const root = makeFixture();
    const rootText = readFileSync(join(root, 'docs/workspace-schema.json'), 'utf-8');
    const l1Text = readFileSync(join(root, 'templates/common/docs/workspace-schema.json'), 'utf-8');
    const rootPatched = upsertRegistryEntriesInText(rootText, [REGISTRY_ROW as never]);
    const l1Patched = upsertRegistryEntriesInText(l1Text, [REGISTRY_ROW as never]);
    const sectionOf = (t: string) => t.slice(t.indexOf('"hub_topology"'));
    expect(sectionOf(rootPatched)).toEqual(sectionOf(l1Patched));
  });
});

describe('contractEntryPresent', () => {
  test('detects an exact entry and ignores same-name-different-content', () => {
    const vj = { skills: [{ name: 'threat-review', file: 'skills/threat-review/SKILL.md', version: '1.1.0' }] };
    const update = { variant: 'co-security', type: 'roster' as const, list: 'skills' as const, entry: { name: 'threat-review', file: 'skills/threat-review/SKILL.md', version: '1.1.0' } };
    expect(contractEntryPresent(vj, update)).toBe(true);
    expect(contractEntryPresent(vj, { ...update, entry: { ...update.entry, version: '9.9.9' } })).toBe(false);
    expect(contractEntryPresent({}, update)).toBe(false);
  });
});

// ── helpers ───────────────────────────────────────────────────────────────

function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of readdirSorted(dir)) {
      const p = join(dir, e);
      if (statIsDir(p)) walk(p);
      // keys are separator-neutral repo-relative strings: win32 join yields
      // backslashes, which withoutPipelineState's '/.pipeline-state/' filter
      // would miss (the windows-latest CI failure). POSIX keys contain no
      // backslash, so this is a no-op on macos/ubuntu.
      else out[p.slice(root.length).replace(/\\/g, '/')] = readFileSync(p, 'utf-8');
    }
  };
  walk(root);
  return out;
}

function withoutPipelineState(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) {
    if (!k.startsWith('/.pipeline-state/')) out[k] = v;
  }
  return out;
}

function readdirSorted(dir: string): string[] {
  try {
    return readdirSync(dir).sort();
  } catch {
    return [];
  }
}

function statIsDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
