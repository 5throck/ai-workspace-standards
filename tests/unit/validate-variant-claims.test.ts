/**
 * Unit tests for validate-variant-claims.ts calibration-sensitive parsers
 * (T-20261006-006): the pure helpers behind the claim battery. The 1.0.0→1.4.0
 * hardening wave recalibrated these repeatedly with no regression pin; these
 * tests are that pin.
 *
 * The fs-bound check functions (roster walks, manifest reads) remain covered
 * by the live variant battery; the CI wiring asked for in the ticket is
 * deliberately NOT in this change (test.yml edits need explicit CI-change
 * approval per workspace §7 Security Boundaries).
 *
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import {
  splitMdRow,
  markerTableNames,
  setDiff,
  extractBareImports,
  isBuiltin,
  lineOf,
} from '../../scripts/validate-variant-claims.ts';

describe('splitMdRow (table-cell parser)', () => {
  test('splits a plain markdown row and trims cells', () => {
    expect(splitMdRow('| `agent-a` | High | 1 |')).toEqual(['`agent-a`', 'High', '1']);
  });
  test('a row ending without the trailing pipe still parses', () => {
    expect(splitMdRow('  | a | b ')).toEqual(['a', 'b']);
  });
  test('escaped pipes inside cells are NOT cell separators (known parser shape)', () => {
    // the parser is a plain split — this test PINS that behavior so a
    // calibration change to escape-awareness is deliberate, not accidental
    expect(splitMdRow('| a \\| b | c |').length).toBe(3);
  });
});

describe('markerTableNames (managed-block table extraction)', () => {
  const md = [
    'preamble',
    '<!-- RACI:START',
    '| name | accountable |',
    '|------|-------------|',
    '| `task-a` | pm |',
    '| `task-b` | pm |',
    '<!-- RACI:END -->',
    '| `outside` | nobody |',
  ].join('\n');

  test('extracts only data rows inside the marker block', () => {
    expect(markerTableNames(md, 'RACI')).toEqual(['task-a', 'task-b']);
  });
  test('header and separator rows are skipped', () => {
    const withHeader = markerTableNames(md, 'RACI');
    expect(withHeader).not.toContain('name');
  });
  test('absent or inverted markers yield an empty list (skip arm)', () => {
    expect(markerTableNames('no markers here', 'RACI')).toEqual([]);
    expect(markerTableNames('<!-- RACI:END -->\n<!-- RACI:START -->', 'RACI')).toEqual([]);
  });
});

describe('setDiff (missing/extra attribution)', () => {
  test('symmetric difference attribution', () => {
    expect(setDiff(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual({
      missing: ['a'],
      extra: ['d'],
    });
  });
  test('empty actual = everything declared is extra', () => {
    expect(setDiff([], ['x'])).toEqual({ missing: [], extra: ['x'] });
  });
});

describe('extractBareImports (claim-source scanner)', () => {
  test('finds bare module specifiers with line numbers', () => {
    const src = "import { x } from './helpers/foo.ts';\nconst y = 1;\nimport { z } from \"../lib/bar.mjs\";\n";
    const found = extractBareImports(src);
    expect(found).toEqual([
      { spec: './helpers/foo.ts', line: 1 },
      { spec: '../lib/bar.mjs', line: 3 },
    ]);
  });
  test('line numbers are 1-based and count every line', () => {
    const src = '\n\nimport { q } from "./a.ts";\n';
    expect(extractBareImports(src)[0]?.line).toBe(3);
  });
});

describe('isBuiltin', () => {
  test('node builtins are recognized', () => {
    expect(isBuiltin('node:fs')).toBe(true);
    expect(isBuiltin('path')).toBe(true);
  });
  test('relative and package imports are not builtins', () => {
    expect(isBuiltin('./x.ts')).toBe(false);
    expect(isBuiltin('js-yaml')).toBe(false);
  });
});

describe('lineOf (needle locator)', () => {
  test('returns the 1-based line containing the needle', () => {
    expect(lineOf('a\nb\nc-d\n', 'c-d')).toBe(3);
  });
  test('null when the needle is absent', () => {
    expect(lineOf('a\nb\n', 'zzz')).toBeUndefined();
  });
});
