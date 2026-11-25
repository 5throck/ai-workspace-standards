/**
 * Engine script-lane gaps (T-20261124-013 / U-20261123-003 — design
 * docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md §4.6).
 *
 * Unit: the three pure registry helpers (escapeRegistryRowPipes,
 * registryRowVersion, isL0OnlyRegistryRow).
 *
 * Engine (real co-work templates, temp project — the upgrade-overwrite-protection
 * pattern): a versioned `.py` under scripts/deck/ is delivered; a file no lane
 * places gets UNCLASSIFIED; a delivered script whose row is not updated is
 * REGISTRY_DRIFT (ERROR); a stale row is reconciled to the file's @version.
 *
 * @version 1.0.0
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, test } from 'bun:test';

import { escapeRegistryRowPipes, isL0OnlyRegistryRow, registryRowVersion, splitRegistryRow, toPosixPath } from '../../scripts/lib/upgrade-policy.ts';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-work';

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

describe('registry helpers (design §4.6 c, d)', () => {
  test('a cell containing a pipe inside backticks parses to 8 columns after escaping', () => {
    const raw = '| `x.ts` | L3 | 1.0.0 | active | runs `a|b` then c | — | L3 | — |';
    expect(splitRegistryRow(raw)).toHaveLength(9); // the raw pipe splits the cell
    const escaped = escapeRegistryRowPipes(raw);
    const cells = splitRegistryRow(escaped);
    expect(cells).toHaveLength(8);
    expect(cells[4]).toBe('runs `a|b` then c');
    expect(escapeRegistryRowPipes(escaped)).toBe(escaped); // idempotent
  });

  test('registryRowVersion reads the version cell of the named row', () => {
    const text = '| `deck/svg_check.py` | L3 | 2.1.1 | active | uses `a\\|b` | — | L3 | — |\n';
    expect(registryRowVersion(text, 'deck/svg_check.py')).toBe('2.1.1');
    expect(registryRowVersion(text, 'deck/other.py')).toBeNull();
  });

  test('isL0OnlyRegistryRow: only the L0 row, layer L0 or L0-only', () => {
    expect(isL0OnlyRegistryRow('| `s.ts` | L0 | 1.0.0 | active | d | — | L0 | — |', undefined)).toBe(true);
    expect(isL0OnlyRegistryRow('| `s.ts` | L0-only | 1.0.0 | active | d | — | L0 | — |', undefined)).toBe(true);
    expect(isL0OnlyRegistryRow('| `s.ts` | L0 | 1.0.0 | active | d | — | L0 | — |', '| `s.ts` | L0+L1 | 1.0.0 | a | d |')).toBe(false);
    expect(isL0OnlyRegistryRow('| `s.ts` | L3 | 1.0.0 | active | d | — | L3 | — |', undefined)).toBe(false);
    expect(isL0OnlyRegistryRow(undefined, undefined)).toBe(false);
  });

  test('toPosixPath: a walker entry becomes a POSIX-style key on every OS', () => {
    // Bun.Glob.scanSync yields `\`-separated entries on Windows while the lanes' keys
    // (readdirSync + name joins) are `/`-separated. Literal backslashes stand in for
    // the Windows walker here (it yields `/` on POSIX/macOS).
    expect(toPosixPath('deck\\tests\\fixtures\\a.svg', 'win32')).toBe('deck/tests/fixtures/a.svg');
    expect(toPosixPath('deck\\nested\\SCRIPTS.md', 'win32')).toBe('deck/nested/SCRIPTS.md');
    expect(toPosixPath('deck\\svg_check.py', 'win32')).toBe('deck/svg_check.py');
    expect(toPosixPath('deck\\svg_check.py', 'darwin')).toBe('deck\\svg_check.py');
  });
});

// ── Engine ───────────────────────────────────────────────────────────────────

function git(cwd: string, ...args: string[]): void {
  spawnSync('git', ['-C', cwd, 'config', '--unset', 'core.hooksPath'], { env: gitCleanEnv(), stdio: 'ignore' });
  const r = spawnSync('git', ['-C', cwd, ...args], { env: gitCleanEnv(), stdio: 'ignore' });
  expect(r.status).toBe(0);
}

function freshProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-script-lane-'));
  tmpDirs.push(tmp);
  assertCallerEnvSafeForGitFixtures(tmp);
  spawnSync('git', ['init', '-q'], { cwd: tmp, env: gitCleanEnv(), stdio: 'ignore' });
  assertFixtureGitIdentity(tmp);
  git(tmp, 'config', 'user.email', 'test@example.com');
  git(tmp, 'config', 'user.name', 'Test');
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(join(tmp, '.claude', 'template-version.txt'), `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`);
  // The registry file rides the template tree; seed the L0 registry so every
  // delivered script has a row the lockstep loop can reconcile.
  mkdirSync(join(tmp, 'scripts'), { recursive: true });
  writeFileSync(
    join(tmp, 'scripts', 'SCRIPTS.md'),
    readFileSync(join(workspaceRoot, 'scripts', 'SCRIPTS.md')),
  );
  git(tmp, 'add', '-A');
  git(tmp, 'commit', '-q', '-m', 'seed');
  return tmp;
}

function runUpgrade(tmp: string): { status: number; out: string } {
  const r = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes'], {
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
const decisionsOf = (tmp: string): Row[] =>
  (JSON.parse(readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8')).decisions as Row[]);
const rowsFor = (rows: Row[], path: string): Row[] => rows.filter((r) => r.path === path);

describe('engine — script lane gaps (design §4.6)', () => {
  const project = freshProject();
  const first = runUpgrade(project);
  const rows = decisionsOf(project);

  test('(a) a versioned .py under scripts/deck/ is delivered', () => {
    expect(first.status).toBe(0);
    const delivered = readFileSync(join(project, 'scripts', 'deck', 'svg_check.py'), 'utf8');
    const template = readFileSync(join(workspaceRoot, 'templates', VARIANT, 'scripts', 'deck', 'svg_check.py'), 'utf8');
    expect(delivered).toBe(template);
    expect(first.out).toMatch(/(?:NEW|UPDATE)\s+scripts\/deck\/svg_check\.py/);
  }, 60000);

  test('(a) a file no lane places gets an UNCLASSIFIED row at WARN', () => {
    const unclassified = rows.filter((r) => r.verdict === 'UNCLASSIFIED');
    expect(unclassified.map((r) => r.path)).toContain('scripts/deck/tests/fixtures/sample-business-report/01-title.svg');
    expect(unclassified.every((r) => r.severity === 'WARN')).toBe(true);
    // documentation and registry files are not scripts — never named
    expect(unclassified.map((r) => r.path)).not.toContain('scripts/README.md');
    // OS-independent invariants (PR #2177 Windows CI: rows carried `\` paths there,
    // which is toContain-missed above and also mis-read delivered scripts as unplaced).
    expect(unclassified.every((r) => !r.path.includes('\\'))).toBe(true); // manifest paths are POSIX-style on every OS
    expect(unclassified.every((r) => r.path.startsWith('scripts/'))).toBe(true);
    const unclassifiedPaths = new Set(unclassified.map((r) => r.path));
    // files a script lane delivered are placed — never UNCLASSIFIED
    for (const rel of ['scripts/deck/svg_check.py', 'scripts/deck/ppt-master-adapter.ts', 'scripts/lib/upgrade-policy.ts']) {
      expect(unclassifiedPaths.has(rel)).toBe(false);
    }
    // a nested registry file is a registry, not an unclassified script
    expect([...unclassifiedPaths].filter((p) => p.endsWith('/SCRIPTS.md') || p === 'scripts/SCRIPTS.md')).toEqual([]);
  });

  test('(b) a stale registry row is reconciled to the delivered file version', () => {
    const registryPath = join(project, 'scripts', 'SCRIPTS.md');
    const registry = readFileSync(registryPath, 'utf8');
    const current = registryRowVersion(registry, 'deck/svg_check.py');
    expect(current).toMatch(/^\d+\.\d+\.\d+$/);
    writeFileSync(registryPath, registry.replace(`| ${current} |`, '| 0.0.1 |'));
    git(project, 'add', '-A');
    git(project, 'commit', '-q', '-m', 'stale row');
    const second = runUpgrade(project);
    expect(second.status).toBe(0);
    expect(registryRowVersion(readFileSync(registryPath, 'utf8'), 'deck/svg_check.py')).toBe(current);
  }, 60000);

  test('(b) a delivered file whose row cannot be updated fails: REGISTRY_DRIFT at ERROR, non-zero exit', () => {
    git(project, 'add', '-A');
    git(project, 'commit', '-q', '-m', 'land second run');
    // A registry without its `## Registry` anchor can receive no appended row.
    writeFileSync(join(project, 'scripts', 'SCRIPTS.md'), '# Registry\n\n(no table)\n');
    git(project, 'add', '-A');
    git(project, 'commit', '-q', '-m', 'break registry');
    const third = runUpgrade(project);
    const drift = decisionsOf(project).filter((r) => r.verdict === 'REGISTRY_DRIFT');
    expect(drift.map((r) => r.path)).toContain('scripts/deck/svg_check.py');
    expect(drift.every((r) => r.severity === 'ERROR')).toBe(true);
    expect(third.out).toContain('REGISTRY DRIFT');
    expect(third.status).not.toBe(0);
  }, 60000);
});
