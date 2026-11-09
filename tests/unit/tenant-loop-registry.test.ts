/**
 * Registry load matrix for the tenant-loop SSOT reader (design
 * docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §3.1/§7.1):
 * loadTenantLoopRegistry + validateTenantLoopRegistryPayload +
 * listTenantLoopProjects. Fail-closed semantics pinned: absent/stale(>24h)/
 * schema-major → zero tenants (no historical behavior to fall back to), with
 * distinct error kinds surfaced for logs; malformed → throw with the detail.
 * All fixtures are mkdtempSync workspaces with ABSOLUTE tmpdir roots — never
 * relative paths that could recreate a repo-root Projects/ (the
 * T-20261104-003 / PR #1855 lesson).
 *
 * @version 1.0.0
 */
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadTenantLoopRegistry,
  listTenantLoopProjects,
  tenantLoopRegistryPath,
  TENANT_LOOP_STALE_MS,
} from '../../scripts/lib/fleet.ts';
import { validateTenantLoopRegistryPayload } from '../../scripts/lib/fleet.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'tenant-reg-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function nowIso(): string {
  return new Date().toISOString();
}

function writeRegistry(payload: unknown, fixtureRoot: string = root): void {
  mkdirSync(join(fixtureRoot, '.pipeline-state'), { recursive: true });
  writeFileSync(tenantLoopRegistryPath(fixtureRoot), typeof payload === 'string' ? payload : JSON.stringify(payload), 'utf-8');
}

function validTenant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'gw-0123456789ab',
    principal: 'operator@example.com',
    variant: 'co-consult',
    projectDir: '/tmp/does-not-need-to-exist-for-validation',
    status: 'active',
    scopes: { upgrade: true, upstreamFile: true, backportReview: false, nightlyFleet: true },
    windows: { tz: 'Asia/Seoul', days: [0, 1, 2, 3, 4, 5, 6], start: '22:00', end: '06:00' },
    gitRemote: 'local-only',
    ...overrides,
  };
}

function validRegistry(tenants: unknown[] = [validTenant()]): Record<string, unknown> {
  return { schemaVersion: 1, writtenAt: nowIso(), tenants };
}

describe('loadTenantLoopRegistry — valid file (design §3.1 schema)', () => {
  test('parses every field into the typed shape', () => {
    writeRegistry(validRegistry());
    const r = loadTenantLoopRegistry(root);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.registry.schemaVersion).toBe(1);
    expect(r.registry.tenants).toHaveLength(1);
    const t = r.registry.tenants[0];
    expect(t.id).toBe('gw-0123456789ab');
    expect(t.principal).toBe('operator@example.com');
    expect(t.variant).toBe('co-consult');
    expect(t.status).toBe('active');
    expect(t.scopes).toEqual({ upgrade: true, upstreamFile: true, backportReview: false, nightlyFleet: true });
    expect(t.windows).toEqual({ tz: 'Asia/Seoul', days: [0, 1, 2, 3, 4, 5, 6], start: '22:00', end: '06:00' });
    expect(t.gitRemote).toBe('local-only');
  });

  test('unknown row keys are ignored forward-compatibly (fleet registry convention)', () => {
    writeRegistry(validRegistry([{ ...validTenant(), loopGroup: 'g-1', futureField: 42 }]));
    const r = loadTenantLoopRegistry(root);
    expect(r.ok).toBe(true);
  });
});

describe('fail-closed matrix (design §3.1 table)', () => {
  test('file absent → zero tenants, error absent-file, list does not throw', () => {
    const r = loadTenantLoopRegistry(root);
    expect(r).toEqual({ ok: false, error: 'absent-file' });
    expect(listTenantLoopProjects(root)).toEqual([]);
  });

  test('invalid JSON → malformed with the path in the detail; list THROWS (§6)', () => {
    writeRegistry('{ not json');
    const r = loadTenantLoopRegistry(root);
    expect(r.ok).toBe(false);
    if (r.ok || r.error !== 'malformed') return;
    expect(r.detail).toContain('tenant-loop-registry.json');
    expect(() => listTenantLoopProjects(root)).toThrow(/Malformed tenant-loop registry/);
  });

  test('stale writtenAt (25h old) → zero tenants with distinct stale detail', () => {
    const stale = new Date(Date.now() - TENANT_LOOP_STALE_MS - 60_000).toISOString();
    writeRegistry({ schemaVersion: 1, writtenAt: stale, tenants: [validTenant()] });
    const r = loadTenantLoopRegistry(root);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('stale');
    if (r.error !== 'stale') return;
    expect(r.detail).toContain('24h');
    expect(listTenantLoopProjects(root)).toEqual([]);
  });

  test('writtenAt within 24h is NOT stale (boundary sanity)', () => {
    const fresh = new Date(Date.now() - TENANT_LOOP_STALE_MS + 3_600_000).toISOString();
    writeRegistry({ schemaVersion: 1, writtenAt: fresh, tenants: [validTenant()] });
    expect(loadTenantLoopRegistry(root).ok).toBe(true);
  });

  test('schemaVersion 2 (major bump) → treated as absent: zero tenants, schema-major kind', () => {
    writeRegistry({ schemaVersion: 2, writtenAt: nowIso(), tenants: [validTenant()] });
    const r = loadTenantLoopRegistry(root);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('schema-major');
    expect(listTenantLoopProjects(root)).toEqual([]);
  });

  test('schemaVersion 0 / non-integer / string → malformed (not schema-major)', () => {
    for (const sv of [0, 1.5, '1', null]) {
      writeRegistry({ schemaVersion: sv, writtenAt: nowIso(), tenants: [] });
      const r = loadTenantLoopRegistry(root);
      expect(r.ok).toBe(false);
      if (!r.ok && r.error !== 'absent-file') expect(r.error).toBe('malformed');
    }
  });

  test('writtenAt unparseable → malformed', () => {
    writeRegistry({ schemaVersion: 1, writtenAt: 'not-a-timestamp', tenants: [] });
    expect(loadTenantLoopRegistry(root).ok).toBe(false);
  });
});

describe('row validation — every invalid shape fails closed with a useful detail (design §7.1)', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['fleet-namespace id is rejected', validTenant({ id: 'co-wrongnamespace' })],
    ['13 hex digits rejected', validTenant({ id: 'gw-0123456789abc' })],
    ['11 hex digits rejected', validTenant({ id: 'gw-0123456789a' })],
    ['uppercase id rejected', validTenant({ id: 'GW-0123456789AB' })],
    ['non-string id rejected', validTenant({ id: 42 })],
    ['empty principal rejected', validTenant({ principal: '   ' })],
    ['non co-* variant rejected', validTenant({ variant: 'consult' })],
    ['relative projectDir rejected', validTenant({ projectDir: 'storage/p/project' })],
    ['empty projectDir rejected', validTenant({ projectDir: '' })],
    ['unknown status rejected', validTenant({ status: 'paused' })],
    ['scopes missing a key rejected', validTenant({ scopes: { upgrade: true, upstreamFile: true, nightlyFleet: true } })],
    ['scopes extra key rejected', validTenant({ scopes: { upgrade: true, upstreamFile: true, backportReview: true, nightlyFleet: true, extra: true } })],
    ['scopes non-boolean rejected', validTenant({ scopes: { upgrade: 'yes', upstreamFile: true, backportReview: true, nightlyFleet: true } })],
    ['scopes non-object rejected', validTenant({ scopes: 'all' })],
    ['windows.tz empty rejected', validTenant({ windows: { tz: '', days: [1], start: '09:00', end: '17:00' } })],
    ['windows.days 7 rejected', validTenant({ windows: { tz: 'UTC', days: [7], start: '09:00', end: '17:00' } })],
    ['windows.days -1 rejected', validTenant({ windows: { tz: 'UTC', days: [-1], start: '09:00', end: '17:00' } })],
    ['windows.days float rejected', validTenant({ windows: { tz: 'UTC', days: [1.5], start: '09:00', end: '17:00' } })],
    ['windows.days non-array rejected', validTenant({ windows: { tz: 'UTC', days: 'weekdays', start: '09:00', end: '17:00' } })],
    ['windows.days empty rejected', validTenant({ windows: { tz: 'UTC', days: [], start: '09:00', end: '17:00' } })],
    ['windows.start 24:00 rejected', validTenant({ windows: { tz: 'UTC', days: [1], start: '24:00', end: '17:00' } })],
    ['windows.end 22:60 rejected', validTenant({ windows: { tz: 'UTC', days: [1], start: '09:00', end: '22:60' } })],
    ['windows.start 9:00 (one digit) rejected', validTenant({ windows: { tz: 'UTC', days: [1], start: '9:00', end: '17:00' } })],
    ['windows non-object rejected', validTenant({ windows: 'always' })],
    ['empty gitRemote rejected', validTenant({ gitRemote: '' })],
  ];

  for (const [label, tenant] of cases) {
    test(label, () => {
      const v = validateTenantLoopRegistryPayload(validRegistry([tenant]));
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.detail.length).toBeGreaterThan(0);
    });
  }

  test('duplicate tenant id rejected', () => {
    const v = validateTenantLoopRegistryPayload(validRegistry([validTenant(), validTenant()]));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.detail).toContain('duplicate');
  });

  test('tenants not an array rejected; non-object payload rejected', () => {
    expect(validateTenantLoopRegistryPayload({ schemaVersion: 1, writtenAt: nowIso(), tenants: 'none' }).ok).toBe(false);
    expect(validateTenantLoopRegistryPayload([1, 2]).ok).toBe(false);
    expect(validateTenantLoopRegistryPayload('nope').ok).toBe(false);
  });
});

describe('listTenantLoopProjects filters + determinism (design §3.2)', () => {
  test('only nightlyFleet:true AND status:active tenants are returned, sorted by id', () => {
    writeRegistry(validRegistry([
      validTenant({ id: 'gw-ffffffffffff' }), // active + nightly → in
      validTenant({ id: 'gw-bbbbbbbbbbbb', status: 'suspended' }), // suspended → out
      validTenant({ id: 'gw-cccccccccccc', scopes: { upgrade: true, upstreamFile: true, backportReview: true, nightlyFleet: false } }), // nightly off → out
      validTenant({ id: 'gw-aaaaaaaaaaaa' }), // active + nightly → in, sorts first
    ]));
    const list = listTenantLoopProjects(root);
    expect(list.map((t) => t.id)).toEqual(['gw-aaaaaaaaaaaa', 'gw-ffffffffffff']);
  });

  test('injected-root determinism: two roots never cross', () => {
    const other = mkdtempSync(join(tmpdir(), 'tenant-reg-'));
    try {
      writeRegistry(validRegistry([validTenant()]));
      expect(listTenantLoopProjects(root)).toHaveLength(1);
      expect(listTenantLoopProjects(other)).toEqual([]); // no registry file there
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  test('registry under a fixture root is read at the declared path', () => {
    expect(tenantLoopRegistryPath('/x')).toBe(join('/x', '.pipeline-state', 'tenant-loop-registry.json'));
  });
});
