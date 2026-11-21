/**
 * Asserts the package.json scripts emitted by scaffold-handbook.ts match each
 * script's real CLI (extract-copycode takes a positional docs root).
 *
 * @version 1.0.0
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCAFFOLD = resolve(import.meta.dir, '../../templates/common/scripts/handbook/scaffold-handbook.ts');

let proj: string;

beforeEach(() => {
  proj = mkdtempSync(join(tmpdir(), 'scaffold-hb-'));
});

afterEach(() => {
  rmSync(proj, { recursive: true, force: true });
});

describe('scaffold-handbook package.json scripts', () => {
  test('extract-copycode uses a positional docs root and runs cleanly', () => {
    const r = Bun.spawnSync(['bun', 'run', SCAFFOLD, '--project', proj, '--output', 'handbook', '--lang', 'en']);
    expect(r.exitCode).toBe(0);
    const root = join(proj, 'handbook');
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
    expect(pkg.scripts['extract-copycode']).toBe('bun run scripts/extract-copycode.ts docs');
    const run = Bun.spawnSync(['bun', 'run', 'scripts/extract-copycode.ts', 'docs'], { cwd: root });
    expect(run.exitCode).toBe(0);
  });

  test('check-generated-content is scaffolded and wired', () => {
    Bun.spawnSync(['bun', 'run', SCAFFOLD, '--project', proj, '--output', 'handbook', '--lang', 'en']);
    const root = join(proj, 'handbook');
    expect(existsSync(join(root, 'scripts', 'check-generated-content.ts'))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
    expect(pkg.scripts['check-generated-content']).toBe('bun run scripts/check-generated-content.ts --docs-dir docs');
  });
});
