import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assessSnapshotFreshness,
  WARN_AFTER_DAYS,
  FAIL_AFTER_DAYS,
} from '../../scripts/lib/snapshot-freshness.ts';

// ── Fixture ──────────────────────────────────────────────────────────────────

let root: string;
let snapshotDir: string;
// Injected todayIso — the module never reads the clock, so every boundary is
// deterministic: today = 2026-11-23 (the design doc's measurement date).
const TODAY = '2026-11-23';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'snapshot-freshness-test-'));
  snapshotDir = join(root, 'skill-graph-metrics');
  mkdirSync(snapshotDir, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function snap(date: string): void {
  writeFileSync(join(snapshotDir, `snapshot-${date}.json`), '{}');
}

// ── Status boundaries (SF-T1..T5 — design §3.3) ──────────────────────────────

describe('assessSnapshotFreshness (T-20261123-008 intent, design §3)', () => {
  test('SF-T1: latest snapshot today → ok (age 0)', () => {
    snap('2026-11-23');
    const r = assessSnapshotFreshness({ dir: snapshotDir, todayIso: TODAY });
    expect(r.status).toBe('ok');
    expect(r.latest).toBe('2026-11-23');
    expect(r.ageDays).toBe(0);
  });

  test('SF-T2: exactly 8 days old → ok (boundary: "older than 8" warns)', () => {
    snap('2026-11-15');
    const r = assessSnapshotFreshness({ dir: snapshotDir, todayIso: TODAY });
    expect(r.status).toBe('ok');
    expect(r.ageDays).toBe(8);
  });

  test('SF-T3: 9 days old → warn, detail names the WARN threshold', () => {
    snap('2026-11-14');
    const r = assessSnapshotFreshness({ dir: snapshotDir, todayIso: TODAY });
    expect(r.status).toBe('warn');
    expect(r.ageDays).toBe(9);
    expect(r.detail).toContain('latest snapshot is 9 days old');
    expect(r.detail).toContain('(snapshot-2026-11-14.json, WARN threshold 8)');
  });

  test('SF-T4: exactly 15 days old → warn (boundary: "older than 15" fails)', () => {
    snap('2026-11-08');
    const r = assessSnapshotFreshness({ dir: snapshotDir, todayIso: TODAY });
    expect(r.status).toBe('warn');
    expect(r.ageDays).toBe(15);
  });

  test('SF-T5: 16 days old → fail, detail names the FAIL threshold', () => {
    snap('2026-11-07');
    const r = assessSnapshotFreshness({ dir: snapshotDir, todayIso: TODAY });
    expect(r.status).toBe('fail');
    expect(r.ageDays).toBe(16);
    expect(r.detail).toContain('latest snapshot is 16 days old');
    expect(r.detail).toContain('(snapshot-2026-11-07.json, FAIL threshold 15)');
  });

  // ── Failure states (SF-T6..T8) ─────────────────────────────────────────────

  test('SF-T6: missing directory → fail ("missing snapshot directory"), latest/age null', () => {
    const r = assessSnapshotFreshness({ dir: join(root, 'nope'), todayIso: TODAY });
    expect(r.status).toBe('fail');
    expect(r.latest).toBeNull();
    expect(r.ageDays).toBeNull();
    expect(r.detail).toContain('missing snapshot directory');
  });

  test('SF-T7: empty directory → fail ("zero snapshots")', () => {
    const r = assessSnapshotFreshness({ dir: snapshotDir, todayIso: TODAY });
    expect(r.status).toBe('fail');
    expect(r.detail).toContain('zero snapshots');
  });

  test('SF-T8: only malformed filenames → fail ("zero snapshots") — malformed names are ignored deterministically', () => {
    writeFileSync(join(snapshotDir, 'snapshot-foo.json'), '{}');
    writeFileSync(join(snapshotDir, 'snapshot-20261120.json'), '{}');
    writeFileSync(join(snapshotDir, 'notes.txt'), 'x');
    const r = assessSnapshotFreshness({ dir: snapshotDir, todayIso: TODAY });
    expect(r.status).toBe('fail');
    expect(r.detail).toContain('zero snapshots');
    expect(r.latest).toBeNull();
  });

  // ── Latest-wins (SF-T9) ────────────────────────────────────────────────────

  test('SF-T9: multiple snapshots → lexicographic max of filename dates wins', () => {
    snap('2026-11-01');
    snap('2026-11-10');
    snap('2026-11-02');
    const r = assessSnapshotFreshness({ dir: snapshotDir, todayIso: TODAY });
    expect(r.latest).toBe('2026-11-10');
    expect(r.ageDays).toBe(13);
    expect(r.status).toBe('warn'); // 13 > 8, ≤ 15
  });

  // ── Threshold override contract (SF-T10) ───────────────────────────────────

  test('SF-T10: injected warnAfterDays/failAfterDays overrides are respected', () => {
    snap('2026-11-20'); // age 3 against TODAY
    // default thresholds → ok
    expect(assessSnapshotFreshness({ dir: snapshotDir, todayIso: TODAY }).status).toBe('ok');
    // tightened warn → 3 > 2 → warn
    expect(
      assessSnapshotFreshness({ dir: snapshotDir, todayIso: TODAY, warnAfterDays: 2, failAfterDays: 9 }).status,
    ).toBe('warn');
    // tightened fail → 3 > 2 → fail
    expect(
      assessSnapshotFreshness({ dir: snapshotDir, todayIso: TODAY, warnAfterDays: 2, failAfterDays: 2 }).status,
    ).toBe('fail');
  });

  // ── Threshold constants (contract pins — design §3.1 named constants) ──────

  test('threshold constants: WARN_AFTER_DAYS=8, FAIL_AFTER_DAYS=15 (named, exported)', () => {
    expect(WARN_AFTER_DAYS).toBe(8);
    expect(FAIL_AFTER_DAYS).toBe(15);
  });
});
