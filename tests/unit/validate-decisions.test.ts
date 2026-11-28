#!/usr/bin/env bun
// @version 1.0.0
// validate-decisions.test.ts — upstream U-20261119-001 (validate-decisions v1.2.0).
//
// Pins the knowledge_refs archive-resolution ladder against the CLI contract
// (dev-sync step 3.96b runs `bun scripts/validate-decisions.ts`; each test
// spawns the real script with --json against a fixture cwd):
//   - V-D1 live path archived by archive-memory.ts → memory/archive/<name>
//     resolves the reference (the U-20261119-001 fix);
//   - V-D2 missing from both live tree and archive → still fails (fail-visible);
//   - V-D3 the co-newbiz hand-edited shape — DEC referencing
//     memory/archive/<name> directly with the archive dir present — passes
//     (plain existsSync; the validator needs no special case for it);
//   - V-D4 the direct-archive shape on a fresh clone (no local copy) fails
//     visible — the accepted fresh-clone degradation
//     (docs/designs/2026-11-18-memory-union-archival-tier-design.md R1/R2;
//     memory/archive stays gitignored, docs/designs/2026-11-13-memory-index-link-validator-design.md);
//   - V-D5 v1.1.0 regression: archived governance ticket resolution preserved;
//   - V-D6 live path present → passes normally (the fallback never masks it).

import { describe, test, expect, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const WORKSPACE_ROOT = join(import.meta.dir, '..', '..');
const SCRIPT = join(WORKSPACE_ROOT, 'scripts', 'validate-decisions.ts');
const TEMP_BASE = join(WORKSPACE_ROOT, 'tests', '.temp');

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs) rmSync(dir, { recursive: true, force: true });
});

/** Fresh fixture root with docs/decisions/; registered for cleanup.
 * v1.4.0 (U-20261128-004): each fixture becomes its OWN tiny git repo — the
 * fixtures live under the repo's ignored tests/.temp, and the new
 * knowledge-gitignored class classifies EVERY path under an ignored ancestor
 * as gitignored, which would turn the not-ignored fixtures (V-D2/V-D4) into
 * false warnings. Fixture-local repos keep check-ignore pattern evaluation
 * fixture-local. fixture-git adoption (FM1+FM2). */
function makeFixture(tag: string): string {
  mkdirSync(TEMP_BASE, { recursive: true });
  const dir = mkdtempSync(join(TEMP_BASE, `validate-decisions-${tag}-`));
  createdDirs.push(dir);
  mkdirSync(join(dir, 'docs', 'decisions'), { recursive: true });
  assertCallerEnvSafeForGitFixtures(dir);
  const init = spawnSync('git', ['init', '-q'], { cwd: dir, env: gitCleanEnv(), encoding: 'utf-8' });
  if (init.status !== 0) throw new Error(`fixture git init failed: ${init.stderr}`);
  assertFixtureGitIdentity(dir);
  return dir;
}

/** Writes a minimal valid DEC record (required frontmatter per ADR-0061) with
 * the given knowledge_refs; the id must match the filename stem. */
function writeDecision(fixture: string, stem: string, knowledgeRefs: string[]): void {
  const refs = knowledgeRefs.map((r) => `  - ${r}`).join('\n');
  const body = [
    '---',
    `id: ${stem}`,
    'date: 2026-11-11',
    'agent: docs-writer',
    'decision: keep the decision chain resolvable after memory archival',
    'alternatives: hand-edit every DEC reference to memory/archive (co-newbiz LOCAL-PATCH shape)',
    'status: accepted',
    'knowledge_refs:',
    refs,
    '---',
    '',
    `# ${stem}`,
    '',
    'Decision body.',
    '',
  ].join('\n');
  writeFileSync(join(fixture, 'docs', 'decisions', `${stem}.md`), body, 'utf-8');
}

function writeFile(fixture: string, rel: string, content = '# placeholder\n'): void {
  const p = join(fixture, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content, 'utf-8');
}

function runValidator(fixture: string): { status: number; errors: Array<{ check: string; message: string }> } {
  const r = spawnSync('bun', [SCRIPT, '--json'], { cwd: fixture, encoding: 'utf-8' });
  let errors: Array<{ check: string; message: string }> = [];
  try {
    const parsed = JSON.parse(r.stdout ?? '{}');
    errors = parsed.errors ?? [];
  } catch {
    // non-JSON output (crash) — leave errors empty; the status assertion below
    // reports the failure with the raw output through the surrounding test.
  }
  return { status: r.status ?? -1, errors };
}

describe('validate-decisions v1.2.0 — knowledge_refs archive resolution (U-20261119-001)', () => {
  test('V-D1: reference to a memory file archived by archive-memory.ts resolves through memory/archive/', () => {
    const f = makeFixture('vd1');
    writeDecision(f, 'DEC-20261111-02', ['memory/2026-11-11.md']);
    writeFile(f, 'memory/archive/2026-11-11.md'); // step 3.8 moved the live path here
    const r = runValidator(f);
    expect(r.status).toBe(0);
    expect(r.errors).toEqual([]);
  });

  test('V-D2: missing from both the live tree and the archive still fails (fail-visible)', () => {
    const f = makeFixture('vd2');
    writeDecision(f, 'DEC-20261111-02', ['memory/2026-11-10.md']);
    // neither memory/2026-11-10.md nor memory/archive/2026-11-10.md exists
    const r = runValidator(f);
    expect(r.status).toBe(1);
    expect(r.errors.some((e) => e.check === 'knowledge-missing' && e.message.includes('memory/2026-11-10.md'))).toBe(true);
  });

  test('V-D3: the co-newbiz shape — DEC referencing memory/archive/<name> with the archive dir present — passes', () => {
    const f = makeFixture('vd3');
    writeDecision(f, 'DEC-20261111-02', ['memory/archive/2026-11-11.md']);
    writeFile(f, 'memory/archive/2026-11-11.md');
    const r = runValidator(f);
    expect(r.status).toBe(0);
    expect(r.errors).toEqual([]);
  });

  test('V-D4: the direct-archive shape without a local archive copy fails visible (fresh-clone degradation, accepted)', () => {
    const f = makeFixture('vd4');
    writeDecision(f, 'DEC-20261111-02', ['memory/archive/2026-11-11.md']);
    // no memory/archive/ at all — the fresh-clone shape
    const r = runValidator(f);
    expect(r.status).toBe(1);
    expect(r.errors.some((e) => e.check === 'knowledge-missing' && e.message.includes('memory/archive/2026-11-11.md'))).toBe(true);
  });

  test('V-D5: v1.1.0 regression — archived governance ticket resolution preserved', () => {
    const f = makeFixture('vd5');
    writeDecision(f, 'DEC-20261004-01', ['tickets/governance/T-20260101-001.yaml']);
    writeFile(f, 'tickets/governance/archive/T-20260101-001.yaml'); // done ticket moved out of the live store
    const r = runValidator(f);
    expect(r.status).toBe(0);
    expect(r.errors).toEqual([]);
  });

  test('V-D6: live path present passes normally — the archive fallback never masks it', () => {
    const f = makeFixture('vd6');
    writeDecision(f, 'DEC-20261111-02', ['memory/2026-11-19.md']);
    writeFile(f, 'memory/2026-11-19.md');
    const r = runValidator(f);
    expect(r.status).toBe(0);
    expect(r.errors).toEqual([]);
  });
});
