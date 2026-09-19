/**
 * Tests for the verify-scripts.ts --fix helpers (ADR-0081 / T-20260919-002):
 * extractHeaderVersion, buildFixRow, insertRowsIntoRegistry — the primitives
 * that auto-register scripts Check 1 flags as unregistered, so a new
 * project-local script no longer blocks its project's audit until someone
 * hand-writes a SCRIPTS.md row.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  extractHeaderVersion,
  buildFixRow,
  insertRowsIntoRegistry,
} from '../../scripts/verify-scripts.ts';

const SCRIPT_MD = [
  '# SCRIPTS.md — Script Lifecycle Registry',
  '',
  '## Registry',
  '',
  '| script | source | version | status | removal-date | security-advisory | layer | pair |',
  '|--------|--------|---------|--------|--------------|-------------------|-------|------|',
  '| `existing.ts` | L0 | 1.0.0 | active | — | — | common | — |',
  '',
  '## Guide',
  '',
  'notes',
].join('\n');

describe('extractHeaderVersion', () => {
  test('reads the @version header', () => {
    expect(extractHeaderVersion('#!/usr/bin/env bun\n// @version 1.2.3\n// code')).toBe('1.2.3');
  });

  test('defaults to 1.0.0 when no header exists', () => {
    expect(extractHeaderVersion('// no version here')).toBe('1.0.0');
  });
});

describe('buildFixRow', () => {
  test('builds an 8-column registry row', () => {
    expect(buildFixRow('co-newbiz/job-worker.ts', '1.0.0', 'L3', 'L3', '2026-09-19')).toBe(
      '| `co-newbiz/job-worker.ts` | L3 | 1.0.0 | active | 2026-09-19 | — | L3 | — |'
    );
  });
});

describe('insertRowsIntoRegistry', () => {
  test('inserts after the last Registry table row, before the next section', () => {
    const rows = ['| `a.ts` | L0 | 1.0.0 | active | — | — | common | — |'];
    const r = insertRowsIntoRegistry(SCRIPT_MD, rows);
    expect(r).not.toBeNull();
    const out = r!.content.split('\n');
    const inserted = out.findIndex((l) => l.includes('`a.ts`'));
    const guide = out.findIndex((l) => l.startsWith('## Guide'));
    expect(inserted).toBeGreaterThan(0);
    expect(inserted).toBeLessThan(guide);
  });

  test('returns null when no Registry table exists (leave the file untouched)', () => {
    expect(insertRowsIntoRegistry('# no registry\n', ['| `x.ts` | L0 | 1.0.0 | active | — | — | — | — |'])).toBeNull();
  });
});
