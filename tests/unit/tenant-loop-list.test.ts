/**
 * listTenantLoopProjects + tenant path helpers over mkdtemp fixtures (design
 * docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §3.2/§7.2):
 * injected-root determinism, namespace separation from the fleet SSOT
 * (a fleet path is never a tenant path and vice versa), sibling-prefix
 * overlap defense, symlinked paths, and the root-equality guard.
 * ABSOLUTE tmpdir roots only — never relative roots that could recreate a
 * repo-root Projects/ (the T-20261104-003 / PR #1855 lesson).
 *
 * @version 1.0.0
 */
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import {
  isFleetProjectPath,
  isTenantLoopProjectPath,
  listTenantLoopProjects,
  tenantForProjectPath,
  tenantLoopRegistryPath,
} from '../../scripts/lib/fleet.ts';

let root: string;
let storage: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'tenant-list-'));
  storage = join(root, 'storage');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function tenantDir(id: string): string {
  // Mirrors the gateway storage layout: storage/<principal>/<folder>/project
  const dir = join(storage, 'op', id, 'project');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeRegistry(tenants: Array<Record<string, unknown>>, fixtureRoot: string = root): void {
  mkdirSync(join(fixtureRoot, '.pipeline-state'), { recursive: true });
  writeFileSync(
    tenantLoopRegistryPath(fixtureRoot),
    JSON.stringify({ schemaVersion: 1, writtenAt: new Date().toISOString(), tenants }),
    'utf-8',
  );
}

function row(id: string, projectDir: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    principal: 'operator@example.com',
    variant: 'co-consult',
    projectDir,
    status: 'active',
    scopes: { upgrade: true, upstreamFile: true, backportReview: true, nightlyFleet: true },
    windows: { tz: 'UTC', days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '23:59' },
    gitRemote: 'local-only',
    ...overrides,
  };
}

describe('listTenantLoopProjects over a fixture root (design §7.2)', () => {
  test('returns nightlyFleet+active tenants sorted by id, as their registry paths', () => {
    const c = tenantDir('gw-cccccccccccc');
    const a = tenantDir('gw-aaaaaaaaaaaa');
    writeRegistry([
      row('gw-cccccccccccc', c),
      row('gw-bbbbbbbbbbbb', tenantDir('gw-bbbbbbbbbbbb'), { status: 'suspended' }),
      row('gw-aaaaaaaaaaaa', a),
      row('gw-dddddddddddd', tenantDir('gw-dddddddddddd'), { scopes: { upgrade: true, upstreamFile: true, backportReview: true, nightlyFleet: false } }),
    ]);
    expect(listTenantLoopProjects(root).map((t) => t.id)).toEqual(['gw-aaaaaaaaaaaa', 'gw-cccccccccccc']);
    expect(listTenantLoopProjects(root)[0].projectDir).toBe(a);
  });

  test('two injected roots never cross (determinism)', () => {
    const a = tenantDir('gw-aaaaaaaaaaaa');
    writeRegistry([row('gw-aaaaaaaaaaaa', a)]);
    const other = mkdtempSync(join(tmpdir(), 'tenant-list-'));
    try {
      expect(listTenantLoopProjects(root)).toHaveLength(1);
      expect(listTenantLoopProjects(other)).toEqual([]);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });
});

describe('isTenantLoopProjectPath / tenantForProjectPath — the isFleetProjectPath twin', () => {
  test('the projectDir itself and any descendant match; unrelated paths do not', () => {
    const dir = tenantDir('gw-aaaaaaaaaaaa');
    writeRegistry([row('gw-aaaaaaaaaaaa', dir)]);
    expect(isTenantLoopProjectPath(dir, root)).toBe(true);
    expect(isTenantLoopProjectPath(join(dir, 'deep', 'nested', 'file.ts'), root)).toBe(true);
    expect(isTenantLoopProjectPath(storage, root)).toBe(false);
    expect(isTenantLoopProjectPath(join(root, 'unrelated'), root)).toBe(false);
    expect(tenantForProjectPath(dir, root)?.id).toBe('gw-aaaaaaaaaaaa');
  });

  test('trailing separators are normalized (realpath)', () => {
    const dir = tenantDir('gw-bbbbbbbbbbbb');
    writeRegistry([row('gw-bbbbbbbbbbbb', dir)]);
    expect(isTenantLoopProjectPath(dir + sep, root)).toBe(true);
  });

  test('a symlinked path into the tenant resolves through realpath', () => {
    const dir = tenantDir('gw-cccccccccccc');
    const link = join(root, 'link-to-tenant');
    symlinkSync(dir, link);
    writeRegistry([row('gw-cccccccccccc', dir)]);
    expect(isTenantLoopProjectPath(link, root)).toBe(true);
    expect(isTenantLoopProjectPath(join(link, 'src'), root)).toBe(true);
  });

  test('a not-yet-existing descendant resolves through its deepest existing ancestor (lexical tail)', () => {
    const dir = tenantDir('gw-dddddddddddd');
    writeRegistry([row('gw-dddddddddddd', dir)]);
    // Inside the tenant → tenant-scoped even before the contents exist.
    expect(isTenantLoopProjectPath(join(dir, 'nope', 'gone'), root)).toBe(true);
    // A missing remainder under a NON-tenant dir matches nothing.
    expect(isTenantLoopProjectPath(join(storage, 'nope', 'gone'), root)).toBe(false);
  });

  test('NAMESPACE SEPARATION: a fleet path (Projects/co-x) is never a tenant path and vice versa', () => {
    const fleet = join(root, 'Projects', 'co-hr');
    mkdirSync(fleet, { recursive: true });
    const dir = tenantDir('gw-eeeeeeeeeeee');
    writeRegistry([row('gw-eeeeeeeeeeee', dir)]);
    expect(isTenantLoopProjectPath(fleet, root)).toBe(false);
    expect(isFleetProjectPath(dir, root)).toBe(false);
    expect(isFleetProjectPath(fleet, root)).toBe(true); // the fleet twin still works
  });

  test('sibling-prefix overlap: …/gw-A/project does NOT match …/gw-AB/project (sep boundary)', () => {
    const a = tenantDir('gw-aaaaaaaaaaaa');
    const ab = tenantDir('gw-bbbbbbbbbbbb'); // registry sibling sharing the '…/gw-' prefix shape
    // gw-AB lives at a path that shares a STRING prefix with gw-A's dir:
    const abAlt = a + '-alt'; // e.g. …/gw-aaaaaaaaaaaa/project-alt — string-prefix sibling
    mkdirSync(abAlt, { recursive: true });
    writeRegistry([row('gw-aaaaaaaaaaaa', a), row('gw-bbbbbbbbbbbb', ab)]);
    expect(tenantForProjectPath(a, root)?.id).toBe('gw-aaaaaaaaaaaa');
    expect(tenantForProjectPath(ab, root)?.id).toBe('gw-bbbbbbbbbbbb');
    // The string-prefix sibling must NOT resolve to gw-A's tenant:
    expect(isTenantLoopProjectPath(abAlt, root)).toBe(false);
  });

  test('nested registered dirs: the DEEPEST match wins', () => {
    const outer = tenantDir('gw-aaaaaaaaaaaa');
    const inner = join(outer, 'nested-project');
    mkdirSync(inner, { recursive: true });
    writeRegistry([row('gw-aaaaaaaaaaaa', outer), row('gw-bbbbbbbbbbbb', inner)]);
    expect(tenantForProjectPath(join(inner, 'x'), root)?.id).toBe('gw-bbbbbbbbbbbb');
    expect(tenantForProjectPath(join(outer, 'other'), root)?.id).toBe('gw-aaaaaaaaaaaa');
  });

  test('a registered projectDir equal to the workspace root itself never matches', () => {
    writeRegistry([row('gw-aaaaaaaaaaaa', root)]);
    expect(isTenantLoopProjectPath(root, root)).toBe(false);
    expect(isTenantLoopProjectPath(join(root, 'anything'), root)).toBe(false);
    expect(listTenantLoopProjects(root)).toHaveLength(1); // listing is unaffected
  });

  test('a registered projectDir that no longer exists never matches (no throw)', () => {
    writeRegistry([row('gw-aaaaaaaaaaaa', join(storage, 'gone', 'project'))]);
    expect(isTenantLoopProjectPath(storage, root)).toBe(false);
    expect(listTenantLoopProjects(root)).toHaveLength(1);
  });

  test('malformed registry → the path guard THROWS (fail-closed, same contract as the list)', () => {
    const dir = tenantDir('gw-aaaaaaaaaaaa');
    mkdirSync(join(root, '.pipeline-state'), { recursive: true });
    writeFileSync(tenantLoopRegistryPath(root), '{ broken', 'utf-8');
    expect(() => isTenantLoopProjectPath(dir, root)).toThrow(/Malformed tenant-loop registry/);
    expect(() => listTenantLoopProjects(root)).toThrow(/Malformed tenant-loop registry/);
    void dir;
  });

  test('absent registry → guard false without throwing', () => {
    expect(isTenantLoopProjectPath(root, root)).toBe(false);
  });

  test('fixtures are absolute tmpdir roots (T-20261104-003)', () => {
    expect(root.startsWith(tmpdir())).toBe(true);
  });
});
