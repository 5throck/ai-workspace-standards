import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
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
});
