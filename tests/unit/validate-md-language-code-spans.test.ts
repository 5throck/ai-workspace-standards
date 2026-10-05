/**
 * Tests for the validate-md-language.ts code-span stripper (T-20261005-004,
 * spec docs/designs/2026-10-05-scripts-hygiene-batch-design.md).
 *
 * The single-backtick inline-code stripper cannot pair CommonMark
 * double-backtick delimiters, so a `` `x` `` span left stray backtick runs
 * whose global pairing flipped for the rest of the file — observed 2026-10-05
 * as a language-gate false positive on an English-only CHANGELOG entry while
 * older entries keep Korean intentionally wrapped in single-backtick inline
 * code. The fix consumes multi-backtick spans lazily BEFORE the
 * single-backtick pass.
 *
 * Pins:
 * 1. stripCodeForLanguageScan removes a double-backtick span containing Korean.
 * 2. analyzeFile passes (null) a CHANGELOG-style fixture whose only Korean
 *    sits inside double-backtick inline code.
 * 3. analyzeFile still fails Korean in plain prose (stage 4, no declaration).
 * 4. THE BUG: double-backtick markup in one entry + older entries whose Korean
 *    lives in single-backtick spans → passes (pairing parity no longer flips).
 */

import { describe, test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeFile, stripCodeForLanguageScan } from '../../scripts/validate-md-language.ts';

function fixtureDir(): string {
  return mkdtempSync(join(tmpdir(), 'validate-md-language-spans-'));
}

describe('stripCodeForLanguageScan', () => {
  test('removes double-backtick spans containing Korean', () => {
    const content = 'English prose with `` `순우리말` `` inline markup and more prose.';
    expect(/[가-힯]/.test(stripCodeForLanguageScan(content))).toBe(false);
  });

  test('removes single-backtick spans and fenced blocks as before', () => {
    const content = 'keep `한국어토큰` hidden and\n\n```md\n한국어 펜스\n```\nvisible text';
    const stripped = stripCodeForLanguageScan(content);
    expect(/[가-힯]/.test(stripped)).toBe(false);
  });
});

describe('analyzeFile code-span judgment', () => {
  test('passes when the only Korean sits inside double-backtick inline code', () => {
    const dir = fixtureDir();
    const p = join(dir, 'changelog-style.md');
    writeFileSync(p, [
      '# Changelog',
      '',
      '- **[2026-10-05]**: fix: an English-only entry using `` `교재 업데이트 등` `` style markup.',
      '',
    ].join('\n'), 'utf-8');
    expect(analyzeFile(p)).toBeNull();
  });

  test('still fails Korean in plain prose without a lang declaration', () => {
    const dir = fixtureDir();
    const p = join(dir, 'plain-korean.md');
    writeFileSync(p, '# Doc\n\n한국어 본문은 선언 없이 허용되지 않습니다.\n', 'utf-8');
    const violation = analyzeFile(p);
    expect(violation).not.toBeNull();
    expect(violation!.reason).toContain('lang: ko');
  });

  test('THE BUG: double-backtick markup plus Korean in single-backtick spans passes', () => {
    const dir = fixtureDir();
    const p = join(dir, 'changelog-mixed.md');
    writeFileSync(p, [
      '# Changelog',
      '',
      '- **[2026-10-05]**: fix: new entry with `` `인라인 코드` `` markup and plain English.',
      '- **[2026-09-20]**: docs(skills): older entry with `한국어 트리거` tokens in single-backtick spans.',
      '',
    ].join('\n'), 'utf-8');
    expect(analyzeFile(p)).toBeNull();
  });
});
