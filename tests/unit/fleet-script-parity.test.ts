// fleet-script-parity unit tests — fixture-based (no filesystem fixtures).
// Pins the pure core of scripts/fleet-script-parity.ts (spec
// docs/designs/2026-11-01-hub-consolidation-design.md §8 Phase 4 — the
// WARN-soak script-parity report — as extended by
// docs/designs/2026-11-10-delivery-gating-hardening-design.md §4 Scope B +
// C-B, PR-1): hash-primary row classes with @version as classifier only
// (mismatch-equal-version fork / version-ahead pending-port / version-behind
// pending-delivery / mismatch fallback), LOCAL-PATCH labels, orphan-test
// detection, and the repo summary roll-up (parity counts unexplained
// divergence only).
import { describe, expect, test } from 'bun:test';
import {
  compareScriptSet,
  compareSemver,
  extractVersion,
  findOrphanTests,
  orphanSubjectCandidates,
  summarize,
  type ScriptRow,
} from '../../scripts/fleet-script-parity.ts';

const CANONICAL = {
  'audit.ts': 'hash-audit-v1',
  'dev-sync.ts': 'hash-devsync-v1',
  'lib/shared.ts': 'hash-shared-v1',
};

describe('compareScriptSet', () => {
  test('classifies match / mismatch / missing per canonical script (v1 behavior, no options)', () => {
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

describe('compareScriptSet — @version classifier (Scope B row classes)', () => {
  const versions = {
    templateVersions: {
      'audit.ts': '1.2.0',
      'dev-sync.ts': '1.3.0',
      'lib/shared.ts': '2.0.0',
    },
    projectVersions: {
      'audit.ts': '1.2.0', // equal version, divergent bytes → the fork class
      'dev-sync.ts': '1.5.0', // project newer → pending port
      'lib/shared.ts': '1.8.0', // template newer → pending delivery
    },
  };

  test('equal @version + divergent bytes is mismatch-equal-version (the fork class)', () => {
    const observed = { ...CANONICAL, 'audit.ts': 'hash-audit-FORKED' };
    const rows = compareScriptSet(CANONICAL, observed, 'co-fork', versions);
    expect(rows.find((r) => r.script === 'audit.ts')?.status).toBe('mismatch-equal-version');
  });

  test('project @version newer with divergent bytes is version-ahead (pending port, INFO)', () => {
    const observed = { ...CANONICAL, 'dev-sync.ts': 'hash-devsync-PORTED' };
    const rows = compareScriptSet(CANONICAL, observed, 'co-ahead', versions);
    expect(rows.find((r) => r.script === 'dev-sync.ts')?.status).toBe('version-ahead');
  });

  test('template @version newer with divergent bytes is version-behind (pending delivery)', () => {
    const observed = { ...CANONICAL, 'lib/shared.ts': 'hash-shared-STALE' };
    const rows = compareScriptSet(CANONICAL, observed, 'co-behind', versions);
    expect(rows.find((r) => r.script === 'lib/shared.ts')?.status).toBe('version-behind');
  });

  test('hash-equal rows are match regardless of the version classifier', () => {
    const rows = compareScriptSet(CANONICAL, { ...CANONICAL }, 'co-same', versions);
    expect(rows.every((r) => r.status === 'match')).toBe(true);
  });

  test('hash-diff without a parseable @version on either side falls back to mismatch', () => {
    const noVersion = {
      templateVersions: { 'audit.ts': '1.2.0', 'dev-sync.ts': '', 'lib/shared.ts': '2.0.0' },
      projectVersions: { 'audit.ts': '', 'dev-sync.ts': '1.5.0', 'lib/shared.ts': '2.0.0' },
    };
    const observed = {
      'audit.ts': 'hash-audit-X',
      'dev-sync.ts': 'hash-devsync-X',
      'lib/shared.ts': 'hash-shared-X',
    };
    const rows = compareScriptSet(CANONICAL, observed, 'co-nov', noVersion);
    expect(rows.find((r) => r.script === 'audit.ts')?.status).toBe('mismatch');
    expect(rows.find((r) => r.script === 'dev-sync.ts')?.status).toBe('mismatch');
    // both sides say 2.0.0 but hashes differ — equal-version classifier wins
    expect(rows.find((r) => r.script === 'lib/shared.ts')?.status).toBe('mismatch-equal-version');
  });
});

describe('compareScriptSet — LOCAL-PATCH labels (C-B)', () => {
  test('a divergent project file with markers is labeled local-patch (ticket id)', () => {
    const observed = { ...CANONICAL, 'dev-sync.ts': 'hash-devsync-PATCHED' };
    const rows = compareScriptSet(CANONICAL, observed, 'co-p', {
      templateVersions: { 'dev-sync.ts': '1.3.0' },
      projectVersions: { 'dev-sync.ts': '1.3.0' },
      localPatchIds: { 'dev-sync.ts': ['U-20261105-002'] },
    });
    const row = rows.find((r) => r.script === 'dev-sync.ts');
    expect(row?.status).toBe('mismatch-equal-version');
    expect(row?.label).toBe('local-patch (U-20261105-002)');
  });

  test('multiple distinct marker ids join into one label', () => {
    const observed = { ...CANONICAL, 'dev-sync.ts': 'hash-devsync-PATCHED' };
    const rows = compareScriptSet(CANONICAL, observed, 'co-p2', {
      localPatchIds: { 'dev-sync.ts': ['U-1', 'U-2'] },
    });
    expect(rows.find((r) => r.script === 'dev-sync.ts')?.label).toBe('local-patch (U-1, U-2)');
  });

  test('a byte-identical file is never labeled, even when it carries a stale marker', () => {
    const rows = compareScriptSet(CANONICAL, { ...CANONICAL }, 'co-clean', {
      localPatchIds: { 'dev-sync.ts': ['U-STALE'] },
    });
    const row = rows.find((r) => r.script === 'dev-sync.ts');
    expect(row?.status).toBe('match');
    expect(row?.label).toBeUndefined();
  });
});

describe('orphan-test detection (C-B)', () => {
  const tracked = {
    'helpers/security-validator.ts': 'hash-sv',
    'gen.mjs': 'hash-gen',
    'config.json': 'hash-cfg',
    'tests/snapshot-self-reference.test.ts': 'hash-tracked-test',
  };

  test('a project-only X.test.ts beside a tracked X.ts is an orphan', () => {
    const observed = { ...tracked, 'helpers/security-validator.test.ts': 'hash-orphan' };
    expect(findOrphanTests(tracked, observed)).toEqual(['helpers/security-validator.test.ts']);
  });

  test('a project-only test whose subject is itself project-only is NOT an orphan', () => {
    const observed = { ...tracked, 'handbook/build-search-index.test.ts': 'hash-local' };
    expect(findOrphanTests(tracked, observed)).toEqual([]);
  });

  test('a tracked X.test.ts is a compared pair, not an orphan', () => {
    expect(findOrphanTests(tracked, { ...tracked })).toEqual([]);
  });

  test('.mjs and .json subjects count as tracked', () => {
    const observed = { ...tracked, 'gen.test.ts': 'hash-a', 'config.test.ts': 'hash-b' };
    expect(findOrphanTests(tracked, observed)).toEqual(['config.test.ts', 'gen.test.ts']);
  });

  test('subject candidates are same-directory (the design "beside") with ext fallbacks', () => {
    expect(orphanSubjectCandidates('helpers/security-validator.test.ts')).toEqual([
      'helpers/security-validator.ts',
      'helpers/security-validator.mjs',
      'helpers/security-validator.json',
    ]);
    expect(orphanSubjectCandidates('root.test.ts')).toEqual([
      'root.ts',
      'root.mjs',
      'root.json',
    ]);
  });
});

describe('compareSemver / extractVersion', () => {
  test('numeric dot-component comparison', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1);
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
    expect(compareSemver('0.1.0', '0.2.0')).toBe(-1);
  });

  test('extractVersion reads the @version header (upgrade-project convention)', () => {
    expect(extractVersion('// @version 1.14.4 — notes\n// body', 'gen-slides-pdf.ts')).toBe('1.14.4');
    expect(extractVersion('#!/usr/bin/env bun\n// no version here', 'x.ts')).toBe('');
  });

  test('extractVersion falls back to a version key for .json files', () => {
    expect(extractVersion('{ "name": "x", "version": "1.2.3" }', 'package.json')).toBe('1.2.3');
    // .ts files do not consult the JSON key
    expect(extractVersion('{ "version": "1.2.3" }', 'not-json.ts')).toBe('');
  });
});

describe('summarize', () => {
  test('full parity when zero unexplained divergence; extras and INFO rows do not block parity', () => {
    const rows: ScriptRow[] = [
      { script: 'audit.ts', status: 'match', project: 'co-full' },
      { script: 'gen.ts', status: 'version-ahead', project: 'co-full' }, // pending port — INFO
      { script: 'stale.ts', status: 'version-behind', project: 'co-full' }, // pending delivery — INFO
      { script: 'helpers/x.test.ts', status: 'orphan-test', project: 'co-full', label: 'adopt (register L3) or delete' },
    ];
    const s = summarize('co-full', rows, 2, 'co-full');
    expect(s).toEqual({
      project: 'co-full',
      variant: 'co-full',
      match: 1,
      mismatch: 0,
      fork: 0,
      ahead: 1,
      behind: 1,
      missing: 0,
      orphanTest: 1,
      localPatch: 0,
      extra: 2,
      parity: true,
    });
  });

  test('fork rows break parity unless labeled local-patch; labels mark intentional divergence', () => {
    const forked: ScriptRow[] = [{ script: 'a.ts', status: 'mismatch-equal-version', project: 'co-d' }];
    expect(summarize('co-d', forked, 0).parity).toBe(false);
    const patched: ScriptRow[] = [
      { script: 'a.ts', status: 'mismatch-equal-version', project: 'co-d', label: 'local-patch (U-20261029-002)' },
    ];
    const s = summarize('co-d', patched, 0);
    expect(s.parity).toBe(true);
    expect(s.localPatch).toBe(1);
    expect(s.fork).toBe(1);
  });

  test('mismatch and missing always break parity; common section carries variant=null', () => {
    const drifted = compareScriptSet(CANONICAL, { ...CANONICAL, 'dev-sync.ts': 'x' }, 'co-m');
    expect(summarize('co-m', drifted, 0).parity).toBe(false);
    const absent = compareScriptSet(CANONICAL, { 'audit.ts': CANONICAL['audit.ts'] }, 'co-mm');
    expect(summarize('co-mm', absent, 0).parity).toBe(false);
    expect(summarize('co-mm', absent, 0).variant).toBeNull();
    // a local-patch label on the missing row is impossible (the file is absent)
    expect(summarize('co-mm', absent, 0).localPatch).toBe(0);
  });
});
