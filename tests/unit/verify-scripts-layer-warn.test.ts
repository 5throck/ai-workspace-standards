/**
 * U-20261026-010 — equal-version drift blocking is scoped by context layer.
 *
 * equalVersionDivergenceBlocks() decides whether an equal-version L0/L1
 * divergence blocks --check-drift:
 *   - L0 / L1 (mirror contexts): blocking (exit 1), regression guard.
 *   - L2 / L3 (variant template / Projects/*): warn-only (exit 0); the L1 side
 *     is the upstream delivery source, reconciled by upgrade-project.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  classifyL0L1Pair,
  equalVersionDivergenceBlocks,
  type ContextLayer,
} from '../../scripts/verify-scripts.ts';

const L0_PATH = 'scripts/fixture.ts';
const L1_PATH = 'templates/common/scripts/fixture.ts';

// Same @version on both sides, functional content differs: the equal-version
// divergence class.
const L0_SRC = ['// @version 2.0.0', 'export const mode = "workspace";', ''].join('\n');
const L1_SRC = ['// @version 2.0.0', 'export const mode = "upstream";', ''].join('\n');

describe('equalVersionDivergenceBlocks (U-20261026-010)', () => {
  test('L0 keeps blocking on equal-version divergence (regression)', () => {
    expect(equalVersionDivergenceBlocks('L0')).toBe(true);
  });

  test('L1 keeps blocking on equal-version divergence', () => {
    expect(equalVersionDivergenceBlocks('L1')).toBe(true);
  });

  test('L2 downgrades equal-version divergence to warn-only', () => {
    expect(equalVersionDivergenceBlocks('L2')).toBe(false);
  });

  test('L3 (Projects/*) downgrades equal-version divergence to warn-only', () => {
    expect(equalVersionDivergenceBlocks('L3')).toBe(false);
  });

  test('every layer is covered by an explicit decision', () => {
    const layers: ContextLayer[] = ['L0', 'L1', 'L2', 'L3'];
    const blocking = layers.filter((l) => equalVersionDivergenceBlocks(l));
    expect(blocking).toEqual(['L0', 'L1']);
  });
});

describe('equal-version pair still classifies as divergence (input to the layer gate)', () => {
  test('matching @version with differing bytes → equal-version-divergence', () => {
    const r = classifyL0L1Pair(L0_SRC, L1_SRC, L0_PATH, L1_PATH);
    expect(r.classification).toBe('equal-version-divergence');
    expect(r.l0Version).toBe('2.0.0');
    expect(r.l1Version).toBe('2.0.0');
  });

  test('version skew with differing bytes stays pending-publish (warn in every layer)', () => {
    const r = classifyL0L1Pair(L0_SRC, L1_SRC.replace('2.0.0', '1.9.0'), L0_PATH, L1_PATH);
    expect(r.classification).toBe('pending-publish');
  });
});
