#!/usr/bin/env bun
// hub-topology-legs.test.ts — unit contract for scripts/helpers/hub-topology.ts
// and the three validate-templates.ts hub legs + the audit.ts hub-resolve
// checker semantics (design docs/designs/2026-11-01-hub-consolidation-design.md
// §2.4). Negative classes from design §14.2 are covered here at helper level
// (a seeded unregistered duplication FAILs; a below-minimum consumer FAILs)
// on mkdtempSync fixtures — the full validator battery is NOT spawned in unit
// tests (test-budget policy); real-tree greenness is pinned by the two
// real-workspace assertions at the bottom.
//
// @version 1.0.0
import { describe, test, expect, afterAll } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseSemver,
  semverCompare,
  validateHubTopologyShape,
  findCrossVariantDuplicates,
  loadCommonContractNames,
  checkUnregisteredDuplicates,
  checkVariantIdentity,
  checkConsumerMinimumVersions,
  loadConsumingVariants,
  loadHubTopology,
  type HubTopology,
} from '../../scripts/helpers/hub-topology.ts';
import { cwd } from 'node:process';

const CLEANUPS: string[] = [];
function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'hub-legs-test-'));
  CLEANUPS.push(root);
  return root;
}
afterAll(() => {
  for (const dir of CLEANUPS) rmSync(dir, { recursive: true, force: true });
});

function topologyWith(overrides: Partial<HubTopology>): HubTopology {
  return {
    domains: ['co-develop', 'co-design', 'co-security'],
    categories: ['variant-identity', 'hub-doctrine', 'hub-escalation', 'incident-escalation'],
    capability_enum: {
      'pentest-execution': { never_in_degraded: true },
      'routine-triage': { never_in_degraded: false },
    },
    hubs: [],
    entries: [],
    known_unregistered_duplicates: [],
    ...overrides,
  } as HubTopology;
}

describe('semver', () => {
  test('parseSemver is strict MAJOR.MINOR.PATCH', () => {
    expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseSemver('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
    expect(parseSemver('1.2')).toBeNull();
    expect(parseSemver('1.2.3.4')).toBeNull();
    expect(parseSemver('v1.2.3')).toBeNull();
    expect(parseSemver('01.2.3')).toBeNull();
    expect(parseSemver(undefined)).toBeNull();
    expect(parseSemver(42)).toBeNull();
  });

  test('semverCompare orders numerically, not lexically', () => {
    expect(semverCompare(parseSemver('1.10.0')!, parseSemver('1.9.0')!)).toBe(1);
    expect(semverCompare(parseSemver('2.0.0')!, parseSemver('10.0.0')!)).toBe(-1);
    expect(semverCompare(parseSemver('1.2.3')!, parseSemver('1.2.3')!)).toBe(0);
  });
});

describe('validateHubTopologyShape (leg 0 — fail-closed)', () => {
  test('a well-formed registry passes', () => {
    const t = topologyWith({
      entries: [{ asset: 'threat-review', domain: 'co-security', hub_variant: 'co-security', category: 'hub-doctrine', canonical_path: 'skills/threat-review/SKILL.md', version: '1.1.0' }],
      hubs: [{ name: 'co-security', hub_remote: 'git@example.com:x.git', capabilities: ['pentest-execution'] }],
      known_unregistered_duplicates: [{ asset: 'code-review', kind: 'skill', variants: ['co-develop', 'co-game'] }],
    });
    expect(validateHubTopologyShape(t)).toEqual([]);
  });

  test('bad enums, missing fields, non-semver versions, and unknown capability keys all violate', () => {
    const t = topologyWith({
      entries: [
        { asset: 'x', domain: 'co-unknown', hub_variant: 'co-security', category: 'mystery', canonical_path: 'a.md', version: '1.0' },
        { asset: 'x', domain: 'co-unknown', hub_variant: 'co-security', category: 'hub-doctrine', canonical_path: 'a.md', version: '1.0.0' },
      ],
      hubs: [{ name: 'co-security', hub_remote: 'git@example.com:x.git', capabilities: ['time-travel'] }],
      known_unregistered_duplicates: [{ asset: 'solo', kind: 'macro', variants: ['only-one'] }],
    });
    const errors = validateHubTopologyShape(t);
    expect(errors.some(e => e.includes('domain "co-unknown"'))).toBe(true);
    expect(errors.some(e => e.includes('category "mystery"'))).toBe(true);
    expect(errors.some(e => e.includes('version "1.0" is not'))).toBe(true);
    expect(errors.some(e => e.includes('capability "time-travel"'))).toBe(true);
    expect(errors.some(e => e.includes('duplicates (asset, domain)'))).toBe(true);
    expect(errors.some(e => e.includes('kind must be "skill" or "agent"'))).toBe(true);
    expect(errors.some(e => e.includes('variants must be an array of >= 2'))).toBe(true);
  });
});

describe('findCrossVariantDuplicates (leg 1 derivation)', () => {
  test('finds non-common multi-variant assets, excludes common contract + README, on a fixture', () => {
    const root = makeFixture();
    for (const v of ['co-develop', 'co-game']) {
      mkdirSync(join(root, 'templates', v, 'skills', 'code-review'), { recursive: true });
      writeFileSync(join(root, 'templates', v, 'skills', 'code-review', 'SKILL.md'), 'shared\n');
      mkdirSync(join(root, 'templates', v, 'agents'), { recursive: true });
      writeFileSync(join(root, 'templates', v, 'agents', 'architect.md'), 'agent\n');
      writeFileSync(join(root, 'templates', v, 'agents', 'README.md'), 'docs, not an agent\n');
      writeFileSync(join(root, 'templates', v, 'variant.json'), JSON.stringify({ name: v }));
    }
    mkdirSync(join(root, 'templates', 'co-develop', 'skills', 'solo'), { recursive: true });
    writeFileSync(join(root, 'templates', 'co-develop', 'skills', 'solo', 'SKILL.md'), 'single-variant\n');
    // common contract excludes code-review (delivered L1-common, NOT duplication)
    mkdirSync(join(root, 'docs', 'templates'), { recursive: true });
    writeFileSync(join(root, 'docs', 'templates', 'common-contract.json'), JSON.stringify({ common_skills: { 'code-review': {} }, common_agents: { pm: {} } }));

    const dups = findCrossVariantDuplicates(root);
    expect(dups).toEqual([{ asset: 'architect', kind: 'agent', variants: ['co-develop', 'co-game'] }]);
    expect(loadCommonContractNames(root).has('code-review')).toBe(true);
  });
});

describe('checkUnregisteredDuplicates (leg 1)', () => {
  const dup = { asset: 'code-review', kind: 'skill' as const, variants: ['co-develop', 'co-game'] };

  test('unregistered duplicate FAILs', () => {
    const res = checkUnregisteredDuplicates(topologyWith({}), [dup]);
    expect(res.fails).toHaveLength(1);
    expect(res.fails[0]).toContain('unregistered cross-variant duplication');
  });

  test('declared soak row WARNs; registered row is silent; stale soak row WARNs', () => {
    const soaked = checkUnregisteredDuplicates(topologyWith({ known_unregistered_duplicates: [{ asset: 'code-review', kind: 'skill', variants: ['co-develop', 'co-game'] }] }), [dup]);
    expect(soaked.fails).toHaveLength(0);
    expect(soaked.warns.some(w => w.includes('declared in known_unregistered_duplicates'))).toBe(true);

    const registered = checkUnregisteredDuplicates(topologyWith({ entries: [{ asset: 'code-review', domain: 'co-develop', hub_variant: 'co-develop', category: 'hub-doctrine', canonical_path: 'skills/code-review/SKILL.md', version: '1.0.0' }] }), [dup]);
    expect(registered.fails).toHaveLength(0);
    expect(registered.warns).toHaveLength(0);

    const stale = checkUnregisteredDuplicates(topologyWith({ known_unregistered_duplicates: [{ asset: 'ghost', kind: 'skill', variants: ['co-develop', 'co-game'] }] }), [dup]);
    expect(stale.warns.some(w => w.includes("stale"))).toBe(true);
  });
});

describe('checkVariantIdentity (leg 2)', () => {
  test('a variant-identity asset copied into a foreign variant FAILs; the owning variant is fine', () => {
    const root = makeFixture();
    for (const v of ['co-security', 'co-design']) {
      mkdirSync(join(root, 'templates', v, 'agents'), { recursive: true });
      writeFileSync(join(root, 'templates', v, 'variant.json'), JSON.stringify({ name: v }));
    }
    writeFileSync(join(root, 'templates', 'co-security', 'agents', 'security-monitor.md'), 'identity\n');
    writeFileSync(join(root, 'templates', 'co-design', 'agents', 'security-monitor.md'), 'clobber copy\n');

    const t = topologyWith({
      entries: [{ asset: 'security-monitor', domain: 'co-security', hub_variant: 'co-security', category: 'variant-identity', canonical_path: 'agents/security-monitor.md', version: '2.0.0' }],
    });
    const res = checkVariantIdentity(t, root);
    expect(res.fails).toHaveLength(1);
    expect(res.fails[0]).toContain('unauthorized promotion/copy of identity content');
    expect(res.fails[0]).toContain('co-design');
  });

  test('vacuously clean with no variant-identity entries', () => {
    const res = checkVariantIdentity(topologyWith({}), mkdtempSyncSafe());
    expect(res.fails).toHaveLength(0);
    expect(res.passes[0]).toContain('vacuously clean');
  });
});

describe('checkConsumerMinimumVersions (leg 3 + audit hub-resolve semantics)', () => {
  const entry = { asset: 'threat-review', domain: 'co-security', hub_variant: 'co-security', category: 'hub-doctrine', canonical_path: 'skills/threat-review/SKILL.md', version: '1.1.0' };

  test('vacuously green with an empty registry (entries start empty at Phase 1 landing)', () => {
    const res = checkConsumerMinimumVersions(topologyWith({}), [{ variant: 'co-design', hubBlock: { role: 'consumer', consumes: [{ domain: 'co-security', minimum_version: '99.0.0' }] } }]);
    expect(res.fails).toHaveLength(0);
    expect(res.passes[0]).toContain('all minimum_version declarations satisfied');
  });

  test('a consumer below its declared minimum FAILs once entries land (design §14.2 negative)', () => {
    const t = topologyWith({ entries: [entry] });
    const res = checkConsumerMinimumVersions(t, [{ variant: 'co-design', hubBlock: { role: 'consumer', consumes: [{ domain: 'co-security', minimum_version: '2.0.0' }] } }]);
    expect(res.fails).toHaveLength(1);
    expect(res.fails[0]).toContain('consumer below minimum');
  });

  test('a satisfied minimum passes; unknown domain WARNs; non-semver minimum FAILs', () => {
    const t = topologyWith({ entries: [entry] });
    const ok = checkConsumerMinimumVersions(t, [{ variant: 'co-design', hubBlock: { consumes: [{ domain: 'co-security', minimum_version: '1.1.0' }] } }]);
    expect(ok.fails).toHaveLength(0);

    const unknownDomain = checkConsumerMinimumVersions(t, [{ variant: 'co-design', hubBlock: { consumes: [{ domain: 'co-unknown', minimum_version: '1.0.0' }] } }]);
    expect(unknownDomain.fails).toHaveLength(0);
    expect(unknownDomain.warns.some(w => w.includes('unknown domain'))).toBe(true);

    const badSemver = checkConsumerMinimumVersions(t, [{ variant: 'co-design', hubBlock: { consumes: [{ domain: 'co-security', minimum_version: 'latest' }] } }]);
    expect(badSemver.fails.some(f => f.includes('not MAJOR.MINOR.PATCH semver'))).toBe(true);
  });

  test('loadConsumingVariants reads hub blocks and skips variants without one', () => {
    const root = makeFixture();
    for (const v of ['co-design', 'co-develop']) {
      mkdirSync(join(root, 'templates', v), { recursive: true });
      const body: Record<string, unknown> = { name: v };
      if (v === 'co-design') body.hub = { role: 'consumer', consumes: [{ domain: 'co-security', minimum_version: '1.0.0' }] };
      writeFileSync(join(root, 'templates', v, 'variant.json'), JSON.stringify(body));
    }
    const consumers = loadConsumingVariants(root);
    expect(consumers).toHaveLength(1);
    expect(consumers[0]!.variant).toBe('co-design');
  });
});

describe('loadHubTopology', () => {
  test('absent file and absent section are clean skips, malformed JSON is an error', () => {
    const empty = makeFixture();
    expect(loadHubTopology(empty)).toEqual({ ok: false, error: 'absent-file' });

    const root = makeFixture();
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs', 'workspace-schema.json'), '{"other": true}');
    expect(loadHubTopology(root)).toEqual({ ok: false, error: 'absent-section' });

    writeFileSync(join(root, 'docs', 'workspace-schema.json'), 'NOT JSON');
    const res = loadHubTopology(root);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('not valid JSON');
  });
});

// ── Real-workspace pins (keep the battery green; catch inventory drift) ────
describe('real workspace registry', () => {
  const REAL = cwd();
  test('the landed registry is shape-valid', () => {
    const loaded = loadHubTopology(REAL);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(validateHubTopologyShape(loaded.topology!)).toEqual([]);
  });

  test('every real duplicate is covered by entries or the declared soak (validate-templates stays green)', () => {
    const loaded = loadHubTopology(REAL);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const dups = findCrossVariantDuplicates(REAL);
    const leg = checkUnregisteredDuplicates(loaded.topology!, dups);
    expect(leg.fails).toEqual([]);
  });
});

function mkdtempSyncSafe(): string {
  return makeFixture();
}
