#!/usr/bin/env bun
// @version 1.0.1
// v1.0.1 (2026-11-09): run `git status` with scripts/lib/git-env.ts gitCleanEnv() — a
//          hook context (`git push` pre-push) exports GIT_DIR pointing at this checkout's
//          private git dir, and the status call inherited it and inspected the WRONG repo
//          instead of --root (verified: with GIT_DIR set, a non-git --root passed vacuously
//          instead of failing closed; a fixture commit also landed on the PR branch — the
//          2026-11-07 external-deps incident class). The gate must always inspect the
//          requested root regardless of the caller's git environment.
// v1.0.0 (2026-11-08, spec docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md
//          §5.1): standalone fixture-root hygiene gate. Runs `git status --porcelain`
//          from the repo root and fails (exit 1) when any entry is an untracked WHOLE
//          directory whose name is one of the repo's known top-level directories —
//          porcelain emits `?? <top>/` only when the entire directory is untracked,
//          which at a repo root can only be test-fixture residue (the 2026-11-04
//          `rm -rf Projects` incident class, memory/2026-11-04.md:159). Tracked-but-
//          modified rows and untracked FILES inside tracked directories are ordinary
//          work and never fail this check. dev-sync step 6.4 enforces the same rule
//          inline; the classification logic is shared via scripts/lib/workspace-hygiene.ts
//          (one derivation, two callers — the scripts/lib/fleet.ts discipline).
//
// Usage: bun scripts/check-workspace-hygiene.ts [--root <dir>] [--json]
//   --root <dir>  repo root to check (default: this checkout's root; lets the unit
//                 suite and worktree operators point the gate at a fixture repo)
//   --json        machine-readable output: {"ok":boolean,"root":string,"offenders":[]}
// Exit codes: 0 clean, 1 residue found (also 1 on a git error — fail-closed).

import { $ } from 'bun';
import {
  classifyWorkspaceHygieneResidue,
  formatHygieneResidueReport,
} from './lib/workspace-hygiene.ts';
import { gitCleanEnv } from './lib/git-env.ts';

function defaultRoot(): string {
  return new URL('..', import.meta.url).pathname;
}

function parseArgs(argv: string[]): { root: string; json: boolean } {
  let root = defaultRoot();
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--root') {
      root = argv[++i] ?? '';
    } else if (arg.startsWith('--root=')) {
      root = arg.slice('--root='.length);
    }
  }
  if (!root) {
    console.error('--root requires a directory argument');
    process.exit(2);
  }
  return { root, json };
}

const { root, json } = parseArgs(process.argv.slice(2));

// gitCleanEnv() strips inherited repo-redirection vars (GIT_DIR et al. from a
// hook/CI context) so this always inspects --root, not the caller's repo.
const status = await $`git status --porcelain`.env(gitCleanEnv()).cwd(root).quiet().nothrow();
if (status.exitCode !== 0) {
  const detail = status.stderr.toString().trim();
  if (json) {
    console.log(JSON.stringify({ ok: false, root, offenders: [], error: detail || 'git status failed' }));
  } else {
    console.error(`check-workspace-hygiene: git status failed (exit ${status.exitCode})${detail ? `: ${detail}` : ''}`);
    console.error('Fail-closed: a gate that cannot read the tree refuses to pass.');
  }
  process.exit(1);
}

const offenders = classifyWorkspaceHygieneResidue(status.stdout.toString());

if (json) {
  console.log(JSON.stringify({ ok: offenders.length === 0, root, offenders }));
} else if (offenders.length > 0) {
  console.error(`❌ check-workspace-hygiene: ${offenders.length} residue entries in ${root}`);
  for (const line of formatHygieneResidueReport(offenders)) console.error(`   ${line}`);
  process.exit(1);
} else {
  console.log(`✅ check-workspace-hygiene: clean (no untracked whole-directory residue in ${root})`);
}
process.exit(offenders.length > 0 ? 1 : 0);
