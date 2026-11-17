/**
 * Incident simulation for T-20261117-015 (spec
 * docs/designs/2026-11-18-dev-sync-hunk-staging-design.md §5 S1-S3): reproduces the
 * 2026-11-17 audit-fix landing shape in a temp git repo — a landing that adds its own
 * spec entry to docs/specs/registry.json while a sibling batch's entry must stay OUT
 * (hunk-level adjudication), plus an UNTRACKED parallel entry JSON — and proves:
 *   S1 the path-level re-add clobber (step 6.5 sweeping the honored path) produces the
 *      dangling shape, and the step-6.55 gate logic flags it PRE-COMMIT — the 2026-11-17
 *      shape passed every gate and was caught only at push-time review;
 *   S2 the honor-staged contract: the adjudicated staged blob survives a selective add
 *      sweep verbatim (honored paths are never path-level re-added), and once the
 *      parallel entry JSON is staged (the unshelve) the gate passes on either blob;
 *   S3 the ghost-opt-in classifier input (honored path present in the cached diff,
 *      worktree-only scratch absent).
 *
 * dev-sync.ts is not import-safe (monolithic top-level-await script), so the gate
 * computation here mirrors the step-6.55 body over the shared pure lib
 * (scripts/lib/spec-landing.ts) — the structural placement of that body in dev-sync.ts
 * is pinned textually by tests/unit/dev-sync-hunk-staging.test.ts.
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeAll } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { danglingSpecRefs, parseRegistryEntries, specEntryPath } from '../../scripts/lib/spec-landing.ts';

// Hermetic root: derive from this file's own location (C-C contract,
// scripts/lib/hermetic-test-roots.ts) — never from process.cwd().
const repoRoot = mkdtempSync(join(tmpdir(), 'spec-landing-incident-sim-'));

function git(args: string[]): { code: number; out: string } {
  const proc = Bun.spawnSync(['git', ...args], { cwd: repoRoot, stdout: 'pipe', stderr: 'pipe' });
  if (proc.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${proc.exitCode}): ${proc.stderr.toString()}`);
  }
  return { code: proc.exitCode, out: proc.stdout.toString() };
}

const registryPath = 'docs/specs/registry.json';
const entry = (id: string) => ({
  id,
  title: id,
  file: `docs/designs/${id}.md`,
  status: 'implemented',
  source: 'manual',
});

const E1 = '2026-11-18-sim-entry-one'; // already on main
const E2 = '2026-11-18-sim-entry-two'; // THIS landing's own spec entry
const E3 = '2026-11-18-sim-entry-three'; // the sibling batch's forbidden entry

const registryJson = (specs: Array<Record<string, unknown>>) =>
  JSON.stringify({ version: '1.0.0', specs }, null, 2) + '\n';

function writeEntryFiles(ids: string[]): void {
  mkdirSync(join(repoRoot, 'docs', 'specs', 'entries'), { recursive: true });
  mkdirSync(join(repoRoot, 'docs', 'designs'), { recursive: true });
  for (const id of ids) {
    writeFileSync(join(repoRoot, specEntryPath(id)), JSON.stringify(entry(id), null, 2) + '\n');
    writeFileSync(join(repoRoot, 'docs', 'designs', `${id}.md`), `# ${id}\n`);
  }
}

function stageRegistryBlob(content: string): void {
  // hunk-level adjudicated staging, simulated faithfully: the INDEX blob is written
  // directly (git hash-object -w + update-index --cacheinfo) — the same end state
  // `git apply --cached` of an adjudicated hunk-1-only patch produces: index blob
  // differs from BOTH HEAD and the worktree file.
  const proc = Bun.spawnSync(['git', 'hash-object', '-w', '--stdin'], {
    cwd: repoRoot,
    stdin: Buffer.from(content),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (proc.exitCode !== 0) throw new Error(`hash-object failed: ${proc.stderr.toString()}`);
  const blobSha = proc.stdout.toString().trim();
  git(['update-index', '--add', '--cacheinfo', `100644,${blobSha},${registryPath}`]);
}

/** The step-6.55 gate computation, mirroring the dev-sync body over the pure lib. */
function computeDangling(): string[] {
  const stagedReg = git(['show', `:${registryPath}`]).out;
  const entries = parseRegistryEntries(stagedReg);
  const required = [
    ...new Set(entries.flatMap((e) => [specEntryPath(e.id), ...(e.file ? [e.file] : [])])),
  ];
  const idxSet = new Set(git(['ls-files', '-z', '--', ...required]).out.split('\0').filter(Boolean));
  const headSet = new Set(git(['ls-tree', '-r', '--name-only', '-z', 'HEAD']).out.split('\0').filter(Boolean));
  const removed = new Set(
    git(['diff', '--cached', '--name-status', '-z']).out
      .split('\0')
      .flatMap((s, i, a) => (s === 'D' && a[i + 1] ? [a[i + 1]] : [])),
  );
  return danglingSpecRefs(entries, (p) => idxSet.has(p) || (headSet.has(p) && !removed.has(p)));
}

function worktreeRegistry(ids: string[]): void {
  writeFileSync(join(repoRoot, registryPath), registryJson(ids.map(entry)));
}

describe('spec-landing incident simulation (T-20261117-015)', () => {
  beforeAll(() => {
    git(['init', '-b', 'main']);
    git(['config', 'user.email', 'sim@example.com']);
    git(['config', 'user.name', 'Sim']);
    writeEntryFiles([E1]);
    worktreeRegistry([E1]);
    git(['add', '.']);
    git(['commit', '-m', 'base: registry with entry one']);
  });

  test('S1: the clobbered shape — path-level re-add stages the sibling entry whose entry JSON is untracked, and the gate flags it PRE-COMMIT', () => {
    // worktree: this landing appends its own entry E2; the sibling batch's E3 rides
    // along in the worktree (its entry JSON + design doc stay UNTRACKED — the exact
    // 2026-11-17 audit-fix shape)
    worktreeRegistry([E1, E2, E3]);
    writeEntryFiles([E2]); // E2's entry JSON + design doc land with this batch
    // the silent clobber, simulated: dev-sync step 6.5's path-level re-add of the
    // task-staged registry sweeps the WHOLE worktree file over the adjudicated index
    git(['add', registryPath]);
    const stagedBlob = git(['show', `:${registryPath}`]).out;
    expect(stagedBlob).toContain(E3); // the clobbered index state — what v1.50.0 shipped

    const dangling = computeDangling();
    // the incident bite: the forbidden entry rides the commit as a dangling reference —
    // entry JSON and design file will NOT exist in the commit
    expect(dangling).toContain(`${specEntryPath(E3)} (spec ${E3})`);
    expect(dangling).toContain(`docs/designs/${E3}.md (spec ${E3})`);
  });

  test('S2: the adjudicated shape — honor-staged blob survives the sweep; the unshelve clears the gate on the clobbered blob too', () => {
    // the auditor's hunk-1-only adjudication: E2 in, sibling E3 out
    stageRegistryBlob(registryJson([entry(E1), entry(E2)]));
    const adjudicated = git(['show', `:${registryPath}`]).out;
    expect(adjudicated).toContain(E2);
    expect(adjudicated).not.toContain(E3);
    expect(adjudicated).not.toBe(git(['show', `HEAD:${registryPath}`]).out); // a real staged delta (E2) — in taskStaged

    // honor-staged contract: the sweep adds ONLY non-honored committable paths — the
    // registry itself is never re-added, so the adjudicated blob survives verbatim
    git(['add', specEntryPath(E2), `docs/designs/${E2}.md`]); // sibling committable paths
    expect(computeDangling()).toEqual([]); // the adjudicated state is clean
    expect(git(['show', `:${registryPath}`]).out).toBe(adjudicated);
    expect(readFileSync(join(repoRoot, registryPath), 'utf-8')).toContain(E3); // worktree keeps the parallel batch for a later sync

    // the unshelve (the 2026-11-17 repair path): staging the parallel entry JSON makes
    // even the CLOBBERED 3-entry blob pass the gate — the failure mode is closed
    writeEntryFiles([E3]);
    git(['add', registryPath, specEntryPath(E3), `docs/designs/${E3}.md`]);
    expect(computeDangling()).toEqual([]);
  });

  test('S3: ghost-opt-in classifier input — an honored path with no staged delta is detectable', () => {
    const ghostPath = 'docs/designs/never-staged.md';
    writeFileSync(join(repoRoot, ghostPath), 'uncommitted scratch\n'); // worktree-only
    const taskStaged = new Set(git(['diff', '--cached', '--name-only', '-z']).out.split('\0').filter(Boolean));
    expect(taskStaged.has(ghostPath)).toBe(false); // the ghost condition dev-sync fails closed on
    expect(taskStaged.has(registryPath)).toBe(true); // the genuinely-honored path is present
  });
});
