#!/usr/bin/env bun
/**
 * audit-fail-hint.test.ts — lib/audit-fail-hint.ts v1.0.0 (T-20261122-004 /
 * U-20261122-010, design docs/designs/2026-11-22-dev-sync-skill-graph-preconvergence-design.md
 * D2): the dev-sync step-3.9 failing-sub-check hint parser. Pure functions over
 * strings — no fs, no spawn.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  failSubCheckBody,
  failSubCheckName,
  formatSpecCheckHint,
  parseAuditFailLines,
  stripAnsi,
} from '../../scripts/lib/audit-fail-hint.ts';

const RED = '\x1b[31m';
const RESET = '\x1b[0m';

describe('stripAnsi', () => {
  test('removes SGR sequences, keeps plain text', () => {
    expect(stripAnsi(`${RED}[FAIL] boom${RESET}`)).toBe('[FAIL] boom');
    expect(stripAnsi('\x1b[1;32mok\x1b[0m')).toBe('ok');
    expect(stripAnsi('plain')).toBe('plain');
  });
});

describe('parseAuditFailLines', () => {
  test('ANSI-wrapped stderr FAIL lines parse correctly', () => {
    const stderr = [
      `${RED}[FAIL] Skill-graph drift detected: docs/skill-graph.json is stale — run bun scripts/generate-skill-graph.ts, review, and commit${RESET}`,
      'some progress line',
      '',
      `${RED}[FAIL] Spec check: 3 code file(s) changed but no recent/relevant spec activity (diff doesn't touch docs/specs|docs/designs) — consider running the brainstorming skill${RESET}`,
    ].join('\n');
    expect(parseAuditFailLines(stderr)).toEqual([
      'Skill-graph drift detected: docs/skill-graph.json is stale — run bun scripts/generate-skill-graph.ts, review, and commit',
      'Spec check: 3 code file(s) changed but no recent/relevant spec activity (diff doesn\'t touch docs/specs|docs/designs) — consider running the brainstorming skill',
    ]);
  });

  test('stdout PASS/WARN rows and non-FAIL stderr lines are ignored', () => {
    expect(parseAuditFailLines('[PASS] x\n[WARN] y\n[FAIL] z')).toEqual(['z']);
    expect(parseAuditFailLines('')).toEqual([]);
    expect(parseAuditFailLines('error: something broke\n  at frame')).toEqual([]);
  });
});

describe('failSubCheckName', () => {
  test('text before the first " — " or ": " separator', () => {
    expect(failSubCheckName('Skill-graph drift detected: docs/x is stale — run bun scripts/generate-skill-graph.ts')).toBe(
      'Skill-graph drift detected',
    );
    expect(failSubCheckName('Spec check: 3 code file(s) changed but no relevant spec activity — consider …')).toBe('Spec check');
    expect(failSubCheckName('em dash first — then colon: later')).toBe('em dash first');
    expect(failSubCheckName('no separator here')).toBe('no separator here');
  });
});

describe('formatSpecCheckHint', () => {
  test('name bullet + indented remainder per FAIL (design D2 point 4 shape)', () => {
    const lines = formatSpecCheckHint([
      'Skill-graph drift detected: docs/skill-graph.json is stale — run bun scripts/generate-skill-graph.ts, review, and commit',
      'Spec check: 3 code file(s) changed but no recent/relevant spec activity — consider running the brainstorming skill',
    ]);
    expect(lines).toEqual([
      '    - Skill-graph drift detected',
      '        docs/skill-graph.json is stale — run bun scripts/generate-skill-graph.ts, review, and commit',
      '    - Spec check',
      '        3 code file(s) changed but no recent/relevant spec activity — consider running the brainstorming skill',
    ]);
  });

  test('a FAIL with no separator renders whole under its own bullet', () => {
    expect(formatSpecCheckHint(['opaque failure'])).toEqual(['    - opaque failure', '        opaque failure']);
  });

  test('failSubCheckBody returns the remainder after the name and separator', () => {
    expect(failSubCheckBody('A: b — c')).toBe('b — c');
    expect(failSubCheckBody('A — b: c')).toBe('b: c');
    expect(failSubCheckBody('no separator')).toBe('no separator');
  });

  test('more than 10 FAILs cap with an "+N more" tail', () => {
    const many = Array.from({ length: 13 }, (_, i) => `Check ${i + 1}: failed detail — remedy`);
    const lines = formatSpecCheckHint(many);
    expect(lines.filter((l) => l.startsWith('    - '))).toHaveLength(10);
    expect(lines[lines.length - 1]).toBe('    … +3 more');
  });

  test('empty input renders nothing', () => {
    expect(formatSpecCheckHint([])).toEqual([]);
  });
});
