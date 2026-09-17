/**
 * Tests for scripts/lint-instructions.ts — the ADR-0079 advisory
 * sentence-length probe (ticket T-20260917-011, design
 * docs/designs/2026-09-17-instruction-lint-probe-design.md).
 *
 * Pins:
 * 1. Requirement-section detection: heading text match, level bounds,
 *    section extent ends at the next same-or-higher heading.
 * 2. Word counting: list markers and inline code stripped.
 * 3. Lint: 25-word limit fires exactly once on a 30-word sentence;
 *    fenced code blocks and table lines are skipped; clean text is clean.
 * 4. Sentence splitting keeps one instruction per token run.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  countWords,
  extractRequirementSections,
  isRequirementHeading,
  lintDocument,
  splitSentences,
} from '../../scripts/lint-instructions.ts';

const LONG = 'Per-file absence policy: a variant AGENTS.md must stay present in every variant and the parity checker must keep failing whenever a variant copy drifts from the common source so that fleet upgrades can never silently lose governance content again.'; // 39 words

describe('isRequirementHeading', () => {
  test('matches requirement/acceptance headings at levels 2-4', () => {
    expect(isRequirementHeading('## Requirements and acceptance criteria')).toBe(true);
    expect(isRequirementHeading('### Acceptance criteria')).toBe(true);
    expect(isRequirementHeading('#### 3. Requirements')).toBe(true);
  });

  test('rejects other headings, level 1, and prose', () => {
    expect(isRequirementHeading('# Requirements')).toBe(false); // level 1: document title
    expect(isRequirementHeading('## Chosen approach')).toBe(false);
    expect(isRequirementHeading('Requirements are checked here.')).toBe(false);
  });
});

describe('extractRequirementSections', () => {
  test('section extends until the next same-or-higher heading', () => {
    const doc = [
      '# Title',
      '## 3. Requirements and acceptance criteria',
      '1. Keep the guard hard-fail.',
      LONG,
      '## 4. Chosen approach', // same-level boundary ends the section
      'Nothing here is scanned.',
    ].join('\n');
    const sections = extractRequirementSections(doc);
    expect(sections.length).toBe(1);
    expect(sections[0].startLine).toBe(2); // 0-based line after the heading
    expect(sections[0].endLine).toBe(4); // exclusive: the ### 3.1 line
  });

  test('deeper headings stay inside the section', () => {
    const doc = ['## Requirements', 'A.', '#### sub', 'B.'].join('\n');
    const sections = extractRequirementSections(doc);
    expect(sections.length).toBe(1);
    expect(sections[0].endLine).toBe(4); // to end of document
  });
});

describe('countWords', () => {
  test('strips list markers and counts inline code as one word', () => {
    expect(countWords('- Keep the root guard hard-fail.')).toBe(5);
    expect(countWords('1. Run `bun scripts/audit.ts` now.')).toBe(4);
    expect(countWords('')).toBe(0);
  });
});

describe('splitSentences', () => {
  test('splits on terminators at token ends', () => {
    expect(splitSentences('Keep the guard. Give it no bypass flag.').length).toBe(2);
    expect(splitSentences('One instruction only')).toEqual(['One instruction only']);
  });
});

describe('lintDocument', () => {
  const withSection = (body: string[]): string =>
    ['# Design', '## 3. Requirements and acceptance criteria', ...body].join('\n');

  test('flags one 30-word sentence with its 1-based line number', () => {
    const short = 'Keep the root guard hard-fail. Give it no bypass flag.';
    const findings = lintDocument(withSection([short, LONG]));
    expect(findings.length).toBe(1);
    expect(findings[0].line).toBe(4); // heading is line 2; LONG is line 4 (1-based)
    expect(findings[0].words).toBe(39);
  });

  test('skips fenced code blocks and table lines', () => {
    const doc = withSection(['```', LONG, '```', `| col |`, `|-----|`, `| ${LONG} |`]);
    expect(lintDocument(doc)).toEqual([]);
  });

  test('clean short sentences produce no findings', () => {
    const doc = withSection([
      '1. Canonicalize the target before the guards.',
      '2. Require explicit confirmation outside Projects.',
    ]);
    expect(lintDocument(doc)).toEqual([]);
  });

  test('text outside requirement sections is never scanned', () => {
    const doc = ['## Chosen approach', LONG].join('\n');
    expect(lintDocument(doc)).toEqual([]);
  });
});
