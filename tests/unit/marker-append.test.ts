#!/usr/bin/env bun
// @version 1.0.0
// marker-append.test.ts — appendMissingZones() pure-helper coverage
//
// Spec: docs/designs/2026-09-25-propagation-engine-batch-design.md (T-20260924-006).
// Covers AC-2 (anchor placement + fail-safe skip), AC-3 (k-th ↔ k-th pairing
// kept, unmatched tail appended in source order), AC-4 (idempotency),
// AC-5 (CRLF target composition, no \r\r\n), anchor-is-LAST-zone semantics,
// and the anchorless end-of-file default. The helper is import-safe and pure
// (design §6-D9), so every case runs against in-memory fixtures.

import { test, expect, describe } from 'bun:test';
import { appendMissingZones, extractMarkerZones } from '../../scripts/helpers/markers.ts';
import type { MarkerZone } from '../../scripts/helpers/markers.ts';

const START = (m: string) => `<!-- ${m}:START -->`;
const END = (m: string) => `<!-- ${m}:END -->`;

/** Count the zones of `marker` in `content` (the helper reads only the count). */
function countZones(content: string, marker: string): MarkerZone[] {
  const n = extractMarkerZones(content, marker).length;
  return Array.from({ length: n }, (_, i) => ({
    marker,
    startLine: i + 1,
    endLine: i + 1,
    fullBlock: '',
    innerContent: '',
  }));
}

/** Two source sections for COMMON-TAIL (post-scrub fullBlocks, LF). */
function twoSourceSections(): string {
  return [
    'Source',
    START('COMMON-TAIL'),
    '### Section One',
    'first body',
    END('COMMON-TAIL'),
    START('COMMON-TAIL'),
    '### Section Two',
    'second body',
    END('COMMON-TAIL'),
    '',
  ].join('\n');
}

describe('appendMissingZones — anchor placement (AC-2)', () => {
  test('inserts after the anchor zone END line when the anchor is present', () => {
    const target = [
      '# Target',
      START('COMMON-ANCHOR'),
      'anchor body',
      END('COMMON-ANCHOR'),
      'trailing line',
      '',
    ].join('\n');
    const sections = extractMarkerZones(twoSourceSections(), 'COMMON-TAIL');

    const result = appendMissingZones(target, countZones(target, 'COMMON-TAIL'), sections, 'COMMON-TAIL', { anchorMarker: 'COMMON-ANCHOR' });

    expect(result.placement).toBe('after-anchor');
    expect(result.appended).toBe(2);
    const lines = result.content.split('\n');
    // Anchor END sits at index 3; the appended block must start at index 4.
    expect(lines[3]).toBe(END('COMMON-ANCHOR'));
    expect(lines[4]).toBe(START('COMMON-TAIL'));
    expect(lines[7]).toBe(END('COMMON-TAIL'));
    expect(lines[8]).toBe(START('COMMON-TAIL'));
    expect(lines[8]).toContain('COMMON-TAIL');
    // Trailing (non-anchor) content survives below the block.
    expect(lines[12]).toBe('trailing line');
  });

  test('anchor resolves to the LAST zone of the anchor marker', () => {
    const target = [
      START('COMMON-ANCHOR'),
      'first anchor zone',
      END('COMMON-ANCHOR'),
      'between',
      START('COMMON-ANCHOR'),
      'second anchor zone',
      END('COMMON-ANCHOR'),
      '',
    ].join('\n');
    const sections = extractMarkerZones(twoSourceSections(), 'COMMON-TAIL');

    const result = appendMissingZones(target, [], sections, 'COMMON-TAIL', { anchorMarker: 'COMMON-ANCHOR' });

    expect(result.placement).toBe('after-anchor');
    const lines = result.content.split('\n');
    // Must insert after the SECOND anchor END (index 6), not the first (index 2).
    expect(lines[6]).toBe(END('COMMON-ANCHOR'));
    expect(lines[7]).toBe(START('COMMON-TAIL'));
    expect(lines[2]).toBe(END('COMMON-ANCHOR'));
    expect(lines[3]).toBe('between');
  });

  test('anchor missing → mutates nothing and reports no placement (fail-safe skip, no EOF fallback)', () => {
    const target = ['# Target', 'plain content', ''].join('\n');
    const sections = extractMarkerZones(twoSourceSections(), 'COMMON-TAIL');

    const result = appendMissingZones(target, [], sections, 'COMMON-TAIL', { anchorMarker: 'COMMON-ANCHOR' });

    expect(result.placement).toBe('none');
    expect(result.appended).toBe(0);
    expect(result.content).toBe(target);
  });

  test('anchor marker name is matched literally (no regex metacharacter leakage)', () => {
    const target = ['# Target', 'plain', ''].join('\n');
    const sections = extractMarkerZones(twoSourceSections(), 'COMMON-TAIL');

    // A ')' in the anchor name must not throw or match accidentally.
    const result = appendMissingZones(target, [], sections, 'COMMON-TAIL', { anchorMarker: 'COMMON-A)' });
    expect(result.placement).toBe('none');
    expect(result.content).toBe(target);
  });
});

describe('appendMissingZones — pairing and tail (AC-3, R7)', () => {
  test('existing zone keeps its content; sections k+1..n append in source order as one block', () => {
    const existingBlock = [START('COMMON-TAIL'), '### Section One', 'STALE body', END('COMMON-TAIL')].join('\n');
    const target = [
      '# Target',
      START('COMMON-ANCHOR'),
      'anchor',
      END('COMMON-ANCHOR'),
      existingBlock,
      '',
    ].join('\n');
    const sections = extractMarkerZones(twoSourceSections(), 'COMMON-TAIL');

    const result = appendMissingZones(target, countZones(target, 'COMMON-TAIL'), sections, 'COMMON-TAIL', { anchorMarker: 'COMMON-ANCHOR' });

    expect(result.appended).toBe(1);
    // The existing (stale) zone is byte-unchanged — pairing stays k-th ↔ k-th;
    // rewriting it is the caller's separate concern.
    expect(result.content).toContain(existingBlock);
    // Placement is anchor-driven: the appended tail (section TWO, index k=1)
    // lands directly after the anchor END, ahead of the existing zone.
    const lines = result.content.split('\n');
    const anchorEnd = lines.indexOf(END('COMMON-ANCHOR'));
    expect(lines[anchorEnd + 1]).toBe(START('COMMON-TAIL'));
    expect(lines[anchorEnd + 2]).toBe('### Section Two');
    expect(lines[anchorEnd + 3]).toBe('second body');
    // Contiguous: one block, no interleaved filler.
    expect(lines[anchorEnd + 4]).toBe(END('COMMON-TAIL'));
  });

  test('full bootstrap: zero existing zones appends all sections in source order', () => {
    const target = ['# Target', START('COMMON-ANCHOR'), 'a', END('COMMON-ANCHOR'), ''].join('\n');
    const sections = extractMarkerZones(twoSourceSections(), 'COMMON-TAIL');

    const result = appendMissingZones(target, [], sections, 'COMMON-TAIL', { anchorMarker: 'COMMON-ANCHOR' });

    expect(result.appended).toBe(2);
    const lines = result.content.split('\n');
    expect(lines[3]).toBe(END('COMMON-ANCHOR'));
    expect(lines[4]).toBe(START('COMMON-TAIL'));
    expect(lines[5]).toBe('### Section One');
    expect(lines[8]).toBe(START('COMMON-TAIL'));
    expect(lines[9]).toBe('### Section Two');
    expect(lines[11]).toBe(END('COMMON-TAIL'));
  });

  test('tail empty (existing >= source) → nothing appended, content unchanged', () => {
    const target = ['# Target', 'plain', ''].join('\n');
    const sections = extractMarkerZones(twoSourceSections(), 'COMMON-TAIL');
    const existing = Array.from({ length: 2 }, () => ({ marker: 'COMMON-TAIL', startLine: 1, endLine: 1, fullBlock: '', innerContent: '' }) as MarkerZone);

    const result = appendMissingZones(target, existing, sections, 'COMMON-TAIL', { anchorMarker: 'COMMON-ANCHOR' });

    expect(result.appended).toBe(0);
    expect(result.content).toBe(target);
  });
});

describe('appendMissingZones — idempotency (AC-4)', () => {
  test('running the append on its own output a second time appends nothing', () => {
    const target = ['# Target', START('COMMON-ANCHOR'), 'a', END('COMMON-ANCHOR'), ''].join('\n');
    const sections = extractMarkerZones(twoSourceSections(), 'COMMON-TAIL');

    const first = appendMissingZones(target, [], sections, 'COMMON-TAIL', { anchorMarker: 'COMMON-ANCHOR' });
    expect(first.appended).toBe(2);

    // Second run: the target now carries 2 zones of the marker → tail empty.
    const second = appendMissingZones(first.content, countZones(first.content, 'COMMON-TAIL'), sections, 'COMMON-TAIL', { anchorMarker: 'COMMON-ANCHOR' });
    expect(second.appended).toBe(0);
    expect(second.content).toBe(first.content);
  });
});

describe('appendMissingZones — end-of-file default (R4)', () => {
  test('no anchor field → inserts after the last non-empty line, preserving the trailing newline', () => {
    const target = '# Target\n\nbody\n';
    const sections = extractMarkerZones(twoSourceSections(), 'COMMON-TAIL');

    const result = appendMissingZones(target, [], sections, 'COMMON-TAIL');

    expect(result.placement).toBe('eof');
    expect(result.appended).toBe(2);
    expect(result.content).toBe('# Target\n\nbody\n' + [START('COMMON-TAIL'), '### Section One', 'first body', END('COMMON-TAIL'), START('COMMON-TAIL'), '### Section Two', 'second body', END('COMMON-TAIL')].join('\n') + '\n');
  });
});

describe('appendMissingZones — line-ending composition (AC-5, R8)', () => {
  test('CRLF target: appended content is LF-normalized by the helper, CRLF after the caller re-apply, never \\r\\r\\n', () => {
    const target = '# Target\r\n\r\n' + [START('COMMON-ANCHOR'), 'a', END('COMMON-ANCHOR')].join('\r\n') + '\r\n';
    const sections = extractMarkerZones(twoSourceSections(), 'COMMON-TAIL');

    const result = appendMissingZones(target, countZones(target, 'COMMON-TAIL'), sections, 'COMMON-TAIL', { anchorMarker: 'COMMON-ANCHOR' });
    // Helper output is LF-normalized (the engine's normalize-and-reapply path
    // takes it from here).
    expect(result.content).not.toContain('\r');

    // The engine's write-path composition: normalize to LF, re-apply CRLF.
    const written = result.content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    expect(written).toContain('\r\n');
    expect(written).not.toContain('\r\r\n');
    expect(written).toContain([START('COMMON-TAIL'), '### Section One', 'first body', END('COMMON-TAIL')].join('\r\n'));
  });
});
