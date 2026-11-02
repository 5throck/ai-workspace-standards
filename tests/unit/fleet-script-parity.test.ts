// fleet-script-parity unit tests — fixture-based (no filesystem fixtures).
// Pins the pure core of scripts/fleet-script-parity.ts: per-script
// match/mismatch/missing classification (spec
// docs/designs/2026-11-01-hub-consolidation-design.md §8 Phase 4, the
// WARN-soak script-parity report) and the repo summary roll-up.
import { describe, expect, test } from 'bun:test';
import {
  compareScriptSet,
  summarize,
  type ScriptRow,
} from '../../scripts/fleet-script-parity.ts';

const CANONICAL = {
  'audit.ts': 'hash-audit-v1',
  'dev-sync.ts': 'hash-devsync-v1',
  'lib/shared.ts': 'hash-shared-v1',
};

describe('compareScriptSet', () => {
  test('classifies match / mismatch / missing per canonical script', () => {
    const observed = {
      'audit.ts': 'hash-audit-v1', // identical
      'dev-sync.ts': 'hash-devsync-EDITED', // drifted content
      'lib/shared.ts': 'hash-shared-v1', // identical
    };
    const rows = compareScriptSet(CANONICAL, observed, 'co-x');
    expect(rows).toEqual([
      { script: 'audit.ts', status: 'match', project: 'co-x' },
      { script: 'dev-sync.ts', status: 'mismatch', project: 'co-x' },
      { script: 'lib/shared.ts', status: 'match', project: 'co-x' },
    ]);
  });

  test('a canonical script absent from the project tree is missing, not mismatch', () => {
    const observed = { 'audit.ts': 'hash-audit-v1' };
    const rows = compareScriptSet(CANONICAL, observed, 'co-y');
    const missing = rows.find((r) => r.script === 'dev-sync.ts');
    expect(missing?.status).toBe('missing');
    // extra project-only files (variant hooks) are invisible to the core —
    // the caller counts them separately.
    expect(rows.every((r) => Object.keys(CANONICAL).includes(r.script))).toBe(true);
  });

  test('an empty project tree marks every canonical script missing', () => {
    const rows: ScriptRow[] = compareScriptSet(CANONICAL, {}, 'co-z');
    expect(rows.every((r) => r.status === 'missing')).toBe(true);
  });
});

describe('summarize', () => {
  test('full parity when zero mismatch and zero missing', () => {
    const rows = compareScriptSet(CANONICAL, { ...CANONICAL }, 'co-full');
    const s = summarize('co-full', rows, 2);
    expect(s).toEqual({ project: 'co-full', match: 3, mismatch: 0, missing: 0, extra: 2, parity: true });
  });

  test('parity=false on any mismatch or missing; extras do not block parity', () => {
    const drifted = compareScriptSet(CANONICAL, { ...CANONICAL, 'dev-sync.ts': 'x' }, 'co-d');
    expect(summarize('co-d', drifted, 0).parity).toBe(false);
    const absent = compareScriptSet(CANONICAL, { 'audit.ts': CANONICAL['audit.ts'] }, 'co-m');
    expect(summarize('co-m', absent, 0).parity).toBe(false);
  });
});
