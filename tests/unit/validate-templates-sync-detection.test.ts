#!/usr/bin/env bun
// @version 1.0.0
// validate-templates-sync-detection.test.ts — syncDetection gate shape check + schema
// registration pins (spec docs/designs/2026-11-17-sync-auto-detection-design.md §5.1/§8,
// detection batch PR-C, T-20261118-001).
//
// Pins:
//   1. collectSyncDetectionIssues — absent key and valid block are no-ops; every
//      malformed shape from the §5.1 gate spec (non-object block, enabled
//      non-boolean/missing, max_tickets_per_sync outside 1..5 or non-integer,
//      retired_tokens not a string array) yields exactly one clear FAIL message
//      (SSOT: parseSyncDetection in scripts/detect-backport.ts).
//   2. Schema registration — docs/workspace-schema.json AND its hand-maintained
//      L1 pair templates/common/docs/workspace-schema.json (DEC-20261028-05 parity)
//      declare variant_extensions._shared.syncDetection with the same contract
//      (required: enabled; optional: max_tickets_per_sync, retired_tokens).
//   3. SCRIPTS.md registry — the detect-backport.ts row carries layer L0+L1 on BOTH
//      layers and the validate-templates.ts row is 1.86.0 on BOTH layers (the L1
//      mirror publish + validator bump this batch delivers).
//   4. L1 mirror presence — templates/common/scripts/detect-backport.ts exists and
//      is byte-identical to the L0 root script (no CONSTITUTION.md refs in the
//      detector, so scrubConstitutionRefs is a no-op and parity is byte-exact).
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectSyncDetectionIssues } from '../../scripts/validate-templates.ts';

const ROOT = join(import.meta.dir, '..', '..');

const sd = (block: unknown) => ({ syncDetection: block }) as Record<string, unknown>;

describe('collectSyncDetectionIssues (spec §5.1 gate spec)', () => {
  test('absent key is a no-op — every project starts OFF by omission', () => {
    expect(collectSyncDetectionIssues({})).toEqual([]);
    expect(collectSyncDetectionIssues(null)).toEqual([]);
    expect(collectSyncDetectionIssues({ other_extension: {} })).toEqual([]);
  });

  test('valid block passes (enabled true/false, cap in range, string tokens, optional fields omitted)', () => {
    expect(collectSyncDetectionIssues(sd({ enabled: true }))).toEqual([]);
    expect(collectSyncDetectionIssues(sd({ enabled: false }))).toEqual([]);
    expect(collectSyncDetectionIssues(sd({ enabled: true, max_tickets_per_sync: 1 }))).toEqual([]);
    expect(collectSyncDetectionIssues(sd({ enabled: true, max_tickets_per_sync: 5 }))).toEqual([]);
    expect(collectSyncDetectionIssues(sd({ enabled: true, retired_tokens: ['graft'] }))).toEqual([]);
    expect(
      collectSyncDetectionIssues(sd({ enabled: true, max_tickets_per_sync: 3, retired_tokens: [] })),
    ).toEqual([]);
  });

  test('non-boolean enabled FAILs with a clear message', () => {
    expect(collectSyncDetectionIssues(sd({ enabled: 'yes' }))).toEqual([
      'syncDetection.enabled is not a boolean',
    ]);
  });

  test('missing enabled FAILs (required field)', () => {
    expect(collectSyncDetectionIssues(sd({ max_tickets_per_sync: 3 }))).toEqual([
      'syncDetection.enabled is not a boolean',
    ]);
  });

  test('cap outside 1..5 FAILs; non-integer cap FAILs', () => {
    expect(collectSyncDetectionIssues(sd({ enabled: true, max_tickets_per_sync: 9 }))).toEqual([
      'syncDetection.max_tickets_per_sync must be an integer 1..5',
    ]);
    expect(collectSyncDetectionIssues(sd({ enabled: true, max_tickets_per_sync: 0 }))).toEqual([
      'syncDetection.max_tickets_per_sync must be an integer 1..5',
    ]);
    expect(collectSyncDetectionIssues(sd({ enabled: true, max_tickets_per_sync: 2.5 }))).toEqual([
      'syncDetection.max_tickets_per_sync must be an integer 1..5',
    ]);
    expect(collectSyncDetectionIssues(sd({ enabled: true, max_tickets_per_sync: '3' }))).toEqual([
      'syncDetection.max_tickets_per_sync must be an integer 1..5',
    ]);
  });

  test('retired_tokens not a string array FAILs (§8: tokens [1])', () => {
    expect(collectSyncDetectionIssues(sd({ enabled: true, retired_tokens: [1] }))).toEqual([
      'syncDetection.retired_tokens must be an array of strings',
    ]);
    expect(collectSyncDetectionIssues(sd({ enabled: true, retired_tokens: 'graft' }))).toEqual([
      'syncDetection.retired_tokens must be an array of strings',
    ]);
    expect(collectSyncDetectionIssues(sd({ enabled: true, retired_tokens: ['graft', 2] }))).toEqual([
      'syncDetection.retired_tokens must be an array of strings',
    ]);
  });

  test('non-object block FAILs', () => {
    expect(collectSyncDetectionIssues(sd('on'))).toEqual(['syncDetection block is not an object']);
    expect(collectSyncDetectionIssues(sd(null))).toEqual(['syncDetection block is not an object']);
    expect(collectSyncDetectionIssues(sd([true]))).toEqual(['syncDetection block is not an object']);
  });
});

describe('syncDetection schema registration (variant_extensions._shared)', () => {
  const schemaPaths = [
    join(ROOT, 'docs', 'workspace-schema.json'),
    join(ROOT, 'templates', 'common', 'docs', 'workspace-schema.json'),
  ];

  test('both hand-maintained copies declare the block (DEC-20261028-05 pair)', () => {
    for (const p of schemaPaths) {
      expect(existsSync(p)).toBe(true);
    }
  });

  test('block contract: required enabled; optional cap + tokens; identical on both copies', () => {
    const blocks = schemaPaths.map((p) => {
      const schema = JSON.parse(readFileSync(p, 'utf-8')) as {
        variant_extensions?: { _shared?: { syncDetection?: Record<string, unknown> } };
      };
      const block = schema.variant_extensions?._shared?.syncDetection;
      expect(block).toBeDefined();
      return block as Record<string, unknown>;
    });
    for (const block of blocks) {
      expect(block.required_fields).toEqual(['enabled']);
      expect(block.optional_fields).toEqual(['max_tickets_per_sync', 'retired_tokens']);
      const desc = String(block.description);
      expect(desc).toContain('ABSENT KEY MEANS OFF');
      expect(desc).toContain('2026-11-17-sync-auto-detection-design.md');
    }
    // The two copies must agree byte-for-byte on the registered block (the
    // sanctioned DEC-20261028-05 delta lives elsewhere — rootAllowlist).
    expect(JSON.stringify(blocks[0])).toBe(JSON.stringify(blocks[1]));
  });
});

describe('SCRIPTS.md registry rows (both layers) + L1 mirror presence', () => {
  const read = (p: string) => readFileSync(p, 'utf-8');

  test('detect-backport.ts row carries layer L0+L1 on root and common SCRIPTS.md', () => {
    for (const rel of ['scripts/SCRIPTS.md', 'templates/common/scripts/SCRIPTS.md']) {
      const row = read(join(ROOT, rel))
        .split('\n')
        .find((l) => l.startsWith('| `detect-backport.ts` |'));
      expect(row, `${rel} detect-backport.ts row`).toBeDefined();
      expect(row!.endsWith('| —| L0+L1 | —|'), `${rel} layer column`).toBe(true);
    }
  });

  test('validate-templates.ts row is 1.87.0 on root and common SCRIPTS.md', () => {
    for (const rel of ['scripts/SCRIPTS.md', 'templates/common/scripts/SCRIPTS.md']) {
      const row = read(join(ROOT, rel))
        .split('\n')
        .find((l) => l.startsWith('| `validate-templates.ts` |'));
      expect(row, `${rel} validate-templates.ts row`).toBeDefined();
      expect(row).toContain('| L0 | 1.87.0 | active |');
    }
  });

  test('L1 mirror of detect-backport.ts exists and is byte-identical to the root script', () => {
    const rootScript = join(ROOT, 'scripts', 'detect-backport.ts');
    const l1Mirror = join(ROOT, 'templates', 'common', 'scripts', 'detect-backport.ts');
    expect(existsSync(rootScript)).toBe(true);
    expect(existsSync(l1Mirror)).toBe(true);
    expect(readFileSync(l1Mirror).equals(readFileSync(rootScript))).toBe(true);
  });
});
