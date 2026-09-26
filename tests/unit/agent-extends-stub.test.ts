/**
 * Unit tests for extends-stub detection (T-20260926-020c): the live L2 stub
 * format declares frontmatter `extends: ../../common/agents/<name>.md`
 * (first line `---`); the legacy `# @extends: l1/…` first-line comment form
 * must still be recognized. Both helpers ship the same detection contract.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { hasExtendsDeclaration } from '../../scripts/helpers/agent-promote.ts';
import {
  hasExtendsDeclaration as analyzerHasExtends,
  UNPINNED_EXTENDS,
} from '../../scripts/helpers/agent-similarity-analyzer.ts';

const FRONTMATTER_STUB = [
  '---',
  'extends: ../../common/agents/i18n-specialist.md',
  'name: i18n-specialist',
  '---',
  '',
  'Stub body.',
].join('\n');

const LEGACY_COMMENT_STUB = '# @extends: l1/i18n-specialist@1.0.0\n\nStub body.';

const STANDALONE = ['---', 'name: custom-agent', '---', '', 'Full body.'].join('\n');

describe.each([
  ['agent-promote', hasExtendsDeclaration],
  ['agent-similarity-analyzer', analyzerHasExtends],
])('hasExtendsDeclaration — %s', (_name, fn) => {
  test('frontmatter extends stub (live format) → true', () => {
    expect(fn(FRONTMATTER_STUB)).toBe(true);
  });

  test('legacy # @extends comment → true', () => {
    expect(fn(LEGACY_COMMENT_STUB)).toBe(true);
  });

  test('standalone frontmatter agent without extends → false', () => {
    expect(fn(STANDALONE)).toBe(false);
  });

  test('plain body without frontmatter → false', () => {
    expect(fn('# Title\n\nBody text.')).toBe(false);
  });

  test('body-level "extends:" outside frontmatter does NOT count', () => {
    expect(fn('# Title\n\nUse extends: nowhere\n')).toBe(false);
  });

  test('CRLF frontmatter form → true', () => {
    expect(fn(FRONTMATTER_STUB.replace(/\n/g, '\r\n'))).toBe(true);
  });
});

describe('UNPINNED_EXTENDS marker', () => {
  test('is the documented unpinned marker string', () => {
    expect(UNPINNED_EXTENDS).toBe('(unpinned)');
  });
});
