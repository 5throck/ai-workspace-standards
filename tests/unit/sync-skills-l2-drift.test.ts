/**
 * Tests for scripts/sync-skills-to-l2.ts v2.0.0 drift machinery
 * (T-20261128-004, design 2026-11-28-origin-l2-drift-design.md §3.3/§3.4/§3.5):
 * numeric classification, the exit-code matrix, fork-declaration loading, and
 * the live-tree post-heal state (check-drift exits 0 with the declared fork
 * rows; apply refuses a declared fork without writing).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  classifyPair,
  isDeclaredFork,
  loadForkDeclarations,
  parseScriptVersion,
  parseSkillVersion,
  rowFailsGate,
} from '../../scripts/sync-skills-to-l2.ts';

const ROOT = join(import.meta.dir, '..', '..');

describe('classifyPair — numeric semver classification (§3.4)', () => {
  test('byte-equal → in-sync (version values irrelevant)', () => {
    expect(classifyPair('a: 1\n', 'a: 1\n', '1.0.0', '1.0.0')).toBe('in-sync');
    expect(classifyPair('x', 'x', null, null)).toBe('in-sync');
  });
  test('missing target → missing', () => {
    expect(classifyPair('a\n', null, '1.0.0', null)).toBe('missing');
  });
  test('NUMERIC: common 1.11.0 vs variant 1.6.0 → L2-STALE (lexicographic would misfile as AHEAD)', () => {
    expect(classifyPair('v 1.11.0\n', 'v 1.6.0\n', '1.11.0', '1.6.0')).toBe('L2-STALE');
  });
  test('variant strictly newer → L2-AHEAD', () => {
    expect(classifyPair('c\n', 'v\n', '1.3.2', '1.3.4')).toBe('L2-AHEAD');
  });
  test('equal versions + differing bytes → SAME-VER-DIFF', () => {
    expect(classifyPair('c\n', 'v\n', '1.2.3', '1.2.3')).toBe('SAME-VER-DIFF');
  });
  test('unparseable versions fall back to 0 and classify conservatively', () => {
    // null common version reads as 0 → a versioned variant copy classifies AHEAD
    expect(classifyPair('c\n', 'v\n', null, '1.0.0')).toBe('L2-AHEAD');
    // both unparseable + differing bytes → needs a human ruling
    expect(classifyPair('c\n', 'v\n', null, null)).toBe('SAME-VER-DIFF');
    expect(classifyPair('c\n', 'v\n', '1.0.0', null)).toBe('L2-STALE');
  });
});

describe('rowFailsGate — the §3.4 exit-code matrix', () => {
  test('L2-STALE always fails (even a declared fork must respond to common-ahead)', () => {
    expect(rowFailsGate({ status: 'L2-STALE', declaredFork: false })).toBe(true);
    expect(rowFailsGate({ status: 'L2-STALE', declaredFork: true })).toBe(true);
  });
  test('missing always fails', () => {
    expect(rowFailsGate({ status: 'missing', declaredFork: false })).toBe(true);
  });
  test('L2-AHEAD fails unless declared; declared fork prints but does not fail', () => {
    expect(rowFailsGate({ status: 'L2-AHEAD', declaredFork: false })).toBe(true);
    expect(rowFailsGate({ status: 'L2-AHEAD', declaredFork: true })).toBe(false);
  });
  test('SAME-VER-DIFF fails unless declared (declared = the retained forks\' post-heal steady state)', () => {
    expect(rowFailsGate({ status: 'SAME-VER-DIFF', declaredFork: false })).toBe(true);
    expect(rowFailsGate({ status: 'SAME-VER-DIFF', declaredFork: true })).toBe(false);
  });
  test('in-sync never fails', () => {
    expect(rowFailsGate({ status: 'in-sync', declaredFork: false })).toBe(false);
  });
});

describe('version readers', () => {
  test('parseSkillVersion reads the frontmatter version', () => {
    expect(parseSkillVersion('---\nname: x\nversion: 1.11.0\n---\nbody')).toBe('1.11.0');
    expect(parseSkillVersion('no frontmatter')).toBeNull();
  });
  test('parseScriptVersion reads the @version header', () => {
    expect(parseScriptVersion('#!/usr/bin/env bun\n// @version 2.0.0\nx')).toBe('2.0.0');
    expect(parseScriptVersion('// no version here\n')).toBeNull();
  });
});

describe('fork declarations (design §3.3 mechanism)', () => {
  test('loadForkDeclarations parses class "fork" entries into (variant, skill) pairs', () => {
    const forks = loadForkDeclarations(ROOT);
    // the live allowlist: 7 L2-AHEAD forks + 5 post-heal retained co-safety forks
    expect(isDeclaredFork(forks, 'co-safety', 'project-review')).toBe(true);
    expect(isDeclaredFork(forks, 'co-work', 'project-review')).toBe(true);
    expect(isDeclaredFork(forks, 'co-price', 'i18n-audit')).toBe(true);
    expect(isDeclaredFork(forks, 'co-design', 'design-foundation')).toBe(true);
    expect(isDeclaredFork(forks, 'co-design', 'token-usage-lint')).toBe(true);
    expect(isDeclaredFork(forks, 'co-design', 'ui-ux-design-intelligence')).toBe(true);
    expect(isDeclaredFork(forks, 'co-work', 'i18n-layout')).toBe(true);
    // post-heal retained declarations
    expect(isDeclaredFork(forks, 'co-safety', 'sync')).toBe(true);
    expect(isDeclaredFork(forks, 'co-safety', 'translate')).toBe(true);
    expect(isDeclaredFork(forks, 'co-safety', 'team-builder')).toBe(true);
    expect(isDeclaredFork(forks, 'co-safety', 'script-lifecycle-manager')).toBe(true);
    expect(isDeclaredFork(forks, 'co-safety', 'skill-lifecycle-manager')).toBe(true);
    // non-declared pairs
    expect(isDeclaredFork(forks, 'co-design', 'accessibility-audit')).toBe(false);
    expect(isDeclaredFork(forks, 'co-safety', 'meeting-facilitation')).toBe(false);
  });
  test('the live allowlist declares exactly 12 (variant, skill) fork pairs across 11 path entries', () => {
    const parsed = JSON.parse(readFileSync(join(ROOT, 'docs', 'templates', 'variant-shadow-allowlist.json'), 'utf-8')) as {
      entries: Array<{ path: string; variants: string[] | string; class: string }>;
    };
    const forkEntries = parsed.entries.filter((e) => e.class === 'fork');
    expect(forkEntries.length).toBe(11);
    const pairs = forkEntries.flatMap((e) =>
      (Array.isArray(e.variants) ? e.variants : [e.variants]).map((v) => `${v}\0${e.path}`),
    );
    expect(pairs.length).toBe(12);
    // all fork entries are origin skill paths
    for (const e of forkEntries) expect(e.path).toMatch(/^skills\/[^/]+\/SKILL\.md$/);
  });
  test('missing allowlist → no declarations (fail-closed: undeclared ahead fails the gate)', () => {
    const forks = loadForkDeclarations(join(ROOT, 'tests', 'unit', 'fixtures', 'nonexistent-root'));
    expect(isDeclaredFork(forks, 'co-safety', 'sync')).toBe(false);
  });
});

describe('live-tree post-heal state (§3.5 regression)', () => {
  test('check-drift exits 0: the 6 healed pairs are gone (accessibility-audit converged byte-identical), 12 fork rows print annotated', async () => {
    const proc = Bun.spawn(['bun', 'scripts/sync-skills-to-l2.ts', '--check-drift'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const out = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(out).not.toMatch(/L2-STALE/);
    expect(out).toContain('No undeclared drift');
    // the 7 re-derived L2-AHEAD forks, declared
    expect(out).toContain('[co-price] skill i18n-audit: L2-AHEAD');
    expect(out).toContain('[co-design] skill design-foundation: L2-AHEAD');
    expect(out).toContain('[co-design] skill token-usage-lint: L2-AHEAD');
    expect(out).toContain('[co-design] skill ui-ux-design-intelligence: L2-AHEAD');
    expect(out).toContain('[co-work] skill project-review: L2-AHEAD');
    expect(out).toContain('[co-work] skill i18n-layout: L2-AHEAD');
    expect(out).toContain('[co-safety] skill project-review: L2-AHEAD');
    // the 5 post-heal retained forks at equal versions
    expect(out).toContain('[co-safety] skill sync: SAME-VER-DIFF');
    expect(out).toContain('[co-safety] skill translate: SAME-VER-DIFF');
    expect((out.match(/\[declared fork\]/g) ?? []).length).toBe(12);
    // healed pair no longer reported stale
    expect(out).not.toContain('skill accessibility-audit: L2-STALE');
  });

  test('apply against a declared fork is REFUSED and writes nothing', async () => {
    const target = join(ROOT, 'templates', 'co-work', 'skills', 'project-review', 'SKILL.md');
    const before = readFileSync(target, 'utf-8');
    const proc = Bun.spawn(
      ['bun', 'scripts/sync-skills-to-l2.ts', '--variant=co-work', '--skill=project-review', '--apply'],
      { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' },
    );
    const err = await new Response(proc.stderr).text();
    const code = await proc.exited;
    expect(code).toBe(1);
    expect(err).toContain('REFUSED');
    expect(err).toContain('declared fork');
    expect(readFileSync(target, 'utf-8')).toBe(before); // no write
  });
});
