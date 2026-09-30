/**
 * Unit tests for the pm.md extends-pointer rewrite (T-20260930-037): the
 * template stub pointer `extends: ../../common/agents/pm.md` is relative to the
 * TEMPLATE tree. When a stub survives into a project (missingL1 scaffold, or the
 * upgrade-project MERGE create path), that string dangles — the pipeline never
 * delivers `common/` into a project. The only valid project pointer is
 * `extends: ../../../agents/pm.md`, which resolves to the workspace-root
 * agents/pm.md.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  rewritePmExtendsPointer,
  fixPmExtendsPointer,
} from '../../scripts/helpers/resolve-pm-stub.ts';

const DANGLING_STUB = [
  '---',
  'extends: ../../common/agents/pm.md',
  'name: pm',
  '---',
  'Stub body.'
].join('\n');

const FIXED_STUB = [
  '---',
  'extends: ../../../agents/pm.md',
  'name: pm',
  '---',
  'Stub body.'
].join('\n');

const I18N_STUB = [
  '---',
  'extends: ../../common/agents/i18n-specialist.md',
  'name: i18n-specialist',
  '---',
  'Stub body.'
].join('\n');

const STANDALONE = [
  '---',
  'name: pm',
  '---',
  'Full body.'
].join('\n');

describe('rewritePmExtendsPointer', () => {
  test('rewrites the dangling template-form pointer', () => {
    expect(rewritePmExtendsPointer(DANGLING_STUB)).toBe(FIXED_STUB);
  });

  test('is idempotent on the correct project form', () => {
    expect(rewritePmExtendsPointer(FIXED_STUB)).toBe(FIXED_STUB);
  });

  test('leaves the i18n-specialist template stub untouched', () => {
    expect(rewritePmExtendsPointer(I18N_STUB)).toBe(I18N_STUB);
  });

  test('leaves a standalone file without extends untouched', () => {
    expect(rewritePmExtendsPointer(STANDALONE)).toBe(STANDALONE);
  });

  test('accepts quoted values', () => {
    const quoted = DANGLING_STUB.replace(
      'extends: ../../common/agents/pm.md',
      "extends: '../../common/agents/pm.md'"
    );
    expect(rewritePmExtendsPointer(quoted)).toBe(FIXED_STUB);
  });
});

describe('fixPmExtendsPointer (in place)', () => {
  test('rewrites only when the dangling form is present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pm-extends-'));
    try {
      const danglingPath = join(dir, 'dangling.md');
      const fixedPath = join(dir, 'fixed.md');
      writeFileSync(danglingPath, DANGLING_STUB);
      writeFileSync(fixedPath, FIXED_STUB);
      expect(fixPmExtendsPointer(danglingPath)).toBe(true);
      expect(readFileSync(danglingPath, 'utf8')).toBe(FIXED_STUB);
      expect(fixPmExtendsPointer(fixedPath)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
