#!/usr/bin/env bun
/**
 * Unit tests: audit shell-injection scan skips comment lines (DEC-20261106-03)
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { isSourceCommentLine, sourceShellInjectionPatterns } from '../../scripts/helpers/security-validator.ts';

function firstMatchIndex(content: string): number {
  const p = sourceShellInjectionPatterns[0].pattern;
  p.lastIndex = 0;
  const m = [...content.matchAll(p)][0];
  return m ? (m.index ?? 0) : -1;
}

const COMPOUND = "$`git show ${'HEAD:' + rel}`";

describe('isSourceCommentLine', () => {
  test('flags // comment lines', () => {
    const src = `// example: ${COMPOUND}\nconst a = 1;`;
    const idx = firstMatchIndex(src);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(isSourceCommentLine(src, idx)).toBe(true);
  });
  test('flags * and /* comment lines', () => {
    for (const lead of [' * ', '/* ', '   * ']) {
      const src = `x\n${lead}${COMPOUND}\n`;
      expect(isSourceCommentLine(src, firstMatchIndex(src))).toBe(true);
    }
  });
  test('does not flag real code lines', () => {
    const src = `const r = await ${COMPOUND}.quiet();\n`;
    const idx = firstMatchIndex(src);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(isSourceCommentLine(src, idx)).toBe(false);
  });
  test('does not flag code after a prior comment line', () => {
    const src = `// note\nconst r = await ${COMPOUND};\n`;
    expect(isSourceCommentLine(src, firstMatchIndex(src))).toBe(false);
  });
});
