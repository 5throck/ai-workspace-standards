/**
 * Tests for helpers/scaffold-markers.ts — transient test-fixture predicate
 * (T-20260916-001).
 *
 * The predicate is the shared contract between the templates/-staging E2E
 * (producer) and the validators that enumerate templates/ (skippers). If it
 * ever stops matching a real fixture prefix, validators see fixture dirs as
 * variants again — the VERSION_REGISTRY.json pollution class returns.
 */
import { describe, it, expect } from 'bun:test';
import {
  isTransientTestFixture,
  TRANSIENT_TEST_FIXTURE_PREFIXES,
} from '../../scripts/helpers/scaffold-markers.ts';

describe('isTransientTestFixture', () => {
  it('matches every declared prefix', () => {
    const runId = 1758000000000;
    const expected: Array<[string, boolean]> = [
      [`test-l3promo-${runId}`, true],
      [`test-l3promo-${runId}-agentsmd-stage`, true],
      [`co-e2eguard-beta-${runId}`, true],
      [`co-e2eguard-stable-${runId}`, true],
      [`co-e2p2b-${runId}`, true],
      [`co-e2p2s-${runId}`, true],
      [`co-e2p2c-${runId}`, true],
    ];
    for (const [name, want] of expected) {
      expect(isTransientTestFixture(name)).toBe(want);
    }
  });

  it('does not match real variant names or near-misses', () => {
    // 'test-l3promo' alone does NOT match: the trailing dash is part of the
    // prefix, so the bare stem must be treated as a name, not a fixture.
    expect(isTransientTestFixture('test-l3promo')).toBe(false);
    const notFixtures = [
      'co-develop',
      'co-abap',
      'common',
      'test', // bare, no fixture prefix
      'test-l3prom', // prefix truncation
      'co-e2egu',
      'my-test-l3promo-123', // prefix not at start
      'CO-E2EGUARD-BETA-1', // case-sensitive
    ];
    for (const name of notFixtures) {
      expect(isTransientTestFixture(name)).toBe(false);
    }
  });

  it('prefix list covers exactly the fixture families the E2E stages', () => {
    // Lockstep guard: the constant set is the contract — a new fixture family
    // must extend it (and this assertion pins accidental removals).
    expect([...TRANSIENT_TEST_FIXTURE_PREFIXES].sort()).toEqual(
      ['co-e2eguard-', 'co-e2p2b-', 'co-e2p2c-', 'co-e2p2s-', 'test-l3promo-'].sort(),
    );
  });
});
