/**
 * Regression tests for the T-20261001-015 scoped-staging default flip
 * (amendment 3 of docs/designs/2026-09-12-dev-sync-scoped-staging-design.md):
 * step 6.5 must EXCLUDE un-staged, un-generated files by default, with the
 * ADR-0055 WARN soak available only as an explicit opt-out.
 *
 * dev-sync.ts is a monolithic top-level-await script (not import-safe), so —
 * like tests/unit/dev-sync-scoped-staging-deletion.test.ts — these tests read
 * the real source and assert the contract textually:
 *   T1: the declaration defaults to exclusion (`!== '0'`).
 *   T2: the `--warn-staging` opt-out flag exists in the argv parser.
 *   T3: the legacy opt-IN forms (`=1`, `--scoped-staging`) are still accepted.
 *   T4: skills/sync/SKILL.md step 0 no longer documents the soak as default.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..', '..');
const src = readFileSync(join(root, 'scripts', 'dev-sync.ts'), 'utf-8');
const skill = readFileSync(join(root, 'skills', 'sync', 'SKILL.md'), 'utf-8');

describe('dev-sync scoped-staging default flip (T-20261001-015)', () => {
  test('T1: declaration defaults to exclusion (SYNC_SCOPED_STAGING !== 0)', () => {
    expect(src).toMatch(/let scopedStaging = process\.env\.SYNC_SCOPED_STAGING !== '0';/);
    // the old soak-default declaration must be gone
    expect(src).not.toMatch(/let scopedStaging = process\.env\.SYNC_SCOPED_STAGING === '1';/);
  });

  test('T2: --warn-staging opt-out flag is parsed', () => {
    expect(src).toMatch(/arg === '--warn-staging'/);
  });

  test('T3: legacy opt-in forms remain accepted', () => {
    expect(src).toMatch(/arg === '--scoped-staging'/);
    expect(src).toMatch(/remain accepted no-ops/);
  });

  test('T4: sync SKILL.md step 0 documents the exclusion default', () => {
    expect(skill).toMatch(/EXCLUDED from the commit by default/);
    expect(skill).not.toMatch(/swept in during the current soak/);
  });
});
