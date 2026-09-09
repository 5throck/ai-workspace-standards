#!/usr/bin/env bun
// @version 1.0.0
// agent-lifecycle-stale-date.test.ts — T-20260909-004 stale last_updated helpers
//
// Covers the pure date helpers behind Check 11: frontmatter date normalization
// (plain + ISO-datetime forms, non-date rejection) and the strictly-older
// comparison against the last git commit date.

import { test, expect, describe } from 'bun:test';
import {
  parseFrontmatterDate,
  isFrontmatterStale,
} from '../../scripts/agent-lifecycle-audit.ts';

describe('parseFrontmatterDate (T-20260909-004)', () => {
  test('parses plain YYYY-MM-DD values', () => {
    expect(parseFrontmatterDate('2026-08-24')).toBe('2026-08-24');
  });

  test('parses ISO datetime values (lifecycle.last_updated form)', () => {
    expect(parseFrontmatterDate('2026-08-24T00:00:00.000Z')).toBe('2026-08-24');
  });

  test('accepts quoted values', () => {
    expect(parseFrontmatterDate("'2026-05-31'")).toBe('2026-05-31');
  });

  test('rejects non-date values and non-strings', () => {
    expect(parseFrontmatterDate('inherit')).toBeNull();
    expect(parseFrontmatterDate('')).toBeNull();
    expect(parseFrontmatterDate(undefined)).toBeNull();
    expect(parseFrontmatterDate(42)).toBeNull();
  });
});

describe('isFrontmatterStale (T-20260909-004)', () => {
  test('stale when frontmatter date is strictly older than last commit', () => {
    expect(isFrontmatterStale('2026-08-24', '2026-09-07')).toBe(true);
  });

  test('not stale on the same day', () => {
    expect(isFrontmatterStale('2026-09-07', '2026-09-07')).toBe(false);
  });

  test('not stale when frontmatter date is newer than last commit', () => {
    expect(isFrontmatterStale('2026-09-09', '2026-09-07')).toBe(false);
  });
});
