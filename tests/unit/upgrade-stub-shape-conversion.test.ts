// upgrade-stub-shape-conversion.test.ts — T-20261126-003 of design
// docs/designs/2026-11-26-skill-drift-structural-fixes-design.md §4.5/§9: a legacy
// FULL-BODY resolved agent copy converts to its template counterpart's extends-stub
// shape (STUB_SHAPE_CONVERSION, INFO) after a clean managed-body merge — never on a
// dirty one. The legacy project copy is modeled exactly as a scaffold produced it:
// composeResolvedAgentContent over the REAL co-work/common pm.md pair. Engine runs
// execute at DESCRIBE scope (the upgrade-overwrite-protection pattern).

import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  if (!(st.stdout ?? '').trim()) return; // nothing to commit — the tree already holds the wanted state
  git(tmp, 'add', '-A');
  git(tmp, 'commit', '-q', '-m', msg);
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

/** First delivery + commit, then seed agents/pm.md with the legacy resolved copy. */
function projectWithLegacyPm(): string {
  const tmp = freshProject();
  runUpgrade(tmp);
  commitAll(tmp, 'wave 1');
  mkdirSync(join(tmp, 'agents'), { recursive: true });
  writeFileSync(pmOf(tmp), legacyResolvedBody());
  commitAll(tmp, 'legacy resolved pm.md (scaffold-era shape)');
  return tmp;
}

// ── Engine scenes (run once, at collection) ──────────────────────────────────

// Scene A — the five-observation shape: legacy resolved copy + stub counterpart +
// clean managed-body merge (bodies byte-identical) → converts at INFO. The REAL
// wave-2 state has the project copy AT its recorded baseline (no project edits
// since delivery) — forged here so the marker guard's UNTOUCHED rule holds (a
// resolved pm body carries marker PROSE the stub lacks; only the UNTOUCHED rule
// — "any marker text came from the template itself" — classifies that as no loss,
// which is exactly the real projects' situation).
const sceneA = (() => {
  const tmp = projectWithLegacyPm();
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

// Scene B — a stub-shaped project takes the backfill path; the conversion arm never fires.
const sceneB = (() => {
  const tmp = freshProject();
  runUpgrade(tmp);
  commitAll(tmp, 'wave 1');
  mkdirSync(join(tmp, 'agents'), { recursive: true });
  writeFileSync(pmOf(tmp), readFileSync(VARIANT_STUB, 'utf8'));
  commitAll(tmp, 'stub-shaped project pm.md');
  runUpgrade(tmp);
  return { rows: pmRows(tmp), bytes: readFileSync(pmOf(tmp), 'utf8') };
})();

// Scene C — a project-only frontmatter key blocks the conversion (INFO row, copy preserved).
const sceneC = (() => {
  const tmp = projectWithLegacyPm();
  writeFileSync(pmOf(tmp), legacyResolvedBody().replace(/\n---\n/, '\nproject_pin: fixture-only\n---\n'));
  commitAll(tmp, 'legacy pm.md with a project-only frontmatter key');
  runUpgrade(tmp);
  return { rows: pmRows(tmp), bytes: readFileSync(pmOf(tmp), 'utf8') };
})();

// Scene D — a dirty merge never converts: a marker-bearing project copy makes
// markerLossBlocks block the merge (the guard returns BEFORE the conversion arm —
// the design's "markerLossBlocks already passed" precondition). agents/pm.md is
// not an instruction file, so the census channels are structurally silent for it
// (INSTRUCTION_FILE_RELS covers the five top-level docs only) — the marker loss
// guard is the reachable dirty channel, and it fails closed.
const sceneD = (() => {
  const tmp = projectWithLegacyPm();
  const marked = `${legacyResolvedBody()}<!-- LOCAL-PATCH(upstream-request: UR-fixture): project patch -->\n`;
  writeFileSync(pmOf(tmp), marked);
  commitAll(tmp, 'marker-bearing legacy pm.md');
  runUpgrade(tmp);
  return { rows: pmRows(tmp), bytes: readFileSync(pmOf(tmp), 'utf8') };
})();

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

describe('STUB_SHAPE_CONVERSION engine scenes (T-20261126-003)', () => {
  test('the five-observation shape converts at INFO; the project copy becomes the template stub', () => {
    expect(sceneA.run.out).toContain('STUB SHAPE CONVERSION');
    const row = sceneA.rows.find((r) => r.verdict === 'STUB_SHAPE_CONVERSION' && !r.detail?.includes('WITHHELD'));
    expect(row).toBeDefined();
    expect(row!.severity).toBe('INFO');
    expect(isExtendsStub(sceneA.bytes)).toBe(true);
    expect(sceneA.bytes).toBe(sceneA.stub.replace(/last_updated: \d{4}-\d{2}-\d{2}/, 'last_updated: ' + (sceneA.bytes.match(/last_updated: (\d{4}-\d{2}-\d{2})/)?.[1] ?? '')));
    expect(sceneA.bytes.length).toBeLessThan(sceneA.resolvedLen); // stub, not the 350-line body
  });

  test('a stub-shaped project takes the backfill path; the conversion arm never fires', () => {
    expect(sceneB.rows.find((r) => r.verdict === 'STUB_SHAPE_CONVERSION')).toBeUndefined();
    expect(isExtendsStub(sceneB.bytes)).toBe(true); // still stub-shaped
  });

  test('a project-only frontmatter key blocks the conversion (INFO row, copy preserved)', () => {
    const blocked = sceneC.rows.find((r) => r.verdict === 'STUB_SHAPE_CONVERSION' && r.detail?.includes('WITHHELD'));
    expect(blocked).toBeDefined();
    expect(blocked!.severity).toBe('INFO');
    expect(blocked!.detail).toContain('project_pin');
    expect(isExtendsStub(sceneC.bytes)).toBe(false); // still the resolved body
    expect(sceneC.bytes).toContain('project_pin: fixture-only');
  });

  test('a dirty merge never converts — the marker-loss guard blocks before the arm', () => {
    expect(sceneD.rows.find((r) => r.verdict === 'STUB_SHAPE_CONVERSION')).toBeUndefined();
    expect(sceneD.rows.find((r) => r.verdict === 'MARKER_LOSS')).toBeDefined();
    expect(isExtendsStub(sceneD.bytes)).toBe(false); // full body preserved with its marker
    expect(sceneD.bytes).toContain('LOCAL-PATCH(upstream-request: UR-fixture)');
  });
});
