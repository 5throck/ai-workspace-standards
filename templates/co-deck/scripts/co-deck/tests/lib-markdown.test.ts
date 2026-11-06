// @version 1.0.0
// lib-markdown.test.ts — pin markdown inline-run helpers for the PDF renderer
// (U-20261105-005 item 6b): `**bold**` segments split into runs and wrap
// word-by-word with weight-aware measurement.
//
// Run: bun test scripts/co-deck/scripts/co-deck/tests/lib-markdown.test.ts

import { describe, expect, test } from 'bun:test';
import { splitMarkdownRuns, markdownPlain, wrapMarkdownWords } from '../lib/markdown';

describe('splitMarkdownRuns', () => {
  test('splits on ** markers, marker-free runs', () => {
    expect(splitMarkdownRuns('a **bold** b')).toEqual([
      { text: 'a ', bold: false }, { text: 'bold', bold: true }, { text: ' b', bold: false },
    ]);
  });
  test('plain text is one regular run; empty produces no runs', () => {
    expect(splitMarkdownRuns('plain')).toEqual([{ text: 'plain', bold: false }]);
    expect(splitMarkdownRuns('')).toEqual([]);
  });
  test('markdownPlain strips markers', () => {
    expect(markdownPlain('x **y** z')).toBe('x y z');
  });
});

describe('wrapMarkdownWords', () => {
  // monospace-ish measure: 1 unit per char, bold words count double
  const measure = (w: string, bold: boolean) => w.length * (bold ? 2 : 1);

  test('wraps at width, preserving bold flags per word', () => {
    const lines = wrapMarkdownWords('aa **BB** cc', measure, 8);
    expect(lines).toEqual([
      [{ word: 'aa ', bold: false }, { word: 'BB ', bold: true }],
      [{ word: 'cc', bold: false }],
    ]);
  });

  test('explicit \\n forces line breaks', () => {
    const lines = wrapMarkdownWords('one\ntwo', measure, 100);
    expect(lines.length).toBe(2);
    expect(lines[0][0].word).toBe('one');
    expect(lines[1][0].word).toBe('two');
  });

  test('long single word stays on its own line', () => {
    const lines = wrapMarkdownWords('**LONGWORD**', measure, 4);
    expect(lines.length).toBe(1);
    expect(lines[0]).toEqual([{ word: 'LONGWORD', bold: true }]);
  });
});
