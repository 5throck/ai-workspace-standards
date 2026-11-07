/**
 * Tests for scripts/external-deps.ts — the project-side external-deps CLI
 * (design docs/designs/2026-11-07-external-deps-standard-design.md §5.3, §7
 * "CLI tests"): exit codes per subcommand, --json shape, install idempotence,
 * check-updates never writes the manifest, usage errors.
 *
 * Runs the CLI as a subprocess against tiny local fixture repos (git init +
 * tag) through the EXTERNAL_DEPS_ALLOW_LOCAL_REPOS=1 test hook. NO network.
 *
 * @version 1.0.1
 * v1.0.1 (2026-11-07): fixture git calls run with a stripped GIT_* env and a
 * private config (commit.gpgsign=false, core.hooksPath=/dev/null,
 * protocol.file.allow=always) so a hook/CI context can never redirect them to
 * the outer repository (stray-commit incident during the first sync run).
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

// Test-process git isolation: a git hook context (pre-push) exports GIT_DIR /
// GIT_WORK_TREE, which the library's own git() calls would inherit and resolve
// to the OUTER repository (stray-commit incident 2026-11-07; three fixture
// verify/install failures reproduced with GIT_DIR set). Strip them from the
// test process before any test runs; the per-call GIT_ENV below is the second
// layer.
for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_COMMON_DIR', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete process.env[k];
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const CLI = path.resolve(import.meta.dir, '../../scripts/external-deps.ts');
let scratch = '';

/**
 * Git isolation for fixture repos: strip every GIT_* variable the surrounding
 * hook/CI context may export (GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, ...) so
 * a fixture `git` call can NEVER resolve to the outer repository, no matter
 * what environment `bun test` runs under. Each fixture also gets a private
 * config (no user identity leak, no global hooks). Incident 2026-11-07: under
 * the dev-sync pre-push hook context, fixture git calls resolved to the
 * workspace repo and a fixture commit landed on the PR branch.
 */
const GIT_PASSTHROUGH = ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', '-c', 'protocol.file.allow=always'];
const GIT_ENV = (() => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('GIT_')) env[k] = v as string;
  }
  env['GIT_CONFIG_GLOBAL'] = '/dev/null';
  env['GIT_CONFIG_SYSTEM'] = '/dev/null';
  return env;
})();
function git(args: string[], cwd: string): void {
  const argv = ['git', ...args];
  if (['add', 'commit', 'tag', 'checkout', 'init'].includes(args[0])) argv.splice(1, 0, ...GIT_PASSTHROUGH);
  const r = Bun.spawnSync(argv, { cwd, stdout: 'pipe', stderr: 'pipe', env: GIT_ENV });
  if (r.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed (exit ${r.exitCode}): ${r.stderr.toString()}`);
  }
}


function fixtureRepo(dir: string, tags: string[] = ['v1.0.0']): string {
  fs.mkdirSync(dir, { recursive: true });
  git(['init', '-q'], dir);
  fs.writeFileSync(path.join(dir, 'LICENSE'), 'MIT\n');
  tags.forEach((t, i) => {
    fs.writeFileSync(path.join(dir, `file-${i}.txt`), `${t}\n`);
    git(['add', '-A'], dir);
    git(['-c', 'user.email=f@t', '-c', 'user.name=F', 'commit', '-q', '-m', t], dir);
    git(['tag', t], dir);
  });
  return dir;
}

function cli(args: string[], projectDir: string): { code: number; out: string; err: string } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('GIT_')) env[k] = v as string;
  const r = Bun.spawnSync(['bun', CLI, ...args, '--project', projectDir], {
    stdout: 'pipe', stderr: 'pipe',
    env: { ...env, EXTERNAL_DEPS_ALLOW_LOCAL_REPOS: '1' },
  });
  return { code: r.exitCode ?? -1, out: r.stdout.toString(), err: r.stderr.toString() };
}

function project(entry: Record<string, unknown> | null): string {
  const p = path.join(scratch, 'proj');
  fs.mkdirSync(path.join(p, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(p, 'scripts/dep-adapter.ts'), 'export {};\n');
  if (entry) fs.writeFileSync(path.join(p, 'external-deps.json'), JSON.stringify({ schema_version: 2, dependencies: [entry] }, null, 2) + '\n');
  return p;
}

function entry(repo: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'dep',
    repo: `file://${repo}`,
    pin: 'v1.0.0',
    install: 'git clone --depth 1 --branch {pin} {repo} {dir}',
    install_dir: 'external/dep',
    propagation: 'never',
    license: 'MIT',
    usage: 'as-is',
    adapter: 'scripts/dep-adapter.ts',
    ...extra,
  };
}

beforeEach(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'extdeps-cli-')); });
afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }));

describe('usage', () => {
  test('missing / unknown subcommand and misplaced flags exit 2', () => {
    const p = project(null);
    expect(cli([], p).code).toBe(2);
    expect(cli(['frobnicate'], p).code).toBe(2);
    expect(cli(['list', '--manifest-only'], p).code).toBe(2);
    expect(cli(['verify', '--id', 'x'], p).code).toBe(2);
  });

  test('no manifest: every subcommand is a clean no-op (exit 0)', () => {
    const p = project(null);
    for (const sub of ['list', 'install', 'verify', 'check-updates']) expect(cli([sub], p).code).toBe(0);
  });
});

describe('list', () => {
  test('--json shape before and after install', () => {
    const repo = fixtureRepo(path.join(scratch, 'repo'));
    const p = project(entry(repo));
    const before = JSON.parse(cli(['list', '--json'], p).out);
    expect(before.schemaVersion).toBe(2);
    expect(before.dependencies[0]).toMatchObject({ id: 'dep', pin: 'v1.0.0', license: 'MIT', usage: 'as-is', adapter: 'scripts/dep-adapter.ts', installed: false, commit: null });
    expect(cli(['install'], p).code).toBe(0);
    const after = JSON.parse(cli(['list', '--json'], p).out);
    expect(after.dependencies[0].installed).toBe(true);
    expect(after.dependencies[0].commit).toMatch(/^[0-9a-f]{40}$/);
  });

  test('an invalid manifest exits 1', () => {
    const p = project({ id: 'broken' });
    expect(cli(['list'], p).code).toBe(1);
  });
});

describe('install', () => {
  test('idempotent: second run refreshes, same commit, exit 0', () => {
    const repo = fixtureRepo(path.join(scratch, 'repo'));
    const p = project(entry(repo));
    const first = cli(['install'], p);
    expect(first.code).toBe(0);
    expect(first.out).toContain('installed');
    const c1 = JSON.parse(fs.readFileSync(path.join(p, 'external-deps.json'), 'utf8')).dependencies[0].commit;
    const second = cli(['install'], p);
    expect(second.code).toBe(0);
    expect(second.out).toContain('refreshed');
    const c2 = JSON.parse(fs.readFileSync(path.join(p, 'external-deps.json'), 'utf8')).dependencies[0].commit;
    expect(c2).toBe(c1);
    expect(fs.readFileSync(path.join(p, '.gitignore'), 'utf8')).toContain('external/dep/');
  });

  test('refuses a deny-class dependency (exit 1, nothing cloned)', () => {
    const repo = fixtureRepo(path.join(scratch, 'repo'));
    const p = project(entry(repo, { license: 'AGPL-3.0-only' }));
    const r = cli(['install'], p);
    expect(r.code).toBe(1);
    expect(r.err).toContain('deny class');
    expect(fs.existsSync(path.join(p, 'external/dep'))).toBe(false);
  });

  test('refuses a NEW off-convention install_dir (R3 — registration refused)', () => {
    const repo = fixtureRepo(path.join(scratch, 'repo'));
    const p = project(entry(repo, { install_dir: 'vendor/dep' }));
    const r = cli(['install'], p);
    expect(r.code).toBe(1);
    expect(r.err).toContain('registration refused');
  });

  test('--id of an unknown dependency exits 1', () => {
    const repo = fixtureRepo(path.join(scratch, 'repo'));
    const p = project(entry(repo));
    expect(cli(['install', '--id', 'nope'], p).code).toBe(1);
  });
});

describe('verify', () => {
  test('clean install → exit 0; --json carries ok + findings', () => {
    const repo = fixtureRepo(path.join(scratch, 'repo'));
    const p = project(entry(repo));
    cli(['install'], p);
    expect(cli(['verify'], p).code).toBe(0);
    const j = JSON.parse(cli(['verify', '--json'], p).out);
    expect(j.ok).toBe(true);
    expect(j.findings.some((f: { check: string }) => f.check === 'V8')).toBe(true);
  });

  test('a modified tracked upstream file → exit 1 (V8)', () => {
    const repo = fixtureRepo(path.join(scratch, 'repo'));
    const p = project(entry(repo));
    cli(['install'], p);
    fs.appendFileSync(path.join(p, 'external/dep/file-0.txt'), 'patched\n');
    const r = cli(['verify'], p);
    expect(r.code).toBe(1);
    expect(r.out).toContain('[FAIL] V8');
  });

  test('--manifest-only is offline and skips the clone checks', () => {
    const p = project(entry('/nonexistent/repo'));
    fs.writeFileSync(path.join(p, '.gitignore'), 'external/\n');
    const j = JSON.parse(cli(['verify', '--manifest-only', '--json'], p).out);
    expect(j.ok).toBe(true);
    expect(j.findings.some((f: { check: string }) => ['V6', 'V7', 'V8', 'V9'].includes(f.check))).toBe(false);
  });

  test('a deny-class license fails --manifest-only (the commit-time / CI leg)', () => {
    const p = project(entry('/nonexistent/repo', { license: 'SSPL-1.0' }));
    fs.writeFileSync(path.join(p, '.gitignore'), 'external/\n');
    expect(cli(['verify', '--manifest-only'], p).code).toBe(1);
  });
});

describe('check-updates', () => {
  test('reports a newer tag, exit 0, and never writes the manifest', () => {
    const repo = fixtureRepo(path.join(scratch, 'repo'), ['v1.0.0', 'v1.1.0']);
    const p = project(entry(repo));
    const manifestPath = path.join(p, 'external-deps.json');
    const before = fs.readFileSync(manifestPath, 'utf8');
    const r = cli(['check-updates', '--json'], p);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).updates[0]).toMatchObject({ id: 'dep', pin: 'v1.0.0', ok: true, newer: 'v1.1.0' });
    expect(fs.readFileSync(manifestPath, 'utf8')).toBe(before);
  });
});
