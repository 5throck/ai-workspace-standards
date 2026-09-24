/**
 * Regression tests for dev-sync step 6.5 scoped-staging `git add` deletion
 * handling (spec Amendment 2 §13:
 * docs/designs/2026-09-24-constitution-s33-context-injection-design.md;
 * extends docs/designs/2026-09-12-dev-sync-scoped-staging-design.md).
 *
 * Bug class (hit in delivery on 2026-09-24): under SYNC_SCOPED_STAGING=1 the
 * add step batched every committable path into one plain `git add --`. A STAGED
 * DELETION exists in neither worktree nor index, so its pathspec fatals 128 —
 * and one poisoned pathspec makes the batch stage NOTHING (probed), killing the
 * whole sync. Deletion workloads could never pass scoped-staging sync.
 *
 * Test shape: dev-sync.ts is a monolithic top-level-await script (not
 * import-safe), and a full pipeline run is infeasible in a scratch repo, so —
 * like tests/unit/dev-sync-pipeline-order.test.ts reads the source — these
 * tests slice the REAL step 6.5 block out of scripts/dev-sync.ts at run time,
 * prepend a minimal prelude (colors, $, snapshot variables), and execute that
 * verbatim production block with `bun` against a scratch git repo under
 * tests/.temp/ (gitignored). The block therefore runs the REAL commands
 * (`git status --porcelain`, `git diff --cached`, `git add`) against REAL git
 * state. T4 additionally injects the §13.3 ghost class ("pipeline output
 * deleted mid-run after the S1 snapshot") deterministically: the driver's `$`
 * wrapper removes the injected file when the block reaches its first post-S1
 * git call, so the path is in committable but matches neither worktree nor
 * index by add time.
 *
 * T1 is the acceptance gate for the amendment: it fails against the pre-fix
 * block (single batch add fatals on the staged deletion → driver exits 1) and
 * passes after the fix.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dir, '..', '..');
const devSyncPath = path.join(workspaceRoot, 'scripts', 'dev-sync.ts');
const libPath = path.join(workspaceRoot, 'scripts', 'lib', 'git-status.ts');
const scratchRoot = path.join(workspaceRoot, 'tests', '.temp', 'scoped-staging-deletion-test');

const BLOCK_START = '// 6.5 Scoped staging';
const BLOCK_END = 'const syncContext = crypto.randomUUID();';

/** Extract the verbatim step 6.5 block from the dev-sync source. */
function extractStep65Block(): string {
  const src = fs.readFileSync(devSyncPath, 'utf-8');
  const start = src.indexOf(BLOCK_START);
  const end = src.indexOf(BLOCK_END);
  if (start === -1 || end === -1 || start >= end) {
    throw new Error(
      `Cannot locate the step 6.5 block in scripts/dev-sync.ts (start=${start}, end=${end}) — ` +
      `the block markers "${BLOCK_START}" / "${BLOCK_END}" moved; update this test.`,
    );
  }
  return src.slice(start, end);
}

/** Prelude giving the block every free variable it references. */
function buildDriver(block: string): string {
  return [
    `import { $ as bun$ } from 'bun';`,
    `import * as nodeFs from 'node:fs';`,
    `const fs = nodeFs;`,
    `import { parseCachedNameStatus, parseStatusPorcelain } from ${JSON.stringify(libPath)};`,
    `const GREEN = '\\x1b[32m';`,
    `const RED = '\\x1b[31m';`,
    `const YELLOW = '\\x1b[33m';`,
    `const CYAN = '\\x1b[36m';`,
    `const DIM = '\\x1b[2m';`,
    `const RESET = '\\x1b[0m';`,
    `const GHOST_PATH = process.env.DRIVER_GHOST_PATH || '';`,
    // Delegates every invocation to the real Bun shell. When the ghost class is
    // armed, removes the injected file at the block's first post-S1 git call
    // (the name-status probe) so the path matches neither worktree nor index by
    // add time — the "pipeline output deleted mid-run after the S1 snapshot"
    // race from spec §13.3 step 5, made deterministic.
    `const $ = (ss: TemplateStringsArray, ...vs: unknown[]) => {`,
    `  const cmd = ss.join('');`,
    `  if (GHOST_PATH && (cmd.startsWith('git add') || cmd.includes('name-status'))) {`,
    `    try { nodeFs.rmSync(GHOST_PATH, { force: true }); } catch {}`,
    `  }`,
    `  return bun$(ss, ...vs);`,
    `};`,
    // S0 snapshot — same command shape as dev-sync's pre-flight snapshot.
    `let s0Paths = new Set<string>();`,
    `let snapshotFailed = false;`,
    `try {`,
    `  const s0Res = await bun$\`git status --porcelain=v1 -z -uall\`.quiet().nothrow();`,
    `  if (s0Res.exitCode === 0) s0Paths = parseStatusPorcelain(s0Res.stdout.toString());`,
    `} catch {`,
    `  snapshotFailed = true;`,
    `}`,
    `const scopedStaging = process.env.SYNC_SCOPED_STAGING === '1';`,
    // The ghost file is created AFTER the S0 snapshot so the block's S1 shot
    // classifies it as pipeline output (S1 \\ S0) and it joins committable.
    `if (GHOST_PATH) nodeFs.writeFileSync(GHOST_PATH, 'pipeline-output\\n');`,
    '',
    '// ── verbatim dev-sync step 6.5 block below ──',
    block,
  ].join('\n');
}

interface ScratchRepo { root: string; run(args: string[]): { exitCode: number; out: string }; }

/** Create a scratch git repo with one commit, ready for scenario setup. */
function makeScratchRepo(name: string): ScratchRepo {
  const root = path.join(scratchRoot, name);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const run = (args: string[]) => {
    const p = Bun.spawnSync(['git', ...args], {
      cwd: root, stdout: 'pipe', stderr: 'pipe',
    });
    return { exitCode: p.exitCode ?? 0, out: p.stdout.toString() + p.stderr.toString() };
  };
  run(['init', '-q', '.']);
  run(['config', 'user.email', 'test@example.com']);
  run(['config', 'user.name', 'test']);
  return { root, run };
}

/** Run the extracted step 6.5 block against a scratch repo. */
function runDriver(repo: ScratchRepo, ghostPath = ''): { exitCode: number; stdout: string } {
  const driverPath = path.join(repo.root, '.driver.ts');
  fs.writeFileSync(driverPath, buildDriver(extractStep65Block()));
  const proc = Bun.spawnSync([process.execPath, driverPath], {
    cwd: repo.root,
    env: { ...process.env, SYNC_SCOPED_STAGING: '1', DRIVER_GHOST_PATH: ghostPath },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return { exitCode: proc.exitCode ?? -1, stdout: proc.stdout.toString() + proc.stderr.toString() };
}

function status(repo: ScratchRepo): string {
  return repo.run(['status', '--porcelain']).out;
}

afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

describe('dev-sync step 6.5 scoped staging: deletion handling (spec Amendment 2 §13)', () => {
  test('T1: staged deletion + SYNC_SCOPED_STAGING=1 — add succeeds, exit 0, "D " preserved', () => {
    const repo = makeScratchRepo('t1');
    repo.run(['add', '.']);
    repo.run(['commit', '-qm', 'init']);
    fs.writeFileSync(path.join(repo.root, 'gone.txt'), 'x');
    repo.run(['add', 'gone.txt']);
    repo.run(['commit', '-qm', 'add gone.txt']);
    fs.rmSync(path.join(repo.root, 'gone.txt'));
    repo.run(['add', 'gone.txt']); // staged deletion — the 2026-09-24 delivery crash
    expect(status(repo)).toContain('D  gone.txt');

    const result = runDriver(repo);

    // Pre-fix block: batch `git add -- gone.txt` fatals 128 → driver exits 1.
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('skipping 1 path');
    // AC12: the staged deletion is still recorded after the add step.
    expect(status(repo)).toContain('D  gone.txt');
  });

  test('T2: staged-add whose worktree file vanished (AD) — per-path add resolves, exit 0', () => {
    const repo = makeScratchRepo('t2');
    repo.run(['add', '.']);
    repo.run(['commit', '-qm', 'init']);
    fs.writeFileSync(path.join(repo.root, 'added.txt'), 'x');
    repo.run(['add', 'added.txt']);
    fs.rmSync(path.join(repo.root, 'added.txt'));
    expect(status(repo)).toContain('AD added.txt');

    const result = runDriver(repo);

    // The path is absent from the worktree but still index-resolvable, so the
    // per-path add succeeds (probed P5) and the ghost entry is resolved.
    expect(result.exitCode).toBe(0);
    expect(status(repo)).not.toContain('AD added.txt');
  });

  test('T3: mixed committable — poisoned batch stages nothing, fixed step stages both', () => {
    const repo = makeScratchRepo('t3');
    fs.writeFileSync(path.join(repo.root, 'kept-old.txt'), 'x');
    repo.run(['add', '.']);
    repo.run(['commit', '-qm', 'init']);
    fs.rmSync(path.join(repo.root, 'kept-old.txt'));
    repo.run(['add', 'kept-old.txt']); // staged deletion
    // Distinct content from kept-old.txt so git's rename detector does NOT
    // collapse the staged deletion + the addition into an R100 record — this
    // case pins the plain D + A batch, not the rename-skip class (T5 covers
    // the rename parser half).
    fs.writeFileSync(path.join(repo.root, 'good.txt'), 'a deliberately different body of text\n');

    // P6 batch-poisoning class: one unresolvable pathspec aborts the batch and
    // stages nothing — the good file must stay untracked.
    const poisoned = repo.run(['add', 'good.txt', 'kept-old.txt']);
    expect(poisoned.exitCode).not.toBe(0);
    expect(status(repo)).toContain('?? good.txt');

    repo.run(['add', 'good.txt']); // now the good file joins committable
    const result = runDriver(repo);

    // AC13: the present file is staged AND the staged deletion is preserved.
    expect(result.exitCode).toBe(0);
    expect(status(repo)).toContain('A  good.txt');
    expect(status(repo)).toContain('D  kept-old.txt');
  });

  test('T4: true ghost in committable — loud failure, exit 1 (fail-closed)', () => {
    const repo = makeScratchRepo('t4');
    fs.writeFileSync(path.join(repo.root, 'base.txt'), 'x');
    repo.run(['add', '.']);
    repo.run(['commit', '-qm', 'init']);

    // Command-shape ground truth: a plain per-path add on a true ghost (neither
    // worktree nor index) is unresolvable for git.
    const ghostAdd = repo.run(['add', 'truly-ghost.txt']);
    expect(ghostAdd.exitCode).not.toBe(0);

    // Behavioral: the ghost joins committable via the pipeline-output route,
    // then vanishes mid-run (driver $ wrapper) before the add step.
    const result = runDriver(repo, 'midrun-deleted.txt');

    // AC14: the sync aborts loudly and names the path.
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('❌');
    expect(result.stdout).toContain('midrun-deleted.txt');
  });

  test('WARN-soak branch is unchanged: bare `git add -A` still present in step 6.5', () => {
    const block = extractStep65Block();
    expect(block).toContain('git add -A');
    expect(block).toContain('} else {');
  });
});
