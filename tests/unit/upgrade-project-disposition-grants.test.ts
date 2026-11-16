/**
 * T-20261114-005 (spec docs/designs/2026-11-16-ticket-batch-dev-sync-upgrade-drift-design.md §3):
 *  (a) repeated --disposition grants accumulate (OR) and every ADOPT row names its grant;
 *  (b) {a,b} alternation and comma lists are equivalent to repeated flags;
 *  (c) a second apply run on a tree holding the previous run's uncommitted delivery
 *      refuses (exit 1) — no new stash, no file un-adopted — and a conflicted run
 *      prints its stash name;
 *  (d) the preUpgradeDirty parser keeps the full path of worktree-only (' M path') entries.
 *
 * Engine runs spawn scripts/upgrade-project.ts against a temp project and the real
 * workspace templates (the upgrade-overwrite-protection pattern).
 *
 * @version 1.0.0
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect, afterAll } from 'bun:test';

import { baselineKeyFor } from '../../scripts/lib/upgrade-policy.ts';
import { parseStatusPorcelain } from '../../scripts/lib/git-status.ts';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function git(tmp: string, ...args: string[]): string {
  const r = spawnSync('git', ['-C', tmp, ...args], { env: gitCleanEnv(), encoding: 'utf8' });
  return `${r.stdout ?? ''}`;
}

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-disposition-grants-'));
  tmpDirs.push(tmp);
  assertCallerEnvSafeForGitFixtures(tmp);
  spawnSync('git', ['init', '-q'], { cwd: tmp, env: gitCleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  assertFixtureGitIdentity(tmp);
  git(tmp, 'config', 'user.email', 'test@example.com');
  git(tmp, 'config', 'user.name', 'Test');
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(join(tmp, '.claude', 'template-version.txt'), `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`);
  return tmp;
}

function runUpgrade(tmp: string, extraArgs: string[] = []): { status: number; out: string } {
  const result = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes', ...extraArgs], {
    encoding: 'utf-8',
    timeout: 300000,
    env: { ...process.env, LC_ALL: 'C', LANG: 'C', LANGUAGE: 'en' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { status: result.status ?? -1, out: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

function templateBytes(rel: string): string {
  const variantCopy = join(workspaceRoot, 'templates', VARIANT, rel);
  return readFileSync(existsSync(variantCopy) ? variantCopy : join(workspaceRoot, 'templates', 'common', rel), 'utf8');
}
function write(tmp: string, rel: string, content: string): void {
  mkdirSync(dirname(join(tmp, rel)), { recursive: true });
  writeFileSync(join(tmp, rel), content);
}
const read = (tmp: string, rel: string): string => readFileSync(join(tmp, rel), 'utf8');

interface Decision {
  path: string;
  policy: string;
  verdict: string;
  severity: string;
  detail: string;
}
const readManifest = (tmp: string): { decisions: Decision[] } =>
  JSON.parse(read(tmp, '.claude/last-upgrade-delivery.json'));

// Three TEMPLATE TREE SYNC / DOCS_OVERWRITE docs. Each is project-evolved AND its recorded
// baseline is stale (!= template) => CONFLICT (ERROR) without a grant, ADOPT with one.
const A = 'docs/governance/agents/workflows.md';
const B = '.github/workflows/delete-merged-branches.yml';
const C = 'docs/phase-definitions.md';
const rels = [A, B, C];
const evolvedOf = (rel: string): string => `${templateBytes(rel).trimEnd()}\n# project-only addition for ${rel}\n`;

function seed(withScratch = false): string {
  const tmp = makeTempProject();
  const manifest = {
    schemaVersion: 2,
    timestamp: 'test',
    project: 'fixture',
    templateVersion: '0.0.0',
    templateSha: '',
    baseSha: '',
    files: [] as string[],
    baselines: {} as Record<string, { hash: string; templateVersion: string }>,
    decisions: [],
  };
  for (const rel of rels) {
    write(tmp, rel, evolvedOf(rel));
    manifest.baselines[rel] = { hash: baselineKeyFor(rel, 'stale baseline content\n'), templateVersion: '0.0.0' };
    manifest.files.push(rel);
  }
  write(tmp, '.claude/last-upgrade-delivery.json', `${JSON.stringify(manifest, null, 2)}\n`);
  git(tmp, 'add', '-A');
  git(tmp, 'commit', '-q', '-m', 'seed evolved project');
  // An untracked file makes apply mode create a pre-upgrade stash entry.
  if (withScratch) write(tmp, 'scratch-notes.txt', 'local scratch\n');
  return tmp;
}

const adopted = (tmp: string, rel: string): Decision[] =>
  readManifest(tmp).decisions.filter((d) => d.path === rel && d.verdict === 'ADOPT');
const stashCount = (tmp: string): number => git(tmp, 'stash', 'list').split('\n').filter(Boolean).length;

function expectOnlyAandB(tmp: string): void {
  expect(read(tmp, A)).toBe(templateBytes(A));
  expect(read(tmp, B)).toBe(templateBytes(B));
  expect(read(tmp, C)).toBe(evolvedOf(C)); // no grant covers C
  expect(adopted(tmp, C)).toHaveLength(0);
}

describe('(a) repeated --disposition flags accumulate', () => {
  const tmp = seed();
  const r = runUpgrade(tmp, [`--disposition`, `adopt-template=${A}`, `--disposition`, `adopt-template=${B}`]);
  test('adopts exactly A and B; both grants appear in the decision rows; C stays preserved', () => {
    expectOnlyAandB(tmp);
    expect(adopted(tmp, A)[0].detail).toContain(`[grant: adopt-template=${A}]`);
    expect(adopted(tmp, B)[0].detail).toContain(`[grant: adopt-template=${B}]`);
    expect(r.status).toBe(1); // C is an unresolved CONFLICT (ERROR)
  });
});

describe('(b) {a,b} alternation and comma lists equal repeated flags', () => {
  const braceTmp = seed();
  runUpgrade(braceTmp, ['--disposition', `adopt-template={${A},${B}}`]);
  const commaTmp = seed();
  runUpgrade(commaTmp, [`--disposition=adopt-template=${A},${B}`]);
  test('brace alternation adopts exactly A and B', () => {
    expectOnlyAandB(braceTmp);
    expect(adopted(braceTmp, A)[0].detail).toContain('[grant: adopt-template=');
  });
  test('comma list adopts exactly A and B', () => {
    expectOnlyAandB(commaTmp);
  });
  test('an unbalanced brace is rejected with exit 1 and nothing is touched', () => {
    const tmp = seed();
    const r = runUpgrade(tmp, ['--disposition', 'adopt-template={a,b']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('unbalanced');
    expect(read(tmp, A)).toBe(evolvedOf(A));
  });
});

describe('(c) a second apply run on an uncommitted previous delivery refuses', () => {
  const tmp = seed(true);
  const run1 = runUpgrade(tmp, ['--disposition', `adopt-template=${A}`]);
  const stashesAfterRun1 = stashCount(tmp);
  const aAfterRun1 = read(tmp, A);
  const run2 = runUpgrade(tmp, ['--disposition', `adopt-template=${B}`]);

  test('run 1 is conflicted (B, C preserved), names its stash, and adopts A', () => {
    expect(run1.status).toBe(1);
    expect(aAfterRun1).toBe(templateBytes(A));
    expect(run1.out).toMatch(/Pre-upgrade stash of this run: pre-upgrade-snapshot-\d{8}/);
    expect(stashesAfterRun1).toBe(1);
  });

  test('run 2 refuses before any write: exit 1, guidance, no new stash, A not un-adopted, B untouched', () => {
    expect(run2.status).toBe(1);
    expect(run2.out).toContain("previous upgrade run's uncommitted delivery");
    expect(run2.out).toContain('discard the previous delivery');
    expect(run2.out).toContain('ONCE with every grant');
    expect(stashCount(tmp)).toBe(stashesAfterRun1);
    expect(read(tmp, A)).toBe(aAfterRun1);
    expect(read(tmp, B)).toBe(evolvedOf(B));
  });

  test('a dry-run on the same dirty tree is not refused (it writes nothing)', () => {
    const dry = runUpgrade(tmp, ['--dry-run', '--disposition', `adopt-template=${B}`]);
    expect(dry.out).not.toContain("previous upgrade run's uncommitted delivery");
  });
});

describe('(d) preUpgradeDirty parser keeps full worktree-only paths', () => {
  test("git status -z through parseStatusPorcelain: ' M AGENTS.md' stays 'AGENTS.md'", () => {
    const tmp = makeTempProject();
    write(tmp, 'AGENTS.md', 'one\n');
    write(tmp, 'gone.md', 'x\n');
    write(tmp, 'has space.md', 'y\n');
    git(tmp, 'add', '-A');
    git(tmp, 'commit', '-q', '-m', 'seed');
    write(tmp, 'AGENTS.md', 'two\n');
    rmSync(join(tmp, 'gone.md'));
    write(tmp, 'has space.md', 'z\n');
    write(tmp, 'new-untracked.md', 'n\n');
    const out = git(tmp, 'status', '--porcelain=v1', '-z', '-uall');
    expect(parseStatusPorcelain(out)).toEqual(new Set(['AGENTS.md', 'gone.md', 'has space.md', 'new-untracked.md']));
  });

  test('the engine no longer uses the trim()+slice(3) parser', () => {
    const src = readFileSync(upgradeScript, 'utf8');
    expect(src).toContain('parseStatusPorcelain(st.stdout');
    expect(src).not.toMatch(/entry\.slice\(3\)\.trim\(\)/);
  });
});
