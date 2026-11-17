/**
 * Regression tests for dev-sync 1.50.0 re-run hygiene (spec
 * docs/designs/2026-11-17-root-machinery-batch-design.md §2, ticket
 * U-20261116-012 defects 1+2).
 *
 * Defect 1 (B1) — ignore-aware promotion staging: a plain `git add` refuses an
 * explicitly named ignored path even when the path is TRACKED (verified on git
 * 2.56.1 — the .zcode/config.json class; `.gitignore` negations cannot fix it,
 * a negation cannot re-include a file under an excluded parent). The step-6.5
 * promotion sweep's batched add therefore exited 1 and the catch killed the
 * whole sync. The fix classifies the sweep set with two batched queries
 * (`git ls-files -z`, `git check-ignore --no-index` in line mode — two git
 * 2.56.1 behaviors the design's sketch missed: default check-ignore silently
 * excludes TRACKED paths from its report, exactly the class to find, so
 * `--no-index` is required; and `-z` is only meaningful with `--stdin` and
 * fatals 128 in the argv form) and partitions:
 *   tracked ∩ ignored  → `git add -f`, one DIM log line per path;
 *   untracked ∩ ignored → WARN + skip (never force-added);
 *   everything else     → the plain batch add, unchanged.
 *
 * Defect 2 (B2) — branch-keyed session-block replace: step 2's memory session
 * block gains a leading `<!-- dev-sync:session branch=<branch> -->` marker and
 * a same-branch same-day re-run REPLACES the marker-plus-block segment (through
 * the next `\n---\n` boundary or EOF) instead of appending a near-duplicate —
 * the old idempotency check keyed on the exact commit subject, which misses
 * whenever the derived subject differs between attempts (the normal case).
 * Legacy markerless blocks keep the exact-subject skip + plain append.
 *
 * Test shape: dev-sync.ts is a monolithic top-level-await script (not
 * import-safe), so — like tests/unit/dev-sync-scoped-staging-deletion.test.ts —
 * these tests slice the REAL blocks out of scripts/dev-sync.ts at run time,
 * prepend a minimal prelude, and execute the verbatim production code with
 * `bun` against scratch git repos under tests/.temp/ (gitignored).
 *
 * Reachability notes for the synthetic states:
 * - B-T2 (untracked ∩ ignored in the sweep): `git status` never lists ignored
 *   paths, so this class is only reachable when the path is NOT ignored at S1
 *   (it joins committable as a pipeline output) and the ignore rule arrives
 *   between S1 and the add — the ensureGitignoreCoverage-then-output channel.
 *   The driver's `$` wrapper makes that race deterministic by appending the
 *   pattern when the block reaches its `git check-ignore` call.
 * - B-T4 (tracked ∩ ignored, absent branch): the worktree deletion must happen
 *   AFTER the S0 snapshot (bytes captured) so the S0∩S1 content-overlap
 *   classifier routes the deletion into committable — same deterministic-race
 *   shape as the deletion test's T4 ghost.
 *
 * B-T8 additionally pins the memory-union-verify v1.3.0 compat: a leading
 * single-line HTML comment (the marker) does not fail the block-start
 * well-formedness rule, while prose still does.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dir, '..', '..');
const devSyncPath = path.join(workspaceRoot, 'scripts', 'dev-sync.ts');
const gitStatusLibPath = path.join(workspaceRoot, 'scripts', 'lib', 'git-status.ts');
const specLandingLibPath = path.join(workspaceRoot, 'scripts', 'lib', 'spec-landing.ts');
const unionVerifyPath = path.join(workspaceRoot, 'scripts', 'helpers', 'memory-union-verify.ts');
const scratchRoot = path.join(workspaceRoot, 'tests', '.temp', 'rerun-hygiene-test');

// ── Harness A: verbatim step-6.5 scoped-staging block (B1 tests) ─────────────

const STAGING_BLOCK_START = '// 6.5 Scoped staging';
// T-20261028-012: step 6.9 sits between the staging block and the sync-context
// tmp write, so the slice ends where step 6.9 begins.
const STAGING_BLOCK_END = '// ── Step 6.9 — final message composition';

function extractStagingBlock(): string {
  const src = fs.readFileSync(devSyncPath, 'utf-8');
  const start = src.indexOf(STAGING_BLOCK_START);
  const end = src.indexOf(STAGING_BLOCK_END);
  if (start === -1 || end === -1 || start >= end) {
    throw new Error(
      `Cannot locate the step 6.5 block in scripts/dev-sync.ts (start=${start}, end=${end}) — ` +
      `the block markers "${STAGING_BLOCK_START}" / "${STAGING_BLOCK_END}" moved; update this test.`,
    );
  }
  return src.slice(start, end);
}

/**
 * Prelude for the staging block. DRIVER_WATCH_IGNORE holds a directory pattern
 * (e.g. `out/`) that is appended to .gitignore the moment the block reaches its
 * `git check-ignore` call — the deterministic S1→add ignore-rule arrival race.
 * DRIVER_DELETE holds a worktree path removed right after the S0 snapshot (and
 * its byte capture), so the content-overlap classifier routes the deletion into
 * committable and the path lands in the absent branch.
 */
function buildStagingDriver(block: string): string {
  return [
    `import { $ as bun$ } from 'bun';`,
    `import * as nodeFs from 'node:fs';`,
    `const fs = nodeFs;`,
    `import { parseCachedNameStatus, parseStatusPorcelain, parseTrackedWorktreeChanges } from ${JSON.stringify(gitStatusLibPath)};`,
    // T-20261117-015: the slice now extends through the new step 6.55 (it sits
    // between the soak else-block and the step-6.9 marker), so the driver needs the
    // spec-landing free variables the gate references.
    `import { SPEC_REGISTRY_PATH, danglingSpecRefs, parseRegistryEntries, requiredPathsForEntry } from ${JSON.stringify(specLandingLibPath)};`,
    `const GREEN = '\\x1b[32m';`,
    `const RED = '\\x1b[31m';`,
    `const YELLOW = '\\x1b[33m';`,
    `const CYAN = '\\x1b[36m';`,
    `const DIM = '\\x1b[2m';`,
    `const RESET = '\\x1b[0m';`,
    `const WATCH_IGNORE = process.env.DRIVER_WATCH_IGNORE || '';`,
    `const DELETE_AFTER_S0 = process.env.DRIVER_DELETE || '';`,
    // Delegates every invocation to the real Bun shell, logging a call marker so
    // tests can pin "no extra git calls on the happy path beyond the two
    // classification queries" (B-T3). When WATCH_IGNORE is armed, the ignore
    // pattern is appended to .gitignore right before the check-ignore
    // classification query runs.
    `const $ = (ss: TemplateStringsArray, ...vs: unknown[]) => {`,
    `  const cmd = ss.join('');`,
    `  console.log('[driver-call] ' + cmd);`,
    `  if (WATCH_IGNORE && cmd.startsWith('git check-ignore')) {`,
    `    nodeFs.appendFileSync('.gitignore', WATCH_IGNORE + '\\n');`,
    `  }`,
    `  return bun$(ss, ...vs);`,
    `};`,
    // S0 snapshot — same command shape as dev-sync's pre-flight snapshot, plus
    // the per-path byte capture (production v1.43.0 behavior).
    `let s0Paths = new Set<string>();`,
    `const s0Content = new Map<string, string>();`,
    `let snapshotFailed = false;`,
    `try {`,
    `  const s0Res = await bun$\`git status --porcelain=v1 -z -uall\`.quiet().nothrow();`,
    `  if (s0Res.exitCode === 0) s0Paths = parseStatusPorcelain(s0Res.stdout.toString());`,
    `  for (const p of s0Paths) {`,
    `    try { s0Content.set(p, nodeFs.readFileSync(p, 'utf-8')); } catch { /* absent at S0 */ }`,
    `  }`,
    `} catch {`,
    `  snapshotFailed = true;`,
    `}`,
    `if (DELETE_AFTER_S0) nodeFs.rmSync(DELETE_AFTER_S0, { force: true });`,
    `const scopedStaging = process.env.SYNC_SCOPED_STAGING === '1';`,
    // T-20261117-015: the honor set is a step-6.5 free variable — no honor opt-in
    // under test here, so the prelude supplies the empty set.
    `const honorSet = new Set<string>();`,
    '',
    '// ── verbatim dev-sync step 6.5 block below ──',
    block,
  ].join('\n');
}

interface ScratchRepo { root: string; run(args: string[]): { exitCode: number; out: string }; }

function makeScratchRepo(name: string): ScratchRepo {
  const root = path.join(scratchRoot, name);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const run = (args: string[]) => {
    const p = Bun.spawnSync(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
    return { exitCode: p.exitCode ?? 0, out: p.stdout.toString() + p.stderr.toString() };
  };
  run(['init', '-q', '.']);
  run(['config', 'user.email', 'test@example.com']);
  run(['config', 'user.name', 'test']);
  return { root, run };
}

function runStagingDriver(repo: ScratchRepo, env: Record<string, string> = {}): { exitCode: number; stdout: string } {
  const driverPath = path.join(repo.root, '.driver.ts');
  fs.writeFileSync(driverPath, buildStagingDriver(extractStagingBlock()));
  const proc = Bun.spawnSync([process.execPath, driverPath], {
    cwd: repo.root,
    env: { ...process.env, TZ: 'UTC', SYNC_SCOPED_STAGING: '1', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return { exitCode: proc.exitCode ?? -1, stdout: proc.stdout.toString() + proc.stderr.toString() };
}

// ── Harness B: verbatim step-2 memory session block (B2 tests) ───────────────

const MEMORY_BLOCK_START = '// Use local calendar date, not toISOString() (which is UTC)';
const MEMORY_BLOCK_END = '// 2. Update MEMORY.md index';

function extractMemoryBlock(): string {
  const src = fs.readFileSync(devSyncPath, 'utf-8');
  const start = src.indexOf(MEMORY_BLOCK_START);
  const end = src.indexOf(MEMORY_BLOCK_END);
  if (start === -1 || end === -1 || start >= end) {
    throw new Error(
      `Cannot locate the step-2 memory block in scripts/dev-sync.ts (start=${start}, end=${end}) — ` +
      `the block markers "${MEMORY_BLOCK_START}" / "${MEMORY_BLOCK_END}" moved; update this test.`,
    );
  }
  return src.slice(start, end);
}

function buildMemoryDriver(block: string): string {
  return [
    `import { $ } from 'bun';`,
    `import * as nodeFs from 'node:fs';`,
    `const fs = nodeFs;`,
    `import * as nodePath from 'node:path';`,
    `const path = nodePath;`,
    `const GREEN = '\\x1b[32m';`,
    `const RED = '\\x1b[31m';`,
    `const YELLOW = '\\x1b[33m';`,
    `const CYAN = '\\x1b[36m';`,
    `const DIM = '\\x1b[2m';`,
    `const RESET = '\\x1b[0m';`,
    `const msg = process.env.DRIVER_MSG || 'test: default subject';`,
    '',
    '// ── verbatim dev-sync step-2 memory block below ──',
    block,
  ].join('\n');
}

function runMemoryDriver(repo: ScratchRepo, msg: string): { exitCode: number; stdout: string } {
  const driverPath = path.join(repo.root, '.driver-memory.ts');
  fs.writeFileSync(driverPath, buildMemoryDriver(extractMemoryBlock()));
  const proc = Bun.spawnSync([process.execPath, driverPath], {
    cwd: repo.root,
    env: { ...process.env, TZ: 'UTC', DRIVER_MSG: msg },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return { exitCode: proc.exitCode ?? -1, stdout: proc.stdout.toString() + proc.stderr.toString() };
}

/** Day-log date pinned to UTC — the bun test runner executes test files with
 * TZ=UTC (observed: a child spawned from the test computes the host-local date,
 * the test process does not), so both the driver and this helper must agree on
 * one explicit zone or the day-log filename disagrees between them. */
function localDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'UTC' });
}

function readDayLog(repo: ScratchRepo): string {
  return fs.readFileSync(path.join(repo.root, 'memory', `${localDate()}.md`), 'utf-8');
}

function countHeadings(content: string, heading: string): number {
  return (content.match(new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'gm')) ?? []).length;
}

afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

// ── B1 tests ──────────────────────────────────────────────────────────────────

describe('dev-sync 1.50.0 B1: ignore-aware promotion staging (step 6.5 block)', () => {
  test('B-T1: tracked-but-ignored dirty path → staged via -f, DIM log line, sync completes', () => {
    const repo = makeScratchRepo('bt1');
    fs.mkdirSync(path.join(repo.root, 'dir'));
    fs.writeFileSync(path.join(repo.root, 'dir', 'config.json'), 'v1\n');
    repo.run(['add', '.']);
    repo.run(['commit', '-qm', 'init']);
    // The file becomes ignored AFTER it was committed — the tracked-status
    // intent wins. .gitignore itself stays untracked (residual, harmless).
    fs.writeFileSync(path.join(repo.root, '.gitignore'), 'dir/\n');
    fs.writeFileSync(path.join(repo.root, 'dir', 'config.json'), 'v2\n');
    // Ground truth: a plain explicit add of the tracked-but-ignored path is refused.
    expect(repo.run(['add', 'dir/config.json']).exitCode).not.toBe(0);
    // Production channel: `git add -u` stages tracked-but-ignored edits — this is
    // how the path reaches committable (taskStaged).
    expect(repo.run(['add', '-u', 'dir/config.json']).exitCode).toBe(0);

    const result = runStagingDriver(repo);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('tracked-but-ignored: staged with -f (dir/config.json)');
    expect(repo.run(['status', '--porcelain']).out).toContain('M  dir/config.json');
  });

  test('B-T2: untracked-ignored pipeline output becomes ignored mid-block → WARN + skip, exit 0', () => {
    const repo = makeScratchRepo('bt2b');
    fs.writeFileSync(path.join(repo.root, 'base.txt'), 'x\n');
    repo.run(['add', '.']);
    repo.run(['commit', '-qm', 'init']);

    // Driver pre-step creates the pipeline output right after the S0 snapshot
    // (armed via DRIVER_WATCH_IGNORE's sibling hook in buildStagingDriver? No —
    // the output creation is folded into the wrapper's first git call.)
    const driverPath = path.join(repo.root, '.driver.ts');
    const prelude = buildStagingDriver(extractStagingBlock()).replace(
      `if (DELETE_AFTER_S0) nodeFs.rmSync(DELETE_AFTER_S0, { force: true });`,
      [
        `if (DELETE_AFTER_S0) nodeFs.rmSync(DELETE_AFTER_S0, { force: true });`,
        `if (process.env.DRIVER_CREATE_OUTPUT) {`,
        `  nodeFs.mkdirSync(nodePath.dirname(process.env.DRIVER_CREATE_OUTPUT), { recursive: true });`,
        `  nodeFs.writeFileSync(process.env.DRIVER_CREATE_OUTPUT, 'pipeline-output\\n');`,
        `}`,
      ].join('\n'),
    ).replace(
      `const DELETE_AFTER_S0 = process.env.DRIVER_DELETE || '';`,
      [
        `const DELETE_AFTER_S0 = process.env.DRIVER_DELETE || '';`,
        `import * as nodePath from 'node:path';`,
      ].join('\n'),
    );
    fs.writeFileSync(driverPath, prelude);
    const proc = Bun.spawnSync([process.execPath, driverPath], {
      cwd: repo.root,
      env: { ...process.env, TZ: 'UTC', SYNC_SCOPED_STAGING: '1', DRIVER_WATCH_IGNORE: 'out/', DRIVER_CREATE_OUTPUT: 'out/generated.txt' },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const result = { exitCode: proc.exitCode ?? -1, stdout: proc.stdout.toString() + proc.stderr.toString() };

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('ignored path not staged: out/generated.txt');
    // Never force-added: the path must not be in the index.
    expect(repo.run(['ls-files']).out).not.toContain('out/generated.txt');
  });

  test('B-T3: clean path set → plain batch add, no -f, exactly the two classification queries', () => {
    const repo = makeScratchRepo('bt3');
    fs.writeFileSync(path.join(repo.root, 'src.txt'), 'v1\n');
    repo.run(['add', '.']);
    repo.run(['commit', '-qm', 'init']);
    fs.writeFileSync(path.join(repo.root, 'src.txt'), 'v2\n');
    repo.run(['add', 'src.txt']);

    const result = runStagingDriver(repo);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('tracked-but-ignored');
    expect(result.stdout).not.toContain('ignored path not staged');
    expect(repo.run(['status', '--porcelain']).out).toContain('M  src.txt');
    // Classification is exactly two batched queries; the batch add stays plain.
    expect(result.stdout.match(/\[driver-call\] git ls-files/g) ?? []).toHaveLength(1);
    expect(result.stdout.match(/\[driver-call\] git check-ignore/g) ?? []).toHaveLength(1);
    expect(result.stdout).toContain('[driver-call] git add -- ');
    expect(result.stdout).not.toContain('git add -f');
  });

  test('B-T4: tracked-but-ignored worktree-deleted path → -f stages the deletion, exit 0', () => {
    const repo = makeScratchRepo('bt4');
    fs.mkdirSync(path.join(repo.root, 'gone'));
    fs.writeFileSync(path.join(repo.root, 'gone', 'config.json'), 'v1\n');
    repo.run(['add', '.']);
    repo.run(['commit', '-qm', 'init']);
    fs.writeFileSync(path.join(repo.root, '.gitignore'), 'gone/\n');
    // The worktree deletion happens AFTER the driver's S0 snapshot so the
    // S0∩S1 content-overlap classifier routes it into committable (absent
    // branch) — the production archive-step channel.
    const result = runStagingDriver(repo, { DRIVER_DELETE: 'gone/config.json' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('tracked-but-ignored: staged with -f (gone/config.json)');
    expect(repo.run(['status', '--porcelain']).out).toContain('D  gone/config.json');
  });

  test('WARN-soak branch and staged-deletion skip are unchanged in the block source', () => {
    const block = extractStagingBlock();
    expect(block).toContain('git add -A');
    expect(block).toContain('skipping ${skip.length} path(s)');
    expect(block).toContain('git ls-files -z');
    expect(block).toContain('git check-ignore --no-index -- ');
  });
});

// ── B2 tests ──────────────────────────────────────────────────────────────────

describe('dev-sync 1.50.0 B2: branch-keyed session-block replace (step-2 memory block)', () => {
  function makeBranchRepo(name: string, branch: string): ScratchRepo {
    const repo = makeScratchRepo(name);
    fs.writeFileSync(path.join(repo.root, 'base.txt'), 'x\n');
    repo.run(['add', '.']);
    repo.run(['commit', '-qm', 'init']);
    repo.run(['checkout', '-qb', branch]);
    return repo;
  }

  test('B-T5: same branch, different subject → block replaced, exactly one Session Summary', () => {
    const repo = makeBranchRepo('bt5', 'feature/alpha');

    const run1 = runMemoryDriver(repo, 'chore: run one');
    expect(run1.exitCode).toBe(0);
    let content = readDayLog(repo);
    expect(content).toContain('<!-- dev-sync:session branch=feature/alpha -->');
    expect(countHeadings(content, '## Session Summary')).toBe(1);
    // Marker line sits immediately before the heading.
    expect(content).toMatch(/<!-- dev-sync:session branch=feature\/alpha -->\n## Session Summary/);

    const run2 = runMemoryDriver(repo, 'chore: run two with a much longer derived subject');
    expect(run2.exitCode).toBe(0);
    expect(run2.stdout).toContain("replaced the dev-sync block for branch 'feature/alpha'");
    content = readDayLog(repo);
    expect(countHeadings(content, '## Session Summary')).toBe(1);
    expect(content).toContain('run two with a much longer derived subject');
    expect(content).not.toContain('run one');
  });

  test('B-T6: same day, different branch → both blocks present', () => {
    const repo = makeBranchRepo('bt6', 'feature/alpha');
    expect(runMemoryDriver(repo, 'chore: alpha run').exitCode).toBe(0);
    expect(repo.run(['checkout', '-qb', 'feature/beta']).exitCode).toBe(0);
    expect(runMemoryDriver(repo, 'chore: beta run').exitCode).toBe(0);

    const content = readDayLog(repo);
    expect(content).toContain('<!-- dev-sync:session branch=feature/alpha -->');
    expect(content).toContain('<!-- dev-sync:session branch=feature/beta -->');
    expect(countHeadings(content, '## Session Summary')).toBe(2);
    expect(content).toContain('alpha run');
    expect(content).toContain('beta run');
  });

  test('B-T7: legacy markerless block → identical subject skipped, different subject plain appends', () => {
    const repo = makeBranchRepo('bt7', 'feature/alpha');
    const memoryDir = path.join(repo.root, 'memory');
    fs.mkdirSync(memoryDir);
    const legacy = [
      '',
      '---',
      '',
      '## Session Summary',
      'chore: legacy subject',
      '',
      '## Changes',
      '- N/A',
      '',
      '## Decisions',
      '- None',
      '',
      '## Open Issues',
      '- None',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(memoryDir, `${localDate()}.md`), legacy, 'utf8');

    // Same subject as the legacy block, no marker for this branch yet → the
    // exact-subject idempotency skip holds (legacy behavior preserved).
    const skipRun = runMemoryDriver(repo, 'chore: legacy subject');
    expect(skipRun.exitCode).toBe(0);
    let content = readDayLog(repo);
    expect(countHeadings(content, '## Session Summary')).toBe(1);
    expect(skipRun.stdout).toContain('already logged');

    // Different subject, still no marker → plain append (no replacement).
    expect(runMemoryDriver(repo, 'chore: new subject').exitCode).toBe(0);
    content = readDayLog(repo);
    expect(countHeadings(content, '## Session Summary')).toBe(2);
    expect(content).toContain('chore: legacy subject');
    expect(content).toContain('chore: new subject');

    // Once a marker block exists for the branch, every further same-branch run
    // replaces it (one block per branch per day) — the legacy block stays alone.
    expect(runMemoryDriver(repo, 'chore: third subject').exitCode).toBe(0);
    content = readDayLog(repo);
    expect(countHeadings(content, '## Session Summary')).toBe(2);
    expect(content).toContain('chore: third subject');
    expect(content).not.toContain('chore: new subject');
    expect(content).toContain('chore: legacy subject');
  });

  test('B-T8: marker + replaced block passes verifyWellFormed; prose-first block still fails', async () => {
    const { verifyWellFormed } = await import(unionVerifyPath);
    const repo = makeBranchRepo('bt8', 'feature/alpha');
    expect(runMemoryDriver(repo, 'chore: first attempt').exitCode).toBe(0);
    expect(runMemoryDriver(repo, 'chore: second attempt').exitCode).toBe(0);

    const content = readDayLog(repo);
    expect(countHeadings(content, '## Session Summary')).toBe(1);
    // All four required sections survive the replace (verify-memory contract).
    for (const section of ['## Session Summary', '## Changes', '## Decisions', '## Open Issues']) {
      expect(content).toContain(section);
    }
    expect(verifyWellFormed({ file: 'day.md', content })).toEqual([]);

    // Two-branch shape is well-formed too (2 blocks, 1 separator, both markers).
    expect(repo.run(['checkout', '-qb', 'feature/beta']).exitCode).toBe(0);
    expect(runMemoryDriver(repo, 'chore: beta run').exitCode).toBe(0);
    const twoBranch = readDayLog(repo);
    expect(verifyWellFormed({ file: 'day.md', content: twoBranch })).toEqual([]);

    // Narrowness pin: a block starting with prose (not a comment, not a heading)
    // still fails the block-start rule.
    const prose = `${content}\n---\n\nsome prose without a heading\n`;
    expect(verifyWellFormed({ file: 'day.md', content: prose }).length).toBeGreaterThan(0);
  });

  test('replace carries the replaced block\'s filled Skills Used section forward verbatim', () => {
    const repo = makeBranchRepo('skills', 'feature/alpha');
    expect(runMemoryDriver(repo, 'chore: run one').exitCode).toBe(0);
    // Agent fills the skeleton between runs (the documented edit-while-open flow).
    const file = path.join(repo.root, 'memory', `${localDate()}.md`);
    const filled = fs.readFileSync(file, 'utf-8').replace(
      'Remove this comment when filled. Unfilled sections are skipped by\nskill-session-review.ts (WARN only on malformed entries).\n-->',
      [
        '- skill: sync',
        '  usage: primary',
        '  outcome: completed',
        '  observations:',
        '    - "filled between runs"',
      ].join('\n'),
    );
    fs.writeFileSync(file, filled, 'utf8');

    expect(runMemoryDriver(repo, 'chore: run two').exitCode).toBe(0);
    const content = fs.readFileSync(file, 'utf-8');
    expect(countHeadings(content, '## Session Summary')).toBe(1);
    expect(content).toContain('- skill: sync');
    expect(content).toContain('run two');
    expect(content).not.toContain('run one');
  });
});
