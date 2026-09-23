#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-09-23, adopt-project conversion — spec 2026-09-23-adopt-project-conversion):
//          E2E harness for scripts/adopt-project.ts. Registered in the `scripts` suite of
//          test-runner.ts (sequential, 120s ceiling — meeting Automation R1 #7).
//
// Two modes:
//   default        — fast, write-free: dry-run adoption (plan + engine --dry-run) and the
//                    refusal-grade pre-flight paths (tracked secrets, hook managers). These
//                    prove the safety contract without network or heavy engine passes.
//   ADOPT_E2E_FULL=1 — the real conversion on a disposable fixture: delivery, preservation,
//                    _legacy archival, package.json merge, provenance, second-run guard.
//                    Skipped (counts as passed) when the env flag is absent, mirroring
//                    test-new-project.ts's presence-based smoke pattern.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const WORKSPACE_ROOT = path.resolve(import.meta.dir, '..');
const ADOPT = path.join(WORKSPACE_ROOT, 'scripts', 'adopt-project.ts');
const TEST_ROOT = path.join(WORKSPACE_ROOT, 'tests', '.temp', 'Test-AdoptProject');
const FULL = process.env.ADOPT_E2E_FULL === '1';
const VARIANT = process.env.ADOPT_E2E_VARIANT || 'co-work';

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function pass(name: string): void { passCount++; console.log(`  ✅ ${name}`); }
function fail(name: string, detail?: string): void {
  failCount++;
  failures.push(name);
  console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
}
function expect(cond: boolean, name: string, detail?: string): void {
  if (cond) pass(name); else fail(name, detail);
}

function cleanup(): void {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
}

function git(cwd: string, ...args: string[]): number {
  return spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 'adopt-e2e', GIT_AUTHOR_EMAIL: 'adopt-e2e@test', GIT_COMMITTER_NAME: 'adopt-e2e', GIT_COMMITTER_EMAIL: 'adopt-e2e@test' },
  }).status ?? 1;
}

/** A committed foreign project: own README/CLAUDE.md, package.json, colliding script, tools/. */
function makeForeignProject(dir: string, opts: { husky?: boolean; trackedEnv?: boolean } = {}): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'), '# My Own Project\n\nMy own words that must survive adoption verbatim.\n');
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Foreign Claude Notes\n\nMy own Claude conventions, no managed markers.\n');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'foreign-proj',
    version: '1.2.3',
    private: true,
    scripts: {
      build: 'tsc',
      ...(opts.husky ? { prepare: 'husky install' } : {}),
    },
    dependencies: { 'my-own-dep': '^0.1.0' },
  }, null, 2));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'scripts', 'audit.ts'), 'console.log("my own audit, no version header");\n');
  fs.writeFileSync(path.join(dir, 'scripts', 'build.ts'), 'console.log("my own build");\n');
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'tools', 'legacy.sh'), '#!/bin/sh\necho legacy\n');
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'index.ts'), 'export const mine = true;\n');
  if (opts.trackedEnv) fs.writeFileSync(path.join(dir, '.env'), 'SECRET_TOKEN=supersecret\n');
  git(dir, 'init');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-m', 'foreign project state');
}

function runAdopt(projectDir: string, extra: string[] = []): { status: number; output: string } {
  const r = spawnSync(process.execPath, [ADOPT, projectDir, '--variant', VARIANT, '--yes', ...extra], {
    encoding: 'utf8', cwd: WORKSPACE_ROOT, timeout: 110_000,
    env: { ...process.env, CI: '1' },
  });
  return { status: r.status ?? 1, output: (r.stdout || '') + (r.stderr || '') };
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n=== test-adopt-project (mode: ${FULL ? 'FULL' : 'fast/dry-run'}) ===`);
cleanup();
fs.mkdirSync(TEST_ROOT, { recursive: true });

try {
  // ── Test 1: refusal-grade — tracked secret-shaped file aborts even under --yes ──
  console.log('\n[1] Tracked secret file is a --yes-proof refusal');
  {
    const dir = path.join(TEST_ROOT, 'refusal-secret');
    makeForeignProject(dir, { trackedEnv: true });
    const r = runAdopt(dir);
    expect(r.status === 1, 'adoption aborts with exit 1');
    expect(r.output.includes('secret-shaped'), 'refusal names the secret-shaped finding');
    expect(r.output.includes('.env'), 'refusal names the offending path');
    expect(!fs.existsSync(path.join(dir, '.claude', 'template-version.txt')), 'no provenance written on refusal');
    expect(fs.readFileSync(path.join(dir, 'README.md'), 'utf8').includes('My own words'), 'README untouched');
  }

  // ── Test 2: refusal-grade — hook-manager conflict aborts even under --yes ──
  console.log('\n[2] Hook-manager conflict is a --yes-proof refusal');
  {
    const dir = path.join(TEST_ROOT, 'refusal-husky');
    makeForeignProject(dir, { husky: true });
    const r = runAdopt(dir);
    expect(r.status === 1, 'adoption aborts with exit 1');
    expect(r.output.includes('hook manager'), 'refusal names the hook-manager conflict');
    expect(!fs.existsSync(path.join(dir, '.githooks')), 'no .githooks written on refusal');
  }

  // ── Test 3: dry-run — full plan, zero writes ──
  console.log('\n[3] Dry-run plans the adoption without writing');
  {
    const dir = path.join(TEST_ROOT, 'dryrun');
    makeForeignProject(dir);
    const before = git(dir, 'status', '--porcelain');
    const r = runAdopt(dir, ['--dry-run']);
    expect(r.status === 0, 'dry-run exits 0');
    expect(r.output.includes('Adoption plan'), 'prints the adoption plan');
    expect(r.output.includes('scripts/audit.ts'), 'collision scan names the colliding foreign script');
    expect(r.output.includes('scripts/build.ts'), 'retained-foreign-script scan names scripts/build.ts');
    expect(r.output.includes('Planned settling pass'), 'prints the planned settling steps');
    expect(git(dir, 'status', '--porcelain') === before, 'working tree untouched by dry-run');
    expect(!fs.existsSync(path.join(dir, '.githooks')), 'no LOCKED files written in dry-run');
  }

  // ── Test 4: invalid variant / missing variant are rejected with a menu ──
  console.log('\n[4] Variant validation');
  {
    const dir = path.join(TEST_ROOT, 'variant-guard');
    makeForeignProject(dir);
    const missing = runAdopt(dir, ['--dry-run', '--variant', 'co-doesnotexist']);
    expect(missing.status === 1, 'unknown variant exits 1');
    const noVariant = spawnSync(process.execPath, [ADOPT, dir, '--dry-run'], {
      encoding: 'utf8', cwd: WORKSPACE_ROOT, env: { ...process.env, CI: '1' },
    });
    expect((noVariant.stdout || '').includes('Valid variants'), 'missing variant prints the menu');
    expect(noVariant.status === 1, 'missing variant exits 1');
  }

  // ── Test 5 (FULL): the real conversion ──
  if (!FULL) {
    console.log('\n[5] FULL conversion run — SKIPPED (set ADOPT_E2E_FULL=1; counts as passed)');
    pass('full-run suite skipped by design');
  } else {
    console.log('\n[5] FULL conversion run');
    const dir = path.join(TEST_ROOT, 'full');
    makeForeignProject(dir);
    const foreignReadme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
    const foreignAudit = fs.readFileSync(path.join(dir, 'scripts', 'audit.ts'), 'utf8');

    const r = runAdopt(dir);
    expect(r.status === 0, 'adoption exits 0', r.output.slice(-600));

    expect(fs.existsSync(path.join(dir, 'AGENTS.md')), 'AGENTS.md delivered');
    for (const twin of ['CLAUDE.md', 'GEMINI.md', 'CODEX.md']) {
      expect(fs.existsSync(path.join(dir, twin)), `${twin} delivered (platform=all)`);
    }
    expect(fs.existsSync(path.join(dir, 'docs', 'context.md')), 'docs/context.md delivered');
    expect(fs.existsSync(path.join(dir, 'docs', `${VARIANT}.context.md`)), `docs/${VARIANT}.context.md present`);
    expect(fs.existsSync(path.join(dir, '.githooks', 'pre-commit')), '.githooks/pre-commit delivered (LOCKED)');
    expect(fs.existsSync(path.join(dir, '.claude', 'template-version.txt')), 'provenance marker minted');
    expect(fs.existsSync(path.join(dir, '.claude', 'last-upgrade-delivery.json')), 'delivery manifest written');
    expect(fs.existsSync(path.join(dir, 'scripts', 'SCRIPTS.md')), 'project SCRIPTS.md delivered');
    expect(fs.existsSync(path.join(dir, 'memory', 'MEMORY.md')), 'memory/MEMORY.md seeded');
    expect(fs.existsSync(path.join(dir, 'CHANGELOG.md')), 'CHANGELOG.md seeded');

    // Preservation guarantees
    expect(fs.readFileSync(path.join(dir, 'README.md'), 'utf8') === foreignReadme, 'foreign README preserved byte-identical (PRESERVE policy)');
    const claudeNow = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    expect(claudeNow.includes('My own Claude conventions'), 'foreign CLAUDE.md prose kept (managed-block merge)');

    // Collision archival: template audit.ts in place, foreign copy de-executed in _legacy
    expect(fs.existsSync(path.join(dir, 'scripts', 'audit.ts')), 'template scripts/audit.ts delivered');
    const legacyAudit = path.join(dir, 'scripts', '_legacy', 'audit.ts');
    expect(fs.existsSync(legacyAudit), 'foreign audit.ts archived at scripts/_legacy/audit.ts');
    if (fs.existsSync(legacyAudit)) {
      expect(fs.readFileSync(legacyAudit, 'utf8') === foreignAudit, 'archived audit.ts bytes match the foreign original');
    }
    expect(fs.existsSync(path.join(dir, 'tools', 'legacy.sh')), 'non-delivered tools/legacy.sh untouched');
    expect(fs.readFileSync(path.join(dir, 'src', 'index.ts'), 'utf8').includes('mine = true'), 'project source untouched');

    // package.json merge: foreign keys kept, workspace surface added
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    expect(pkg.name === 'foreign-proj', 'foreign package name kept');
    expect(pkg.dependencies?.['my-own-dep'] === '^0.1.0', 'foreign dependency kept');
    expect(Boolean(pkg.scripts?.audit), 'workspace npm scripts merged in');
    expect(!pkg.scripts?.prepare, 'no prepare script introduced');

    // Second run: fully-adopted guard
    const second = runAdopt(dir);
    expect(second.status === 1, 'second adoption run is refused');
    expect(second.output.includes('already adopted'), 'refusal explains the project is already adopted');
  }
} finally {
  cleanup();
}

console.log(`\n=== test-adopt-project: ${passCount} pass, ${failCount} fail ===`);
if (failures.length > 0) {
  console.log('Failed:');
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failCount === 0 ? 0 : 1);
