#!/usr/bin/env bun
// @version 1.0.0
// validate-decisions-gitignore.test.ts — U-20261128-004 (spec
// docs/designs/2026-11-28-sync-worktree-robustness-design.md §4.4).
//
// Pins the gitignore-aware knowledge_refs degradation against the CLI contract
// (dev-sync step 3.96b runs `bun scripts/validate-decisions.ts`; each test
// spawns the real script with --json against a fixture cwd):
//   - KG1 absent ref matching a .gitignore pattern (.env) → WARNING
//     `knowledge-gitignored`, exit 0, surfaced in skippedGitignored;
//   - KG2 absent ref NOT ignored → fatal error, exit 1 (fail-visible, unchanged);
//   - KG3 the ref's file PRESENT → no finding at all (today's behavior — the
//     class only relaxes absent+gitignored);
//   - KG4 absent ref inside a gitignored DIRECTORY pattern (.venv/ prefix) →
//     warning;
//   - KG5 non-git directory + absent ref → fatal error with the
//     "git check-ignore unavailable — fail-closed" note (the old contract is
//     preserved whenever classification is impossible);
//   - KG6 glob metacharacters are exempt from the skip class — a `*?[` ref
//     stays fatal on miss (check-ignore does not glob).

import { describe, test, expect, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as os from 'node:os';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const WORKSPACE_ROOT = join(import.meta.dir, '..', '..');
const SCRIPT = join(WORKSPACE_ROOT, 'scripts', 'validate-decisions.ts');
const TEMP_BASE = join(WORKSPACE_ROOT, 'tests', '.temp');

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeFixture(tag: string, inRepoTree: boolean = true): string {
  const base = inRepoTree ? TEMP_BASE : os.tmpdir();
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, `val-dec-gitignore-${tag}-`));
  createdDirs.push(dir);
  mkdirSync(join(dir, 'docs', 'decisions'), { recursive: true });
  // The fixtures live inside the real workspace tree; without their own repo,
  // check-ignore would inherit the repo's tests/.temp ignore patterns and
  // classify EVERY fixture path as ignored (KG2/KG6 could never exercise the
  // not-ignored arm). Each fixture becomes its own tiny repo so pattern
  // evaluation is fixture-local; KG5 (fail-closed) stays a non-repo by design.
  if (inRepoTree) {
    // fixture-git adoption (FM1+FM2, design docs/designs/2026-11-09-repo-integrity-mode1-detector-design.md §3.5).
    assertCallerEnvSafeForGitFixtures(dir);
    const init = spawnSync('git', ['init', '-q'], { cwd: dir, env: gitCleanEnv(), encoding: 'utf-8' });
    if (init.status !== 0) throw new Error(`fixture git init failed: ${init.stderr}`);
    assertFixtureGitIdentity(dir);
  }
  return dir;
}

function writeDecision(fixture: string, stem: string, knowledgeRefs: string[]): void {
  const body = [
    '---',
    `id: ${stem}`,
    'date: 2026-11-28',
    'agent: automation-engineer',
    'status: accepted',
    'skills_used: []',
    `knowledge_refs: [${knowledgeRefs.map((r) => `"${r}"`).join(', ')}]`,
    'evidence_refs: []',
    'rules_applied: []',
    'decision: >-',
    '  Fixture decision record for the gitignore-aware degradation matrix.',
    'alternatives: >-',
    '  (None — fixture.)',
    '---',
    '',
    '## Context',
    '',
    'Fixture.',
    '',
  ];
  // The block-scalar decision/alternatives fields keep the required-field check
  // green; knowledge_refs rides the inline-array form the validator parses.
  writeFileSync(join(fixture, 'docs', 'decisions', `${stem}.md`), body.join('\n'), 'utf8');
}

interface JsonOut {
  errors: { file: string; check: string; message: string }[];
  warnings: { file: string; check: string; message: string }[];
  skippedGitignored: { file: string; ref: string }[];
  summary: string;
}

function runValidator(fixture: string): { status: number; out: JsonOut } {
  const r = spawnSync('bun', [SCRIPT, '--json'], { cwd: fixture, encoding: 'utf-8' });
  const start = r.stdout.indexOf('{');
  expect(start, r.stdout + r.stderr).toBeGreaterThanOrEqual(0);
  return { status: r.status ?? 0, out: JSON.parse(r.stdout.slice(start)) as JsonOut };
}

describe('validate-decisions v1.4.0 — knowledge-gitignored skip class (U-20261128-004)', () => {
  test('KG1: absent + gitignored ref → warning knowledge-gitignored, exit 0, in skippedGitignored', () => {
    const fixture = makeFixture('kg1');
    writeFileSync(join(fixture, '.gitignore'), '.env\n', 'utf8');
    writeDecision(fixture, 'DEC-20261101-01', ['.env']);
    const { status, out } = runValidator(fixture);
    expect(status).toBe(0);
    expect(out.errors).toEqual([]);
    expect(out.warnings.some((w) => w.check === 'knowledge-gitignored' && w.message.includes('.env'))).toBe(true);
    expect(out.skippedGitignored).toEqual([{ file: 'DEC-20261101-01.md', ref: '.env' }]);
  });

  test('KG2: absent + NOT ignored ref → fatal error, exit 1 (unchanged)', () => {
    const fixture = makeFixture('kg2');
    writeDecision(fixture, 'DEC-20261101-02', ['docs/does-not-exist.md']);
    const { status, out } = runValidator(fixture);
    expect(status).toBe(1);
    expect(out.errors.some((e) => e.check === 'knowledge-missing' && e.message.includes('docs/does-not-exist.md'))).toBe(true);
    expect(out.errors.every((e) => !e.message.includes('fail-closed'))).toBe(true);
    expect(out.skippedGitignored).toEqual([]);
  });

  test('KG3: present .env → no finding (the class only relaxes absent+gitignored)', () => {
    const fixture = makeFixture('kg3');
    writeFileSync(join(fixture, '.gitignore'), '.env\n', 'utf8');
    writeFileSync(join(fixture, '.env'), 'SECRET=fixture-only-not-a-real-secret\n', 'utf8');
    writeDecision(fixture, 'DEC-20261101-03', ['.env']);
    const { status, out } = runValidator(fixture);
    expect(status).toBe(0);
    expect(out.errors).toEqual([]);
    expect(out.warnings.every((w) => w.check !== 'knowledge-gitignored')).toBe(true);
    expect(out.skippedGitignored).toEqual([]);
  });

  test('KG4: absent ref inside a gitignored directory pattern → warning', () => {
    const fixture = makeFixture('kg4');
    writeFileSync(join(fixture, '.gitignore'), '.venv/\n', 'utf8');
    writeDecision(fixture, 'DEC-20261101-04', ['.venv/bin/provisioned-tool']);
    const { status, out } = runValidator(fixture);
    expect(status).toBe(0);
    expect(out.errors).toEqual([]);
    expect(out.warnings.some((w) => w.check === 'knowledge-gitignored' && w.message.includes('.venv/bin/provisioned-tool'))).toBe(true);
    expect(out.skippedGitignored.map((s) => s.ref)).toEqual(['.venv/bin/provisioned-tool']);
  });

  test('KG5: non-git directory + absent ref → fatal with the fail-closed note', () => {
    const fixture = makeFixture('kg5', false); // os.tmpdir() — outside any repository
    writeDecision(fixture, 'DEC-20261101-05', ['docs/absent.md']);
    const { status, out } = runValidator(fixture);
    expect(status).toBe(1);
    expect(out.errors.some((e) => e.check === 'knowledge-missing' && e.message.includes('git check-ignore unavailable — fail-closed'))).toBe(true);
    expect(out.skippedGitignored).toEqual([]);
  });

  test('KG6: glob metacharacters are exempt from the skip class (fatal on miss)', () => {
    const fixture = makeFixture('kg6');
    writeFileSync(join(fixture, '.gitignore'), 'docs/*.md\n', 'utf8');
    writeDecision(fixture, 'DEC-20261101-06', ['docs/ghost-*.md']);
    const { status, out } = runValidator(fixture);
    expect(status).toBe(1);
    expect(out.errors.some((e) => e.check === 'knowledge-missing')).toBe(true);
    expect(out.skippedGitignored).toEqual([]);
  });
});
