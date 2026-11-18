/**
 * Unit tests for resync-audit.ts v1.11.0 (T-20261118-004, spec
 * docs/designs/2026-11-18-resync-audit-retention-prune-design.md): the
 * RETENTION-PRUNE verdict class. dev-sync step 3.8 runs
 * scripts/archive-memory.ts, which moves flat memory logs older than 7 days
 * into the gitignored memory/archive/ and tombstones their MEMORY.md rows in
 * the same run — surfacing in variant projects as a working-tree DELETION of
 * the tracked memory/<date>.md with its index row de-linked. Previously that
 * deletion landed in the bare KEEP branch ("deleted in working tree —
 * restore or commit"), forcing manual adjudication every cycle (the
 * 2026-11-18 co-export/co-price landings: 3+ each).
 *
 * Pinned here:
 *  - corroborated prune (old date log + tombstoned index — the 2026-11-17
 *    sweep shape) → RETENTION-PRUNE;
 *  - still-linked deletion → KEEP (the safety net, unchanged);
 *  - unknown patterns → KEEP: MEMORY.md itself, subdirectory paths,
 *    non-memory trees, non-.md files, a date log whose retention window has
 *    NOT elapsed (far-future date — deterministically in-window forever;
 *    the exact 7-day boundary is pinned on retentionWindowElapsed with an
 *    injected clock);
 *  - non-date flat log (the meeting-file pattern) → RETENTION-PRUNE only
 *    when the prune's rename destination (memory/archive/<name>) exists AND
 *    the index is de-linked; without the archive copy → KEEP (mtime keyed
 *    the original selection — post-deletion the archive copy is the only
 *    observable of the same rule);
 *  - absent/unreadable MEMORY.md → KEEP (fail-closed, no in-tree
 *    corroboration).
 *
 * classify() reads HEAD:<path>, so the e2e cases run against a temp repo
 * with a controlled initial commit (the merge-managed suite's harness
 * pattern).
 *
 * @version 1.11.0
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  classify,
  retentionPrunePattern,
  retentionWindowElapsed,
  retentionPruneCorroborated,
} from '../../scripts/resync-audit.ts';

const dir = mkdtempSync(join(tmpdir(), 'resync-audit-prune-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const EMPTY_DELIVERY = { tombstones: {}, baselines: {} } as const;

/** A date guaranteed outside the 7-day retention window from any plausible CI clock. */
const OLD_DATE = '2026-10-01';

const INDEX_LINKED = [
  '# Memory Index',
  '',
  '## Sessions',
  '',
  '| Date | Summary |',
  '|------|---------|',
  `| [${OLD_DATE}](${OLD_DATE}.md) | session log |`,
  '| [2026-10-02](2026-10-02.md) | other session |',
  '',
].join('\n');

const INDEX_TOMBSTONED = [
  '# Memory Index',
  '',
  '## Sessions',
  '',
  '| Date | Summary |',
  '|------|---------|',
  `| ${OLD_DATE} | session log |`,
  '| [2026-10-02](2026-10-02.md) | other session |',
  '',
].join('\n');

function gitInit(project: string, files: Record<string, string>): string {
  mkdirSync(project, { recursive: true });
  const run = (args: string[]) => spawnSync('git', ['-C', project, ...args], { encoding: 'utf-8' });
  run(['init', '-q']);
  run(['config', 'user.email', 'test@example.invalid']);
  run(['config', 'user.name', 'resync-audit test']);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(project, rel);
    mkdirSync(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
    writeFileSync(abs, content);
  }
  run(['add', '-A']);
  run(['commit', '-qm', 'fixture baseline']);
  return project;
}

/** The sweep fixture: log committed at HEAD, then pruned out of the working
 *  tree; index rewritten in the same tree. `keepLink` flips the de-link
 *  condition; `indexMode` selects present / absent. */
function prunedProject(
  name: string,
  logRel: string,
  opts: { keepLink?: boolean; index?: 'present' | 'absent'; archiveCopy?: boolean } = {},
): string {
  const logName = logRel.slice('memory/'.length);
  const indexContent = opts.keepLink ? INDEX_LINKED : INDEX_TOMBSTONED;
  const files: Record<string, string> = {
    [logRel]: `# ${logName} session\n\nsome landed session block\n`,
    'memory/MEMORY.md': INDEX_LINKED,
    'memory/2026-10-02.md': '# still-linked other session\n',
  };
  const project = gitInit(join(dir, name), files);
  // The prune: move the log into the gitignored archive dir, repair the index.
  mkdirSync(join(project, 'memory', 'archive'), { recursive: true });
  if (opts.archiveCopy !== false) {
    writeFileSync(join(project, 'memory', 'archive', logName), 'archived copy\n');
  }
  rmSync(join(project, logRel));
  if (opts.index === 'absent') {
    rmSync(join(project, 'memory', 'MEMORY.md'));
  } else {
    writeFileSync(join(project, 'memory', 'MEMORY.md'), indexContent);
  }
  return project;
}

describe('retentionPrunePattern — the archive-memory selection shape (mirrored)', () => {
  test('flat date-named log → {kind:"date"}', () => {
    expect(retentionPrunePattern('memory/2026-10-01.md')).toEqual({ kind: 'date', date: '2026-10-01' });
  });

  test('flat non-date log → {kind:"flat"} (mtime-keyed in the original rule)', () => {
    expect(retentionPrunePattern('memory/meeting-2026-09-01.md')).toEqual({ kind: 'flat' });
    expect(retentionPrunePattern('memory/notes.md')).toEqual({ kind: 'flat' });
  });

  test('MEMORY.md itself → null (the prune explicitly skips the index)', () => {
    expect(retentionPrunePattern('memory/MEMORY.md')).toBeNull();
  });

  test('subdirectory and non-memory paths → null', () => {
    expect(retentionPrunePattern('memory/archive/2026-10-01.md')).toBeNull();
    expect(retentionPrunePattern('memory/skill-review/2026-09-06.md')).toBeNull();
    expect(retentionPrunePattern('docs/2026-10-01.md')).toBeNull();
    expect(retentionPrunePattern('memory/notes.txt')).toBeNull();
    expect(retentionPrunePattern('2026-10-01.md')).toBeNull();
  });
});

describe('retentionWindowElapsed — the strict >7-day window (archive-memory arithmetic)', () => {
  const noon = new Date('2026-10-21T12:00:00');

  test('exactly 7 days → not elapsed (strict >)', () => {
    expect(retentionWindowElapsed('2026-10-14', noon)).toBe(false);
  });

  test('past 7 days → elapsed', () => {
    expect(retentionWindowElapsed('2026-10-13', noon)).toBe(true);
    expect(retentionWindowElapsed(OLD_DATE, noon)).toBe(true);
  });

  test('future / in-window dates → not elapsed', () => {
    expect(retentionWindowElapsed('2026-10-20', noon)).toBe(false);
    expect(retentionWindowElapsed('2099-01-01', noon)).toBe(false);
  });

  test('invalid date → never selected (NaN-safe, same as archive-memory)', () => {
    expect(retentionWindowElapsed('2026-13-45', noon)).toBe(false);
  });
});

describe('classify — corroborated prunes (RP-T1, RP-T4) and the KEEP safety net (RP-T2, RP-T3, RP-T5)', () => {
  test('RP-T1: old date log pruned + index tombstoned → RETENTION-PRUNE (the 2026-11-17 sweep shape)', () => {
    const project = prunedProject('corroborated', `memory/${OLD_DATE}.md`);
    const row = classify(project, `memory/${OLD_DATE}.md`, 'modified', { ...EMPTY_DELIVERY });
    expect(row.verdict).toBe('RETENTION-PRUNE');
    expect(row.basis).toContain('retention prune corroborated');
    expect(row.basis).toContain('outside the 7-day retention window');
    expect(row.basis).toContain('MEMORY.md no longer links it');
    expect(row.basis).toContain('discard-safe');
  });

  test('RP-T2: still-linked deletion (index keeps the link) → KEEP, unchanged', () => {
    const project = prunedProject('still-linked', `memory/${OLD_DATE}.md`, { keepLink: true });
    const row = classify(project, `memory/${OLD_DATE}.md`, 'modified', { ...EMPTY_DELIVERY });
    expect(row.verdict).toBe('KEEP');
    expect(row.basis).toBe('deleted in working tree — no file content to audit; restore or commit the deletion');
  });

  test('RP-T3a: date log inside the retention window → KEEP (far-future date, deterministically unelapsed)', () => {
    const project = prunedProject('in-window', 'memory/2099-01-01.md');
    const row = classify(project, 'memory/2099-01-01.md', 'modified', { ...EMPTY_DELIVERY });
    expect(row.verdict).toBe('KEEP');
    expect(row.basis).toBe('deleted in working tree — no file content to audit; restore or commit the deletion');
  });

  test('RP-T3b: unknown shapes → KEEP (subdirs, non-memory, non-.md)', () => {
    const project = prunedProject('unknown-shapes', `memory/${OLD_DATE}.md`);
    for (const rel of [
      'memory/archive/2026-09-01.md',
      'memory/skill-review/2026-09-06.md',
      'docs/gone.md',
      'memory/notes.txt',
    ]) {
      const row = classify(project, rel, 'modified', { ...EMPTY_DELIVERY });
      expect(row.verdict).toBe('KEEP');
    }
  });

  test('RP-T3c: the index itself deleted → KEEP (memory/MEMORY.md is never a prune candidate)', () => {
    // dedicated fixture: MEMORY.md committed at HEAD, deleted in the worktree.
    // (In the shared fixture the index is present-and-modified — a genuine
    // commit candidate, LOCAL-WORK — so the deleted shape needs its own repo.)
    const project = gitInit(join(dir, 'index-deleted'), { 'memory/MEMORY.md': '# Memory Index\n\n## Sessions\n\n| Date | Summary |\n|------|---------|\n' });
    rmSync(join(project, 'memory', 'MEMORY.md'));
    const row = classify(project, 'memory/MEMORY.md', 'modified', { ...EMPTY_DELIVERY });
    expect(row.verdict).toBe('KEEP');
    expect(row.basis).toBe('deleted in working tree — no file content to audit; restore or commit the deletion');
  });

  test('RP-T4a: non-date flat log with archive copy + de-linked index → RETENTION-PRUNE (meeting-file pattern)', () => {
    const project = prunedProject('non-date', 'memory/meeting-2026-09-01.md');
    // tombstone the meeting link in the index like tombstoneIndex does
    writeFileSync(
      join(project, 'memory', 'MEMORY.md'),
      INDEX_TOMBSTONED.replace(
        `| ${OLD_DATE} | session log |`,
        '| *(archived — local only)* | meeting notes |',
      ),
    );
    const row = classify(project, 'memory/meeting-2026-09-01.md', 'modified', { ...EMPTY_DELIVERY });
    expect(row.verdict).toBe('RETENTION-PRUNE');
    expect(row.basis).toContain('archive copy present in memory/archive/');
  });

  test('RP-T4b: non-date flat log with NO archive copy → KEEP (selection rule not corroborated)', () => {
    const project = prunedProject('non-date-no-archive', 'memory/meeting-2026-09-01.md', {
      archiveCopy: false,
    });
    writeFileSync(
      join(project, 'memory', 'MEMORY.md'),
      INDEX_TOMBSTONED.replace(
        `| ${OLD_DATE} | session log |`,
        '| *(archived — local only)* | meeting notes |',
      ),
    );
    const row = classify(project, 'memory/meeting-2026-09-01.md', 'modified', { ...EMPTY_DELIVERY });
    expect(row.verdict).toBe('KEEP');
    expect(row.basis).toBe('deleted in working tree — no file content to audit; restore or commit the deletion');
  });

  test('RP-T5: absent MEMORY.md → KEEP (fail-closed, no in-tree corroboration)', () => {
    const project = prunedProject('no-index', `memory/${OLD_DATE}.md`, { index: 'absent' });
    expect(existsSync(join(project, 'memory', 'MEMORY.md'))).toBe(false);
    const row = classify(project, `memory/${OLD_DATE}.md`, 'modified', { ...EMPTY_DELIVERY });
    expect(row.verdict).toBe('KEEP');
    expect(row.basis).toBe('deleted in working tree — no file content to audit; restore or commit the deletion');
  });
});

describe('retentionPruneCorroborated — helper-level pins', () => {
  test('corroborated date case returns the basis; null on still-linked', () => {
    const project = prunedProject('helper-ok', `memory/${OLD_DATE}.md`);
    expect(retentionPruneCorroborated(project, `memory/${OLD_DATE}.md`)).toContain('retention prune corroborated');
    const linked = prunedProject('helper-linked', `memory/${OLD_DATE}.md`, { keepLink: true });
    expect(retentionPruneCorroborated(linked, `memory/${OLD_DATE}.md`)).toBeNull();
  });

  test('a link to a DIFFERENT date does not block corroboration (exact-target match)', () => {
    // prunedProject keeps the [2026-10-02](2026-10-02.md) row in every
    // tombstoned fixture — corroboration for 2026-10-01 must ignore it
    const project = prunedProject('helper-other-date', `memory/${OLD_DATE}.md`);
    expect(retentionPruneCorroborated(project, `memory/${OLD_DATE}.md`)).not.toBeNull();
  });

  test('non-project dir (missing index) → null, never a throw', () => {
    expect(retentionPruneCorroborated(join(dir, 'does-not-exist'), `memory/${OLD_DATE}.md`)).toBeNull();
  });
});
