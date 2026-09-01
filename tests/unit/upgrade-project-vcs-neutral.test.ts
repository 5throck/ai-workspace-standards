/**
 * upgrade-project-vcs-neutral.test.ts
 * @version 1.0.0
 *
 * Regression coverage for upgrade-project.ts v1.18.0 VCS-neutral mode.
 *
 * Before v1.18.0 the rev-parse gate hard-exited with `ERROR: Not a git repository`,
 * so variants that deliberately use another VCS (co-unity on Plastic SCM) had no
 * sanctioned update path at all. The gate is now a mode switch; these tests pin the
 * git-less contract (INFO banner, skipped git-hook security checks, refused
 * --rollback) and assert the git-mode path is unaffected.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const repoRoot = join(import.meta.dir, '..', '..');
const UPGRADE = 'scripts/upgrade-project.ts';

/**
 * Minimal git-less scaffolded-project fixture: enough for upgrade-project.ts to
 * detect the variant, run every pass, and reach the security gate.
 *
 * `docs/context.md` carries a stale inline version footer on purpose — it is the
 * cheapest way to drive VARIANT_DOCS_SYNC into isLocallyModified(), which is what
 * emits the one-time "detection unavailable without git" warning.
 */
function makeFixture(dir: string): void {
  for (const sub of ['.claude', 'agents', 'skills', 'docs', 'memory', 'scripts']) {
    mkdirSync(join(dir, sub), { recursive: true });
  }
  writeFileSync(
    join(dir, '.claude', 'template-version.txt'),
    'variant=co-unity\nversion=0.6.0\nplatform=both\ncountry=none\ncreated=2026-09-01T00:00:00.000Z\n',
  );
  writeFileSync(
    join(dir, 'variant.json'),
    JSON.stringify(
      {
        name: 'co-unity',
        displayName: 'Co Unity',
        inherits_common: 'templates/common',
        skill_manifest: { variant_specific: [], allowlist: [] },
        agents: [],
      },
      null,
      2,
    ) + '\n',
  );
  writeFileSync(join(dir, '.gitleaks.toml'), '# fixture\ntitle = "fixture"\n');
  writeFileSync(join(dir, 'docs', 'context.md'), '# Context\n\nFixture.\n\n*context.md version: 1.0*\n');
}

function runUpgrade(args: string[]) {
  return spawnSync(process.execPath, [UPGRADE, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 180_000,
  });
}

const gitAvailable = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;

// ── VCS-neutral mode (no git repository) ──────────────────────────────────────

describe('upgrade-project.ts — VCS-neutral mode', () => {
  let dir = '';
  let dryRun: ReturnType<typeof runUpgrade>;
  let rollbackRun: ReturnType<typeof runUpgrade>;

  beforeAll(() => {
    dir = join(tmpdir(), `upgrade-vcs-neutral-${Date.now()}`);
    makeFixture(dir);
    dryRun = runUpgrade([dir, '--dry-run']);
    rollbackRun = runUpgrade([dir, '--rollback']);
  });

  afterAll(() => {
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  test('--dry-run exits 0 on a project with no git repository', () => {
    expect(dryRun.status).toBe(0);
  });

  test('announces VCS-neutral mode', () => {
    expect(dryRun.stdout).toContain('INFO: Not a git repository — VCS-neutral mode');
  });

  test('warns once that local-modification detection is unavailable', () => {
    const warns = dryRun.stdout.match(/^WARN: local-modification detection unavailable without git/gm) ?? [];
    expect(warns).toHaveLength(1);
  });

  test('skips the three git-hook security checks', () => {
    expect(dryRun.stdout).toContain('SKIP .githooks/pre-commit exists (no git repository)');
    expect(dryRun.stdout).toContain('SKIP .gitattributes has eol=lf (no git repository)');
    expect(dryRun.stdout).toContain('SKIP .gitignore has .env pattern (no git repository)');
  });

  test('skipped checks do not fail the security gate', () => {
    expect(dryRun.stdout).toContain('Security checks      : PASSED');
  });

  test('--rollback is refused without a git repository', () => {
    expect(rollbackRun.status).toBe(1);
    expect(rollbackRun.stderr).toContain('--rollback requires a git repository');
  });
});

// ── Git mode is unaffected ────────────────────────────────────────────────────

describe.skipIf(!gitAvailable)('upgrade-project.ts — git mode unchanged', () => {
  let dir = '';
  let dryRun: ReturnType<typeof runUpgrade>;

  beforeAll(() => {
    dir = join(tmpdir(), `upgrade-git-mode-${Date.now()}`);
    makeFixture(dir);
    // Throwaway repo in tmpdir — never the harness worktree. core.hooksPath is
    // pointed at a nonexistent directory so an inherited global hooks path
    // cannot execute anything during the fixture commit.
    spawnSync('git', ['init', '-q', dir], { encoding: 'utf8' });
    spawnSync('git', ['-C', dir, 'config', 'core.hooksPath', join(dir, '.no-hooks')], { encoding: 'utf8' });
    spawnSync('git', ['-C', dir, 'config', 'user.email', 'fixture@example.invalid'], { encoding: 'utf8' });
    spawnSync('git', ['-C', dir, 'config', 'user.name', 'Fixture'], { encoding: 'utf8' });
    spawnSync('git', ['-C', dir, 'config', 'commit.gpgsign', 'false'], { encoding: 'utf8' });
    spawnSync('git', ['-C', dir, 'add', '-A'], { encoding: 'utf8' });
    spawnSync('git', ['-C', dir, 'commit', '-q', '-m', 'fixture'], { encoding: 'utf8' });
    dryRun = runUpgrade([dir, '--dry-run']);
  });

  afterAll(() => {
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  test('--dry-run exits 0 inside a git repository', () => {
    expect(dryRun.status).toBe(0);
  });

  test('does not announce VCS-neutral mode', () => {
    expect(dryRun.stdout).not.toContain('INFO: Not a git repository');
    expect(dryRun.stdout).not.toContain('(no git repository)');
  });

  test('runs the git-hook security checks instead of skipping them', () => {
    expect(dryRun.stdout).toMatch(/^ {2}(OK |FAIL) \.githooks\/pre-commit exists$/m);
  });
});
