/**
 * Unit tests for scripts/helpers/ignored-tooling.ts (T-20261011-014):
 * selectIgnoredToolingArtifacts picks machine-local tooling artifacts out of a
 * `git ls-files --others --ignored --exclude-standard` listing.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { selectIgnoredToolingArtifacts } from '../../scripts/helpers/ignored-tooling.ts';

describe('selectIgnoredToolingArtifacts (T-20261011-014)', () => {
  test('keeps extensionless ignored files (likely executables, e.g. vsp)', () => {
    expect(selectIgnoredToolingArtifacts(['vsp', 'bin/tools/runner'])).toEqual(['vsp', 'bin/tools/runner']);
  });

  test('keeps binary-ish extensions', () => {
    expect(selectIgnoredToolingArtifacts(['tool.bin', 'driver.dll', 'lib.so', 'app.dylib', 'setup.exe', 'core.wasm']))
      .toEqual(['tool.bin', 'driver.dll', 'lib.so', 'app.dylib', 'setup.exe', 'core.wasm']);
  });

  test('drops dependency/cache/build trees even for extensionless entries', () => {
    expect(selectIgnoredToolingArtifacts([
      'node_modules/.bin/tsc',
      '.venv/bin/python',
      '__pycache__/x',
      '.cache/yarn/v6/file',
      'dist/server',
      'build/out',
      'vsp',
    ])).toEqual(['vsp']);
  });

  test('drops text-y ignored files (logs, local notes, editor droppings)', () => {
    expect(selectIgnoredToolingArtifacts(['debug.log', 'notes.md', 'local.yaml', '.DS_Store', 'Thumbs.db']))
      .toEqual([]);
  });

  test('trims whitespace and drops blank lines', () => {
    expect(selectIgnoredToolingArtifacts(['', '  vsp  ', '   '])).toEqual(['vsp']);
  });
});
