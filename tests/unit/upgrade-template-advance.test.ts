// upgrade-template-advance.test.ts — S1 of design
// docs/designs/2026-11-26-skill-drift-structural-fixes-design.md §4.1/§9: the
// content-aware equal-version gate (SYNC_TEMPLATE_ADVANCE) on temporary project
// trees against the REAL co-work templates (the upgrade-script-lane-gaps pattern).
// The "template moved without a version bump" state is modeled at the delivery
// manifest: the project file's bytes are pinned as the recorded baseline while the
// (never-modified, real) template copy differs — exactly the stranded shape the
// d82a73649 / bdb72db58 template commits produced in the fleet.
//
// Engine runs execute at DESCRIBE scope (the upgrade-overwrite-protection
// pattern): each bun test gets a 5s budget, far under an engine run, so the runs
// happen once during collection and the tests assert on the captured results.

import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

/** First delivery run + commit: the project sits at its baselines, tree clean. */
function deliveredProject(): string {
  const tmp = freshProject();
  runUpgrade(tmp);
  commitAll(tmp, 'wave 1 delivery');
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

// ── Engine scenarios (run once, at collection) ───────────────────────────────

const tplBytes = readFileSync(TPL_FILE, 'utf8');

// Scene 1 — attributed advance: dry-run parity + apply delivery + baseline refresh.
const s1 = (() => {
  const tmp = deliveredProject();
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

// Scene 2 — project moved (attribution negative).
const s2 = (() => {
  const tmp = deliveredProject();
  const moved = `${tplBytes}\n<!-- fixture: project-side edit -->\n`;
  writeFileSync(projFileOf(tmp), moved);
  commitAll(tmp, 'project moved');
  runUpgrade(tmp);
  return { moved, rows: rowsFor(decisionsOf(tmp), REL), bytes: readFileSync(projFileOf(tmp), 'utf8') };
})();

// Scene 3 — no baseline row.
const s3 = (() => {
  const tmp = deliveredProject();
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
  const tmp = deliveredProject();
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
  const tmp = deliveredProject();
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
  const tmp = deliveredProject();
  runUpgrade(tmp);
  return { allRows: decisionsOf(tmp), relRows: rowsFor(decisionsOf(tmp), REL) };
})();

describe('S1 equal-version content-aware gate (SYNC_TEMPLATE_ADVANCE)', () => {
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
