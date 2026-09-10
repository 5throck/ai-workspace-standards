import { describe, expect, it } from 'bun:test';
import { localDateISO } from '../../scripts/lib/local-date.ts';

// T-20260910-030 — toISOString().slice(0, 10) is UTC-based; calendar-day stamps
// must use local fields so evening/early-morning runs land on the local day.
describe('localDateISO', () => {
  it('uses local calendar fields, not UTC', () => {
    // 23:30 local must stay on the local day even where UTC has already rolled over.
    expect(localDateISO(new Date(2026, 8, 10, 23, 30))).toBe('2026-09-10');
    expect(localDateISO(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });

  it('pads month and day to two digits', () => {
    expect(localDateISO(new Date(2026, 2, 5))).toBe('2026-03-05');
  });

  it('defaults to now in yyyy-MM-dd form', () => {
    expect(localDateISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
