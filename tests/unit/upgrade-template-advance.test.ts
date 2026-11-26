// upgrade-template-advance.test.ts — S1 of design
// docs/designs/2026-11-26-skill-drift-structural-fixes-design.md §4.1/§9 (part 1:
// the attributed-advance and project-moved scenes; the guard scenes live in
// upgrade-template-advance-guards.test.ts — per-suite CI budget). The
// "template moved without a version bump" state is modeled at the delivery
// manifest: the project file's bytes are pinned as the recorded baseline while
// the (never-modified, real) template copy differs — exactly the stranded shape
// the d82a73649 / bdb72db58 template commits produced in the fleet.
// Engine runs execute at DESCRIBE scope (upgrade-overwrite-protection pattern);
// scenes after the first CLONE the committed delivered base instead of re-running
// the wave (windows CI suite-budget discipline).

import { existsSync, cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, test } from 'bun:test';

import { baselineKeyFor } from '../../scripts/lib/upgrade-policy.ts';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-work';
const REL = 'skills/explain-me/SKILL.md';
const projFileOf = (tmp: string) => join(tmp, ...REL.split('/'));
const TPL_FILE = join(workspaceRoot, 'templates', 'common', REL);
const manifestOf = (tmp: string) => join(tmp, '.claude', 'last-upgrade-delivery.json');

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
  if (!(st.stdout ?? '').trim()) return; // nothing to commit
  git(tmp, 'add', '-A');
  git(tmp, 'commit', '-q', '-m', msg);
}

function freshProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-template-advance-'));
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
}
const decisionsOf = (tmp: string): Row[] => {
  expect(existsSync(manifestOf(tmp))).toBe(true); // apply runs only
  return JSON.parse(readFileSync(manifestOf(tmp), 'utf8')).decisions as Row[];
};
const rowsFor = (rows: Row[], path: string): Row[] => rows.filter((r) => r.path === path);

/** A delivered, committed, clean base project — the clone source for the scenes. */
function deliveredBase(): string {
  const tmp = freshProject();
  runUpgrade(tmp);
  commitAll(tmp, 'wave 1 delivery');
  return tmp;
}

/** Clone a committed fixture directory (engine state incl. .git) to a fresh path. */
function cloneFixture(source: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-template-advance-c-'));
  tmpDirs.push(tmp);
  rmSync(tmp, { recursive: true, force: true });
  cpSync(source, tmp, { recursive: true });
  return tmp;
}

/** Point the recorded baseline for REL at `text` — the manifest state "these bytes
 *  were delivered last wave" that a real template-side edit without a bump produces. */
function forgeBaseline(tmp: string, text: string): void {
  const manifest = JSON.parse(readFileSync(manifestOf(tmp), 'utf8')) as {
    baselines: Record<string, { hash: string; templateVersion: string }>;
  };
  expect(manifest.baselines?.[REL]).toBeDefined();
  manifest.baselines[REL] = { ...manifest.baselines[REL]!, hash: baselineKeyFor(REL, text) };
  writeFileSync(manifestOf(tmp), JSON.stringify(manifest, null, 2));
}

// ── Engine scenes (run once, at collection) ──────────────────────────────────

const tplBytes = readFileSync(TPL_FILE, 'utf8');
const base = deliveredBase();

// Scene 1 — attributed advance: dry-run parity + apply delivery + baseline refresh.
const s1 = (() => {
  const tmp = cloneFixture(base);
  expect(readFileSync(projFileOf(tmp), 'utf8')).toBe(tplBytes);
  const drifted = `${tplBytes}\n<!-- fixture: template-side edit without a bump -->\n`;
  writeFileSync(projFileOf(tmp), drifted);
  forgeBaseline(tmp, drifted);
  commitAll(tmp, 'project at its (forged) baseline');
  const dry = runUpgrade(tmp, ['--dry-run']);
  const bytesAfterDry = readFileSync(projFileOf(tmp), 'utf8'); // captured BEFORE apply
  const apply = runUpgrade(tmp);
  const rows = existsSync(manifestOf(tmp)) ? rowsFor(decisionsOf(tmp), REL) : [];
  const manifest = existsSync(manifestOf(tmp))
    ? (JSON.parse(readFileSync(manifestOf(tmp), 'utf8')) as { baselines: Record<string, { hash: string }> })
    : null;
  return { drifted, dry, bytesAfterDry, apply, rows, manifest, appliedBytes: readFileSync(projFileOf(tmp), 'utf8') };
})();

// Scene 2 — project moved (attribution negative); cloned from the same base.
const s2 = (() => {
  const tmp = cloneFixture(base);
  const moved = `${tplBytes}\n<!-- fixture: project-side edit -->\n`;
  writeFileSync(projFileOf(tmp), moved);
  commitAll(tmp, 'project moved');
  runUpgrade(tmp);
  return { moved, rows: rowsFor(decisionsOf(tmp), REL), bytes: readFileSync(projFileOf(tmp), 'utf8') };
})();

describe('S1 equal-version content-aware gate (SYNC_TEMPLATE_ADVANCE) — delivery scenes', () => {
  test('attributed advance: dry-run reports the row without writing; apply delivers and refreshes the baseline', () => {
    expect(s1.dry.out).toContain('SYNC_TEMPLATE_ADVANCE');
    expect(s1.dry.out).toContain(`ADVANCE ${REL}`);
    expect(s1.bytesAfterDry).toBe(s1.drifted); // dry-run wrote nothing

    expect(s1.apply.out).toContain(`ADVANCE ${REL}`);
    const advance = s1.rows.find((r) => r.verdict === 'SYNC_TEMPLATE_ADVANCE');
    expect(advance).toBeDefined();
    expect(advance!.severity).toBe('INFO');
    expect(s1.appliedBytes).toBe(tplBytes); // template copy verbatim (apply re-ran over dry)
    expect(s1.manifest!.baselines[REL]!.hash).toBe(baselineKeyFor(REL, tplBytes)); // refreshed
  });

  test('project-moved drift stays DRIFT_PRESERVE and the bytes are untouched', () => {
    expect(s2.rows.find((x) => x.verdict === 'DRIFT_PRESERVE')).toBeDefined();
    expect(s2.rows.find((x) => x.verdict === 'SYNC_TEMPLATE_ADVANCE')).toBeUndefined();
    expect(s2.bytes).toBe(s2.moved);
  });
});
