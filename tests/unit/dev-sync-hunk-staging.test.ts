/**
 * Contract tests for the T-20261117-015 hunk-adjudicated staging surface in
 * scripts/dev-sync.ts v1.51.0 (spec docs/designs/2026-11-18-dev-sync-hunk-staging-design.md
 * §2-§3): the --honor-staged opt-in (pre-staged index blob is authoritative for
 * designated paths; the step-6.5 promotion sweep never path-level re-adds them) and
 * the step-6.55 spec-registry dangling-reference gate.
 *
 * dev-sync.ts is a monolithic top-level-await script (not import-safe), so — like
 * tests/unit/dev-sync-scoped-staging-default.test.ts — these tests read the real
 * source and assert the contract textually.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..', '..');
const src = readFileSync(join(root, 'scripts', 'dev-sync.ts'), 'utf-8');

describe('dev-sync hunk-adjudicated staging (T-20261117-015)', () => {
  test('T1: --honor-staged is parsed in both argv forms', () => {
    expect(src).toMatch(/arg === ['"]--honor-staged['"]/);
    expect(src).toMatch(/arg\.startsWith\(['"]--honor-staged=['"]\)/);
  });

  test('T2: SYNC_HONOR_STAGED env is unioned into the honor set', () => {
    expect(src).toMatch(/process\.env\.SYNC_HONOR_STAGED/);
    // comma-split + trim, like the design §2 surface
    expect(src).toMatch(/honorSet/);
    expect(src).toMatch(/\.split\(","\)/);
  });

  test('T3: ghost opt-in is fail-closed (honored path with no staged delta aborts)', () => {
    expect(src).toMatch(/honor-staged ghost opt-in/);
    expect(src).toMatch(/filter\(\(p\) => !taskStaged\.has\(p\)\)/);
    expect(src).toMatch(/git apply --cached <patch>/);
  });

  test('T4: honor set under --warn-staging is fail-closed', () => {
    expect(src).toMatch(/honor-staged cannot be honored under --warn-staging/);
  });

  test('T5: honored paths are excluded from the promotion sweep add batches', () => {
    // the sweep filter excludes the honor set — the staged blob is authoritative
    expect(src).toMatch(/\.filter\(\(p\) => !honorSet\.has\(p\)\)/);
    expect(src).toMatch(/honoring the pre-staged index blob/);
    // worktree divergence on an honored path is a WARN, not an error
    expect(src).toMatch(/worktree diverges from the staged blob/);
  });

  test('T6: step 6.55 reads the STAGED registry blob and fails closed on dangling refs', () => {
    expect(src).toMatch(/Step 6\.55/);
    expect(src).toMatch(/git show :\$\{SPEC_REGISTRY_PATH\}/);
    expect(src).toMatch(/parseRegistryEntries\(stagedRegRes\.stdout\.toString\(\)\)/);
    expect(src).toMatch(/spec-registry dangling-reference gate FAILED/);
    // existence = index blob OR HEAD blob not removed by this landing
    expect(src).toMatch(/parseCachedNameStatus\(rmRes\.stdout\.toString\(\)\)/);
    expect(src).toMatch(/headSet\.has\(p\) && !removedInIndex\.has\(p\)/);
  });

  test('T7: the pure detection is the shared lib (one derivation, two callers)', () => {
    expect(src).toMatch(/from "\.\/lib\/spec-landing\.ts"/);
    const lib = join(root, 'scripts', 'lib', 'spec-landing.ts');
    expect(existsSync(lib)).toBe(true);
    const libSrc = readFileSync(lib, 'utf-8');
    expect(libSrc).toMatch(/@version 1\.0\.0/);
    expect(libSrc).toMatch(/export function danglingSpecRefs/);
    expect(libSrc).toMatch(/export function parseRegistryEntries/);
  });

  test('T8: version header bumped with the spec reference', () => {
    expect(src).toMatch(/@version 1\.52\.0/);
    // the v1.51.0 spec reference survives the T-20261118-003 bump alongside it
    expect(src).toMatch(/2026-11-18-dev-sync-hunk-staging-design\.md/);
    expect(src).toMatch(/2026-11-18-memory-gate-step2-deadlock-design\.md/);
  });
});
