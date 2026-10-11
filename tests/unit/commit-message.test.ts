/**
 * Unit tests for scripts/helpers/commit-message.ts (dev-sync step 1: weak caller
 * messages are replaced by a descriptive summary derived from the task-staged set).
 * U-20261008-001, spec docs/designs/2026-10-11-backlog-batch-2-design.md.
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { composeCommitMessage, deriveCommitMessage, isWeakCommitMessage } from '../../scripts/helpers/commit-message.ts';

describe('isWeakCommitMessage', () => {
  test('empty and whitespace-only messages are weak', () => {
    expect(isWeakCommitMessage('')).toBe(true);
    expect(isWeakCommitMessage('   ')).toBe(true);
  });

  test('bare fallback shapes are weak (U-20261008-001 repro cases)', () => {
    expect(isWeakCommitMessage('chore: update')).toBe(true);
    expect(isWeakCommitMessage('chore: upgrade template to 0.14.0')).toBe(true);
    expect(isWeakCommitMessage('chore: upgrade template to v1.2.3')).toBe(true);
    expect(isWeakCommitMessage('chore: resync template')).toBe(true);
    expect(isWeakCommitMessage('chore: sync template to 2.0')).toBe(true);
  });

  test('descriptive caller messages are kept', () => {
    expect(isWeakCommitMessage('fix(validators): tighten spec-check path matching')).toBe(false);
    expect(isWeakCommitMessage('docs(guides): add agent-shell-hardening guide')).toBe(false);
    expect(isWeakCommitMessage('chore: update the changelog and version rows')).toBe(false);
  });
});

describe('deriveCommitMessage', () => {
  test('falls back to chore: workspace sync with no classifiable paths', () => {
    expect(deriveCommitMessage([])).toBe('chore: workspace sync');
    expect(deriveCommitMessage(['scratch/foo.txt'])).toBe('chore: workspace sync (1 file)');
    expect(deriveCommitMessage(['scratch/a.txt', 'scratch/b.txt'])).toBe('chore: workspace sync (2 files)');
  });

  test('primary group picks type(scope) — scripts chore', () => {
    const msg = deriveCommitMessage(['scripts/dev-sync.ts', 'scripts/SCRIPTS.md', 'scripts/SCRIPTS.md.bak']);
    expect(msg).toMatch(/^chore\(scripts\): workspace sync \(\d+ files?\)$/);
    expect(msg.length).toBeLessThanOrEqual(72);
  });

  test('docs group maps to docs(docs), designs map to docs(spec)', () => {
    expect(deriveCommitMessage(['docs/guides/a.md', 'docs/guides/b.md'])).toMatch(/^docs\(docs\): workspace sync \(2 files\)$/);
    expect(deriveCommitMessage(['docs/designs/2026-10-11-backlog-batch-2-design.md'])).toBe(
      'docs(spec): workspace sync (spec 2026-10-11-backlog-batch-2, 1 file)',
    );
  });

  test('tickets group maps to chore(tickets)', () => {
    const msg = deriveCommitMessage(['tickets/governance/T-20261011-005.yaml']);
    expect(msg).toBe('chore(tickets): workspace sync (1 file)');
  });

  test('largest group wins; mixed set with designs cites the spec id while it fits', () => {
    const paths = [
      'scripts/dev-sync.ts',
      'scripts/dev-sync.ts.bak',
      'scripts/SCRIPTS.md',
      'docs/designs/2026-10-11-x-design.md',
      'tests/unit/commit-message.test.ts',
    ];
    const msg = deriveCommitMessage(paths);
    expect(msg).toBe('chore(scripts): workspace sync (spec 2026-10-11-x, 5 files)');
    expect(msg.length).toBeLessThanOrEqual(72);
  });

  test('spec citation is dropped when the 72-char budget does not allow it', () => {
    const paths = [
      'scripts/dev-sync.ts',
      'scripts/dev-sync.ts.bak',
      'scripts/SCRIPTS.md',
      'docs/designs/2026-10-11-backlog-batch-2-design.md',
      'tests/unit/commit-message.test.ts',
    ];
    // "chore(scripts): workspace sync (spec 2026-10-11-backlog-batch-2, 5 files)"
    // is 74 chars — over budget, so the citation drops and the note stays.
    const msg = deriveCommitMessage(paths);
    expect(msg).toBe('chore(scripts): workspace sync (5 files)');
    expect(msg.length).toBeLessThanOrEqual(72);
  });

  test('every derived message is conventional-commit shaped and ASCII', () => {
    for (const paths of [
      ['scripts/a.ts'],
      ['docs/b.md', 'tickets/c.yaml'],
      [],
      ['templates/common/x.md', 'skills/sync/SKILL.md', '.github/workflows/ci.yml'],
    ]) {
      const msg = deriveCommitMessage(paths);
      expect(msg.length).toBeLessThanOrEqual(72);
      expect(msg).toMatch(/^(docs|chore|test|ci)(\([a-z]+\))?: workspace sync/);
      expect(msg).toMatch(/^[\x20-\x7E]+$/);
    }
  });
});

describe('composeCommitMessage', () => {
  test('keeps descriptive caller messages verbatim', () => {
    const raw = 'fix(audit): exclude third-party generated skills from version checks';
    expect(composeCommitMessage(raw, ['scripts/audit.ts'])).toBe(raw);
  });

  test('replaces weak shapes with the derived summary', () => {
    expect(composeCommitMessage('chore: update', ['scripts/dev-sync.ts'])).toBe('chore(scripts): workspace sync (1 file)');
    expect(composeCommitMessage('chore: upgrade template to 0.14.0', ['docs/x.md'])).toBe('docs(docs): workspace sync (1 file)');
    expect(composeCommitMessage('', [])).toBe('chore: workspace sync');
  });
});
