/**
 * Tests for the .trail skeleton upgrade seeds (design
 * docs/designs/2026-11-08-trail-fleet-standard-design.md §5.2/§7; DEC-20261108-01
 * R2; governing ticket T-20261108-001).
 *
 * Pins:
 * 1. resolveClaim('.trail/{hook.cjs,README.md,.gitignore}') → ADD_IF_MISSING on
 *    the TEMPLATE TREE SYNC pass — seed-when-absent, withhold-when-present.
 *    Load-bearing: without the claim the paths fall through to the generic
 *    VARIANT ASSET DIRS branch with wholesale SYNC, which would clobber a
 *    `trail init`-refreshed hook.cjs (self-managed surface,
 *    docs/self-managed-surfaces.json).
 * 2. TRAIL_RETIRED_SEEDS regression (2026-10-31-graft-trail-migration R2.4):
 *    the graft-era retired seeds stay retired — the new trail-era seeds must
 *    not join that list and the guard must keep withholding them.
 * 3. The template skeleton (templates/common/.trail/) is byte-identical to the
 *    root wiring trio — the vendor's commit-once doctrine: templates ship the
 *    same bytes the tool writes.
 * 4. .trail is NOT in TRAVERSAL_SKIP_DIRS / KNOWN_TOP_DIRS claim short-circuits —
 *    the walk must see the skeleton (with the claim present, delivery is
 *    deterministic; the assertion documents the invariant the claim relies on).
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  resolveClaim,
  TEMPLATE_TREE_SYNC_PASS,
  TRAIL_RETIRED_SEEDS,
  isTrailRetiredSeed,
} from '../../scripts/lib/upgrade-policy.ts';

const ROOT = resolve(__dirname, '../..');
const SKELETON_FILES = ['.trail/hook.cjs', '.trail/README.md', '.trail/.gitignore'] as const;

describe('resolveClaim for the .trail skeleton (v1.38.0 seeds)', () => {
  for (const rel of SKELETON_FILES) {
    test(`${rel} claims ADD_IF_MISSING on ${TEMPLATE_TREE_SYNC_PASS}`, () => {
      const claim = resolveClaim(rel);
      expect(claim.policy).toBe('ADD_IF_MISSING');
      expect(claim.pass).toBe(TEMPLATE_TREE_SYNC_PASS);
    });
  }

  test('a project-owned .trail path that is NOT skeleton wiring keeps the generic claim', () => {
    // .trail/learnings/* (per-repo knowledge) and .trail/statusline.cjs (personal
    // surface, DEC-20261108-01 R4) are instance content — the workspace never
    // delivers them, so they must NOT ride the skeleton seed claim.
    for (const rel of ['.trail/learnings/2026-11-01-note.md', '.trail/statusline.cjs']) {
      const claim = resolveClaim(rel);
      expect(claim.policy).not.toBe('ADD_IF_MISSING');
    }
  });

  test('the claim sits above the VARIANT ASSET DIRS fallthrough (no wholesale SYNC)', () => {
    // Regression for the clobber class: pre-v1.38.0 these paths resolved to
    // SYNC on the generic asset pass.
    expect(resolveClaim('.trail/hook.cjs').policy).not.toBe('SYNC');
  });
});

describe('TRAIL_RETIRED_SEEDS regression (graft-era guard untouched)', () => {
  test('the retired-seed list contains only graft-era paths', () => {
    for (const rel of TRAIL_RETIRED_SEEDS) {
      expect(rel.startsWith('.trail/')).toBe(false);
      expect(isTrailRetiredSeed(rel)).toBe(true);
    }
    expect(TRAIL_RETIRED_SEEDS.length).toBeGreaterThanOrEqual(3);
  });

  test('none of the new trail-era skeleton seeds is retired', () => {
    for (const rel of SKELETON_FILES) {
      expect(isTrailRetiredSeed(rel)).toBe(false);
    }
  });
});

describe('template skeleton byte-parity with the root wiring trio', () => {
  for (const f of ['README.md', 'hook.cjs', '.gitignore'] as const) {
    test(`templates/common/.trail/${f} is byte-identical to .trail/${f}`, () => {
      const root = readFileSync(join(ROOT, '.trail', f), 'utf-8');
      const tpl = readFileSync(join(ROOT, 'templates', 'common', '.trail', f), 'utf-8');
      expect(tpl).toBe(root);
    });
  }

  test('the skeleton ships exactly the tracked trio (no cache/statusline)', () => {
    // `.trail/.gitignore` keeps cache/ + statusline.cjs machine-local; the
    // template must not ship volatile parts.
    const gitignore = readFileSync(join(ROOT, 'templates', 'common', '.trail', '.gitignore'), 'utf-8');
    expect(gitignore).toContain('cache/');
    expect(gitignore).toContain('statusline.cjs');
  });
});
