/**
 * Root-target guards added after the 2026-09-12 root-upgrade incident
 * (memory/2026-09-12.md): an upgrade-project run aimed at the workspace ROOT
 * delivered the whole template/L1 tree into the repo root, and new-project
 * scaffolded bare names directly into the root. These tests pin the guards:
 *
 *   - scripts/upgrade-project.ts rejects a workspace-ROOT <project-path>
 *   - scripts/new-project.ts resolves bare names under Projects/
 *   - scripts/new-project.ts rejects targets that escape the workspace
 *   - tests/reflect-skill-graph-to-project.ts rejects the workspace ROOT
 *
 * v1.1.0: H14 negative coverage (design
 *         docs/designs/2026-09-16-upgrade-target-realpath-guard-design.md,
 *         tickets T-20260916-006/-007): a symlink resolving to the workspace
 *         root must hit the root guard via fs.realpathSync canonicalization;
 *         outside-Projects targets must fail closed without explicit consent
 *         (EOF/n abort exit 1; 'y' or --yes passes the guard into pre-flight);
 *         inside-Projects targets never prompt; a missing target still errors
 *         before canonicalization. Symlink cases skip gracefully where the
 *         platform cannot create symlinks (Windows CI without privileges).
 *
 * @version 1.1.0
 */
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

describe('root-target guards (incident 2026-09-12)', () => {
  beforeAll(() => {
    // `Projects/` is gitignored (.gitignore: `/*/  Projects`), so it does not
    // exist on a fresh checkout (CI, new clones). The next test's pre-flight
    // path assumes it already exists to fail fast on the "already exists"
    // check; without it, new-project.ts falls through and runs a REAL scaffold
    // (bun install, graft index build with a tree-sitter-cli download) that
    // takes well over the 30s test/file timeout — the CI TIMEOUT this guards
    // against. Creating an empty Projects/ here restores the documented
    // fast-fail pre-flight path deterministically, on any machine.
    if (!existsSync(join(workspaceRoot, 'Projects'))) {
      mkdirSync(join(workspaceRoot, 'Projects'), { recursive: true });
    }
  });

  test('upgrade-project.ts rejects the workspace ROOT as <project-path>', () => {
    const result = spawnSync(
      'bun',
      ['scripts/upgrade-project.ts', '.'],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 60000 }
    );
    expect(result.status).toBe(1);
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).toContain('workspace ROOT');
    expect(out).toContain('L0, not a project');
  }, 30000);

  test('new-project.ts resolves bare names under Projects/ (existence pre-flight path)', () => {
    // The name `.` resolves to <root>/Projects. beforeAll() above guarantees
    // it exists (it's gitignored, so a fresh checkout won't have it) — so the
    // pre-flight fails fast with the resolved path BEFORE any scaffold side
    // effects run. Under pre-1.16.0 behavior the message would have named the
    // workspace root.
    const result = spawnSync(
      'bun',
      ['scripts/new-project.ts', '.', '--variant', 'co-develop'],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 60000 }
    );
    expect(result.status).toBe(1);
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).toContain('Directory already exists');
    expect(out).toContain(join(workspaceRoot, 'Projects'));
  }, 30000);

  test('new-project.ts rejects targets that escape the workspace', () => {
    // An absolute path-like name resolves outside the workspace — the containment
    // guard must reject it before any filesystem work.
    const result = spawnSync(
      'bun',
      ['scripts/new-project.ts', '/tmp/project-target-guard-escape', '--variant', 'co-develop'],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 60000 }
    );
    expect(result.status).toBe(1);
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).toContain('escapes the workspace');
  }, 30000);

  test('reflect-skill-graph-to-project.ts rejects the workspace ROOT', () => {
    const result = spawnSync(
      'bun',
      ['tests/reflect-skill-graph-to-project.ts', '.', 'co-develop'],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 30000 }
    );
    expect(result.status).toBe(1);
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).toContain('workspace ROOT');
  }, 30000);
});

// ── H14 negative coverage (design 2026-09-16-upgrade-target-realpath-guard) ────

/** Recursively count files under dir (descends into .git — the fixture's only content). */
function countFiles(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countFiles(join(dir, entry.name));
    else count += 1;
  }
  return count;
}

describe('upgrade-project realpath + outside-Projects guards (H14)', () => {
  const uid = `upgrade-guard-${process.pid}-${Date.now().toString(36)}`;
  // Outside fixture: a REAL git repo under tests/.temp/ (gitignored), so the run
  // would otherwise proceed past every pre-flight check — only the guard stops it.
  const outsideDir = join(workspaceRoot, 'tests', '.temp', uid);
  const outsideCanonical = () => realpathSync(outsideDir);
  // Inside fixture: an existing but non-git dir under Projects/ — past the guard
  // (which must NOT prompt), stopped fast by the git-repo check.
  const insideDir = join(workspaceRoot, 'Projects', `.${uid}-inside`);
  // Symlink fixture: Projects/<link> -> workspaceRoot. --dry-run is deliberate
  // belt-and-suspenders: the guard fires before any mode check, and if it ever
  // regressed, this run degrades to a no-write dry-run instead of a live
  // whole-tree delivery into the root.
  const linkPath = join(workspaceRoot, 'Projects', `.${uid}-link`);
  let canSymlink = false;

  beforeAll(() => {
    mkdirSync(outsideDir, { recursive: true });
    const init = spawnSync('git', ['init', '-q', outsideDir], { encoding: 'utf-8' });
    if (init.status !== 0) throw new Error(`git init failed for guard fixture: ${init.stderr}`);
    mkdirSync(join(workspaceRoot, 'Projects'), { recursive: true });
    mkdirSync(insideDir, { recursive: true });
    try {
      symlinkSync(workspaceRoot, linkPath, 'dir');
      canSymlink = true;
    } catch {
      // Windows CI without symlink privileges — symlink cases skip gracefully.
      canSymlink = false;
    }
  });

  afterAll(() => {
    // The link is a symlink: rmSync unlinks it without touching its target.
    if (existsSync(linkPath)) rmSync(linkPath, { force: true });
    if (existsSync(insideDir)) rmSync(insideDir, { recursive: true, force: true });
    if (existsSync(outsideDir)) rmSync(outsideDir, { recursive: true, force: true });
  });

  test('symlink resolving to the workspace ROOT hits the root guard (canonicalization)', () => {
    if (!canSymlink) return; // platform cannot create symlinks — skip gracefully
    const result = spawnSync(
      'bun',
      ['scripts/upgrade-project.ts', `Projects/.${uid}-link`, '--dry-run'],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 60000 }
    );
    expect(result.status).toBe(1);
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).toContain('workspace ROOT');
    expect(out).toContain('L0, not a project');
  }, 30000);

  test('outside-Projects with closed stdin (EOF) aborts with exit 1 before pre-flight', () => {
    const before = countFiles(outsideDir);
    const result = spawnSync(
      'bun',
      ['scripts/upgrade-project.ts', outsideDir],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 60000, input: '' }
    );
    expect(result.status).toBe(1);
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).toContain('WARN: Target is outside');
    // The prompt names the CANONICAL target.
    expect(out).toContain(outsideCanonical());
    expect(out).toContain('Outside-Projects target refused');
    expect(out).toContain('--yes');
    // Aborted at the guard — pre-flight never ran.
    expect(out).not.toContain('template-version.txt not found');
    // No delivery happened.
    expect(countFiles(outsideDir)).toBe(before);
  }, 30000);

  test('outside-Projects with stdin "n" aborts with exit 1 before pre-flight', () => {
    const before = countFiles(outsideDir);
    const result = spawnSync(
      'bun',
      ['scripts/upgrade-project.ts', outsideDir],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 60000, input: 'n\n' }
    );
    expect(result.status).toBe(1);
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).toContain('Outside-Projects target refused');
    expect(out).not.toContain('template-version.txt not found');
    expect(countFiles(outsideDir)).toBe(before);
  }, 30000);

  test('outside-Projects with stdin "y" passes the guard into pre-flight', () => {
    const before = countFiles(outsideDir);
    const result = spawnSync(
      'bun',
      ['scripts/upgrade-project.ts', outsideDir],
      // Two 'y' lines: first answers the guard confirm, second answers the
      // missing-template-version.txt confirm — then variant detection hard-errors
      // BEFORE any delivery pass. Reaching that error proves the gate passed.
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 60000, input: 'y\ny\n' }
    );
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).not.toContain('Outside-Projects target refused');
    expect(out).toContain('Could not detect variant');
    expect(result.status).toBe(1);
    expect(countFiles(outsideDir)).toBe(before);
  }, 30000);

  test('outside-Projects with --yes passes the guard without prompting', () => {
    const before = countFiles(outsideDir);
    const result = spawnSync(
      'bun',
      ['scripts/upgrade-project.ts', outsideDir, '--yes'],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 60000, input: '' }
    );
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).not.toContain('Outside-Projects target refused');
    expect(out).not.toContain('Proceed with upgrade into');
    expect(out).toContain('Could not detect variant');
    expect(result.status).toBe(1);
    expect(countFiles(outsideDir)).toBe(before);
  }, 30000);

  test('inside-Projects target never prompts the outside confirm (proceeds silently to pre-flight)', () => {
    // The fixture lives under Projects/, i.e. inside the workspace's own git
    // work tree, so the git-repo check passes and the run continues into
    // pre-flight — which is exactly the point: with empty stdin it reaches the
    // missing-template-version.txt optional prompt (EOF → precedent 'Aborted.'
    // exit 0) WITHOUT any outside-target warning or confirm anywhere. The
    // outside guard must stay silent for in-Projects targets.
    const before = countFiles(insideDir);
    const result = spawnSync(
      'bun',
      ['scripts/upgrade-project.ts', insideDir],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 60000, input: '' }
    );
    expect(result.status).toBe(0);
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).toContain('WARNING: template-version.txt not found');
    expect(out).toContain('Aborted.');
    expect(out).not.toContain('WARN: Target is outside');
    expect(out).not.toContain('Proceed with upgrade into');
    expect(out).not.toContain('Outside-Projects target refused');
    expect(countFiles(insideDir)).toBe(before);
  }, 30000);

  test('missing target still errors before canonicalization (not-found message unchanged)', () => {
    const missing = join(workspaceRoot, `definitely-not-here-${uid}`);
    const result = spawnSync(
      'bun',
      ['scripts/upgrade-project.ts', missing],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 60000 }
    );
    expect(result.status).toBe(1);
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).toContain('Project directory not found');
    expect(out).toContain(missing);
  }, 30000);
});
