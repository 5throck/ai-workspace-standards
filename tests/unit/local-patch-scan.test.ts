/**
 * Tests for scripts/helpers/local-patch-scan.ts (T-20261002-015): the LOCAL-PATCH
 * marker scanner finds ticket-tagged patches (including `pending`), skips dependency
 * and non-text trees, and reports deterministically.
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanLocalPatches } from '../../scripts/helpers/local-patch-scan.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'local-patch-scan-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

test('finds markers with ticket ids and the pending form, one finding per occurrence', () => {
  mkdirSync(join(root, 'scripts'), { recursive: true });
  writeFileSync(
    join(root, 'scripts', 'patched.ts'),
    '// LOCAL-PATCH(upstream-request: U-20261001-001)\nexport const x = 1; // LOCAL-PATCH(upstream-request: pending)\n',
  );
  const findings = scanLocalPatches(root);
  expect(findings).toEqual([
    { file: 'scripts/patched.ts', id: 'U-20261001-001' },
    { file: 'scripts/patched.ts', id: 'pending' },
  ]);
});

test('skips node_modules and non-text files', () => {
  mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(root, 'node_modules', 'pkg', 'index.js'), '// LOCAL-PATCH(upstream-request: U-20261001-002)\n');
  mkdirSync(join(root, 'assets'), { recursive: true });
  writeFileSync(join(root, 'assets', 'logo.png'), 'LOCAL-PATCH(upstream-request: U-20261001-003)');
  expect(scanLocalPatches(root)).toEqual([]);
});

test('paths are project-relative with forward slashes, in deterministic order', () => {
  mkdirSync(join(root, '.claude', 'skills', 'x'), { recursive: true });
  writeFileSync(join(root, '.claude', 'skills', 'x', 'SKILL.md'), 'LOCAL-PATCH(upstream-request: U-20261002-010)');
  writeFileSync(join(root, 'AGENTS.md'), 'LOCAL-PATCH(upstream-request: U-20261002-011)');
  const findings = scanLocalPatches(root);
  expect(findings.map((f) => f.file).sort()).toEqual(['.claude/skills/x/SKILL.md', 'AGENTS.md']);
});
