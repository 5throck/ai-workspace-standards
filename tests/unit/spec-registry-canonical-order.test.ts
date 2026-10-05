/**
 * Tests for the spec-registry canonical-order mechanism (T-20261005-002,
 * spec docs/designs/2026-10-05-spec-registry-canonical-order-design.md).
 *
 * Every concurrent registration used to append at the shared array tail, so
 * simultaneous PRs registering different design docs conflicted
 * deterministically (5 hand-splices on 2026-10-05 alone). The fix: insert at
 * the content-derived position (id ascending), canonicalize the array on every
 * save, and fail out-of-band non-canonical files at the audit gate.
 *
 * Pins:
 * 1. insertSpecSorted places entries mid-array, at the head, and at the tail.
 * 2. canonicalOrderViolation returns null for sorted input and names the first
 *    offending pair otherwise.
 * 3. THE CONCURRENT-WRITER PIN: two writers inserting different ids from the
 *    same base land in DIFFERENT gaps — the git line-merge stays clean.
 * 4. Same-gap residual: two adjacent ids land in one gap (the loser rebases;
 *    the replay is stable — documented in the design, not silently ignored).
 */

import { describe, test, expect } from 'bun:test';
import { insertSpecSorted, canonicalOrderViolation } from '../../scripts/spec-register.ts';

const entry = (id: string) => ({
  id,
  title: id,
  file: `docs/designs/${id}.md`,
  status: 'implemented' as const,
  source: 'manual' as const,
  created: '2026-10-05',
  last_updated: '2026-10-05',
});

describe('insertSpecSorted', () => {
  test('inserts mid-array at the id boundary', () => {
    const specs = [entry('a'), entry('c'), entry('e')];
    insertSpecSorted(specs, entry('b'));
    expect(specs.map(s => s.id)).toEqual(['a', 'b', 'c', 'e']);
  });

  test('appends at the tail when the id is the largest', () => {
    const specs = [entry('a'), entry('c')];
    insertSpecSorted(specs, entry('z'));
    expect(specs.map(s => s.id)).toEqual(['a', 'c', 'z']);
  });

  test('prepends at the head when the id is the smallest', () => {
    const specs = [entry('c'), entry('e')];
    insertSpecSorted(specs, entry('a'));
    expect(specs.map(s => s.id)).toEqual(['a', 'c', 'e']);
  });
});

describe('canonicalOrderViolation', () => {
  test('returns null for sorted input', () => {
    expect(canonicalOrderViolation([entry('a'), entry('b'), entry('c')])).toBeNull();
  });

  test('names the first offending pair for unsorted input', () => {
    const msg = canonicalOrderViolation([entry('a'), entry('z'), entry('m')]);
    expect(msg).toContain('"m"');
    expect(msg).toContain('"z"');
  });
});

describe('concurrent-writer merge model', () => {
  test('THE PIN: two writers land in different gaps of the same base', () => {
    const baseIds = ['2026-10-01-base-a', '2026-10-05-base-e'];
    const base = baseIds.map(entry);

    // Each writer starts from fresh copies of the same committed base.
    const writerA = base.map(s => ({ ...s }));
    insertSpecSorted(writerA, entry('2026-10-02-alpha'));

    const writerB = base.map(s => ({ ...s }));
    insertSpecSorted(writerB, entry('2026-10-08-beta'));

    const aIds = writerA.map(s => s.id);
    const bIds = writerB.map(s => s.id);

    // Different insertion gaps, separated by unchanged base entries → git
    // merges the two JSON edits cleanly (the tail append collided on BOTH).
    expect(aIds.indexOf('2026-10-02-alpha')).not.toBe(bIds.indexOf('2026-10-08-beta'));
    expect(aIds).toEqual(['2026-10-01-base-a', '2026-10-02-alpha', '2026-10-05-base-e']);
    expect(bIds).toEqual(['2026-10-01-base-a', '2026-10-05-base-e', '2026-10-08-beta']);
  });

  test('same-gap residual: adjacent ids share a gap but sort deterministically', () => {
    const a = [entry('a'), entry('c')];
    const b = [entry('a'), entry('c')];
    insertSpecSorted(a, entry('b'));
    insertSpecSorted(b, entry('b2'));
    // Both writers insert between a and c (same gap) — a simultaneous push
    // conflicts at line level and the loser rebases; the replay is stable.
    insertSpecSorted(a, entry('b2'));
    expect(a.map(s => s.id)).toEqual(['a', 'b', 'b2', 'c']);
    expect(b.map(s => s.id)).toEqual(['a', 'b2', 'c']);
  });
});
