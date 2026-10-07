/**
 * Prune pass ordering pin (T-20261006-010)
 * @version 1.0.0
 *
 * The VARIANT-SCOPE SKILL PRUNE (registry-curated foreign-skill deletion) must
 * run BEFORE the PRUNE REMOVED L3-preservation walk: a foreign-variant skill is
 * deleted on the strength of the owner-curated registry itself — that registry
 * IS the ADR-0080 decision record (the registry-curated deletion exemption) —
 * so it never reaches (and is never misclassified by) the project-owned KEEP
 * verdict. The passes are source-ordered, so the pin asserts the source order;
 * moving either pass below the other must update this test deliberately.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(
  join(import.meta.dir, '..', '..', 'scripts', 'upgrade-project.ts'),
  'utf-8',
);

describe('upgrade-project prune pass ordering (T-20261006-010)', () => {
  test('VARIANT-SCOPE SKILL PRUNE runs before the PRUNE REMOVED preservation walk', () => {
    const variantScopeIdx = SOURCE.indexOf('── VARIANT-SCOPE SKILL PRUNE');
    const pruneRemovedIdx = SOURCE.indexOf("'--- PRUNE REMOVED: files present in project but absent from template ---'");
    expect(variantScopeIdx).toBeGreaterThan(-1);
    expect(pruneRemovedIdx).toBeGreaterThan(-1);
    expect(variantScopeIdx).toBeLessThan(pruneRemovedIdx);
  });

  test('the registry-curated deletion exemption is documented at the v1.64.0 header', () => {
    const header = SOURCE.slice(0, SOURCE.indexOf('// v1.63.0'));
    expect(header).toMatch(/registry-curated[\s\S]*?ADR-0080 decision record/);
  });
});
