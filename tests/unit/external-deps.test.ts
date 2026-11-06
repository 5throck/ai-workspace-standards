/**
 * Tests for scripts/lib/external-deps.ts — the generic external-dependency
 * machinery (design docs/designs/2026-11-07-external-deps-machinery-design.md,
 * upstream U-20261106-003):
 *
 *   §4.1  manifest parsing + validation (schema drift, bad install_dir, unknown
 *         propagation value, non-https repos, placeholder resolution)
 *   §4.2  E2E scaffold fetch WITHOUT network — a fixture git repo is created in
 *         a temp dir (git init + one commit + tag v6.8.0) and consumed through a
 *         file:// path in the install command (parseExternalDepsManifest's
 *         allowLocalRepos opt-in is test-only — production scripts never enable
 *         it). Assertions: clone lands in install_dir, manifest commit filled,
 *         gitignore line appended, WARN-not-fail on a bogus repo, strict fails.
 *   §4.3  upgrade update pass core: newer tag detected via ls-remote on the
 *         fixture repo, compat test pass moves the pin, compat test fail holds,
 *         dry-run semantics (no writes) are the pass's own concern — here the
 *         lib primitives are pinned.
 *   §4.4  vendoring-guard detection (D4) + gitignore coverage logic (D5).
 *
 * Fixture repos are cleaned per run. NO network: every git call targets a
 * local fixture (file:// or plain path).
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  parseExternalDepsManifest,
  mergeExternalDepsManifests,
  resolveInstallArgv,
  resolveCompatTestArgv,
  tokenizeCommand,
  installDependency,
  checkUpstreamTags,
  checkPinDrift,
  runCompatibilityTest,
  isNewerTag,
  isGitignoreCovered,
  ensureGitignoreCoverage,
  readGitignore,
  findVendoredInstallDirs,
  isUnderAnyInstallDir,
  extractInstallDirsLoose,
  fetchProjectExternalDeps,
  type ExternalDepEntry,
  type ExternalDepsManifest,
} from '../../scripts/lib/external-deps.ts';

// ── fixture helpers ────────────────────────────────────────────────────────────

let scratchRoot = '';

function git(args: string[], cwd: string): void {
  const r = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
  if (r.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed (exit ${r.exitCode}): ${r.stderr.toString()}`);
  }
}

/** Tiny local fixture repo: one commit tagged v6.8.0, a second tagged v6.9.0. */
function createFixtureRepo(dir: string, opts: { secondTag?: boolean } = {}): string {
  fs.mkdirSync(dir, { recursive: true });
  git(['init', '-q'], dir);
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  git(['add', '-A'], dir);
  git(['-c', 'user.email=fixture@test', '-c', 'user.name=Fixture', 'commit', '-q', '-m', 'v6.8.0 content'], dir);
  git(['tag', 'v6.8.0'], dir);
  if (opts.secondTag !== false) {
    fs.writeFileSync(path.join(dir, 'extra.txt'), 'newer\n');
    git(['add', '-A'], dir);
    git(['-c', 'user.email=fixture@test', '-c', 'user.name=Fixture', 'commit', '-q', '-m', 'v6.9.0 content'], dir);
    git(['tag', 'v6.9.0'], dir);
  }
  return dir;
}

function fileUrl(dir: string): string {
  // Trailing slash matters for git's file transport on some hosts; both work.
  return `file://${dir}`;
}

function writeManifest(projectDir: string, manifest: unknown): void {
  fs.writeFileSync(path.join(projectDir, 'external-deps.json'), JSON.stringify(manifest, null, 2) + '\n');
}

function entryFor(repoUrl: string, installDir = 'vendor/fixture-dep', pin = 'v6.8.0'): ExternalDepEntry {
  return {
    id: 'fixture-dep',
    repo: repoUrl,
    pin,
    install: 'git clone --depth 1 --branch {pin} {repo} {dir}',
    install_dir: installDir,
    compatibility_test: 'bun -e "process.exit(0)"',
    propagation: 'never',
  };
}

// ── §4.1 parsing + validation ──────────────────────────────────────────────────

describe('parseExternalDepsManifest (D1 strict validation)', () => {
  const valid = {
    schema_version: 1,
    dependencies: [{
      id: 'ppt-master',
      repo: 'https://github.com/hugohe3/ppt-master',
      pin: 'v6.8.0',
      commit: '5e8856be0da8e6bc85c4aa28acc614478f7b7137',
      install: 'git clone --depth 1 --branch {pin} {repo} {dir}',
      install_dir: 'presentations/ppt-master',
      consumer: 'deck pipeline',
      compatibility_test: 'python3 scripts/deck/tests/test_svg_check_parity.py',
      propagation: 'never',
    }],
  };

  test('accepts a valid manifest (round-trips every field)', () => {
    const m = parseExternalDepsManifest(JSON.stringify(valid));
    expect(m.schema_version).toBe(1);
    expect(m.dependencies).toHaveLength(1);
    expect(m.dependencies[0].id).toBe('ppt-master');
    expect(m.dependencies[0].commit).toBe('5e8856be0da8e6bc85c4aa28acc614478f7b7137');
    expect(m.dependencies[0].consumer).toBe('deck pipeline');
  });

  test('accepts the empty L1 seed (with $comment doc key)', () => {
    const m = parseExternalDepsManifest(JSON.stringify({ $comment: 'doc', schema_version: 1, dependencies: [] }));
    expect(m.dependencies).toHaveLength(0);
  });

  test('rejects schema drift', () => {
    expect(() => parseExternalDepsManifest(JSON.stringify({ ...valid, schema_version: 2 }))).toThrow(/schema_version/);
    expect(() => parseExternalDepsManifest('not json')).toThrow(/invalid JSON/);
    expect(() => parseExternalDepsManifest('[1,2]')).toThrow(/top level must be a JSON object/);
  });

  test('rejects unknown top-level fields', () => {
    expect(() => parseExternalDepsManifest(JSON.stringify({ ...valid, extra: 1 }))).toThrow(/unknown top-level field\(s\): extra/);
  });

  test('rejects unknown entry fields (interim co-work shape is NOT valid)', () => {
    const interim = {
      schema_version: 1,
      dependencies: [{ ...valid.dependencies[0], license: 'MIT', excluded_packages: [] }],
    };
    expect(() => parseExternalDepsManifest(JSON.stringify(interim))).toThrow(/unknown field\(s\): license, excluded_packages/);
  });

  test('rejects a bad propagation value', () => {
    const bad = { schema_version: 1, dependencies: [{ ...valid.dependencies[0], propagation: 'always' }] };
    expect(() => parseExternalDepsManifest(JSON.stringify(bad))).toThrow(/propagation must be one of \[never\]/);
  });

  test('rejects non-https and credential-embedding repos', () => {
    const http = { schema_version: 1, dependencies: [{ ...valid.dependencies[0], repo: 'http://github.com/x/y' }] };
    expect(() => parseExternalDepsManifest(JSON.stringify(http))).toThrow(/https:\/\/ URL/);
    const cred = { schema_version: 1, dependencies: [{ ...valid.dependencies[0], repo: 'https://user:pass@github.com/x/y' }] };
    expect(() => parseExternalDepsManifest(JSON.stringify(cred))).toThrow(/credentials/);
    const file = { schema_version: 1, dependencies: [{ ...valid.dependencies[0], repo: 'file:///tmp/repo' }] };
    expect(() => parseExternalDepsManifest(JSON.stringify(file))).toThrow(/file:\/\//);
  });

  test('allowLocalRepos accepts file:// and plain local paths (test manifests only)', () => {
    const local = { schema_version: 1, dependencies: [{ ...valid.dependencies[0], repo: '/tmp/some/repo' }] };
    expect(() => parseExternalDepsManifest(JSON.stringify(local), '', { allowLocalRepos: true })).not.toThrow();
    const file = { schema_version: 1, dependencies: [{ ...valid.dependencies[0], repo: 'file:///tmp/repo' }] };
    expect(() => parseExternalDepsManifest(JSON.stringify(file), '', { allowLocalRepos: true })).not.toThrow();
  });

  test('rejects traversal, absolute, and backslash install_dirs', () => {
    for (const bad of ['../escape', '/absolute', 'a\\b', '..', 'presentations/../..']) {
      const m = { schema_version: 1, dependencies: [{ ...valid.dependencies[0], install_dir: bad }] };
      expect(() => parseExternalDepsManifest(JSON.stringify(m))).toThrow(/install_dir/);
    }
  });

  test('rejects duplicate ids and malformed commits', () => {
    const dup = { schema_version: 1, dependencies: [valid.dependencies[0], valid.dependencies[0]] };
    expect(() => parseExternalDepsManifest(JSON.stringify(dup))).toThrow(/duplicate id/);
    const badCommit = { schema_version: 1, dependencies: [{ ...valid.dependencies[0], commit: 'abc123' }] };
    expect(() => parseExternalDepsManifest(JSON.stringify(badCommit))).toThrow(/40-hex/);
  });

  test('rejects install templates with shell metacharacters or missing placeholders', () => {
    const shell = { schema_version: 1, dependencies: [{ ...valid.dependencies[0], install: 'git clone --depth 1 --branch {pin} {repo} {dir}; rm -rf /' }] };
    expect(() => parseExternalDepsManifest(JSON.stringify(shell))).toThrow(/shell metacharacters/);
    const noPh = { schema_version: 1, dependencies: [{ ...valid.dependencies[0], install: 'git clone {repo} {dir}' }] };
    expect(() => resolveInstallArgv(parseExternalDepsManifest(JSON.stringify(noPh)).dependencies[0], '/proj')).toThrow(/placeholders/);
    const notGit = { schema_version: 1, dependencies: [{ ...valid.dependencies[0], install: 'curl -o {dir} {repo}' }] };
    expect(() => resolveInstallArgv(parseExternalDepsManifest(JSON.stringify(notGit)).dependencies[0], '/proj')).toThrow(/argv\[0\]='git'/);
  });
});

describe('tokenizeCommand / resolveInstallArgv / resolveCompatTestArgv', () => {
  test('tokenizes with quote awareness, no shell', () => {
    expect(tokenizeCommand('git clone --branch "my tag" {dir}')).toEqual(['git', 'clone', '--branch', 'my tag', '{dir}']);
  });

  test('resolves {pin}/{repo}/{dir} (dir absolute under projectDir)', () => {
    const entry = entryFor('https://github.com/x/y', 'presentations/ppt-master');
    const argv = resolveInstallArgv(entry, '/proj');
    expect(argv[0]).toBe('git');
    expect(argv).toContain('v6.8.0');
    expect(argv).toContain('https://github.com/x/y');
    expect(argv[argv.length - 1]).toBe(path.resolve('/proj', 'presentations/ppt-master'));
  });

  test('compat test argv resolves from a plain command string', () => {
    expect(resolveCompatTestArgv({ compatibility_test: 'python3 scripts/deck/tests/test_svg_check_parity.py' }, 't'))
      .toEqual(['python3', 'scripts/deck/tests/test_svg_check_parity.py']);
  });
});

describe('mergeExternalDepsManifests (D1: variant extends common, merge on id)', () => {
  test('variant entries win on id collision; common-only entries survive', () => {
    const common: ExternalDepsManifest = {
      schema_version: 1,
      dependencies: [{ ...entryFor('https://github.com/x/shared'), id: 'shared', pin: 'v1.0.0' }],
    };
    const variant: ExternalDepsManifest = {
      schema_version: 1,
      dependencies: [
        { ...entryFor('https://github.com/x/shared'), id: 'shared', pin: 'v2.0.0' },
        entryFor('https://github.com/x/ppt-master'),
      ],
    };
    const merged = mergeExternalDepsManifests(common, variant);
    expect(merged.dependencies).toHaveLength(2);
    expect(merged.dependencies.find((d) => d.id === 'shared')?.pin).toBe('v2.0.0');
    expect(merged.dependencies.find((d) => d.id === 'fixture-dep')).toBeDefined();
  });

  test('null variant returns the common manifest', () => {
    const common: ExternalDepsManifest = { schema_version: 1, dependencies: [] };
    expect(mergeExternalDepsManifests(common, null).dependencies).toHaveLength(0);
  });
});

describe('isNewerTag (D3 semver-aware pin comparison)', () => {
  test('strictly newer release tags', () => {
    expect(isNewerTag('v6.9.0', 'v6.8.0')).toBe(true);
    expect(isNewerTag('v7.0.0', 'v6.8.0')).toBe(true);
    expect(isNewerTag('v6.8.1', 'v6.8.0')).toBe(true);
    expect(isNewerTag('v6.8.0', 'v6.8.0')).toBe(false);
    expect(isNewerTag('v6.7.9', 'v6.8.0')).toBe(false);
  });

  test('release beats pre-release of the same numeric version; non-semver never promotes', () => {
    expect(isNewerTag('v6.8.0', 'v6.8.0-rc1')).toBe(true);
    expect(isNewerTag('v6.8.0-rc2', 'v6.8.0-rc1')).toBe(false);
    expect(isNewerTag('latest', 'v6.8.0')).toBe(false);
    expect(isNewerTag('v6.8.0', 'not-semver')).toBe(false);
  });
});

// ── §4.2/§4.3 fixture-repo flows (NO network) ─────────────────────────────────

describe('installDependency against a local fixture repo', () => {
  beforeEach(() => { scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'extdeps-test-')); });
  afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

  test('clones at the pin into install_dir and records the resolved commit', () => {
    const repo = createFixtureRepo(path.join(scratchRoot, 'fixture-repo'), { secondTag: false });
    const projectDir = path.join(scratchRoot, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    const outcome = installDependency(entryFor(fileUrl(repo)), projectDir);
    expect(outcome.status).toBe('installed');
    expect(outcome.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(fs.existsSync(path.join(projectDir, 'vendor/fixture-dep/README.md'))).toBe(true);
    // The clone carries the pinned tag's content (v6.9.0's extra.txt absent).
    expect(fs.existsSync(path.join(projectDir, 'vendor/fixture-dep/extra.txt'))).toBe(false);
  });

  test('is idempotent — an existing clone refreshes to the pin, not a re-clone', () => {
    const repo = createFixtureRepo(path.join(scratchRoot, 'fixture-repo'));
    const projectDir = path.join(scratchRoot, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    const first = installDependency(entryFor(fileUrl(repo)), projectDir);
    expect(first.status).toBe('installed');
    const second = installDependency(entryFor(fileUrl(repo)), projectDir);
    expect(second.status).toBe('refreshed');
    expect(second.commit).toBe(first.commit);
  });

  test('returns a failure outcome (never throws) for a bogus repo', () => {
    const projectDir = path.join(scratchRoot, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    const outcome = installDependency(entryFor(fileUrl(path.join(scratchRoot, 'no-such-repo'))), projectDir);
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toBeTruthy();
  });
});

describe('fetchProjectExternalDeps (D2 scaffold fetch core — WARN posture, D5 gitignore)', () => {
  beforeEach(() => { scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'extdeps-test-')); });
  afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

  test('happy path: clone lands, commit written back, gitignore appended', () => {
    const repo = createFixtureRepo(path.join(scratchRoot, 'fixture-repo'), { secondTag: false });
    const projectDir = path.join(scratchRoot, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    writeManifest(projectDir, {
      schema_version: 1,
      dependencies: [{ ...entryFor(fileUrl(repo)), commit: undefined }],
    });
    const result = fetchProjectExternalDeps(projectDir, { allowLocalRepos: true });
    expect(result.ok).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].ok).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'vendor/fixture-dep/.git'))).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(projectDir, 'external-deps.json'), 'utf8'));
    expect(manifest.dependencies[0].commit).toMatch(/^[0-9a-f]{40}$/);

    const gitignore = readGitignore(projectDir);
    expect(isGitignoreCovered(gitignore, 'vendor/fixture-dep')).toBe(true);
    expect(result.gitignoreAppended).toEqual(['vendor/fixture-dep']);
  });

  test('second fetch run appends nothing (gitignore idempotence)', () => {
    const repo = createFixtureRepo(path.join(scratchRoot, 'fixture-repo'), { secondTag: false });
    const projectDir = path.join(scratchRoot, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    writeManifest(projectDir, { schema_version: 1, dependencies: [entryFor(fileUrl(repo))] });
    fetchProjectExternalDeps(projectDir, { allowLocalRepos: true });
    const second = fetchProjectExternalDeps(projectDir, { allowLocalRepos: true });
    expect(second.gitignoreAppended).toEqual([]);
  });

  test('bogus repo → WARN-not-fail (ok stays true non-strict)', () => {
    const projectDir = path.join(scratchRoot, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    writeManifest(projectDir, {
      schema_version: 1,
      dependencies: [entryFor(fileUrl(path.join(scratchRoot, 'missing-repo')))],
    });
    const result = fetchProjectExternalDeps(projectDir, { allowLocalRepos: true });
    expect(result.ok).toBe(true); // D2: a scaffold must survive a failed fetch
    expect(result.results[0].ok).toBe(false);
    expect(result.results[0].error).toBeTruthy();
  });

  test('strict mode hard-fails on a fetch failure', () => {
    const projectDir = path.join(scratchRoot, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    writeManifest(projectDir, {
      schema_version: 1,
      dependencies: [entryFor(fileUrl(path.join(scratchRoot, 'missing-repo')))],
    });
    const result = fetchProjectExternalDeps(projectDir, { allowLocalRepos: true, strict: true });
    expect(result.ok).toBe(false);
  });

  test('invalid manifest → manifestError (strict fails, non-strict warns)', () => {
    const projectDir = path.join(scratchRoot, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    writeManifest(projectDir, { schema_version: 3, dependencies: [] });
    const lax = fetchProjectExternalDeps(projectDir, { allowLocalRepos: true });
    expect(lax.ok).toBe(true);
    expect(lax.manifestError).toMatch(/schema_version/);
    const strict = fetchProjectExternalDeps(projectDir, { allowLocalRepos: true, strict: true });
    expect(strict.ok).toBe(false);
  });

  test('absent manifest → vacuous no-op', () => {
    const projectDir = path.join(scratchRoot, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    const result = fetchProjectExternalDeps(projectDir);
    expect(result.manifestPresent).toBe(false);
    expect(result.results).toHaveLength(0);
  });
});

describe('checkUpstreamTags / checkPinDrift / runCompatibilityTest (D3 core)', () => {
  beforeEach(() => { scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'extdeps-test-')); });
  afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

  test('newer tag detected on the fixture repo; current pin short-circuits', () => {
    const repo = createFixtureRepo(path.join(scratchRoot, 'fixture-repo'));
    const newer = checkUpstreamTags({ repo: fileUrl(repo), pin: 'v6.8.0' });
    expect(newer.ok).toBe(true);
    expect(newer.newer).toBe('v6.9.0');
    const current = checkUpstreamTags({ repo: fileUrl(repo), pin: 'v6.9.0' });
    expect(current.ok).toBe(true);
    expect(current.newer).toBeUndefined();
    const bogus = checkUpstreamTags({ repo: fileUrl(path.join(scratchRoot, 'missing')), pin: 'v1.0.0' });
    expect(bogus.ok).toBe(false);
    expect(bogus.error).toBeTruthy();
  });

  test('pin drift tripwire: recorded commit vs clone HEAD', () => {
    const repo = createFixtureRepo(path.join(scratchRoot, 'fixture-repo'), { secondTag: false });
    const projectDir = path.join(scratchRoot, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    const outcome = installDependency(entryFor(fileUrl(repo)), projectDir);
    const dep = { ...entryFor(fileUrl(repo)), commit: outcome.commit };
    expect(checkPinDrift(dep, projectDir)).toMatchObject({ checked: true, drifted: false });
    expect(checkPinDrift({ ...dep, commit: '0'.repeat(40) }, projectDir)).toMatchObject({ checked: true, drifted: true });
    expect(checkPinDrift(dep, path.join(scratchRoot, 'empty-proj')).checked).toBe(false);
  });

  test('compatibility test pass/fail semantics', () => {
    const projectDir = path.join(scratchRoot, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    expect(runCompatibilityTest({ ...entryFor('https://x'), compatibility_test: 'bun -e "process.exit(0)"' }, projectDir))
      .toMatchObject({ ran: true, ok: true });
    const fail = runCompatibilityTest({ ...entryFor('https://x'), compatibility_test: 'bun -e "process.exit(1)"' }, projectDir);
    expect(fail.ok).toBe(false);
    expect(fail.error).toMatch(/exit 1/);
    // A missing compatibility_test can never authorize a pin move (design §5).
    expect(runCompatibilityTest({ ...entryFor('https://x'), compatibility_test: undefined }, projectDir).ran).toBe(false);
  });
});

// ── §4.4 vendoring guard (D4) + gitignore coverage (D5) ───────────────────────

describe('findVendoredInstallDirs (D4 vendoring guard)', () => {
  beforeEach(() => { scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'extdeps-test-')); });
  afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

  test('flags an install_dir present as a directory inside the template tree', () => {
    const tpl = path.join(scratchRoot, 'templates', 'co-x');
    fs.mkdirSync(path.join(tpl, 'presentations', 'ppt-master'), { recursive: true });
    expect(findVendoredInstallDirs(tpl, ['presentations/ppt-master'])).toEqual(['presentations/ppt-master']);
  });

  test('flags a stray FILE named exactly like the install_dir leaf (partial vendor)', () => {
    const tpl = path.join(scratchRoot, 'templates', 'co-x');
    fs.mkdirSync(path.join(tpl, 'presentations'), { recursive: true });
    fs.writeFileSync(path.join(tpl, 'presentations', 'ppt-master'), 'x');
    expect(findVendoredInstallDirs(tpl, ['presentations/ppt-master'])).toEqual(['presentations/ppt-master']);
    // An unrelated file (different name) inside the parent dir is NOT vendoring.
    const tpl2 = path.join(scratchRoot, 'templates', 'co-y');
    fs.mkdirSync(path.join(tpl2, 'presentations'), { recursive: true });
    fs.writeFileSync(path.join(tpl2, 'presentations', 'ppt-master.py'), 'x');
    expect(findVendoredInstallDirs(tpl2, ['presentations/ppt-master'])).toEqual([]);
  });

  test('clean template tree → no hits; unrelated directories are ignored', () => {
    const tpl = path.join(scratchRoot, 'templates', 'co-x');
    fs.mkdirSync(path.join(tpl, 'presentations'), { recursive: true });
    fs.writeFileSync(path.join(tpl, 'presentations', 'README.md'), 'fine');
    expect(findVendoredInstallDirs(tpl, ['presentations/ppt-master'])).toEqual([]);
    expect(findVendoredInstallDirs(tpl, [])).toEqual([]);
  });
});

describe('isUnderAnyInstallDir / extractInstallDirsLoose (D4 exclusion helpers)', () => {
  test('path membership', () => {
    expect(isUnderAnyInstallDir('presentations/ppt-master', ['presentations/ppt-master'])).toBe(true);
    expect(isUnderAnyInstallDir('presentations/ppt-master/svg/x.svg', ['presentations/ppt-master'])).toBe(true);
    expect(isUnderAnyInstallDir('presentations/ppt-masterx', ['presentations/ppt-master'])).toBe(false);
    expect(isUnderAnyInstallDir('presentations/other', ['presentations/ppt-master'])).toBe(false);
  });

  test('loose extraction covers both the generic field and the interim install_path', () => {
    expect(extractInstallDirsLoose(JSON.stringify({ dependencies: [{ install_dir: 'a/b' }] }))).toEqual(['a/b']);
    expect(extractInstallDirsLoose(JSON.stringify({ dependencies: [{ install_path: 'c/d' }] }))).toEqual(['c/d']);
    expect(extractInstallDirsLoose(JSON.stringify({ dependencies: [{ install_dir: '../escape' }, { install_dir: '/abs' }, { nope: 1 }] }))).toEqual([]);
    expect(extractInstallDirsLoose('not json')).toEqual([]);
  });
});

describe('isGitignoreCovered / ensureGitignoreCoverage (D5)', () => {
  test('coverage via exact line, parent dir, trailing slash, and anchored forms', () => {
    const gi = ['# comment', 'presentations/ppt-master/', 'vendor/', 'build/output', '/logs'];
    expect(isGitignoreCovered(gi.join('\n'), 'presentations/ppt-master')).toBe(true);
    expect(isGitignoreCovered(gi.join('\n'), 'vendor')).toBe(true);
    expect(isGitignoreCovered(gi.join('\n'), 'vendor/x/y')).toBe(true);
    expect(isGitignoreCovered(gi.join('\n'), 'build/output')).toBe(true);
    expect(isGitignoreCovered(gi.join('\n'), 'build/output/deep')).toBe(true);
    expect(isGitignoreCovered(gi.join('\n'), 'logs')).toBe(true);
    // '/logs' is the root-level logs DIRECTORY — everything below it is covered
    // by git semantics, same as an unanchored parent-dir line.
    expect(isGitignoreCovered(gi.join('\n'), 'logs/sub')).toBe(true);
    expect(isGitignoreCovered(gi.join('\n'), 'presentations/other')).toBe(false);
    expect(isGitignoreCovered('', 'anything')).toBe(false);
  });

  test('negation lines never count as coverage', () => {
    expect(isGitignoreCovered('!presentations/ppt-master\n', 'presentations/ppt-master')).toBe(false);
  });

  test('ensureGitignoreCoverage appends exactly the uncovered dirs once', () => {
    const projectDir = path.join(scratchRoot, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, '.gitignore'), 'node_modules/\n');
    const first = ensureGitignoreCoverage(projectDir, ['presentations/ppt-master', 'node_modules']);
    expect(first.appended).toEqual(['presentations/ppt-master']);
    const content = readGitignore(projectDir);
    expect(content).toContain('presentations/ppt-master/\n');
    expect(content).toContain('node_modules/');
    const second = ensureGitignoreCoverage(projectDir, ['presentations/ppt-master']);
    expect(second.appended).toEqual([]);
  });
});
