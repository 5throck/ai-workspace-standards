// upgrade-stub-shape-guards.test.ts — T-20261126-003 of design
// docs/designs/2026-11-26-skill-drift-structural-fixes-design.md §4.5/§9 (part 2:
// the protective-guard scenes; the conversion scene and pure helper pins live in
// upgrade-stub-shape-conversion.test.ts — per-suite CI budget). Both scenes share
// one legacy-resolved base and run the engine once each:
//   - a project-only frontmatter key blocks the conversion (INFO row, copy preserved);
//   - a dirty merge never converts: a marker-bearing project copy makes
//     markerLossBlocks block before the arm (the design's "markerLossBlocks already
//     passed" precondition). agents/pm.md is not an instruction file, so the census
//     channels are structurally silent for it (INSTRUCTION_FILE_RELS covers the five
//     top-level docs only) — the marker guard is the reachable dirty channel and it
//     fails closed.

import { existsSync, cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, test } from 'bun:test';

import { composeResolvedAgentContent } from '../../scripts/helpers/resolve-pm-stub.ts';
import { isExtendsStub } from '../../scripts/lib/upgrade-policy.ts';
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

function freshProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-stub-shape-g-'));
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
const pmRows = (tmp: string): Row[] =>
  (JSON.parse(readFileSync(manifestOf(tmp), 'utf8')).decisions as Row[]).filter((r) => r.path === PM);
const pmOf = (tmp: string) => join(tmp, ...PM.split('/'));

function legacyResolvedBody(): string {
  const composed = composeResolvedAgentContent(VARIANT_STUB, COMMON_BODY, VARIANT);
  expect(composed.composed).toBe(true);
  return composed.content;
}

function cloneFixture(source: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-stub-shape-g-c-'));
  tmpDirs.push(tmp);
  rmSync(tmp, { recursive: true, force: true });
  cpSync(source, tmp, { recursive: true });
  return tmp;
}

// ── Engine scenes (run once, at collection) ──────────────────────────────────

// Shared legacy base: delivered once, agents/pm.md swapped to the scaffold-era
// resolved shape, committed — the clone source for both guard scenes.
const legacyBase = (() => {
  const tmp = freshProject();
  runUpgrade(tmp);
  commitAll(tmp, 'wave 1');
  mkdirSync(join(tmp, 'agents'), { recursive: true });
  writeFileSync(pmOf(tmp), legacyResolvedBody());
  commitAll(tmp, 'legacy resolved pm.md');
  return tmp;
})();

// Scene C — a project-only frontmatter key blocks the conversion.
const sceneC = (() => {
  const tmp = cloneFixture(legacyBase);
  writeFileSync(pmOf(tmp), legacyResolvedBody().replace(/\n---\n/, '\nproject_pin: fixture-only\n---\n'));
  commitAll(tmp, 'legacy pm.md with a project-only frontmatter key');
  runUpgrade(tmp);
  return { rows: pmRows(tmp), bytes: readFileSync(pmOf(tmp), 'utf8') };
})();

// Scene D — a dirty merge never converts (marker-loss guard, fail-closed).
const sceneD = (() => {
  const tmp = cloneFixture(legacyBase);
  const marked = `${legacyResolvedBody()}<!-- LOCAL-PATCH(upstream-request: UR-fixture): project patch -->\n`;
  writeFileSync(pmOf(tmp), marked);
  commitAll(tmp, 'marker-bearing legacy pm.md');
  runUpgrade(tmp);
  return { rows: pmRows(tmp), bytes: readFileSync(pmOf(tmp), 'utf8') };
})();

describe('STUB_SHAPE_CONVERSION engine scenes (T-20261126-003) — guards', () => {
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
