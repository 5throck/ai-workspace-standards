// upgrade-stub-shape-conversion.test.ts — T-20261126-003 of design
// docs/designs/2026-11-26-skill-drift-structural-fixes-design.md §4.5/§9 (part 1:
// the pure helper pins + the five-observation conversion scene and the
// stub-takes-backfill regression; the protective-guard scenes live in
// upgrade-stub-shape-guards.test.ts — per-suite CI budget). A legacy FULL-BODY
// resolved agent copy converts to its template counterpart's extends-stub shape
// (STUB_SHAPE_CONVERSION, INFO) after a clean managed-body merge. The legacy
// project copy is modeled exactly as a scaffold produced it:
// composeResolvedAgentContent over the REAL co-work/common pm.md pair. Engine
// runs execute at DESCRIBE scope (upgrade-overwrite-protection pattern).

import { existsSync, cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, test } from 'bun:test';

import { composeResolvedAgentContent } from '../../scripts/helpers/resolve-pm-stub.ts';
import { baselineKeyFor, convertLegacyStubShape, isExtendsStub } from '../../scripts/lib/upgrade-policy.ts';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-work';
const PM = 'agents/pm.md';
const VARIANT_STUB = join(workspaceRoot, 'templates', VARIANT, PM);
const COMMON_BODY = join(workspaceRoot, 'templates', 'common', PM);

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): void {
  spawnSync('git', ['-C', cwd, 'config', '--unset', 'core.hooksPath'], { env: gitCleanEnv(), stdio: 'ignore' });
  const r = spawnSync('git', ['-C', cwd, ...args], { env: gitCleanEnv(), stdio: 'ignore' });
  expect(r.status).toBe(0);
}

function commitAll(tmp: string, msg: string): void {
  const st = spawnSync('git', ['-C', tmp, 'status', '--porcelain'], { encoding: 'utf8', env: gitCleanEnv() });
  if (!(st.stdout ?? '').trim()) return;
  git(tmp, 'add', '-A');
  git(tmp, 'commit', '-q', '-m', msg);
}

function cloneFixture(source: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-stub-shape-c-'));
  tmpDirs.push(tmp);
  rmSync(tmp, { recursive: true, force: true });
  cpSync(source, tmp, { recursive: true });
  return tmp;
}

function freshProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-stub-shape-'));
  tmpDirs.push(tmp);
  assertCallerEnvSafeForGitFixtures(tmp);
  spawnSync('git', ['init', '-q'], { cwd: tmp, env: gitCleanEnv(), stdio: 'ignore' });
  assertFixtureGitIdentity(tmp);
  git(tmp, 'config', 'user.email', 'test@example.com');
  git(tmp, 'config', 'user.name', 'Test');
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(join(tmp, '.claude', 'template-version.txt'), `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`);
  mkdirSync(join(tmp, 'scripts'), { recursive: true });
  writeFileSync(join(tmp, 'scripts', 'SCRIPTS.md'), readFileSync(join(workspaceRoot, 'scripts', 'SCRIPTS.md')));
  commitAll(tmp, 'seed');
  return tmp;
}

function runUpgrade(tmp: string, extra: string[] = []): { status: number; out: string } {
  const r = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes', ...extra], {
    encoding: 'utf-8',
    timeout: 300000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

interface Row {
  path: string;
  verdict: string;
  severity: string;
  detail?: string;
}
const manifestOf = (tmp: string) => join(tmp, '.claude', 'last-upgrade-delivery.json');
const decisionsOf = (tmp: string): Row[] => {
  expect(existsSync(manifestOf(tmp))).toBe(true);
  return JSON.parse(readFileSync(manifestOf(tmp), 'utf8')).decisions as Row[];
};
const pmRows = (tmp: string): Row[] => decisionsOf(tmp).filter((r) => r.path === PM);
const pmOf = (tmp: string) => join(tmp, ...PM.split('/'));

/** The legacy project copy: the scaffold resolution of the co-work pm stub. */
function legacyResolvedBody(): string {
  const composed = composeResolvedAgentContent(VARIANT_STUB, COMMON_BODY, VARIANT);
  expect(composed.composed).toBe(true);
  expect(isExtendsStub(composed.content)).toBe(false); // resolved: extends dropped
  return composed.content;
}

// ── Pure helper pins (no engine) ─────────────────────────────────────────────

describe('convertLegacyStubShape (pure helper)', () => {
  const stub = readFileSync(VARIANT_STUB, 'utf8');
  const common = readFileSync(COMMON_BODY, 'utf8');
  const resolved = legacyResolvedBody();
  // A genuinely resolved counterpart: the common body without its FM `extends:`
  // pointer (isExtendsStub false).
  const resolvedCounterpart = common.replace(/^extends:[^\n]*\n/m, '');

  test('a resolved (non-stub) template counterpart is a byte-identical no-op', () => {
    expect(isExtendsStub(resolvedCounterpart)).toBe(false);
    const res = convertLegacyStubShape(resolved, resolvedCounterpart, '2026-11-26');
    expect(res.changed).toBe(false);
    expect(res.content).toBe(resolved);
    expect(res.blockedBy).toBeUndefined();
  });

  test('unparsable project frontmatter is a no-op', () => {
    const res = convertLegacyStubShape('no frontmatter here', stub, '2026-11-26');
    expect(res.changed).toBe(false);
    expect(res.content).toBe('no frontmatter here');
  });

  test('a project-only frontmatter key blocks with blockedBy naming it (stub ∪ common superset)', () => {
    const edited = resolved.replace(/\n---\n/, '\nproject_pin: x\n---\n');
    const res = convertLegacyStubShape(edited, stub, '2026-11-26', common);
    expect(res.changed).toBe(false);
    expect(res.blockedBy).toContain('project_pin');
    expect(res.content).toBe(edited);
    // WITHOUT the common union the L1-filled keys would false-positive as
    // project-only — the refinement the 4th parameter exists for:
    const noCommon = convertLegacyStubShape(resolved, stub, '2026-11-26');
    expect(noCommon.changed).toBe(false);
    expect(noCommon.blockedBy).toBeDefined();
  });

  test('the conversion is the template stub with the existing last_updated re-stamped', () => {
    const res = convertLegacyStubShape(resolved, stub, '2026-11-27', common);
    expect(res.changed).toBe(true);
    expect(res.blockedBy).toBeUndefined();
    expect(isExtendsStub(res.content)).toBe(true);
    expect(res.content).toContain('last_updated: 2026-11-27');
    // version carried by the stub, body untouched
    expect(res.content.startsWith(stub.slice(0, stub.indexOf('last_updated')))).toBe(true);
  });
});

// ── Engine scenes (run once, at collection) ──────────────────────────────────

// One delivered wave-1 base (agents/pm.md delivered as the variant stub); scenes
// CLONE it — three engine runs total (windows CI per-suite budget: this file ran
// at 100% of its 120s budget with four).
const base = (() => {
  const tmp = freshProject();
  runUpgrade(tmp);
  commitAll(tmp, 'wave 1');
  return tmp;
})();

// Scene A — the five-observation shape: legacy resolved copy + stub counterpart +
// clean managed-body merge (bodies byte-identical) → converts at INFO. The REAL
// wave-2 state has the project copy AT its recorded baseline (no project edits
// since delivery) — forged here so the marker guard's UNTOUCHED rule holds (a
// resolved pm body carries marker PROSE the stub lacks; only the UNTOUCHED rule
// — "any marker text came from the template itself" — classifies that as no loss,
// which is exactly the real projects' situation).
const sceneA = (() => {
  const tmp = cloneFixture(base);
  mkdirSync(join(tmp, 'agents'), { recursive: true });
  writeFileSync(pmOf(tmp), legacyResolvedBody());
  commitAll(tmp, 'legacy resolved pm.md (scaffold-era shape)');
  const resolved = readFileSync(pmOf(tmp), 'utf8');
  const manifest = JSON.parse(readFileSync(manifestOf(tmp), 'utf8')) as {
    baselines: Record<string, { hash: string; templateVersion: string }>;
  };
  expect(manifest.baselines[PM]).toBeDefined();
  manifest.baselines[PM] = { ...manifest.baselines[PM]!, hash: baselineKeyFor(PM, resolved) };
  writeFileSync(manifestOf(tmp), JSON.stringify(manifest, null, 2));
  commitAll(tmp, 'baseline pinned to the resolved copy (delivered-baseline state)');
  const run = runUpgrade(tmp);
  const stub = readFileSync(VARIANT_STUB, 'utf8');
  return {
    run,
    rows: pmRows(tmp),
    bytes: readFileSync(pmOf(tmp), 'utf8'),
    stub,
    resolvedLen: resolved.length,
  };
})();

// Scene B — a stub-shaped project takes the backfill path; the conversion arm
// never fires. Wave 1 already delivered pm.md as the stub; the clone's second run
// is the idempotent in-sync state.
const sceneB = (() => {
  const tmp = cloneFixture(base);
  runUpgrade(tmp);
  return { rows: pmRows(tmp), bytes: readFileSync(pmOf(tmp), 'utf8') };
})();

describe('STUB_SHAPE_CONVERSION engine scenes (T-20261126-003) — delivery', () => {
  test('the five-observation shape converts at INFO; the project copy becomes the template stub', () => {
    expect(sceneA.run.out).toContain('STUB SHAPE CONVERSION');
    const row = sceneA.rows.find((r) => r.verdict === 'STUB_SHAPE_CONVERSION' && !r.detail?.includes('WITHHELD'));
    expect(row).toBeDefined();
    expect(row!.severity).toBe('INFO');
    expect(isExtendsStub(sceneA.bytes)).toBe(true);
    expect(sceneA.bytes.length).toBeLessThan(sceneA.resolvedLen); // stub, not the 350-line body
  });

  test('a stub-shaped project takes the backfill path; the conversion arm never fires', () => {
    expect(sceneB.rows.find((r) => r.verdict === 'STUB_SHAPE_CONVERSION')).toBeUndefined();
    expect(isExtendsStub(sceneB.bytes)).toBe(true); // still stub-shaped
  });
});
