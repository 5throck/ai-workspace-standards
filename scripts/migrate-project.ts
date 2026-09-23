#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-09-23, migrate-project end-to-end adoption — spec
//          2026-09-23-migrate-project-design): one command for the full external-project
//          migration: GitHub baseline (ensure-github-repo subprocess) → adoption plan
//          preview (adopt-project --dry-run) → real adoption (adopt-project, stdio
//          inherited) → machine-checked verification (artifacts, platform twins,
//          provenance marker, merge=ours, hooksPath, remote, audit smoke) → report.
//          Phase failures abort with phase attribution; verification is itemized and
//          hard checks fail the run. This skill performs and inspects — it does not
//          stop at advice.
//
// Usage:
//   bun scripts/migrate-project.ts <project-path> --variant co-<x> [--platform all|claude|antigravity|codex]
//                                  [--org <org>] [--public] [--skip-github] [--dry-run] [--yes]

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const WORKSPACE_ROOT = resolve(import.meta.dir, '..');

function fail(msg: string): never {
  console.error(`${RED}${msg}${RESET}`);
  process.exit(1);
}

function git(cwd: string, ...args: string[]): { status: number; out: string } {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  return { status: r.status ?? 1, out: (r.stdout || '').trim() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pure verification-plan helpers (exported for unit tests)
// ═══════════════════════════════════════════════════════════════════════════════

export type PlatformProfile = 'all' | 'claude' | 'antigravity' | 'codex';

/** Platform twins a migrated project must (or must NOT) carry — mirrors new-project §2.7. */
export function expectedPlatformTwins(platform: PlatformProfile): { required: string[]; absent: string[] } {
  switch (platform) {
    case 'claude': return { required: ['CLAUDE.md'], absent: ['GEMINI.md', 'CODEX.md'] };
    case 'antigravity': return { required: ['GEMINI.md'], absent: ['CLAUDE.md', 'CODEX.md'] };
    case 'codex': return { required: ['CLAUDE.md', 'GEMINI.md', 'CODEX.md'], absent: [] };
    case 'all': return { required: ['CLAUDE.md', 'GEMINI.md', 'CODEX.md'], absent: [] };
  }
}

export interface VerificationCheck {
  kind: 'file' | 'file-content' | 'absent-file';
  /** path relative to the project root (or 'git:hooksPath' style runtime keys) */
  target: string;
  /** expected substring / exact line for file-content checks */
  expect?: string;
  label: string;
  hard: boolean;
}

/** The machine checklist for a migrated project (artifact checks; runtime checks appended separately). */
export function buildVerificationPlan(variant: string, platform: PlatformProfile): VerificationCheck[] {
  const checks: VerificationCheck[] = [
    { kind: 'file', target: 'AGENTS.md', label: 'AGENTS.md delivered', hard: true },
    { kind: 'file', target: 'docs/context.md', label: 'docs/context.md delivered', hard: true },
    { kind: 'file', target: `docs/${variant}.context.md`, label: `docs/${variant}.context.md present`, hard: true },
    { kind: 'file', target: '.githooks/pre-commit', label: '.githooks/pre-commit delivered (LOCKED)', hard: true },
    { kind: 'file-content', target: '.gitattributes', expect: 'docs/context.md merge=ours', label: '.gitattributes carries merge=ours rule', hard: true },
    { kind: 'file', target: 'scripts/audit.ts', label: 'workspace scripts delivered (scripts/audit.ts)', hard: true },
    { kind: 'file', target: 'scripts/SCRIPTS.md', label: 'project SCRIPTS.md registry delivered', hard: true },
    { kind: 'file', target: 'memory/MEMORY.md', label: 'memory/MEMORY.md seeded', hard: true },
    { kind: 'file', target: 'CHANGELOG.md', label: 'CHANGELOG.md seeded', hard: true },
    { kind: 'file', target: '.claude/template-version.txt', label: 'provenance marker minted', hard: true },
    { kind: 'file-content', target: '.claude/template-version.txt', expect: `variant=${variant}`, label: `marker declares variant=${variant}`, hard: true },
    { kind: 'file', target: '.claude/last-upgrade-delivery.json', label: 'delivery manifest written', hard: true },
  ];
  const twins = expectedPlatformTwins(platform);
  for (const t of twins.required) {
    checks.push({ kind: 'file', target: t, label: `${t} delivered (platform=${platform})`, hard: true });
  }
  for (const t of twins.absent) {
    checks.push({ kind: 'absent-file', target: t, label: `${t} removed (platform=${platform})`, hard: true });
  }
  return checks;
}

/** Evaluate the artifact checks against a project directory. Runtime checks are appended by the caller. */
export function evaluateArtifactChecks(projectDir: string, checks: VerificationCheck[]): Array<{ check: VerificationCheck; pass: boolean }> {
  return checks.map(check => {
    const abs = resolve(projectDir, check.target);
    if (!existsSync(abs)) return { check, pass: check.kind === 'absent-file' };
    if (check.kind === 'absent-file') return { check, pass: false };
    if (check.kind === 'file-content') {
      const content = readFileSync(abs, 'utf8');
      return { check, pass: check.expect ? content.includes(check.expect) : true };
    }
    return { check, pass: true };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════════

function main(): void {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    for (let i = args.length - 2; i >= 0; i--) if (args[i] === flag) return args[i + 1];
    return undefined;
  };
  const DRY_RUN = args.includes('--dry-run');
  const YES = args.includes('--yes') || args.includes('-y') || process.env.CI === 'true' || process.env.CI === '1';
  const SKIP_GITHUB = args.includes('--skip-github');
  const platform = (getArg('--platform') ?? 'all') as PlatformProfile;
  const org = getArg('--org');
  const projectArg = args.find((a, i) => !a.startsWith('--') && (i === 0 || !['--variant', '--platform', '--org'].includes(args[i - 1])));
  const variant = getArg('--variant');

  if (!projectArg) {
    console.error('Usage: bun scripts/migrate-project.ts <project-path> --variant co-<x> [--platform all|claude|antigravity|codex] [--org <org>] [--public] [--skip-github] [--dry-run] [--yes]');
    process.exit(1);
  }
  if (!['all', 'claude', 'antigravity', 'codex'].includes(platform)) {
    fail(`Invalid --platform '${platform}' (all|claude|antigravity|codex)`);
  }
  const projectDir = resolve(projectArg);

  console.log(`\n${CYAN}═══ migrate-project: GitHub baseline → adoption → verification ═══${RESET}`);
  console.log(`Project: ${projectDir}`);

  // ── PHASE 1 — GitHub baseline (performed + verified by ensure-github-repo) ────
  if (SKIP_GITHUB) {
    console.log(`\n${YELLOW}[1/4] GitHub baseline SKIPPED (--skip-github) — history is NOT safe off-machine.${RESET}`);
  } else {
    console.log(`\n${CYAN}[1/4] GitHub baseline (check → create → push → verify)${RESET}`);
    const ghArgs = ['scripts/ensure-github-repo.ts', projectDir];
    if (org) ghArgs.push('--org', org);
    if (args.includes('--public')) ghArgs.push('--public');
    if (DRY_RUN) ghArgs.push('--dry-run');
    const gh = spawnSync(process.execPath, ghArgs, { stdio: 'inherit', cwd: WORKSPACE_ROOT });
    if (gh.status !== 0) {
      fail(`[1/4] GitHub baseline FAILED (exit ${gh.status}). Fix the baseline before migrating — adoption without an off-machine copy is unrecoverable if the disk is lost.`);
    }
  }

  // ── PHASE 2 — adoption plan preview (always) ──────────────────────────────────
  if (!variant) {
    console.error(`\nNo --variant given. Pick one from the menu (re-run):`);
    spawnSync(process.execPath, ['scripts/adopt-project.ts', projectArg, '--dry-run'], { stdio: 'inherit', cwd: WORKSPACE_ROOT });
    process.exit(1);
  }
  console.log(`\n${CYAN}[2/4] Adoption plan preview (adopt-project --dry-run)${RESET}`);
  const preview = spawnSync(process.execPath, [
    'scripts/adopt-project.ts', projectDir, '--variant', variant, '--platform', platform, '--yes', '--dry-run',
  ], { stdio: 'inherit', cwd: WORKSPACE_ROOT });
  if (preview.status !== 0) {
    fail(`[2/4] Adoption plan preview FAILED (exit ${preview.status}) — the project does not pass adopt-project pre-flight. Nothing was migrated.`);
  }

  if (DRY_RUN) {
    console.log(`\n${CYAN}[3/4] Real adoption — SKIPPED (--dry-run).${RESET}`);
    console.log(`${CYAN}[4/4] Verification — SKIPPED (--dry-run). Planned checks:${RESET}`);
    for (const c of buildVerificationPlan(variant, platform)) console.log(`  • ${c.label}`);
    console.log(`  • git core.hooksPath == .githooks`);
    console.log(`  • project audit smoke (bun scripts/audit.ts --skip-memory)`);
    console.log(`\nRe-run without --dry-run to perform the migration.`);
    process.exit(0);
  }

  if (!YES) {
    const answer = prompt(`Proceed with the real adoption now? [y/N] `) ?? '';
    if (!['y', 'Y'].includes(answer)) { console.log('Aborted.'); process.exit(0); }
  }

  // ── PHASE 3 — real adoption ───────────────────────────────────────────────────
  console.log(`\n${CYAN}[3/4] Adoption (adopt-project)${RESET}`);
  const adopt = spawnSync(process.execPath, [
    'scripts/adopt-project.ts', projectDir, '--variant', variant, '--platform', platform, '--yes',
  ], { stdio: 'inherit', cwd: WORKSPACE_ROOT });
  if (adopt.status !== 0) {
    fail(`[3/4] Adoption FAILED (exit ${adopt.status}). See adopt-project's guided recovery output above.`);
  }

  // ── PHASE 4 — verification ────────────────────────────────────────────────────
  console.log(`\n${CYAN}[4/4] Migration verification${RESET}`);
  const results = evaluateArtifactChecks(projectDir, buildVerificationPlan(variant, platform));

  // runtime check: hooksPath
  const hooksPath = git(projectDir, 'config', 'core.hooksPath');
  results.push({
    check: { kind: 'file-content', target: 'git:hooksPath', expect: '.githooks', label: 'git core.hooksPath == .githooks', hard: true },
    pass: hooksPath.status === 0 && hooksPath.out.includes('.githooks'),
  });
  // runtime check: GitHub remote
  const remotes = git(projectDir, 'remote', '-v');
  results.push({
    check: { kind: 'file-content', target: 'git:remote', expect: 'github.com', label: 'GitHub remote present', hard: false },
    pass: remotes.out.includes('github.com'),
  });

  let hardFailed = 0;
  for (const { check, pass } of results) {
    if (pass) console.log(`  ${GREEN}✅ ${check.label}${RESET}`);
    else {
      const tag = check.hard ? 'FAIL' : 'WARN';
      console.log(`  ${check.hard ? RED : YELLOW}⚠️  [${tag}] ${check.label}${RESET}`);
      if (check.hard) hardFailed++;
    }
  }

  // runtime check: project audit smoke (soft)
  console.log('  🩺 project audit smoke (bun scripts/audit.ts --skip-memory)…');
  const smoke = spawnSync(process.execPath, ['scripts/audit.ts', '--skip-memory'], { cwd: projectDir, stdio: 'inherit' });
  const smokePass = smoke.status === 0;
  if (smokePass) console.log(`  ${GREEN}✅ audit smoke passed${RESET}`);
  else console.log(`${YELLOW}  ⚠️  [WARN] audit smoke FAILED — often pre-existing foreign content to reconcile; review the output above.${RESET}`);

  // ── Report ────────────────────────────────────────────────────────────────────
  const total = results.length + 1;
  const passed = results.filter(r => r.pass).length + (smokePass ? 1 : 0);
  console.log(`\n${CYAN}═══ Migration report: ${passed}/${total} checks passed ═══${RESET}`);
  if (hardFailed > 0) {
    fail(`${hardFailed} hard verification check(s) failed — the migration is INCOMPLETE. Inspect the failures above; the adopt-project backup/state trail is in the project report.`);
  }
  console.log(`Next steps:`);
  console.log(`  1. Review:  git -C ${projectDir} diff HEAD`);
  console.log(`  2. Commit and push (adoption never commits for you):`);
  console.log(`       git -C ${projectDir} add -A && git -C ${projectDir} commit -m "chore: adopt workspace standard (${variant})" && git -C ${projectDir} push`);
  console.log(`  Future maintenance: bun scripts/upgrade-project.ts ${projectDir} --variant ${variant}`);
  process.exit(smokePass ? 0 : 1);
}

if (import.meta.main) main();
