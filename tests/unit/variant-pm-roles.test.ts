/**
 * Tests for the scaffold constant invariants added by T-20260915-012 (M12/M13):
 *
 * M13 — DEFAULT_PM_ROLE_DESCRIPTIONS (helpers/template-utils.ts) must cover
 * EVERY current variant template. The keys must stay identical to the actual
 * templates/co-* directory set (derived with deriveCoVariantDirs from wave 3,
 * the same derived set validate-templates consumes), or the uncovered
 * variants silently render the generic fallback into their context.md.
 *
 * M12 — NEW_PROJECT_L1_ONLY_AGENTS (helpers/scaffold-markers.ts) entries must
 * resolve to real templates/common/ paths: a stale entry is a dead exclusion
 * that masks future drift. (If the constant ever becomes empty, the drift
 * mask is gone by definition — that state is also accepted.)
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_PM_ROLE_DESCRIPTIONS } from '../../scripts/helpers/template-utils.ts';
import { NEW_PROJECT_L1_ONLY_AGENTS } from '../../scripts/helpers/scaffold-markers.ts';
import { deriveCoVariantDirs } from '../../scripts/lib/propagation-map-schema.ts';

const WORKSPACE_ROOT = resolve(import.meta.dir, '..', '..');
const TEMPLATES_DIR = join(WORKSPACE_ROOT, 'templates');
const COMMON_DIR = join(TEMPLATES_DIR, 'common');

describe('DEFAULT_PM_ROLE_DESCRIPTIONS completeness (T-20260915-012 / M13)', () => {
  test('keys are exactly the templates/co-* directory set (deriveCoVariantDirs)', () => {
    const variantDirs = deriveCoVariantDirs(TEMPLATES_DIR);
    expect(variantDirs.length).toBeGreaterThan(0);
    expect(Object.keys(DEFAULT_PM_ROLE_DESCRIPTIONS).sort()).toEqual(variantDirs);
  });

  test('every description is a real, non-fallback one-liner', () => {
    for (const [variant, description] of Object.entries(DEFAULT_PM_ROLE_DESCRIPTIONS)) {
      expect(description.trim().length, `${variant} description is non-empty`).toBeGreaterThan(10);
      // The generic fallback string must never appear as a map value — the
      // whole point of the map is to replace it per variant.
      expect(description, `${variant} must not use the generic fallback`).not.toBe(
        'Workflow management, dispatch, quality gates',
      );
    }
  });

  test('descriptions stay grounded in the variant template they describe', () => {
    // Spot-check provenance: each listed variant's template must actually
    // exist and carry a PM agent file (the source the description derives from).
    for (const variant of Object.keys(DEFAULT_PM_ROLE_DESCRIPTIONS)) {
      expect(existsSync(join(TEMPLATES_DIR, variant, 'agents', 'pm.md'))).toBe(true);
    }
  });
});

describe('NEW_PROJECT_L1_ONLY_AGENTS resolution (T-20260915-012 / M12)', () => {
  test('every entry resolves to a real templates/common/ path (no dead exclusions)', () => {
    for (const rel of NEW_PROJECT_L1_ONLY_AGENTS) {
      expect(
        existsSync(join(COMMON_DIR, rel)),
        `${rel} must exist under templates/common/ — stale entries mask future drift`,
      ).toBe(true);
    }
  });

  test('the stale pre-T-20260915-012 entries are gone', () => {
    expect(NEW_PROJECT_L1_ONLY_AGENTS).not.toContain('agents/lifecycle-manager.md');
    expect(NEW_PROJECT_L1_ONLY_AGENTS).not.toContain('agents/pm.md.backup');
  });

  test('the excluded paths are the common-only agent machinery actually copied', () => {
    // The common agents directory carries _COMMON.md (shared-sections include)
    // next to the propagating agents; the exclusion list must stay a subset of
    // what the common copy actually delivers.
    const commonAgents = readdirSync(join(COMMON_DIR, 'agents'));
    for (const rel of NEW_PROJECT_L1_ONLY_AGENTS) {
      expect(commonAgents).toContain(rel.replace(/^agents\//, ''));
    }
  });
});
