// upgrade-template-advance-guards.test.ts — S1 of design
// docs/designs/2026-11-26-skill-drift-structural-fixes-design.md §4.1/§9 (part 2:
// the protective-guard scenes; the delivery scenes live in
// upgrade-template-advance.test.ts — per-suite CI budget). Every scene clones the
// one committed delivered base instead of re-running the wave (windows CI suite
// budget): no-baseline preserve, marker-bearing UR-2 shape preserve, uncommitted
// CONFLICT warn, in-sync no-regression, and the structural no-advance-outside-
// skills pin.

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
  if (!(st.stdout ?? '').trim()) return;
  git(tmp, 'add', '-A');
  git(tmp, 'commit', '-q', '-m', msg);
}

function freshProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-tmpl-adv-guards-'));
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
const decisionsOf = (tmp: string): Row[] => {
  expect(existsSync(manifestOf(tmp))).toBe(true);
  return JSON.parse(readFileSync(manifestOf(tmp), 'utf8')).decisions as Row[];
};
const rowsFor = (rows: Row[], path: string): Row[] => rows.filter((r) => r.path === path);

function cloneFixture(source: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-tmpl-adv-g-c-'));
  tmpDirs.push(tmp);
  rmSync(tmp, { recursive: true, force: true });
  cpSync(source, tmp, { recursive: true });
  return tmp;
}

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
const base = (() => {
  const tmp = freshProject();
  runUpgrade(tmp);
  commitAll(tmp, 'wave 1 delivery');
  return tmp;
})();

// Scene 3 — no baseline row.
const s3 = (() => {
  const tmp = cloneFixture(base);
  const moved = `${tplBytes}\n<!-- fixture: unbaselined edit -->\n`;
  writeFileSync(projFileOf(tmp), moved);
  const manifest = JSON.parse(readFileSync(manifestOf(tmp), 'utf8')) as { baselines: Record<string, unknown> };
  delete manifest.baselines[REL];
  writeFileSync(manifestOf(tmp), JSON.stringify(manifest, null, 2));
  commitAll(tmp, 'unbaselined state');
  runUpgrade(tmp);
  return { moved, rows: rowsFor(decisionsOf(tmp), REL), bytes: readFileSync(projFileOf(tmp), 'utf8') };
})();

// Scene 4 — marker-bearing project edit (UR-2 shape, attribution negative).
const s4 = (() => {
  const tmp = cloneFixture(base);
  const marked = `${tplBytes}<!-- LOCAL-PATCH(upstream-request: UR-fixture): project patch -->\n`;
  writeFileSync(projFileOf(tmp), marked);
  commitAll(tmp, 'marker-bearing project edit');
  runUpgrade(tmp);
  return { marked, rows: rowsFor(decisionsOf(tmp), REL), bytes: readFileSync(projFileOf(tmp), 'utf8') };
})();

// Scene 5 — positive attribution but uncommitted: the pre-upgrade stash means the
// pass classifies the COMMITTED bytes (the drifted baseline), while the dirty set
// proves project-side work — the CONFLICT warn path (design guard 3).
const s5 = (() => {
  const tmp = cloneFixture(base);
  const drifted = `${tplBytes}\n<!-- fixture: committed drift at the baseline -->\n`;
  writeFileSync(projFileOf(tmp), drifted);
  forgeBaseline(tmp, drifted);
  commitAll(tmp, 'committed drifted state at the baseline');
  const uncommitted = `${drifted}<!-- fixture: uncommitted edit on top -->\n`;
  writeFileSync(projFileOf(tmp), uncommitted); // dirty at run start; stash hides it from the passes
  runUpgrade(tmp);
  return { uncommitted, rows: rowsFor(decisionsOf(tmp), REL), bytes: readFileSync(projFileOf(tmp), 'utf8') };
})();

// Scene 6 — in-sync equal-version skill (no-regression) + fleet-wide advance-path check.
const s6 = (() => {
  const tmp = cloneFixture(base);
  runUpgrade(tmp);
  return { allRows: decisionsOf(tmp), relRows: rowsFor(decisionsOf(tmp), REL) };
})();

describe('S1 equal-version gate — protective-guard scenes', () => {
  test('no baseline row keeps DRIFT_PRESERVE (ADR-0085 D3 protective default)', () => {
    expect(s3.rows.find((x) => x.verdict === 'DRIFT_PRESERVE')).toBeDefined();
    expect(s3.rows.find((x) => x.verdict === 'SYNC_TEMPLATE_ADVANCE')).toBeUndefined();
    expect(s3.bytes).toBe(s3.moved);
  });

  test('a marker-bearing project edit (UR-2 shape: attribution negative) is preserved intact', () => {
    expect(s4.rows.find((x) => x.verdict === 'DRIFT_PRESERVE')).toBeDefined();
    expect(s4.rows.find((x) => x.verdict === 'MARKER_LOSS')).toBeUndefined();
    expect(s4.bytes).toBe(s4.marked);
  });

  test('an uncommitted positive-attribution file takes the CONFLICT (WARN) path', () => {
    const conflict = s5.rows.find((x) => x.verdict === 'CONFLICT');
    expect(conflict).toBeDefined();
    expect(conflict!.severity).toBe('WARN');
    expect(s5.rows.find((x) => x.verdict === 'SYNC_TEMPLATE_ADVANCE')).toBeUndefined();
    // The delivery is withheld: the file still holds the committed drifted bytes
    // (the uncommitted tail sits in the pre-upgrade stash — the engine's
    // documented rollback surface — so nothing was overwritten).
    expect(s5.bytes).toBe(s5.uncommitted.slice(0, s5.bytes.length));
    expect(s5.bytes).not.toContain('uncommitted edit on top');
  });

  test('an in-sync equal-version skill records no advance (no-regression guard)', () => {
    expect(s6.relRows.find((x) => x.verdict === 'SYNC_TEMPLATE_ADVANCE')).toBeUndefined();
    expect(s6.relRows.find((x) => x.verdict === 'DRIFT_PRESERVE')).toBeUndefined();
  });

  test('no agents/ or MERGE-pass path ever carries the advance verdict', () => {
    expect(s6.allRows.filter((x) => x.verdict === 'SYNC_TEMPLATE_ADVANCE' && !x.path.startsWith('skills/'))).toEqual([]);
  });
});
