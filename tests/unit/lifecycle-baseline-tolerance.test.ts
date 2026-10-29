#!/usr/bin/env bun
// @version 1.0.0
// lifecycle-baseline-tolerance.test.ts — A2 baseline-hash-equality tolerance
//
// Covers the shared helpers behind agent-lifecycle-audit Check 11 and
// skill-lifecycle-audit Check SD (spec
// docs/designs/2026-10-29-delivery-bookkeeping-engine-design.md §3.A2,
// DEC-20261029-01 PR2): a flagged staleness warning is suppressed to an INFO
// line only while the file's current bytes hash-match the delivered baseline
// recorded in the in-project .claude/last-upgrade-delivery.json manifest.
// Degenerate manifest forms (absent, corrupt, v1-shaped) degrade to the
// pre-tolerance behavior — never to a false suppression.

import { test, expect, describe } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadDeliveryBaselineManifest,
  isDeliveredBaselineEqual,
  deliveryStalenessInfoLine,
  resetDeliveryManifestCache,
  type DeliveryBaselineManifest,
} from '../../scripts/agent-lifecycle-audit.ts';
import { baselineKeyFor } from '../../scripts/lib/upgrade-policy.ts';

// A wave-delivered agent file as PR1 writes it: top-level last_updated +
// nested lifecycle block (the exact lines the re-stamp owns).
const DELIVERED_AGENT = [
  '---',
  'name: storyteller',
  'version: 1.1.0',
  'last_updated: 2026-10-27',
  'lifecycle:',
  '  phase: production',
  '  created: 2026-06-09',
  '  last_updated: 2026-10-27',
  '---',
  '',
  '## Role',
  '',
  'Tell the story.',
  '',
].join('\n');

const tmpRoot = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), `lc-baseline-${prefix}-`));
  mkdirSync(join(dir, '.claude'), { recursive: true });
  return dir;
};

describe('isDeliveredBaselineEqual (design 2026-10-29-delivery-bookkeeping-engine §3.A2)', () => {
  test('flagged + baseline hash-match: tolerance fires (suppress to INFO)', () => {
    const rel = 'skills/storyteller/SKILL.md';
    const manifest: DeliveryBaselineManifest = {
      templateVersion: '0.23.0',
      baselines: { [rel]: { hash: baselineKeyFor(rel, DELIVERED_AGENT) } },
    };
    expect(isDeliveredBaselineEqual(rel, DELIVERED_AGENT, manifest)).toBe(true);
  });

  test('agents/ form: re-stamped last_updated lines do not break hash equality', () => {
    // The delivery writer records baselineKeyFor('agents/…', written bytes) —
    // the lifecycleless form — so PR1's top-level + nested last_updated re-stamp
    // must not read as drift on the next audit.
    const rel = 'agents/storyteller.md';
    const restamped = DELIVERED_AGENT
      .replace('last_updated: 2026-10-27\nlifecycle:', 'last_updated: 2026-10-28\nlifecycle:')
      .replace('  last_updated: 2026-10-27\n---', '  last_updated: 2026-10-28\n---');
    expect(restamped).not.toBe(DELIVERED_AGENT); // guard: the re-stamp really moved bytes
    const manifest: DeliveryBaselineManifest = {
      templateVersion: '0.23.0',
      baselines: { [rel]: { hash: baselineKeyFor(rel, DELIVERED_AGENT) } },
    };
    expect(isDeliveredBaselineEqual(rel, restamped, manifest)).toBe(true);
  });

  test('flagged + bytes differ (genuine project edit): still flagged', () => {
    const rel = 'skills/storyteller/SKILL.md';
    const edited = DELIVERED_AGENT.replace('Tell the story.', 'Tell the story, better.');
    expect(edited).not.toBe(DELIVERED_AGENT);
    const manifest: DeliveryBaselineManifest = {
      templateVersion: '0.23.0',
      baselines: { [rel]: { hash: baselineKeyFor(rel, DELIVERED_AGENT) } },
    };
    expect(isDeliveredBaselineEqual(rel, edited, manifest)).toBe(false);
  });

  test('no manifest (workspace root — L0): tolerance inert', () => {
    expect(isDeliveredBaselineEqual('skills/storyteller/SKILL.md', DELIVERED_AGENT, null)).toBe(false);
  });

  test('manifest without a baseline entry for the path: not suppressed', () => {
    const manifest: DeliveryBaselineManifest = {
      templateVersion: '0.23.0',
      baselines: { 'agents/other.md': { hash: 'deadbeef' } },
    };
    expect(isDeliveredBaselineEqual('skills/storyteller/SKILL.md', DELIVERED_AGENT, manifest)).toBe(false);
  });

  test('hash mismatch by construction (baseline hash of different content): not suppressed', () => {
    const rel = 'skills/storyteller/SKILL.md';
    const manifest: DeliveryBaselineManifest = {
      templateVersion: '0.23.0',
      baselines: { [rel]: { hash: 'a'.repeat(64) } },
    };
    expect(isDeliveredBaselineEqual(rel, DELIVERED_AGENT, manifest)).toBe(false);
  });
});

describe('deliveryStalenessInfoLine (design §3.A2 INFO wording)', () => {
  test('names the path, both dates, and the templateVersion', () => {
    const manifest: DeliveryBaselineManifest = {
      templateVersion: '0.23.0',
      baselines: {},
    };
    const line = deliveryStalenessInfoLine('skills/storyteller/SKILL.md', '2026-10-01', '2026-10-27', manifest);
    expect(line).toContain('skills/storyteller/SKILL.md');
    expect(line).toContain('(2026-10-01)');
    expect(line).toContain('(2026-10-27)');
    expect(line).toContain('delivery v0.23.0');
    expect(line).toContain('review stamp intentionally not engine-managed');
  });
});

describe('loadDeliveryBaselineManifest (lazy, cached; degenerate forms degrade)', () => {
  test('absent manifest (in-project file missing — L0 posture) → null', () => {
    resetDeliveryManifestCache();
    const dir = tmpRoot('absent');
    try {
      expect(loadDeliveryBaselineManifest(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('corrupt manifest (invalid JSON) → null — tolerate-degrade, never suppress', () => {
    resetDeliveryManifestCache();
    const dir = tmpRoot('corrupt');
    try {
      writeFileSync(join(dir, '.claude', 'last-upgrade-delivery.json'), '{not json at all', 'utf-8');
      expect(loadDeliveryBaselineManifest(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('v1-shaped manifest (no baselines key) → null — no suppression', () => {
    resetDeliveryManifestCache();
    const dir = tmpRoot('v1shape');
    try {
      writeFileSync(
        join(dir, '.claude', 'last-upgrade-delivery.json'),
        JSON.stringify({ schemaVersion: 1, timestamp: '2026-10-27T00:00:00Z', files: ['AGENTS.md'] }),
        'utf-8',
      );
      expect(loadDeliveryBaselineManifest(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('missing templateVersion → null (structurally wrong manifest degrades)', () => {
    resetDeliveryManifestCache();
    const dir = tmpRoot('nover');
    try {
      writeFileSync(
        join(dir, '.claude', 'last-upgrade-delivery.json'),
        JSON.stringify({ schemaVersion: 2, baselines: {} }),
        'utf-8',
      );
      expect(loadDeliveryBaselineManifest(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('valid v2 manifest parses (templateVersion + baselines preserved)', () => {
    resetDeliveryManifestCache();
    const dir = tmpRoot('valid');
    try {
      writeFileSync(
        join(dir, '.claude', 'last-upgrade-delivery.json'),
        JSON.stringify({
          schemaVersion: 2,
          timestamp: '2026-10-27T00:00:00Z',
          project: 'co-safety',
          templateVersion: '0.23.0',
          files: [],
          baselines: { 'agents/pm.md': { hash: 'c'.repeat(64), templateVersion: '0.23.0' } },
          decisions: [],
        }),
        'utf-8',
      );
      const manifest = loadDeliveryBaselineManifest(dir);
      expect(manifest).not.toBeNull();
      expect(manifest!.templateVersion).toBe('0.23.0');
      expect(manifest!.baselines['agents/pm.md'].hash).toBe('c'.repeat(64));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reads ONCE per root (cached across calls); reset re-reads from disk', () => {
    resetDeliveryManifestCache();
    const dir = tmpRoot('cache');
    const manifestPath = join(dir, '.claude', 'last-upgrade-delivery.json');
    try {
      writeFileSync(
        manifestPath,
        JSON.stringify({ schemaVersion: 2, templateVersion: '0.23.0', baselines: {} }),
        'utf-8',
      );
      expect(loadDeliveryBaselineManifest(dir)!.templateVersion).toBe('0.23.0');
      // Mutate on disk AFTER the first read: the cache must still serve the
      // first result (one read per audit run).
      writeFileSync(
        manifestPath,
        JSON.stringify({ schemaVersion: 2, templateVersion: '9.9.9', baselines: {} }),
        'utf-8',
      );
      expect(readFileSync(manifestPath, 'utf-8')).toContain('9.9.9'); // disk really changed
      expect(loadDeliveryBaselineManifest(dir)!.templateVersion).toBe('0.23.0');
      // Different root → different cache slot (never serves another root's manifest).
      const other = tmpRoot('cache-other');
      try {
        expect(loadDeliveryBaselineManifest(other)).toBeNull();
      } finally {
        rmSync(other, { recursive: true, force: true });
      }
      // Explicit reset re-reads from disk.
      resetDeliveryManifestCache();
      expect(loadDeliveryBaselineManifest(dir)!.templateVersion).toBe('9.9.9');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
