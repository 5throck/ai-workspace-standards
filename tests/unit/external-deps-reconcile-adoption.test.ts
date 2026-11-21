/**
 * T-20261117-001 (spec docs/designs/2026-11-17-root-machinery-batch-design.md §3):
 * EXTERNAL DEPS pass channel 2c — SEED-ID ADOPTION into a valid schema-v2
 * project manifest.
 *
 * The pass had three write channels (absent-file seed copy, parse-failure
 * reconcile, v1→v2 migration) and none fired for a valid v2 manifest missing
 * template-seed ids — the co-deck/quickdl drift class. C-T1..C-T6 pin the pure
 * `adoptSeedEntries` core (scripts/helpers/external-deps-reconcile.ts v1.2.0);
 * C-T7..C-T9 are block-slice tests on the pass via
 * `upgrade-project.ts --external-deps-only` against a temp project and the real
 * co-deck seed (the upgrade-overwrite-protection pattern: engine run as a
 * subprocess, assertions tolerate an offline environment — the per-dependency
 * upstream check may SKIP, which never un-does the adoption or the gitignore
 * coverage write).
 *
 * v1.1.0 (2026-11-21, design docs/designs/2026-11-21-humanize-seed-country-profiles-design.md #1,
 *          T-20261121-002): the co-deck seed gains the `humanize` entry (Korean AI-tell lint,
 *          market_scope ["ko-language"]) — the channel-2c block-slice pins (C-T7/C-T7b/C-T9)
 *          follow the seed as changed: adopted-id lists include humanize, gitignore coverage
 *          includes external/humanize/, and C-T9's no-op fixture manifest covers BOTH live
 *          seed ids (the fleet-majority no-op intent is unchanged).
 * @version 1.0.0
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import { adoptSeedEntries } from '../../scripts/helpers/external-deps-reconcile.ts';
import { parseExternalDepsManifest, type ExternalDepsManifest } from '../../scripts/lib/external-deps.ts';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

// ── Pure-core fixtures (C-T1..C-T6) ────────────────────────────────────────────

function seedWith(entries: Array<Record<string, unknown>>): ExternalDepsManifest {
  return parseExternalDepsManifest(JSON.stringify({ schema_version: 2, dependencies: entries }), 'seed');
}

function seedEntry(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    repo: `https://github.com/example/${id}`,
    pin: 'v1.0.0',
    install: 'git clone --depth 1 --branch {pin} {repo} {dir}',
    install_dir: `external/${id}`,
    consumer: `seed consumer for ${id}`,
    propagation: 'never',
    license: 'MIT',
    usage: 'as-is',
    adapter: `scripts/${id}-adapter.ts`,
    ...extra,
  };
}

function projectWith(entries: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ schema_version: 2, dependencies: entries, ...extra });
}

describe('adoptSeedEntries — add-if-missing adoption into a valid manifest (design §3)', () => {
  test('C-T1: empty project deps + one seed entry → adopted verbatim, schema_version unchanged', () => {
    const seed = seedWith([seedEntry('alpha', { pin: 'v1.2.3', commit: 'a'.repeat(40) })]);
    const r = adoptSeedEntries(projectWith([]), seed);
    expect(r.ok).toBe(true);
    expect(r.adopted).toEqual(['alpha']);
    expect(r.document.schema_version).toBe(2);
    expect(r.document.dependencies.length).toBe(1);
    const dep = r.document.dependencies[0] as Record<string, unknown>;
    // Verbatim seed entry — every declared field, values unchanged.
    expect(JSON.parse(JSON.stringify(dep))).toEqual(JSON.parse(JSON.stringify(seedEntry('alpha', { pin: 'v1.2.3', commit: 'a'.repeat(40) }))));
    expect(dep['license']).toBe('MIT');
    expect(dep['pin']).toBe('v1.2.3');
  });

  test('C-T2: project already has the id (different pin) → no adoption for it, pin untouched; other seed ids still adopted', () => {
    const seed = seedWith([seedEntry('alpha'), seedEntry('beta')]);
    const project = projectWith([seedEntry('alpha', { pin: 'v9.9.9', license: 'Apache-2.0' })]);
    const r = adoptSeedEntries(project, seed);
    expect(r.ok).toBe(true);
    expect(r.adopted).toEqual(['beta']); // alpha: the project's operative pin is its fact
    const deps = r.document.dependencies as Array<Record<string, unknown>>;
    expect(deps.map((d) => d['id'])).toEqual(['alpha', 'beta']); // project entry first, adopted appended
    expect(deps[0]['pin']).toBe('v9.9.9');
    expect(deps[0]['license']).toBe('Apache-2.0'); // project attestation never clobbered
    expect(deps[1]['pin']).toBe('v1.0.0');
  });

  test('C-T3: valid project-only entries preserved in place; adopted ids appended after', () => {
    const seed = seedWith([seedEntry('alpha')]);
    const projectOnly = seedEntry('local-tool', { pin: 'v3.0.0', license: 'BSD-2-Clause' });
    const r = adoptSeedEntries(projectWith([projectOnly]), seed);
    expect(r.ok).toBe(true);
    expect(r.adopted).toEqual(['alpha']);
    const deps = r.document.dependencies as Array<Record<string, unknown>>;
    expect(deps.map((d) => d['id'])).toEqual(['local-tool', 'alpha']);
    expect(deps[0]['pin']).toBe('v3.0.0'); // project-only entry untouched
  });

  test('C-T3b: an invalid-verbatim entry defeats strict revalidation → ok:false (caller skip; the pass reconcile channel owns that document)', () => {
    const seed = seedWith([seedEntry('alpha')]);
    // Missing the v2-required license/usage/adapter — exactly the shape the
    // reconcile channel keeps verbatim for unattested project-only entries.
    const invalidVerbatim = {
      id: 'unattested',
      repo: 'https://github.com/example/unattested',
      pin: 'v1.0.0',
      install: 'git clone --depth 1 --branch {pin} {repo} {dir}',
      install_dir: 'external/unattested',
      propagation: 'never',
    };
    const r = adoptSeedEntries(projectWith([invalidVerbatim]), seed);
    expect(r.ok).toBe(false);
    expect(r.adopted).toEqual([]);
    expect(r.error).toContain('license');
  });

  test('C-T4: empty seed → adopted: [], nothing to write', () => {
    const r = adoptSeedEntries(projectWith([seedEntry('alpha')]), seedWith([]));
    expect(r.ok).toBe(true);
    expect(r.adopted).toEqual([]);
    expect(r.document.dependencies.length).toBe(1); // project entries untouched
  });

  test('C-T5: invalid project raw (not JSON / schema drift) → ok:false, caller skip path', () => {
    const seed = seedWith([seedEntry('alpha')]);
    const notJson = adoptSeedEntries('{ this is not json', seed);
    expect(notJson.ok).toBe(false);
    expect(notJson.error).toContain('invalid JSON');
    const drift = adoptSeedEntries(JSON.stringify({ schema_version: 9, dependencies: [] }), seed);
    expect(drift.ok).toBe(false);
    expect(drift.adopted).toEqual([]);
  });

  test('C-T6: multi-seed adoption follows seed order', () => {
    const seed = seedWith([seedEntry('zeta'), seedEntry('mid'), seedEntry('aaa')]);
    const r = adoptSeedEntries(projectWith([]), seed);
    expect(r.adopted).toEqual(['zeta', 'mid', 'aaa']);
    expect((r.document.dependencies as Array<Record<string, unknown>>).map((d) => d['id'])).toEqual([
      'zeta',
      'mid',
      'aaa',
    ]);
  });

  test('$comment and the project document schema_version survive adoption', () => {
    const seed = seedWith([seedEntry('alpha')]);
    const project = JSON.stringify({
      $comment: 'project doc comment',
      schema_version: 2,
      dependencies: [],
    });
    const r = adoptSeedEntries(project, seed);
    expect(r.ok).toBe(true);
    expect(r.document.$comment).toBe('project doc comment');
    expect(r.document.schema_version).toBe(2);
  });

  test('idempotency: a second adoption over the already-adopted document is a no-op', () => {
    const seed = seedWith([seedEntry('alpha'), seedEntry('beta')]);
    const first = adoptSeedEntries(projectWith([]), seed);
    expect(first.adopted).toEqual(['alpha', 'beta']);
    const second = adoptSeedEntries(JSON.stringify(first.document), seed);
    expect(second.ok).toBe(true);
    expect(second.adopted).toEqual([]);
    expect(JSON.parse(JSON.stringify(second.document))).toEqual(JSON.parse(JSON.stringify(first.document)));
  });
});

// ── Pass-slice tests (C-T7..C-T9): engine subprocess against the co-deck seed ──

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function makeCoDeckProject(manifestJson: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'external-deps-adoption-'));
  tmpDirs.push(tmp);
  assertCallerEnvSafeForGitFixtures(tmp);
  spawnSync('git', ['init', '-q'], { cwd: tmp, env: gitCleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  assertFixtureGitIdentity(tmp);
  mkdirSync(join(tmp, 'docs'), { recursive: true });
  writeFileSync(join(tmp, 'template-version.txt'), 'variant=co-deck\nversion=0.0.0\ncountry=none\n');
  writeFileSync(join(tmp, 'variant.json'), JSON.stringify({ name: 'co-deck', version: '0.0.0' }));
  writeFileSync(join(tmp, 'external-deps.json'), manifestJson);
  return tmp;
}

interface PassRun {
  status: number;
  stdout: string;
}

function runPass(projectDir: string, extraArgs: string[] = []): PassRun {
  const r = spawnSync(process.execPath, [upgradeScript, projectDir, '--external-deps-only', '--yes', ...extraArgs], {
    encoding: 'utf8',
    cwd: workspaceRoot,
    env: gitCleanEnv(),
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return { status: r.status ?? -1, stdout: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

describe('runExternalDepsPass channel 2c — pass-level seed-id adoption (design §3)', () => {
  test('C-T7: valid v2 empty-deps project + co-deck seed → quickdl+humanize adopted, gitignore covered on arrival, decision rows', () => {
    const tmp = makeCoDeckProject('{"schema_version":2,"dependencies":[]}');
    const run = runPass(tmp);
    // Adoption row + one row per id (the live co-deck seed carries quickdl + humanize).
    expect(run.stdout).toContain('ADOPT');
    expect(run.stdout).toContain('seed-id adoption: dep `quickdl` adopted from the template seed verbatim (no project entry existed)');
    expect(run.stdout).toContain('seed-id adoption: dep `humanize` adopted from the template seed verbatim (no project entry existed)');
    // D5 coverage ran AFTER adoption — the adopted install_dirs are covered on arrival
    // (the pass emits ONE combined coverage row listing every appended dir).
    expect(run.stdout).toContain('appended coverage for: external/quickdl');
    const manifest = JSON.parse(readFileSync(join(tmp, 'external-deps.json'), 'utf8')) as {
      schema_version: number;
      dependencies: Array<Record<string, unknown>>;
    };
    expect(manifest.schema_version).toBe(2);
    expect(manifest.dependencies.map((d) => d['id'])).toEqual(['quickdl', 'humanize']);
    // Assert against the LIVE template seed's pin (not a hard-coded value) so
    // compat-gated seed pin moves (issue #2096 class) never stale this test.
    const seedPin = JSON.parse(
      readFileSync(join(workspaceRoot, 'templates', 'co-deck', 'external-deps.json'), 'utf8'),
    ).dependencies[0]['pin'];
    expect(manifest.dependencies[0]['pin']).toBe(seedPin);
    expect(manifest.dependencies[0]['license']).toBe('MIT');
    expect(manifest.dependencies[0]['usage']).toBe('as-is');
    // humanize: adopted verbatim — the ko-language scope rides along (advisory metadata).
    const seed = JSON.parse(
      readFileSync(join(workspaceRoot, 'templates', 'co-deck', 'external-deps.json'), 'utf8'),
    );
    expect(manifest.dependencies[1]).toEqual(seed.dependencies.find((d: Record<string, unknown>) => d['id'] === 'humanize'));
    const gitignore = readFileSync(join(tmp, '.gitignore'), 'utf8');
    expect(gitignore).toContain('external/quickdl/');
    expect(gitignore).toContain('external/humanize/');

    // Idempotency: the second run adopts nothing and writes nothing.
    const afterFirst = readFileSync(join(tmp, 'external-deps.json'), 'utf8');
    const second = runPass(tmp);
    expect(second.stdout).not.toContain('seed-id adoption');
    expect(readFileSync(join(tmp, 'external-deps.json'), 'utf8')).toBe(afterFirst);
    expect(readFileSync(join(tmp, '.gitignore'), 'utf8')).toBe(gitignore);
  });

  test('C-T7b: valid v2 manifest with existing deps → project entries preserved, adopted id appended after', () => {
    const projectDep = {
      id: 'local-tool',
      repo: 'https://github.com/example/local-tool',
      pin: 'v2.0.0',
      install: 'git clone --depth 1 --branch {pin} {repo} {dir}',
      install_dir: 'external/local-tool',
      propagation: 'never',
      license: 'MIT',
      usage: 'as-is',
      adapter: 'scripts/local-adapter.ts',
    };
    const tmp = makeCoDeckProject(JSON.stringify({ schema_version: 2, dependencies: [projectDep] }));
    const run = runPass(tmp);
    expect(run.stdout).toContain('seed-id adoption: dep `quickdl` adopted from the template seed verbatim (no project entry existed)');
    const manifest = JSON.parse(readFileSync(join(tmp, 'external-deps.json'), 'utf8')) as {
      dependencies: Array<Record<string, unknown>>;
    };
    // Project entry first, in place, untouched; adopted id appended after.
    expect(manifest.dependencies.map((d) => d['id'])).toEqual(['local-tool', 'quickdl', 'humanize']);
    expect(manifest.dependencies[0]['pin']).toBe('v2.0.0');
    const gitignore = readFileSync(join(tmp, '.gitignore'), 'utf8');
    expect(gitignore).toContain('external/local-tool/');
    expect(gitignore).toContain('external/quickdl/');
    expect(gitignore).toContain('external/humanize/');
  });

  test('C-T8: --dry-run → adoption rows printed, files untouched', () => {
    const tmp = makeCoDeckProject('{"schema_version":2,"dependencies":[]}');
    const run = runPass(tmp, ['--dry-run']);
    expect(run.stdout).toContain('seed-id adoption: dep `quickdl` adopted from the template seed verbatim (no project entry existed)');
    expect(run.stdout).toContain('[DRY RUN] WROTE: external-deps.json');
    expect(readFileSync(join(tmp, 'external-deps.json'), 'utf8')).toBe('{"schema_version":2,"dependencies":[]}');
    expect(existsSync(join(tmp, '.gitignore'))).toBe(false);
  });

  test('C-T9: project manifest already covering the seed ids → byte-identical pass (fleet-majority no-op)', () => {
    // Fixture covers BOTH live co-deck seed ids (quickdl + humanize) so the pass
    // stays a fleet-majority no-op; a seed growing a new id updates this fixture.
    const original = JSON.stringify({
      schema_version: 2,
      dependencies: [
        {
          id: 'quickdl',
          repo: 'https://github.com/5throck/QuickDL',
          pin: 'v1.0.0',
          install: 'git clone --depth 1 --branch {pin} {repo} {dir}',
          install_dir: 'external/quickdl',
          propagation: 'never',
          license: 'MIT',
          usage: 'as-is',
          adapter: 'scripts/co-deck/download-videos.ts',
        },
        {
          id: 'humanize',
          repo: 'https://github.com/5throck/Humanize',
          pin: 'v1.0.0',
          install: 'git clone --depth 1 --branch {pin} {repo} {dir}',
          install_dir: 'external/humanize',
          propagation: 'never',
          license: 'MIT',
          usage: 'as-is',
          adapter: 'scripts/co-deck/humanize-adapter.ts',
          market_scope: ['ko-language'],
        },
      ],
    });
    const tmp = makeCoDeckProject(original);
    const run = runPass(tmp);
    expect(run.stdout).not.toContain('seed-id adoption');
    expect(run.stdout).not.toContain('ADOPT');
    expect(readFileSync(join(tmp, 'external-deps.json'), 'utf8')).toBe(original);
  });
});
