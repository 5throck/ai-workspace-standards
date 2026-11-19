/**
 * Source-ordering + contract pins for the VARIANT-SCOPE SKILL PRUNE
 * source-variant adoption-residue arm (T-20261120-001, design
 * docs/designs/2026-11-20-adoption-gaps-batch-design.md; U-20261119-002 gap 3).
 *
 * The passes are source-ordered (the T-20261006-010 precedent): the residue arm
 * must run BEFORE the registry-driven loop — it prunes exactly the skills the
 * registry arm's cross-variant protection would SKIP loudly, so running it first
 * keeps the decision log contradiction-free. Moving either side must update this
 * test deliberately.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(import.meta.dir, '..', '..', 'scripts', 'upgrade-project.ts'), 'utf-8');
const HELPER = readFileSync(join(import.meta.dir, '..', '..', 'scripts', 'helpers', 'adoption-provenance.ts'), 'utf-8');

describe('upgrade-project source-variant residue arm (T-20261120-001)', () => {
  test('the residue arm precedes the registry-driven loop inside VARIANT-SCOPE SKILL PRUNE', () => {
    const passIdx = SOURCE.indexOf('console.log("--- VARIANT-SCOPE SKILL PRUNE ---");');
    // Anchor after the pass header — the same phrase appears in the v1.113.0 header note.
    const residueIdx = SOURCE.indexOf('source-variant adoption-residue arm', passIdx);
    const registryIdx = SOURCE.indexOf('const ownedByOther: Array<{ skill: string; owner: string }> = [];');
    expect(passIdx).toBeGreaterThan(-1);
    expect(residueIdx).toBeGreaterThan(passIdx);
    expect(registryIdx).toBeGreaterThan(residueIdx);
  });

  test('the arm consumes the provenance helper and the fail-safe gate order', () => {
    // Gate order pin: provenance → source template exists → identity flipped → target differs.
    const armStart = SOURCE.indexOf('const armArmed =');
    const arm = SOURCE.slice(armStart, SOURCE.indexOf('if (!armArmed)', armStart));
    expect(arm).toMatch(/loadAdoptionProvenance|provenance !== null/);
    expect(arm).toMatch(/isAdoptionIdentityFlipped\([^)]*\) === true/);
    expect(arm).toMatch(/variant !== provenance\.sourceVariant/);
  });

  test('prune mechanics mirror the registry arm: LOCAL-PATCH guard, git rm, decision-logged DELETE', () => {
    const passIdx = SOURCE.indexOf('console.log("--- VARIANT-SCOPE SKILL PRUNE ---");');
    const residueStart = SOURCE.indexOf('source-variant adoption-residue arm', passIdx);
    const residue = SOURCE.slice(residueStart, SOURCE.indexOf('── SKILLS_REGISTRY_RECONCILE', residueStart));
    expect(residue).toContain('deletionMarkerLossBlocks(');
    expect(residue).toContain('"rm", "-rf", "--quiet"');
    expect(residue).toContain('"DELETE"');
    expect(residue).toContain('recordDecision(');
  });

  test('the provenance carrier is the adopt-project decisions file (not variant.json — it is removed at settling)', () => {
    expect(HELPER).toContain('.claude', 'adopt-project-decisions.json');
    expect(HELPER).toMatch(/adopt-project-decisions\.json/);
    expect(HELPER).toMatch(/fail-safe contract|never guess/);
  });

  test('the six-way conjunction is documented and enforced in the helper', () => {
    for (const filter of [
      'proven source-variant-seeded',
      'PROJECT_STATE-authored',
      "project's own adopted skill",
      'target variant',
      'common-owned',
    ]) {
      expect(HELPER).toContain(filter);
    }
    expect(HELPER).toContain('selectSourceVariantPruneCandidates');
  });
});
