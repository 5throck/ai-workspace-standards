/**
 * Tests for review-baseline.ts battery #8 verdict classification
 * (T-20261026-014, finding #17 of docs/reports/2026-10-26-project-review-full.md):
 * a nightly run whose conclusion is anything other than 'success' — and an
 * empty run list — must classify as WARN instead of the green "status: ..."
 * note that previously let timed_out/cancelled/startup_failure nightly passes
 * read as "8/8 green" under --quiet.
 *
 * nightlyE2EVerdict is pure, so these tests never spawn gh or the battery.
 * Importing the module is safe: execution is gated behind import.meta.main.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { nightlyE2EVerdict } from '../../scripts/review-baseline.ts';

const GREEN = [{ conclusion: 'success', createdAt: '2026-10-26T01:30:00Z', url: 'https://example/run/1', databaseId: 1 }];
const FAILED = [{ conclusion: 'failure', createdAt: '2026-10-26T01:30:00Z', url: 'https://example/run/2', databaseId: 2 }];

describe('nightlyE2EVerdict (T-20261026-014)', () => {
  test('a success conclusion stays green', () => {
    const v = nightlyE2EVerdict(GREEN);
    expect(v.warn).toBe(false);
    expect(v.note).toContain('nightly green as of 2026-10-26T01:30:00Z');
  });

  test('a failure conclusion still warns with the regression-class note', () => {
    const v = nightlyE2EVerdict(FAILED);
    expect(v.warn).toBe(true);
    expect(v.note).toContain('FAILED');
    expect(v.note).toContain('run bun scripts/test-new-project.ts');
  });

  test('non-success conclusions (timed_out/cancelled/startup_failure) warn instead of passing green', () => {
    for (const conclusion of ['timed_out', 'cancelled', 'startup_failure']) {
      const v = nightlyE2EVerdict([{ conclusion, createdAt: '2026-10-26T01:30:00Z', url: 'https://example/run/3', databaseId: 3 }]);
      expect(v.warn).toBe(true);
      expect(v.note).toContain(`conclusion: ${conclusion}`);
      expect(v.note).toContain('did not conclude success');
    }
  });

  test('a running nightly (null conclusion) warns instead of passing green', () => {
    const v = nightlyE2EVerdict([{ conclusion: null, status: 'in_progress', createdAt: '2026-10-26T01:30:00Z', url: 'https://example/run/4', databaseId: 4 }]);
    expect(v.warn).toBe(true);
    expect(v.note).toContain('conclusion: none');
    expect(v.note).toContain('status: in_progress');
  });

  test('an empty run list warns — no conclusion to surface is not a green nightly', () => {
    const v = nightlyE2EVerdict([]);
    expect(v.warn).toBe(true);
    expect(v.note).toContain('run list is empty');
    expect(v.note).toContain('gh run list --workflow=nightly-scaffold-e2e.yml');
  });

  test('a non-array payload (malformed gh output shape) warns like an empty list', () => {
    const v = nightlyE2EVerdict({ unexpected: 'shape' });
    expect(v.warn).toBe(true);
    expect(v.note).toContain('run list is empty');
  });
});
