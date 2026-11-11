/**
 * Engine replay for the core-locked fork arm of the SYNC_IF_NEWER: scripts/ pass
 * (T-20260921-010 intent; path-prefix bug fixed in upgrade-project.ts v1.101.1).
 *
 * The arm compared an unprefixed `rel` against the prefixed CORE_LOCKED_SCRIPTS
 * entries, so a version-bumped fork of scripts/dev-sync.ts or scripts/audit.ts
 * (project @version above the template's) fell through to a silent OK. Documented
 * intent (AGENTS.md "Pluggable Variant Audit Hooks"): the canonical copy wins,
 * loudly (DRIFT_RESTORED, WARN); a LOCAL-PATCH-marked fork is MARKER_LOSS (ERROR)
 * and kept. A non-core script with a bumped version stays untouched (OK).
 *
 * Engine runs spawn scripts/upgrade-project.ts against a temp project and the real
 * workspace templates; every spawn-bearing test carries a 60s per-test budget
 * (file joins test-runner FILE_TIME_BUDGETS, suite 300s / test 60s).
 *
 * @version 1.0.0
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect, afterAll } from 'bun:test';

import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';
const BUMPED = '99.0.0';
const MARK = '// LOCAL-PATCH(project-local): keep this project change';

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

const git = (tmp: string, ...args: string[]): void => {
  spawnSync('git', ['-C', tmp, ...args], { env: gitCleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
};

function templateBytes(rel: string): string {
  return readFileSync(join(workspaceRoot, 'templates', 'common', rel), 'utf8');
}
const bumped = (text: string): string => text.replace(/@version\s+\d+\.\d+\.\d+/, `@version ${BUMPED}`);
const write = (tmp: string, rel: string, content: string): void => {
  mkdirSync(dirname(join(tmp, rel)), { recursive: true });
  writeFileSync(join(tmp, rel), content);
};
const read = (tmp: string, rel: string): string => readFileSync(join(tmp, rel), 'utf8');

const FORK_UNMARKED = 'scripts/dev-sync.ts';
const FORK_MARKED = 'scripts/audit.ts';
const NON_CORE = 'scripts/lib/git-env.ts';

function seed(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-core-locked-'));
  tmpDirs.push(tmp);
  assertCallerEnvSafeForGitFixtures(tmp);
  spawnSync('git', ['init', '-q'], { cwd: tmp, env: gitCleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  assertFixtureGitIdentity(tmp);
  git(tmp, 'config', 'user.email', 'test@example.com');
  git(tmp, 'config', 'user.name', 'Test');
  write(tmp, '.claude/template-version.txt', `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`);
  write(tmp, FORK_UNMARKED, `${bumped(templateBytes(FORK_UNMARKED)).trimEnd()}\n// unmarked local fork\n`);
  write(tmp, FORK_MARKED, `${bumped(templateBytes(FORK_MARKED)).trimEnd()}\n${MARK}\n`);
  write(tmp, NON_CORE, `${bumped(templateBytes(NON_CORE)).trimEnd()}\n// bumped non-core script\n`);
  git(tmp, 'add', '-A');
  git(tmp, 'commit', '-q', '-m', 'seed bumped forks');
  return tmp;
}

function run(tmp: string, extra: string[] = []): { status: number; out: string } {
  const r = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes', ...extra], {
    encoding: 'utf-8',
    timeout: 300000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

interface Decision {
  path: string;
  verdict: string;
  severity: string;
}
const decisions = (tmp: string): Decision[] =>
  JSON.parse(read(tmp, '.claude/last-upgrade-delivery.json')).decisions;
const verdicts = (tmp: string, rel: string): string[] =>
  decisions(tmp).filter((d) => d.path === rel).map((d) => d.verdict);

describe('core-locked fork arm — version-bumped forks of dev-sync.ts / audit.ts', () => {
  const dryProject = seed();
  const applyProject = seed();
  const dry = run(dryProject, ['--dry-run']);
  const apply = run(applyProject);

  test('unmarked bumped dev-sync.ts fork: CORE-SCRIPT FORK warning, DRIFT_RESTORED (WARN), canonical restored', () => {
    expect(apply.out).toContain(`CORE-SCRIPT FORK dev-sync.ts  project ${BUMPED}`);
    expect(verdicts(applyProject, FORK_UNMARKED)).toContain('DRIFT_RESTORED');
    const row = decisions(applyProject).find((d) => d.path === FORK_UNMARKED && d.verdict === 'DRIFT_RESTORED');
    expect(row?.severity).toBe('WARN');
    expect(read(applyProject, FORK_UNMARKED)).toBe(templateBytes(FORK_UNMARKED));
  }, 60000);

  test('MARKER_LOSS guard is live on the arm: marked bumped audit.ts fork is ERROR and kept', () => {
    const loss = decisions(applyProject).filter((d) => d.path === FORK_MARKED && d.verdict === 'MARKER_LOSS');
    expect(loss.length).toBe(1);
    expect(loss[0].severity).toBe('ERROR');
    expect(verdicts(applyProject, FORK_MARKED)).not.toContain('DRIFT_RESTORED');
    expect(read(applyProject, FORK_MARKED)).toContain('LOCAL-PATCH(project-local)');
    expect(apply.status).toBe(1);
  }, 60000);

  test('non-core script with a bumped version is unaffected (OK, kept)', () => {
    expect(apply.out).toContain(`OK     lib/git-env.ts  ${BUMPED}`);
    expect(verdicts(applyProject, NON_CORE)).not.toContain('DRIFT_RESTORED');
    expect(read(applyProject, NON_CORE)).toContain('// bumped non-core script');
  }, 60000);

  test('dry-run parity: same CORE-SCRIPT FORK / MARKER_LOSS lines, zero writes', () => {
    expect(dry.out).toContain(`CORE-SCRIPT FORK dev-sync.ts  project ${BUMPED}`);
    expect(dry.out).toContain(`MARKER_LOSS (SKIP): ${FORK_MARKED}`);
    expect(read(dryProject, FORK_UNMARKED)).toContain('// unmarked local fork');
    expect(read(dryProject, FORK_MARKED)).toContain('LOCAL-PATCH(project-local)');
  }, 60000);
});
