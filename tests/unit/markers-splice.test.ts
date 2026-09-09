#!/usr/bin/env bun
// @version 1.0.0
// markers-splice.test.ts — applyIntentionalDuplicateRewrites bottom-up splice
//
// First direct coverage of the --marker-rewrite splice path (design
// 2026-09-10-marker-hardening-followup-design, D2): two stale markers in one
// file whose replacement regions have DIFFERENT line counts than the regions
// they replace. The rewrites arrive in ASCENDING lineIndex order to prove the
// helper's internal descending (bottom-up) sort — an earlier splice must never
// shift a later rewrite's scan-time index.

import { test, expect, describe } from 'bun:test';
import { applyIntentionalDuplicateRewrites } from '../../scripts/helpers/markers.ts';

/** Build a 30-line fixture: marker lines at indices 4 and 19 (lines 5, 20). */
function buildFixture(): string[] {
  const lines: string[] = [];
  for (let i = 0; i < 30; i++) {
    if (i === 4) {
      lines.push('<!-- intentional-duplicate: workspace standards §3; source: docs/constitution/03-pr-workflow.md; hash: aaaaaaaa -->');
    } else if (i === 19) {
      lines.push('<!-- intentional-duplicate: workspace standards §8; source: docs/constitution/08-coding-guidelines.md; hash: bbbbbbbb -->');
    } else {
      lines.push(`filler line ${i}`);
    }
  }
  return lines;
}

describe('applyIntentionalDuplicateRewrites', () => {
  test('two rewrites with differing line counts, given in ASCENDING order', () => {
    const input = buildFixture();
    const snapshot = [...input];

    // Region below marker 1 (indices 5-18, 14 lines) -> 6 lines.
    const section1 = Array.from({ length: 6 }, (_, i) => `NEW-A-${i}`);
    // Region below marker 2 (indices 20-29, 10 lines) -> 15 lines.
    const section2 = Array.from({ length: 15 }, (_, i) => `NEW-B-${i}`);

    // Ascending order on purpose: the helper must sort internally.
    const result = applyIntentionalDuplicateRewrites(input, [
      { lineIndex: 4, newSectionLines: section1, newHash: '11111111' },
      { lineIndex: 19, newSectionLines: section2, newHash: '22222222' },
    ]);

    // 30 - 14 + 6 - 10 + 15 = 27
    expect(result).toHaveLength(27);

    // Content above marker 1 byte-identical (first rewrite shifted everything below it).
    expect(result.slice(0, 4)).toEqual(input.slice(0, 4));

    // Marker 1 still at index 4, hash updated.
    expect(result[4]).toContain('workspace standards §3');
    expect(result[4]).toContain('hash: 11111111');
    expect(result[4]).not.toContain('aaaaaaaa');

    // Replacement block 1 at exactly indices 5-10.
    expect(result.slice(5, 11)).toEqual(section1);

    // Marker 2 shifted 19 -> 11 (19 - 14 + 6), hash updated — the core
    // stale-index assertion: processing rewrite 2 after rewrite 1's length
    // change must still land on the right marker line.
    expect(result[11]).toContain('workspace standards §8');
    expect(result[11]).toContain('hash: 22222222');
    expect(result[11]).not.toContain('bbbbbbbb');

    // Replacement block 2 at exactly indices 12-26.
    expect(result.slice(12, 27)).toEqual(section2);

    // No stray filler from either replaced region survives.
    expect(result.join('\n')).not.toMatch(/filler line (?:[5-9]|1\d|2\d)\b/);

    // Input array not mutated.
    expect(input).toEqual(snapshot);
  });

  test('empty rewrites return content equal to input without mutating it', () => {
    const input = buildFixture();
    const snapshot = [...input];

    const result = applyIntentionalDuplicateRewrites(input, []);

    expect(result).toEqual(input);
    expect(result).not.toBe(input); // new array, not the same reference
    expect(input).toEqual(snapshot);
  });
});
