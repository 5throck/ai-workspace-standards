/**
 * Classification tests for scripts-snapshot.json (U-20261006-001).
 *
 * The snapshot must classify as REGENERATED ("regenerated in place") — it is
 * generated state (scaffold/adopt writes it; upgrade-project now regenerates
 * it), never template-delivered and never a frozen-at-scaffold artifact.
 * Guard the neighbors of the same sets so the move did not disturb them.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { resolveClaim } from '../../scripts/lib/upgrade-policy.ts';

describe('resolveClaim: scripts-snapshot.json (U-20261006-001)', () => {
  test('classifies as REGENERATED on the (regenerated in place) pass', () => {
    const claim = resolveClaim('scripts-snapshot.json');
    expect(claim.policy).toBe('REGENERATED');
    expect(claim.pass).toBe('(regenerated in place)');
  });

  test('is never a delivery claim (no TEMPLATE TREE SYNC / VARIANT ASSET DIRS pass)', () => {
    const claim = resolveClaim('scripts-snapshot.json');
    expect(claim.pass).not.toBe('TEMPLATE TREE SYNC');
    expect(claim.pass).not.toBe('VARIANT ASSET DIRS');
  });

  test('former PROJECT_STATE neighbors keep their classification', () => {
    for (const rel of ['package.json', 'bun.lock', 'bun.lockb', 'package-lock.json', 'variant.json']) {
      expect(resolveClaim(rel).policy).toBe('PROJECT_STATE');
    }
  });

  test('REGENERATED neighbors keep their classification', () => {
    for (const rel of ['docs/skill-graph.json', '.claude/template-version.txt', 'docs/VERSION_MANIFEST.md']) {
      const claim = resolveClaim(rel);
      expect(claim.policy).toBe('REGENERATED');
      expect(claim.pass).toBe('(regenerated in place)');
    }
  });
});
