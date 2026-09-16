/**
 * Tests for scripts/hooks/pre-push.ts pure deletion-push detection
 * (T-20260916-014): a pure ref-deletion push (every stdin line carries an
 * all-zero local OID — 40 zeros on SHA-1 repos, 64 on SHA-256 repos) must
 * early-exit instead of running the audit battery; mixed pushes (commits +
 * deletions) and empty stdin keep the full gate.
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { isZeroOid, isPureDeletionPush, type PushRefUpdate } from '../../scripts/hooks/pre-push';

const SHA1_ZERO = '0000000000000000000000000000000000000000'; // 40 zeros
const SHA256_ZERO = '0'.repeat(64);
const SHA1_A = '1234567890abcdef1234567890abcdef12345678';
const SHA1_B = 'abcdef1234567890abcdef1234567890abcdef12';

function update(localOid: string | undefined, remoteOid = SHA1_B, remoteRef = 'refs/heads/pr/x'): PushRefUpdate {
  return { localRef: 'refs/heads/pr/x', localOid, remoteRef, remoteOid };
}

describe('isZeroOid', () => {
  test('40 zeros (SHA-1 null OID) — true', () => {
    expect(isZeroOid(SHA1_ZERO)).toBe(true);
  });

  test('64 zeros (SHA-256 null OID) — true', () => {
    expect(isZeroOid(SHA256_ZERO)).toBe(true);
  });

  test('real SHA-1 commit SHA — false', () => {
    expect(isZeroOid(SHA1_A)).toBe(false);
  });

  test('all-zero except last char — false', () => {
    expect(isZeroOid('0'.repeat(39) + '1')).toBe(false);
  });

  test('wrong lengths (39, 41, 63, 65 zeros) — false', () => {
    expect(isZeroOid('0'.repeat(39))).toBe(false);
    expect(isZeroOid('0'.repeat(41))).toBe(false);
    expect(isZeroOid('0'.repeat(63))).toBe(false);
    expect(isZeroOid('0'.repeat(65))).toBe(false);
  });

  test('malformed line artifacts (undefined, empty) — false', () => {
    expect(isZeroOid(undefined)).toBe(false);
    expect(isZeroOid('')).toBe(false);
  });
});

describe('isPureDeletionPush', () => {
  test('single deletion (SHA-1 zero OID) — pure', () => {
    expect(isPureDeletionPush([update(SHA1_ZERO)])).toBe(true);
  });

  test('single deletion (SHA-256 zero OID) — pure', () => {
    expect(isPureDeletionPush([update(SHA256_ZERO)])).toBe(true);
  });

  test('multiple deletions — pure', () => {
    expect(isPureDeletionPush([
      update(SHA1_ZERO, SHA1_A, 'refs/heads/pr/a'),
      update(SHA256_ZERO, SHA1_A, 'refs/heads/pr/b'),
    ])).toBe(true);
  });

  test('deletion mixed with a commit-bearing ref — NOT pure (full gate)', () => {
    expect(isPureDeletionPush([
      update(SHA1_ZERO, SHA1_A, 'refs/heads/pr/old'),
      update(SHA1_B, SHA1_A, 'refs/heads/feature'), // commit push
    ])).toBe(false);
  });

  test('commit-only push — NOT pure', () => {
    expect(isPureDeletionPush([update(SHA1_B)])).toBe(false);
  });

  test('new tag push (real local OID) — NOT pure', () => {
    expect(isPureDeletionPush([update(SHA1_B, SHA1_ZERO, 'refs/tags/v1.0.0')])).toBe(false);
  });

  test('empty stdin (no ref updates) — NOT pure (fallback branch protection applies)', () => {
    expect(isPureDeletionPush([])).toBe(false);
  });

  test('malformed line (undefined localOid) — NOT pure (conservative: run the gate)', () => {
    expect(isPureDeletionPush([update(undefined)])).toBe(false);
  });
});
