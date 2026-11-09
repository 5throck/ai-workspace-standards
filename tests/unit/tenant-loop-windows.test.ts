/**
 * tz-aware window check for the tenant-loop helpers (design
 * docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §3.2/§6/§7.1):
 * isTenantWithinWindows — KST-style wrap-midnight windows, Intl weekday
 * matching (0 = Sunday), start-inclusive/end-exclusive semantics, and the
 * fail-closed deny for every invalid input. Deterministic: `now` is always
 * injected. Pure helper tests — no fs, no registry.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { isTenantWithinWindows, type TenantLoopTenant } from '../../scripts/lib/fleet.ts';

function tenant(overrides: Partial<TenantLoopTenant['windows']> = {}): TenantLoopTenant {
  return {
    id: 'gw-0123456789ab',
    principal: 'operator@example.com',
    variant: 'co-consult',
    projectDir: '/tmp/x',
    status: 'active',
    scopes: { upgrade: true, upstreamFile: true, backportReview: true, nightlyFleet: true },
    windows: { tz: 'UTC', days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '17:00', ...overrides },
    gitRemote: 'local-only',
  };
}

const at = (iso: string) => new Date(iso);

describe('normal (non-wrapping) windows — start-inclusive, end-exclusive', () => {
  const t = tenant();
  test('start 09:00 → in; 08:59 → out; 16:59 → in; 17:00 → out', () => {
    expect(isTenantWithinWindows(t, at('2026-11-05T09:00:00Z'))).toBe(true);
    expect(isTenantWithinWindows(t, at('2026-11-05T08:59:00Z'))).toBe(false);
    expect(isTenantWithinWindows(t, at('2026-11-05T16:59:00Z'))).toBe(true);
    expect(isTenantWithinWindows(t, at('2026-11-05T17:00:00Z'))).toBe(false);
  });

  test('days match the Intl weekday in the window tz (0 = Sunday)', () => {
    // 2026-11-08 is a Sunday (asserted dynamically so the fixture cannot drift).
    const sunday = at('2026-11-08T12:00:00Z');
    expect(sunday.getUTCDay()).toBe(0);
    expect(isTenantWithinWindows(tenant({ days: [0] }), sunday)).toBe(true);
    expect(isTenantWithinWindows(tenant({ days: [1] }), sunday)).toBe(false);
  });
});

describe('wrap-midnight windows (22:00-06:00, the design §3.1 example)', () => {
  const night = tenant({ tz: 'Asia/Seoul', start: '22:00', end: '06:00' });
  test('true at 23:30 KST and 01:00 KST, false at 12:00 KST (design §7.1)', () => {
    expect(isTenantWithinWindows(night, at('2026-11-08T23:30:00+09:00'))).toBe(true);
    expect(isTenantWithinWindows(night, at('2026-11-08T01:00:00+09:00'))).toBe(true);
    expect(isTenantWithinWindows(night, at('2026-11-08T12:00:00+09:00'))).toBe(false);
  });

  test('UTC boundaries: 22:00 in, 21:59 out, 05:59 in, 06:00 out', () => {
    const u = tenant({ tz: 'UTC', start: '22:00', end: '06:00' });
    expect(isTenantWithinWindows(u, at('2026-11-05T22:00:00Z'))).toBe(true);
    expect(isTenantWithinWindows(u, at('2026-11-05T21:59:00Z'))).toBe(false);
    expect(isTenantWithinWindows(u, at('2026-11-05T05:59:00Z'))).toBe(true);
    expect(isTenantWithinWindows(u, at('2026-11-05T06:00:00Z'))).toBe(false);
  });

  test('post-midnight minutes attribute to the PREVIOUS calendar day for days[]', () => {
    // Window opens Sunday 22:00 and spills into Monday before 06:00.
    const monday = at('2026-11-09T01:00:00Z');
    expect(monday.getUTCDay()).toBe(1);
    expect(isTenantWithinWindows(tenant({ start: '22:00', end: '06:00', days: [0] }), monday)).toBe(true); // opened Sunday
    expect(isTenantWithinWindows(tenant({ start: '22:00', end: '06:00', days: [1] }), monday)).toBe(false); // Monday-only opens Monday 22:00
    // The window-head side still keys on the SAME day (Sunday 23:00 needs days [0]).
    expect(isTenantWithinWindows(tenant({ start: '22:00', end: '06:00', days: [0] }), at('2026-11-08T23:00:00Z'))).toBe(true);
    expect(isTenantWithinWindows(tenant({ start: '22:00', end: '06:00', days: [1] }), at('2026-11-08T23:00:00Z'))).toBe(false);
  });
});

describe('tz conversion (not a UTC comparison)', () => {
  test('an EDT local time inside the window passes when UTC time would not', () => {
    // 2026-07-15T12:00:00Z is 08:00 in America/New_York (EDT, UTC-4).
    expect(isTenantWithinWindows(tenant({ tz: 'America/New_York', start: '08:00', end: '09:00' }), at('2026-07-15T12:00:00Z'))).toBe(true);
    expect(isTenantWithinWindows(tenant({ tz: 'UTC', start: '08:00', end: '09:00' }), at('2026-07-15T12:00:00Z'))).toBe(false);
  });

  test('DST-edge sanity: fixed-offset tz arithmetic holds across both DST phases', () => {
    // Same UTC instant maps to different local times across the US DST switch;
    // the helper must follow the tz database, not a fixed offset guess.
    const ny = tenant({ tz: 'America/New_York', start: '01:00', end: '02:00' });
    expect(isTenantWithinWindows(ny, at('2026-07-15T05:00:00Z'))).toBe(true); // EDT = 01:00
    expect(isTenantWithinWindows(ny, at('2026-12-15T06:00:00Z'))).toBe(true); // EST = 01:00
    expect(isTenantWithinWindows(ny, at('2026-12-15T05:00:00Z'))).toBe(false); // EST = 00:00
  });
});

describe('fail-closed deny (design §6): any invalid input → false', () => {
  const good = at('2026-11-05T10:00:00Z');
  test('unknown tz', () => {
    expect(isTenantWithinWindows(tenant({ tz: 'Not/AZone' }), good)).toBe(false);
  });
  test('empty tz', () => {
    expect(isTenantWithinWindows(tenant({ tz: '' }), good)).toBe(false);
  });
  test('empty days', () => {
    expect(isTenantWithinWindows(tenant({ days: [] }), good)).toBe(false);
  });
  test('out-of-range day (defensive — the validator rejects it earlier)', () => {
    expect(isTenantWithinWindows(tenant({ days: [7] }), good)).toBe(false);
    expect(isTenantWithinWindows(tenant({ days: [-1] }), good)).toBe(false);
  });
  test('unparseable HH:MM', () => {
    expect(isTenantWithinWindows(tenant({ start: '24:00' }), good)).toBe(false);
    expect(isTenantWithinWindows(tenant({ end: '22:60' }), good)).toBe(false);
    expect(isTenantWithinWindows(tenant({ start: '9am' }), good)).toBe(false);
  });
  test('zero-length window (start == end) never opens', () => {
    expect(isTenantWithinWindows(tenant({ start: '09:00', end: '09:00' }), good)).toBe(false);
  });
  test('missing windows block denies', () => {
    const t = tenant();
    (t as unknown as { windows: unknown }).windows = undefined;
    expect(isTenantWithinWindows(t, good)).toBe(false);
  });
});

describe('determinism with injected now (design §7.1)', () => {
  test('same inputs → same verdict; only the clock moves the verdict', () => {
    const t = tenant({ start: '10:00', end: '11:00' });
    const a = at('2026-11-05T10:30:00Z');
    expect(isTenantWithinWindows(t, a)).toBe(isTenantWithinWindows(t, a));
    expect(isTenantWithinWindows(t, a)).toBe(true);
    expect(isTenantWithinWindows(t, at('2026-11-05T11:30:00Z'))).toBe(false);
  });
});
