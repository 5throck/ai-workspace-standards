import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  parseBlocks,
  verifyUnion,
  verifyWellFormed,
  isExemptMemoryFile,
  flatMemoryFiles,
  listMemoryMerges,
  unionScan,
  wellFormedScan,
  repairedAtHead,
  owedBlocks,
} from '../../scripts/helpers/memory-union-verify.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** One healthy session block in the verify-memory contract shape. */
function block(summary: string, body: string): string {
  return [
    '## Session Summary',
    '',
    summary,
    '',
    '## Changes',
    '',
    body,
    '',
    '## Decisions',
    '',
    `${summary} — decision recorded.`,
    '',
    '## Open Issues',
    '',
    'None.',
  ].join('\n');
}

let root: string;
let memoryDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'memory-union-verify-test-'));
  memoryDir = join(root, 'memory');
  mkdirSync(memoryDir, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function git(args: string[], cwd: string = root): void {
  const res = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
  if (res.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${res.stderr.toString()}`);
  }
}

/** A merge that stops on a conflict exits non-zero — that IS the success
 * signal here; the resolution write + commit below completes the merge. */
function gitAllowConflict(args: string[], cwd: string = root): void {
  Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
}

// ── parseBlocks ──────────────────────────────────────────────────────────────

describe('parseBlocks (verify-memory.ts:108-117 conventions)', () => {
  test('splits on \\n---\\n, trims, extracts heading and first line', () => {
    const content = `${block('A', 'alpha')}\n---\n${block('B', 'beta')}\n`;
    const blocks = parseBlocks(content);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].heading).toBe('Session Summary');
    // firstLine is the first CONTENT line (skips the heading line itself) —
    // otherwise the heading+firstLine fallback would match vacuously.
    expect(blocks[0].firstLine).toBe('A');
    expect(blocks[0].text.startsWith('## Session Summary')).toBe(true);
    expect(blocks[1].text).toContain('beta');
    expect(blocks[1].firstLine).toBe('B');
  });

  test('a block without a heading yields empty heading, text intact', () => {
    const blocks = parseBlocks('plain text block\n---\n## Session Summary\nx');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].heading).toBe('');
    expect(blocks[0].firstLine).toBe('plain text block');
  });

  test('empty content yields zero blocks', () => {
    expect(parseBlocks('')).toEqual([]);
    expect(parseBlocks('   \n  \n')).toEqual([]);
  });
});

// ── verifyUnion (Arm A pure core) ────────────────────────────────────────────

describe('verifyUnion (design §5.1 rules 1-4)', () => {
  test('all parent blocks present in merged → pass (order-tolerant)', () => {
    const a = block('A', 'alpha');
    const b = block('B', 'beta');
    const c = block('C', 'gamma');
    const findings = verifyUnion({
      file: 'memory/2026-11-04.md',
      ours: `${a}\n---\n${b}\n`,
      theirs: `${a}\n---\n${c}\n`,
      merged: `${a}\n---\n${c}\n---\n${b}\n`, // reordered union is still a union
    });
    expect(findings).toEqual([]);
  });

  test('identical block in both parents deduped to one in merged → pass', () => {
    const a = block('A', 'alpha');
    const b = block('B', 'beta');
    const findings = verifyUnion({
      file: 'memory/2026-11-04.md',
      ours: `${a}\n---\n${b}\n`,
      theirs: `${a}\n---\n${b}\n`,
      merged: `${a}\n---\n${b}\n`, // deduplicated — correct union behavior
    });
    expect(findings).toEqual([]);
  });

  test('dropped block from the theirs side → dropped-block naming heading + parent', () => {
    const a = block('A', 'alpha');
    const b = block('B', 'beta');
    const c = block('C', 'gamma');
    const findings = verifyUnion({
      file: 'memory/2026-11-04.md',
      ours: `${a}\n---\n${b}\n`,
      theirs: `${a}\n---\n${c}\n`,
      merged: `${a}\n---\n${b}\n`, // C silently lost
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('dropped-block');
    expect(findings[0].file).toBe('memory/2026-11-04.md');
    expect(findings[0].detail).toContain('theirs');
    expect(findings[0].detail).toContain('Session Summary');
    expect(findings[0].detail).toContain('C'); // first content line names the block
  });

  test('dropped block from the ours side is attributed to ours', () => {
    const a = block('A', 'alpha');
    const b = block('B', 'beta');
    const findings = verifyUnion({
      file: 'memory/2026-11-04.md',
      ours: `${a}\n---\n${b}\n`,
      theirs: a,
      merged: a,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('dropped-block');
    expect(findings[0].detail).toContain('ours');
    expect(findings[0].detail).toContain('B'); // first content line names the block
  });

  test('whitespace-reflowed block matched via heading+firstLine fallback → pass (design §5.1 rule 4)', () => {
    const a = block('A', 'alpha');
    // cosmetic whitespace change only — heading line and first content line intact
    const reflowed = block('B', 'beta').replace('\n\n## Open Issues', '\n## Open Issues');
    const findings = verifyUnion({
      file: 'memory/2026-11-04.md',
      ours: `${a}\n---\n${block('B', 'beta')}\n`,
      theirs: a,
      merged: `${a}\n---\n${reflowed}\n`,
    });
    expect(findings).toEqual([]);
  });

  test('fused heading/separator (two Session Summary headings in one block) → fused-heading', () => {
    const a = block('A', 'alpha');
    const b = block('B', 'beta');
    // the 11-04 incident shape: the '---' separator line was deleted but the
    // newline kept, so both Session Summary headings land in ONE split block
    const fused = `${a}\n${b}`;
    const findings = verifyUnion({
      file: 'memory/2026-11-04.md',
      ours: `${a}\n---\n${b}\n`,
      theirs: a,
      merged: fused,
    });
    const kinds = findings.map((f) => f.kind);
    expect(kinds).toContain('fused-heading');
    // B is still owed by the ours side and no longer present as a distinct
    // block — the union obligation is violated alongside the structural fuse
    expect(kinds).toContain('dropped-block');
  });

  test('separator-count violation alone → malformed-result', () => {
    const a = block('A', 'alpha');
    const b = block('B', 'beta');
    // extra separator: 2 blocks vs 2 separators (expected blocks === seps + 1)
    const bad = `${a}\n---\n---\n${b}\n`;
    const findings = verifyUnion({ file: 'memory/2026-11-04.md', ours: bad, theirs: '', merged: bad });
    expect(findings.map((f) => f.kind)).toContain('malformed-result');
  });

  test('substantive rewrite that keeps heading+firstLine is the documented fallback blind spot, not a false drop', () => {
    const a = block('A', 'alpha');
    const rewritten = block('B', 'COMPLETELY DIFFERENT BODY').replace(
      'B — decision recorded.',
      'B — decision CHANGED.',
    );
    // heading + first line intact ('## Session Summary') → fallback matches.
    // Note: the fallback requires heading equality; both rewrite variants keep
    // the first line '## Session Summary' and heading 'Session Summary'.
    const findings = verifyUnion({
      file: 'memory/2026-11-04.md',
      ours: `${a}\n---\n${block('B', 'beta')}\n`,
      theirs: a,
      merged: `${a}\n---\n${rewritten}\n`,
    });
    expect(findings).toEqual([]);
  });
});

// ── verifyWellFormed (Arm B pure core) ───────────────────────────────────────

describe('verifyWellFormed (design §5.1 rule 3)', () => {
  test('healthy file → no findings', () => {
    const content = `${block('A', 'alpha')}\n---\n${block('B', 'beta')}\n`;
    expect(verifyWellFormed({ file: 'memory/2026-11-04.md', content })).toEqual([]);
  });

  test('empty file → vacuously well-formed', () => {
    expect(verifyWellFormed({ file: 'memory/x.md', content: '' })).toEqual([]);
    expect(verifyWellFormed({ file: 'memory/x.md', content: '  \n ' })).toEqual([]);
  });

  test('block not starting with a ## heading → malformed-result', () => {
    const content = `${block('A', 'alpha')}\n---\nplain stub without heading\n`;
    const findings = verifyWellFormed({ file: 'memory/2026-11-02.md', content });
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('malformed-result');
    expect(findings[0].detail).toContain("## ' heading");
  });

  test('fused separator (two Session Summary headings, one block) → fused-heading', () => {
    // separator deleted, newline kept — the incident fuse shape; block and
    // separator counts both drop by one so the count invariant stays
    // consistent and fused-heading is the (correct) sole detector
    const content = `${block('A', 'alpha')}\n${block('B', 'beta')}\n`;
    const kinds = verifyWellFormed({ file: 'memory/x.md', content }).map((f) => f.kind);
    expect(kinds).toEqual(['fused-heading']);
  });

  test('extra separator → count invariant violation', () => {
    const content = `${block('A', 'alpha')}\n---\n---\n${block('B', 'beta')}\n`;
    const findings = verifyWellFormed({ file: 'memory/x.md', content });
    expect(findings.map((f) => f.kind)).toContain('malformed-result');
  });
});

// ── Scan-layer exemption (verify-memory.ts:37-42 set + archive subtree) ─────

describe('isExemptMemoryFile / flatMemoryFiles (scan-layer exemptions)', () => {
  test('verify-memory.ts exemption patterns honored', () => {
    expect(isExemptMemoryFile('memory/MEMORY.md')).toBe(true);
    expect(isExemptMemoryFile('memory/meeting-2026-11-01-review.md')).toBe(true);
    expect(isExemptMemoryFile('memory/adr-0007-x.md')).toBe(true);
    expect(isExemptMemoryFile('memory/2026-11-01-hub-meeting.md')).toBe(true);
    expect(isExemptMemoryFile('memory/archive/2026-10-01.md')).toBe(true);
    expect(isExemptMemoryFile('memory/skill-review/notes.md')).toBe(true);
  });

  test('flat session logs are NOT exempt', () => {
    expect(isExemptMemoryFile('memory/2026-11-04.md')).toBe(false);
    expect(isExemptMemoryFile('memory/2026-11-05.md')).toBe(false);
  });

  test('flatMemoryFiles lists only flat non-exempt .md files', () => {
    writeFileSync(join(memoryDir, '2026-11-04.md'), 'x');
    writeFileSync(join(memoryDir, 'MEMORY.md'), 'x');
    writeFileSync(join(memoryDir, 'meeting-x.md'), 'x');
    mkdirSync(join(memoryDir, 'archive'));
    writeFileSync(join(memoryDir, 'archive', 'old.md'), 'x');
    writeFileSync(join(memoryDir, 'notes.txt'), 'x');
    expect(flatMemoryFiles(memoryDir)).toEqual(['memory/2026-11-04.md']);
  });

  test('absent memory dir → empty list (documented no-op)', () => {
    expect(flatMemoryFiles(join(root, 'nope'))).toEqual([]);
  });
});

// ── Git plumbing (Arm A on synthetic merge shapes) ──────────────────────────

describe('unionScan on a synthetic git fixture (design §7 step-3.88 integration)', () => {
  function initRepo(): void {
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.name', 'test']);
    git(['config', 'user.email', 'test@example.com']);
    git(['config', 'commit.gpgsign', 'false']);
  }

  function commitAll(msg: string): void {
    git(['add', '-A']);
    git(['commit', '-q', '-m', msg]);
  }

  function setupDroppingMerge(): void {
    initRepo();
    const a = block('A', 'alpha');
    const b = block('B', 'beta');
    const c = block('C', 'gamma');
    // base: A + a shared trailing marker line both sides will edit → forced conflict
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${a}\n---\nSHARED-TAIL\n`);
    commitAll('base');
    // side: replace the tail with block C
    git(['checkout', '-q', '-b', 'side']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${a}\n---\n${c}\n---\nSHARED-TAIL-C\n`);
    commitAll('side appends C');
    // main: replace the tail with block B
    git(['checkout', '-q', 'main']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${a}\n---\n${b}\n---\nSHARED-TAIL-B\n`);
    commitAll('main appends B');
    // merge with the incident resolution: C silently dropped
    gitAllowConflict(['merge', '--no-commit', '--no-ff', 'side']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${a}\n---\n${b}\n---\nSHARED-TAIL-B\n`);
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'merge side (resolution drops C)']);
  }

  test('dropping merge → unionScan reports the dropped block with the merge commit', () => {
    setupDroppingMerge();
    const results = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe('memory/2026-11-04.md');
    const kinds = results[0].findings.map((f) => f.kind);
    expect(kinds).toContain('dropped-block');
    // the incident-class finding: session block C, owed by the theirs side,
    // absent from the merged result (the fixture's SHARED-TAIL resolution
    // markers also legitimately appear as drops — conflict resolutions do
    // drop some theirs-side content; the gate flags, a human overrides)
    const dropC = results[0].findings.find((f) => f.kind === 'dropped-block' && f.detail.includes('"C"'));
    expect(dropC).toBeDefined();
    expect(dropC?.detail).toContain('theirs');
    expect(listMemoryMerges({ sinceDays: 365, maxCommits: 20, cwd: root })).toHaveLength(1);
  });

  test('clean union merge → no findings', () => {
    initRepo();
    const a = block('A', 'alpha');
    const b = block('B', 'beta');
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${a}\n`);
    commitAll('base');
    git(['checkout', '-q', '-b', 'side']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${a}\n---\n${b}\n`);
    commitAll('side appends B');
    git(['checkout', '-q', 'main']);
    // no competing main-side change → fast-forward; force a real merge commit
    git(['merge', '--no-ff', '-q', '-m', 'merge side', 'side']);
    const results = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(results).toEqual([]);
    expect(listMemoryMerges({ sinceDays: 365, maxCommits: 20, cwd: root })).toHaveLength(1);
  });

  test('bounded window: sinceDays=0 scans nothing even when merges exist', () => {
    setupDroppingMerge();
    expect(unionScan({ sinceDays: 0, maxCommits: 20, cwd: root })).toEqual([]);
    expect(listMemoryMerges({ sinceDays: 0, maxCommits: 20, cwd: root })).toEqual([]);
  });

  test('bounded window: maxCommits=0 scans nothing', () => {
    setupDroppingMerge();
    expect(unionScan({ sinceDays: 365, maxCommits: 0, cwd: root })).toEqual([]);
  });

  test('two-tier rollout: activation cutoff past → blocking; future → historical (ages out with the window)', () => {
    setupDroppingMerge();
    // activation in the past: the just-created merge is post-activation → blocking
    const blocking = unionScan({ sinceDays: 365, maxCommits: 20, activationIso: '2000-01-01T00:00:00Z', cwd: root });
    expect(blocking).toHaveLength(1);
    expect(blocking[0].tier).toBe('blocking');
    // activation in the future: the merge predates the gate → historical (WARN)
    const historical = unionScan({ sinceDays: 365, maxCommits: 20, activationIso: '2999-01-01T00:00:00Z', cwd: root });
    expect(historical).toHaveLength(1);
    expect(historical[0].tier).toBe('historical');
    // omitted activation = design-literal posture (everything blocking)
    const literal = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(literal[0].tier).toBe('blocking');
  });

  test('repo without a memory dir → empty scan (no-op)', () => {
    initRepo();
    writeFileSync(join(root, 'README.md'), 'x');
    commitAll('base');
    expect(unionScan({ sinceDays: 365, maxCommits: 20, cwd: root })).toEqual([]);
  });
});

// ── wellFormedScan (Arm B plumbing) ──────────────────────────────────────────

describe('wellFormedScan (Arm B worktree sweep)', () => {
  test('healthy worktree → no entries; corrupted block → one entry naming the file', () => {
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${block('A', 'alpha')}\n`);
    writeFileSync(join(memoryDir, '2026-11-05.md'), `${block('B', 'beta')}\n---\nplain stub\n`);
    const results = wellFormedScan({ memoryDir });
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe('memory/2026-11-05.md');
    expect(results[0].findings[0].kind).toBe('malformed-result');
  });

  test('absent memory dir → empty (documented no-op)', () => {
    expect(wellFormedScan({ memoryDir: join(root, 'nope') })).toEqual([]);
  });
});

// ── repairedAtHead + the repaired-at-head tier (T-20261105-002 v1.1.0) ───────

describe('repairedAtHead (T-20261105-002 repair-completion predicate)', () => {
  const PAUSE = 'governance ticket batch paused for tonight (user request); resumes 2026-11-03 04:00 KST';

  test('un-headed parent block absorbed verbatim into a headed head block → repaired', () => {
    const ours = `${block('A', 'alpha')}\n---\n${PAUSE}\n`;
    const head = `${block('A', 'alpha')}\n---\n## Session Summary\n\n${PAUSE}\n\n## Changes\n\nnone.\n`;
    expect(repairedAtHead({ ours, theirs: ours, head })).toBe(true);
  });

  test('block fully absent from head → not repaired', () => {
    const ours = `${block('A', 'alpha')}\n---\n${PAUSE}\n`;
    const head = `${block('A', 'alpha')}\n`;
    expect(repairedAtHead({ ours, theirs: ours, head })).toBe(false);
  });

  test('headed parent block restored by heading+firstLine → repaired (strict path unchanged)', () => {
    const dropped = block('B', 'beta');
    const ours = `${block('A', 'alpha')}\n---\n${dropped}\n`;
    const head = `${block('A', 'alpha')}\n---\n${dropped}\n`;
    expect(repairedAtHead({ ours, theirs: ours, head })).toBe(true);
  });

  test('headed parent block present only as a substring → NOT repaired (containment cannot fake a heading)', () => {
    const dropped = block('B', 'beta');
    const ours = `${block('A', 'alpha')}\n---\n${dropped}\n`;
    // head merely quotes B's body text inside an unrelated block — no heading match
    const head = `${block('A', 'alpha')}\n---\n## Session Summary\n\nB beta quoted: beta — decision recorded.\n`;
    expect(repairedAtHead({ ours, theirs: ours, head })).toBe(false);
  });

  test('no dropped blocks → vacuously repaired', () => {
    const clean = block('A', 'alpha');
    expect(repairedAtHead({ ours: clean, theirs: clean, head: clean })).toBe(true);
  });
});

describe('unionScan repaired-at-head tier (T-20261105-002)', () => {
  function localGit(args: string[]): void {
    spawnSync('git', args, { cwd: root, stdout: 'pipe', stderr: 'pipe' });
  }
  function localCommit(msg: string): void {
    localGit(['add', '-A']);
    localGit(['commit', '-q', '-m', msg]);
  }
  /** Same dropping-merge shape as setupDroppingMerge (scoped there), local here. */
  function localDroppingMerge(): void {
    localGit(['init', '-q', '-b', 'main']);
    localGit(['config', 'user.name', 'test']);
    localGit(['config', 'user.email', 'test@example.com']);
    localGit(['config', 'commit.gpgsign', 'false']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${block('A', 'alpha')}\n---\nSHARED-TAIL\n`);
    localCommit('base');
    localGit(['checkout', '-q', '-b', 'side']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${block('A', 'alpha')}\n---\n${block('C', 'gamma')}\n---\nSHARED-TAIL-C\n`);
    localCommit('side appends C');
    localGit(['checkout', '-q', 'main']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${block('A', 'alpha')}\n---\n${block('B', 'beta')}\n---\nSHARED-TAIL-B\n`);
    localCommit('main appends B');
    spawnSync('git', ['merge', '--no-commit', '--no-ff', 'side'], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${block('A', 'alpha')}\n---\n${block('B', 'beta')}\n---\nSHARED-TAIL-B\n`);
    localGit(['add', '-A']);
    localCommit('merge side (resolution drops C)');
  }

  test('a repaired worktree re-tiers the dropping merge repaired-at-head; unrepaired stays blocking', () => {
    localDroppingMerge();
    // unrepaired worktree → blocking
    const unrepaired = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(unrepaired).toHaveLength(1);
    expect(unrepaired[0].tier).toBe('blocking');
    // repair: absorb the dropped block C into a headed block in the worktree
    const c = block('C', 'gamma');
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${block('A', 'alpha')}\n---\n${block('B', 'beta')}\n---\nSHARED-TAIL-B\n---\n${c}\n---\nSHARED-TAIL-C\n`);
    const repaired = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(repaired).toHaveLength(1);
    expect(repaired[0].tier).toBe('repaired-at-head');
    expect(repaired[0].findings.some((f) => f.kind === 'dropped-block')).toBe(true);
  });

  test('archival deletion with a MEMORY.md tombstone re-tiers repaired-at-head; clobber deletion stays blocking (v1.1.1)', () => {
    localGit(['init', '-q', '-b', 'main']);
    localGit(['config', 'user.name', 'test']);
    localGit(['config', 'user.email', 'test@example.com']);
    localGit(['config', 'commit.gpgsign', 'false']);
    const logRel = join(memoryDir, '2026-11-06.md');
    const idxRel = join(memoryDir, 'MEMORY.md');
    writeFileSync(logRel, `${block('A', 'alpha')}\n`);
    writeFileSync(idxRel, '| Date | Summary |\n|---|---|\n');
    localCommit('base');
    localGit(['checkout', '-q', '-b', 'side']);
    writeFileSync(logRel, `${block('A', 'alpha')}\n---\n${block('S', 'side')}\n`);
    localCommit('side appends S');
    localGit(['checkout', '-q', 'main']);
    rmSync(logRel); // archive-memory 7-day retention deletes the log
    localCommit('archive deletes the log');
    spawnSync('git', ['merge', '--no-commit', '--no-ff', 'side'], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
    localGit(['rm', '-q', '2026-11-06.md'.replace(/^/, 'memory/')]);
    localCommit('merge side (archival deletion survives)');
    // WITH the MEMORY.md tombstone row for the deleted log → sanctioned archival
    writeFileSync(idxRel, '| Date | Summary |\n|---|---|\n| 2026-11-06 | archived — retention cycle |\n');
    const archived = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(archived).toHaveLength(1);
    expect(archived[0].tier).toBe('repaired-at-head');
    // WITHOUT the tombstone → a genuine clobber deletion stays blocking
    writeFileSync(idxRel, '| Date | Summary |\n|---|---|\n');
    const clobber = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(clobber[0].tier).toBe('blocking');
  });

  test('archive-location fallback: a repaired log that the archive step then moved re-tiers repaired-at-head (T-20261106-007)', () => {
    localDroppingMerge();
    // the documented repair first: restore the file with every parent block
    const repairedContent = [
      block('A', 'alpha'),
      block('B', 'beta'),
      'SHARED-TAIL-B',
      block('C', 'gamma'),
      'SHARED-TAIL-C',
    ].join('\n---\n');
    writeFileSync(join(memoryDir, '2026-11-04.md'), repairedContent + '\n');
    // then the archive step (step 3.8) moves it — the repair now lives in memory/archive/
    mkdirSync(join(memoryDir, 'archive'), { recursive: true });
    renameSync(join(memoryDir, '2026-11-04.md'), join(memoryDir, 'archive', '2026-11-04.md'));
    const results = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(results).toHaveLength(1);
    expect(results[0].tier).toBe('repaired-at-head');
  });

  test('a log absent from BOTH the worktree and the archive stays blocking (no positive evidence)', () => {
    localDroppingMerge();
    rmSync(join(memoryDir, '2026-11-04.md'));
    const results = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(results).toHaveLength(1);
    expect(results[0].tier).toBe('blocking');
  });

  // ── v1.4.0: the T-20261117-008 archival-provenance tier (design
  //    docs/designs/2026-11-18-memory-union-archival-tier-design.md §2) ──────
  /** The v1.4.0 shape: the file EXISTED at the dropping merge (so the v1.1.1
   * merged===null tombstone arm never runs), and a LATER housekeeping commit
   * archived the whole log — worktree file gone, MEMORY.md tombstone row left
   * behind (the archive-memory.ts documented convention). */
  function archiveLogWithTombstone(tombstone: boolean): void {
    localDroppingMerge();
    if (tombstone) {
      writeFileSync(
        join(memoryDir, 'MEMORY.md'),
        '| Date | Summary |\n|---|---|\n| 2026-11-04 | archived — retention cycle |\n',
      );
    } else {
      writeFileSync(join(memoryDir, 'MEMORY.md'), '| Date | Summary |\n|---|---|\n');
    }
    rmSync(join(memoryDir, '2026-11-04.md')); // housekeeping archival (step 3.8)
    localCommit('housekeeping archives the dropped log');
  }

  test('block-drop on a merge whose log was LATER archived, no archive copy → historical (T-20261117-008 fresh-worktree shape)', () => {
    archiveLogWithTombstone(true);
    const results = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(results).toHaveLength(1);
    expect(results[0].tier).toBe('historical');
    expect(results[0].findings.some((f) => f.kind === 'dropped-block')).toBe(true);
  });

  test('same archival shape WITHOUT the MEMORY.md tombstone row stays blocking (fail-closed)', () => {
    archiveLogWithTombstone(false);
    const results = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(results).toHaveLength(1);
    expect(results[0].tier).toBe('blocking');
  });

  test('tombstone present but the archive copy is readable and damaged → blocking (readable evidence outranks provenance)', () => {
    archiveLogWithTombstone(true);
    // the archive holds what the merge produced — C is NOT in it
    mkdirSync(join(memoryDir, 'archive'), { recursive: true });
    writeFileSync(
      join(memoryDir, 'archive', '2026-11-04.md'),
      `${block('A', 'alpha')}\n---\n${block('B', 'beta')}\n---\nSHARED-TAIL-B\n`,
    );
    const results = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(results).toHaveLength(1);
    expect(results[0].tier).toBe('blocking');
  });

  test('tombstone present and the archive copy carries the parent-union → repaired-at-head (v1.2.0 arm in the provenance context)', () => {
    archiveLogWithTombstone(true);
    mkdirSync(join(memoryDir, 'archive'), { recursive: true });
    const repairedContent = [
      block('A', 'alpha'),
      block('B', 'beta'),
      'SHARED-TAIL-B',
      block('C', 'gamma'),
      'SHARED-TAIL-C',
    ].join('\n---\n');
    writeFileSync(join(memoryDir, 'archive', '2026-11-04.md'), repairedContent + '\n');
    const results = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(results).toHaveLength(1);
    expect(results[0].tier).toBe('repaired-at-head');
  });
});

// ── owedBlocks (v1.5.0, T-20261118-003 — design §3.1 §4.1) ───────────────────

describe('owedBlocks (the gate debt inventory behind step-2 sparing, T-20261118-003)', () => {
  function commitAll(msg: string): void {
    git(['add', '-A']);
    git(['commit', '-q', '-m', msg]);
  }
  /** Same dropping-merge shape as localDroppingMerge, plus the merge SHA. */
  function setupOwedFixture(): string {
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.name', 'test']);
    git(['config', 'user.email', 'test@example.com']);
    git(['config', 'commit.gpgsign', 'false']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${block('A', 'alpha')}\n---\nSHARED-TAIL\n`);
    commitAll('base');
    git(['checkout', '-q', '-b', 'side']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${block('A', 'alpha')}\n---\n${block('C', 'gamma')}\n---\nSHARED-TAIL-C\n`);
    commitAll('side appends C');
    git(['checkout', '-q', 'main']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${block('A', 'alpha')}\n---\n${block('B', 'beta')}\n---\nSHARED-TAIL-B\n`);
    commitAll('main appends B');
    gitAllowConflict(['merge', '--no-commit', '--no-ff', 'side']);
    // resolution drops C (the OW-T fixture's debt) and the SHARED-TAIL-C marker
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${block('A', 'alpha')}\n---\n${block('B', 'beta')}\n---\nSHARED-TAIL-B\n`);
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'merge side (resolution drops C)']);
    const res = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
    return res.stdout.toString().trim();
  }

  test('OW-T1: dropping merge + worktree lacking the block → owed, parent- and commit-labeled', () => {
    const mergeSha = setupOwedFixture();
    // post-merge worktree = the merged blob (block C absent) — nothing restored yet
    const owed = owedBlocks({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(owed.length).toBeGreaterThan(0);
    const owedC = owed.find((o) => o.block.text === block('C', 'gamma'));
    expect(owedC).toBeDefined();
    expect(owedC!.parent).toBe('theirs');
    expect(owedC!.commit).toBe(mergeSha);
    expect(owedC!.file).toBe('memory/2026-11-04.md');
    expect(owedC!.block.heading).toBe('Session Summary');
    expect(owedC!.block.firstLine).toBe('C');
    // the SHARED-TAIL-C un-headed drop is owed too — same rules as droppedBlocks
    expect(owed.some((o) => o.block.text === 'SHARED-TAIL-C' && o.parent === 'theirs')).toBe(true);
  });

  test('OW-T2: worktree carrying the union → the merge-time inventory is UNCHANGED (repaired, not forgiven)', () => {
    setupOwedFixture();
    // the restoration satisfies repairedAtHead (unionScan tiers the group
    // repaired-at-head) but does NOT shrink the debt inventory: the merged
    // blob is immutable and the gate still "owes" the dropped block until the
    // merge ages out — that is exactly why DL-T1's sparing keeps working for
    // an already-restored block (head-side clarification, see helper v1.5.0).
    writeFileSync(
      join(memoryDir, '2026-11-04.md'),
      `${block('A', 'alpha')}\n---\n${block('B', 'beta')}\n---\nSHARED-TAIL-B\n---\n${block('C', 'gamma')}\n---\nSHARED-TAIL-C\n`,
    );
    const owed = owedBlocks({ sinceDays: 365, maxCommits: 20, cwd: root });
    expect(owed.some((o) => o.block.text === block('C', 'gamma') && o.parent === 'theirs')).toBe(true);
  });

  test('OW-T3: merge-touched file absent from the worktree → contributes nothing', () => {
    setupOwedFixture();
    rmSync(join(memoryDir, '2026-11-04.md'));
    // the tier arms (archive fallback, tombstone provenance) own the absent-file
    // shape — the debt inventory is worktree-scoped by contract (design §3.1)
    expect(owedBlocks({ sinceDays: 365, maxCommits: 20, cwd: root })).toEqual([]);
  });

  test('OW-T4: no in-window merges → []', () => {
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.name', 'test']);
    git(['config', 'user.email', 'test@example.com']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${block('A', 'alpha')}\n`);
    commitAll('plain commit, no merges');
    expect(owedBlocks({ sinceDays: 365, maxCommits: 20, cwd: root })).toEqual([]);
    // zero window/maxCommits also disables the sweep (listMemoryMerges contract)
    expect(owedBlocks({ sinceDays: 0, maxCommits: 20, cwd: root })).toEqual([]);
    expect(owedBlocks({ sinceDays: 365, maxCommits: 0, cwd: root })).toEqual([]);
  });
});

// ── v1.6.0 absentOk (U-20261120-001 — design docs/designs/2026-11-20-runner-
//    hardening-integrity-design.md §3.5 + §8 PR-4 tests a-d) ──────────────────

describe('absentOk exit-128 classification (v1.6.0, U-20261120-001)', () => {
  function commitAll(msg: string): void {
    git(['add', '-A']);
    git(['commit', '-q', '-m', msg]);
  }
  /** One-side-taken merge: memory/2026-11-05.md is ADDED on the side branch
   * only — the ours-side parent blob read is the absent-path shape (exit 128)
   * that produced the 20+ anonymous WARN storm per scan. */
  function setupOneSideTakenMerge(): string {
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.name', 'test']);
    git(['config', 'user.email', 'test@example.com']);
    git(['config', 'commit.gpgsign', 'false']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${block('A', 'alpha')}\n`);
    commitAll('base');
    git(['checkout', '-q', '-b', 'side']);
    writeFileSync(join(memoryDir, '2026-11-05.md'), `${block('S', 'side-only')}\n`);
    commitAll('side adds a new log');
    git(['checkout', '-q', 'main']);
    git(['merge', '--no-ff', '-q', '-m', 'merge side (one-side-taken)', 'side']);
    const res = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
    return res.stdout.toString().trim();
  }

  /** Capture the module's stderr WARN / stdout INFO channels for one sweep. */
  function captureChannels(): { warns: string[]; infos: string[] } {
    const warns: string[] = [];
    const infos: string[] = [];
    const origWarn = console.warn;
    const origInfo = console.info;
    console.warn = (m: unknown) => warns.push(String(m));
    console.info = (m: unknown) => infos.push(String(m));
    return {
      warns,
      infos,
      restore: () => {
        console.warn = origWarn;
        console.info = origInfo;
      },
    };
  }

  test('(a) absent-side read emits NO warn (the 20+-row storm is gone)', () => {
    const mergeSha = setupOneSideTakenMerge();
    const cap = captureChannels();
    try {
      const results = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
      // the merge is a clean union (blocks only exist on one side) → no findings
      expect(results).toEqual([]);
      expect(listMemoryMerges({ sinceDays: 365, maxCommits: 20, cwd: root })).toHaveLength(1);
      expect(mergeSha.length).toBe(40);
      expect(cap.warns.filter((w) => w.includes('failed (exit'))).toEqual([]);
    } finally {
      cap.restore();
    }
  });

  test('(b) sweep ends with exactly ONE INFO naming the absent ref', () => {
    setupOneSideTakenMerge();
    // the absent read is the OURS-side parent blob (the file does not exist on
    // main's parent) — the INFO must name that exact <sha>:<file> ref
    const p1 = Bun.spawnSync(['git', 'rev-parse', 'HEAD^'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
      .stdout.toString()
      .trim();
    const cap = captureChannels();
    try {
      unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
      expect(cap.infos).toHaveLength(1);
      expect(cap.infos[0]).toContain('1 absent-side blob reads');
      expect(cap.infos[0]).toContain('documented no-data — file added/deleted between sides');
      expect(cap.infos[0]).toContain(`${p1}:memory/2026-11-05.md`);
    } finally {
      cap.restore();
    }
  });

  test('(c) genuine failure (non-log-sourced sweep in a non-repo) still warns with the failing ref named', () => {
    const plain = mkdtempSync(join(tmpdir(), 'muv-strict-warn-'));
    const cap = captureChannels();
    try {
      // listMemoryMerges' strict `git log` (args[1] = --merges) is NOT
      // absentOk — a genuine 128 here must WARN, now naming the ref (v1.6.0
      // item 4), instead of the old anonymous message.
      expect(listMemoryMerges({ sinceDays: 365, maxCommits: 20, cwd: plain })).toEqual([]);
      expect(cap.warns.some((w) => w.includes('git log failed (exit') && w.includes('on --merges'))).toBe(true);
      expect(cap.infos).toEqual([]); // strict failures never enter the absent collector
    } finally {
      cap.restore();
      rmSync(plain, { recursive: true, force: true });
    }
  });

  test('(d) loop-regression pin: one-side-taken merge + same-branch re-run converges in one 3.88 pass (U-20261120-001, v1.5.0 spare semantics hold)', () => {
    // The earlier same-id report: a merge resolution that took ONE side
    // (dropping the other side's blocks), the guidance-following restore, and
    // the next /sync on the same branch re-collapsing the restored block
    // because step 2 did not spare it. Convergence contract (v1.5.0 + v1.6.0):
    // owedBlocks keeps the MERGE-TIME debt (step 2 spares the restored
    // segment) while unionScan tiers the group repaired-at-head (the gate
    // PASSES — no FATAL, no re-collapse), and both stay true on the re-run.
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.name', 'test']);
    git(['config', 'user.email', 'test@example.com']);
    git(['config', 'commit.gpgsign', 'false']);
    const a = block('A', 'alpha');
    const b = block('B', 'beta');
    const c = block('C', 'gamma');
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${a}\n---\nSHARED-TAIL\n`);
    commitAll('base');
    git(['checkout', '-q', '-b', 'side']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${a}\n---\n${c}\n---\nSHARED-TAIL-C\n`);
    commitAll('side appends C');
    git(['checkout', '-q', 'main']);
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${a}\n---\n${b}\n---\nSHARED-TAIL-B\n`);
    commitAll('main appends B');
    gitAllowConflict(['merge', '--no-commit', '--no-ff', 'side']);
    // the one-side-taken resolution: C (and its marker) silently dropped
    writeFileSync(join(memoryDir, '2026-11-04.md'), `${a}\n---\n${b}\n---\nSHARED-TAIL-B\n`);
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'merge side (resolution drops C)']);
    const res = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
    const mergeSha = res.stdout.toString().trim();

    const cap = captureChannels();
    try {
      // run 1 (the sync that FATALs pre-v1.5.0): the debt is inventoried for
      // step-2 sparing AND the gate still flags the unrepaired worktree
      const owed1 = owedBlocks({ sinceDays: 365, maxCommits: 20, cwd: root });
      expect(owed1.some((o) => o.commit === mergeSha && o.block.text === c && o.parent === 'theirs')).toBe(true);
      const scan1 = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
      expect(scan1).toHaveLength(1);
      expect(scan1[0].tier).toBe('blocking'); // the FATAL the repair answers
      // the guidance-following restore into the working tree
      writeFileSync(
        join(memoryDir, '2026-11-04.md'),
        `${a}\n---\n${b}\n---\nSHARED-TAIL-B\n---\n${c}\n---\nSHARED-TAIL-C\n`,
      );
      // run 2 (same-branch re-run): convergence — the gate passes (no
      // re-collapse FATAL) and the merge-time debt still spares the segment
      const scan2 = unionScan({ sinceDays: 365, maxCommits: 20, cwd: root });
      expect(scan2).toHaveLength(1);
      expect(scan2[0].tier).toBe('repaired-at-head');
      const owed2 = owedBlocks({ sinceDays: 365, maxCommits: 20, cwd: root });
      expect(owed2.some((o) => o.block.text === c && o.parent === 'theirs')).toBe(true);
      expect(cap.warns.filter((w) => w.includes('failed (exit'))).toEqual([]); // no storm, ever
    } finally {
      cap.restore();
    }
  });
});
