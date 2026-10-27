/**
 * Tests for the validate-md-language.ts perimeter hardening (U-20261027-007).
 *
 * Three gaps pinned here:
 * (a) DEAD REGEX — `/^Hermes\.md$/` was case-sensitive and never matched the
 *     actual root file HERMES.md; the /i fix makes both spellings official.
 * (b) UN_SCANNED EN ORIGINALS — README.md / docs/README.md / docs/user-guide.md
 *     join officialPatterns, so Korean injected into an English original FAILS
 *     (same Hangul detector the KO side uses; the language-link line in
 *     README.md survives via the markdown-link stripper).
 * (c) DECLARATION-ONLY KO TWINS — README_ko.md / docs/README_ko.md /
 *     docs/user-guide_ko.md join officialPatterns so the suffix-locale gate
 *     (evaluateSuffixLocaleGate) actually ENFORCES the `lang:` declaration;
 *     missing/unknown declarations FAIL, the real files PASS.
 *
 * The module is import-safe since v1.16.0 (the module-level scan moved behind
 * import.meta.main — previously importing this module raced a full-workspace
 * scan that process.exit'ed the test runner).
 */

import { describe, test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  analyzeFile,
  evaluateSuffixLocaleGate,
  isOfficialDocument,
} from '../../scripts/validate-md-language.ts';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const realFile = (...parts: string[]) => join(REPO_ROOT, ...parts);

function fixtureDir(): string {
  return mkdtempSync(join(tmpdir(), 'validate-md-language-perimeter-'));
}

describe('isOfficialDocument — (a) HERMES.md regex is case-insensitive', () => {
  test('the actual root file HERMES.md (uppercase) is an official document', () => {
    expect(isOfficialDocument('HERMES.md')).toBe(true);
  });
  test('the legacy literal spelling Hermes.md still matches', () => {
    expect(isOfficialDocument('Hermes.md')).toBe(true);
  });
  test('sibling protected docs are unaffected', () => {
    expect(isOfficialDocument('CODEX.md')).toBe(true);
    expect(isOfficialDocument('CONSTITUTION.md')).toBe(true);
  });
});

describe('isOfficialDocument — (b) EN originals of the bilingual twins', () => {
  test('root README.md is scanned', () => {
    expect(isOfficialDocument('README.md')).toBe(true);
  });
  test('docs/README.md is scanned', () => {
    expect(isOfficialDocument('docs/README.md')).toBe(true);
  });
  test('docs/user-guide.md is scanned (pattern dormant where the file does not exist yet)', () => {
    expect(isOfficialDocument('docs/user-guide.md')).toBe(true);
  });
});

describe('isOfficialDocument — (c) KO twins join the suffix-locale declaration gate', () => {
  test('README_ko.md is official (gate applies)', () => {
    expect(isOfficialDocument('README_ko.md')).toBe(true);
  });
  test('docs/README_ko.md is official (gate applies)', () => {
    expect(isOfficialDocument('docs/README_ko.md')).toBe(true);
  });
  test('docs/user-guide_ko.md is official (gate applies)', () => {
    expect(isOfficialDocument('docs/user-guide_ko.md')).toBe(true);
  });
});

describe('analyzeFile — (b) Korean in an EN original fails', () => {
  test('Korean prose injected into a README.md fixture FAILS (stage 4, no declaration)', () => {
    const dir = fixtureDir();
    const p = join(dir, 'README.md');
    writeFileSync(p, [
      '# Project',
      '',
      'English intro sentence.',
      '',
      '이 문장은 선언 없이 들어간 한국어입니다.',
      '',
    ].join('\n'), 'utf-8');
    const violation = analyzeFile(p);
    expect(violation).not.toBeNull();
    expect(violation!.reason).toContain('without lang: ko declaration');
  });

  test('the REAL root README.md passes — the languages link line is stripped before detection', () => {
    // README.md line 6 embeds [한국어](README_ko.md); the markdown-link stripper
    // removes it, so the EN original is Hangul-free for the detector.
    expect(analyzeFile(realFile('README.md'))).toBeNull();
  });

  test('the real docs/README.md and HERMES.md contain no undeclared Korean', () => {
    expect(analyzeFile(realFile('docs', 'README.md'))).toBeNull();
    expect(analyzeFile(realFile('HERMES.md'))).toBeNull();
  });
});

describe('evaluateSuffixLocaleGate — (c) declaration gate on the KO twins', () => {
  test('the REAL root README_ko.md passes (declares lang: ko)', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const content = readFileSync(realFile('README_ko.md'), 'utf-8');
    expect(evaluateSuffixLocaleGate('README_ko.md', content)).toBeNull();
  });

  test('a KO twin WITHOUT a lang declaration FAILS with remediation text', () => {
    const violation = evaluateSuffixLocaleGate('docs/user-guide_ko.md', '# 가이드\n한국어 본문\n');
    expect(violation).not.toBeNull();
    expect(violation!.reason).toContain("add 'lang: ko'");
  });

  test('a KO twin declaring an UNKNOWN locale FAILS', () => {
    const violation = evaluateSuffixLocaleGate('README_ko.md', '---\nlang: xx\n---\n본문\n');
    expect(violation).not.toBeNull();
    expect(violation!.reason).toContain('unknown locale "xx"');
  });

  test('a KO twin declaring lang: ko (any frontmatter shape) PASSES the gate', () => {
    expect(evaluateSuffixLocaleGate('docs/README_ko.md', '---\nlang: ko\nlang_reason: source-material\n---\n본문\n')).toBeNull();
  });

  test('an unreadable file (content null) is treated as undeclared → FAIL', () => {
    const violation = evaluateSuffixLocaleGate('README_ko.md', null);
    expect(violation).not.toBeNull();
    expect(violation!.reason).toContain('without a lang declaration');
  });

  test('non-suffix files are outside the gate (null regardless of content)', () => {
    expect(evaluateSuffixLocaleGate('README.md', '아무 한국어\n')).toBeNull();
  });
});
