#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-28, spec 2026-10-28-l0-only-governance-doc-cleanup-design.md
//           §5.5, DEC-20261028-05): one scripted pass over the Projects/co-*
//           repos deleting the retired L0-only governance doc
//           docs/governance/agents/pm-gateway-workflow.md — per repo, in the
//           ABSOLUTE order root-PR-first, upgrade-then-delete (§6): the root
//           PR must have removed the L1 copy (guard below) so the deletion is
//           tombstone-free by construction (manifest-baseline carry-forward
//           v1.79.0 prunes template-departed paths), and the upgrade lands the
//           retargeted instruction files BEFORE the pointer target disappears
//           (zero dangling window). Deliberately does NOT record a --tombstone:
//           the path is template-departed, not project-deleted — a tombstone
//           would misclassify it and the carry-forward would have to unwind it.
//
// Safety contract (§5.5):
//   1. Root-PR guard — refuses to run while
//      templates/common/docs/governance/agents/pm-gateway-workflow.md exists.
//   2. Hash gate — a working-tree copy whose SHA-256 ≠ EXPECTED_SHA256 is
//      STOPPED and reported, NEVER deleted (a diverged copy may hold local
//      adaptation — U-20261028-001 applied in reverse). Escalate to PM.
//   3. Scoped cleanliness — `git status --porcelain -- <target>` must be empty.
//      Unrelated dirty files (co-abap/co-newbiz) are allowed and NEVER staged.
//   4. Pathspec-scoped commit — `git commit -- <target>` only; never
//      `git add -A` / `git add .`. The commit is verified to touch exactly
//      one path.
//   5. Dry-run is the default — pass --apply to mutate anything.
//
// R1 fallback (§7): if the upgrade step fails for a repo (e.g. the operator
// runs the preflight-guarded flow on a dirty tree), the deletion PROCEEDS with
// the accepted short dangle (the operative PM rules live in the delivered
// agents/pm.md — a dangling doc pointer degrades documentation, not
// enforcement) and the repo is listed for the pending-upgrade follow-up.
//
// Usage:
//   bun scripts/remove-retired-governance-docs.ts [--apply] [--push] [--repo <path>]... [--strict-upgrade]
//
//   --apply            execute upgrades + deletions + commits (default: dry-run)
//   --push             push each successful repo after committing (default:
//                      local commit only — push is operator-controlled; the 16
//                      repos are independent)
//   --repo <path>      restrict the pass to the given repo(s), repeatable
//                      (default: every git repo under Projects/co-*)
//   --strict-upgrade   STOP the repo (no deletion) when its upgrade step fails,
//                      instead of the R1 delete-with-short-dangle fallback
//
// @l2-propagate: false

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { die } from './lib/error-handling.ts';

// ── Constants (§5.5.1) ─────────────────────────────────────────────────────────

/** The retired path, relative to each project repo root. */
const TARGET_RELPATH = 'docs/governance/agents/pm-gateway-workflow.md';

/** The retired path at L1 — must ALREADY be deleted (root-PR guard). */
const L1_COPY_RELPATH = 'templates/common/docs/governance/agents/pm-gateway-workflow.md';

/**
 * SHA-256 of the L1 file, recorded immediately before the L1 `git rm`
 * (spec §5.5.1). E18 verified all 16 project copies byte-identical to the L1
 * file at design time; the L1 file is byte-frozen until deletion, so this
 * constant stays the expected project-copy content. Cross-check: md5 prefix
 * `bbe32212…` from the research sweep (design E18) — see EXPECTED_MD5.
 * If the file ever changes before deletion, the operator re-records BOTH
 * constants in the same commit as the L1 git rm (or overrides per-run with
 * --expected-sha256 after PM adjudication of any diverged copies).
 */
const EXPECTED_SHA256 = 'b3defcc96c7b1a7f0213e511e9a9798ce238741133da37d7b652348f86d5b8d5';

/** md5 cross-check (design E18 sweep: md5 prefix bbe32212…). */
const EXPECTED_MD5 = 'bbe32212d50f938ca656c51cef43e344';

/** Standardized commit message (§5.5.3) — English, §7 language policy. */
const COMMIT_MESSAGE =
  'docs: remove L0-only pm-gateway-workflow.md (L1 delivery retired; spec 2026-10-28-l0-only-governance-doc-cleanup)';

const WORKSPACE_ROOT = resolve(import.meta.dir, '..');

// ── Argument parsing ───────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const push = argv.includes('--push');
const strictUpgrade = argv.includes('--strict-upgrade');
const repoArgs: string[] = [];
let expectedOverride = '';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--repo' && argv[i + 1]) { repoArgs.push(resolve(argv[++i])); continue; }
  if (argv[i]?.startsWith('--repo=')) { repoArgs.push(resolve(argv[i].slice('--repo='.length))); continue; }
  if (argv[i] === '--expected-sha256' && argv[i + 1]) { expectedOverride = argv[++i].trim().toLowerCase(); continue; }
}
const expectedSha256 = expectedOverride || EXPECTED_SHA256;

if (apply && expectedOverride) {
  die('--expected-sha256 is a dry-run adjudication aid; in --apply mode fix the EXPECTED_SHA256 constant instead (audit trail lives in git).');
}

// ── Root-PR guard (§5.5 guard; §6: root PR merged before any phase-2 action) ──

if (existsSync(join(WORKSPACE_ROOT, L1_COPY_RELPATH))) {
  die(
    `Root-PR guard: ${L1_COPY_RELPATH} still EXISTS at L1 — the root PR (L1 deletion + ` +
    `propagation exclude + B-PGW pointer retargets) has not merged yet. Deleting project copies first would ` +
    `leave the file in the template tree with a delivered manifest baseline, and the next upgrade would hit ` +
    `the TOMBSTONED (ERROR) refusal (spec §6, U-20261028-001 with the polarity flipped). Merge the root PR first.`
  );
}

// ── Repo discovery ─────────────────────────────────────────────────────────────

function discoverRepos(): string[] {
  if (repoArgs.length > 0) {
    for (const repo of repoArgs) {
      if (!existsSync(join(repo, '.git'))) die(`--repo ${repo} is not a git repository (no .git).`);
    }
    return repoArgs;
  }
  const projectsDir = join(WORKSPACE_ROOT, 'Projects');
  if (!existsSync(projectsDir)) die(`Projects/ not found at ${projectsDir} — pass --repo <path> explicitly.`);
  const repos = readdirSync(projectsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('co-'))
    .map((e) => join(projectsDir, e.name))
    .filter((p) => existsSync(join(p, '.git')));
  if (repos.length === 0) die(`No git repos under ${projectsDir}/co-*.`);
  return repos;
}

// ── Git helpers ────────────────────────────────────────────────────────────────

function git(repo: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

function sha256File(abs: string): string {
  return createHash('sha256').update(readFileSync(abs)).digest('hex');
}

function md5File(abs: string): string {
  return createHash('md5').update(readFileSync(abs)).digest('hex');
}

// ── Per-repo pass (§5.5.2 order: skip → hash → scoped-clean → upgrade → rm → commit → verify) ──

interface RepoResult {
  repo: string;
  hashMatch: string;      // 'match' | 'MISMATCH' | 'absent'
  upgrade: string;        // 'ok' | 'dry-run' | 'FAILED (R1 fallback)' | 'skipped'
  deletionCommit: string; // commit short hash | 'would commit' | reason skipped
  pushState: string;      // 'pushed' | 'local commit only' | 'skipped' |…
}

const results: RepoResult[] = [];
const stopList: string[] = [];
const followUpList: string[] = [];

console.log('🧹 Per-project removal: docs/governance/agents/pm-gateway-workflow.md');
console.log(`   mode: ${apply ? 'APPLY' : 'DRY-RUN (pass --apply to execute)'} | push: ${push ? 'operator-enabled' : 'disabled'} | repos: ${repoArgs.length > 0 ? repoArgs.length + ' explicit' : 'Projects/co-*'}`);
console.log(`   expected sha256: ${expectedSha256.slice(0, 12)}… (md5 cross-check ${EXPECTED_MD5.slice(0, 8)}…)\n`);

for (const repo of discoverRepos()) {
  const name = repo.split('/').pop() ?? repo;
  const targetAbs = join(repo, TARGET_RELPATH);
  const result: RepoResult = { repo: name, hashMatch: 'absent', upgrade: 'skipped', deletionCommit: 'skipped', pushState: 'skipped' };

  // (a) absent → SKIP (idempotent re-run).
  if (!existsSync(targetAbs)) {
    result.deletionCommit = 'SKIP (already absent)';
    results.push(result);
    console.log(`  SKIP ${name}: ${TARGET_RELPATH} already absent (idempotent re-run)`);
    continue;
  }

  // (b) hash gate — mismatch = STOP, never delete.
  const workSha = sha256File(targetAbs);
  const workMd5 = md5File(targetAbs);
  if (workSha !== expectedSha256) {
    result.hashMatch = 'MISMATCH';
    result.deletionCommit = 'REFUSED (hash mismatch)';
    results.push(result);
    const msg =
      `${name}: working-tree SHA-256 ${workSha.slice(0, 12)}… (md5 ${workMd5.slice(0, 8)}…) ≠ expected ` +
      `${expectedSha256.slice(0, 12)}… — the copy may hold local adaptation. NOT deleted; escalate to PM for per-repo adjudication.`;
    stopList.push(msg);
    console.log(`  STOP ${name}: hash mismatch — never deleting a diverged copy`);
    continue;
  }
  result.hashMatch = 'match';

  // (c) scoped cleanliness — only the TARGET path must be clean; unrelated
  // dirty files (co-abap/co-newbiz) are explicitly allowed and never staged.
  const scoped = git(repo, ['status', '--porcelain', '--', TARGET_RELPATH]);
  if (!scoped.ok || scoped.out.length > 0) {
    result.deletionCommit = 'REFUSED (target dirty)';
    results.push(result);
    stopList.push(`${name}: git status is non-empty for ${TARGET_RELPATH} (${scoped.out.split('\n').length} entr(y/ies)) — resolve the local state first.`);
    console.log(`  STOP ${name}: target path has uncommitted local state`);
    continue;
  }

  // (d) upgrade-first (§6) — lands the retargeted instruction files and the
  // forked execution-plan-templates.md BEFORE the pointer target disappears.
  if (apply) {
    console.log(`  ⏳ ${name}: running upgrade-project (apply)…`);
    const up = spawnSync('bun', [join(WORKSPACE_ROOT, 'scripts', 'upgrade-project.ts'), repo, '--yes'], {
      encoding: 'utf8',
      cwd: WORKSPACE_ROOT,
    });
    if (up.status !== 0) {
      result.upgrade = strictUpgrade ? 'FAILED (strict stop)' : 'FAILED (R1 fallback)';
      if (strictUpgrade) {
        result.deletionCommit = 'REFUSED (upgrade failed, --strict-upgrade)';
        results.push(result);
        stopList.push(`${name}: upgrade-project exited ${up.status} — --strict-upgrade set, no deletion.`);
        console.log(`  STOP ${name}: upgrade failed (strict mode)`);
        continue;
      }
      // R1 fallback: delete with the accepted short dangle; the upgrade becomes
      // the filed follow-up. The deletion is still hash-gated and scoped-clean.
      followUpList.push(`${name}: upgrade failed (exit ${up.status}) — deletion committed with the accepted short dangle; file the pending upgrade (spec §7 R1).`);
      console.log(`  ⚠️  ${name}: upgrade failed (exit ${up.status}) — continuing per R1 fallback (short dangle accepted)`);
    } else {
      result.upgrade = 'ok';
    }
    // Post-upgrade re-hash: the upgrade must not have touched the retired file;
    // if it somehow did, stop BEFORE the rm rather than commit a surprise.
    if (existsSync(targetAbs)) {
      const reSha = sha256File(targetAbs);
      if (reSha !== expectedSha256) {
        result.deletionCommit = 'REFUSED (post-upgrade hash drift)';
        results.push(result);
        stopList.push(`${name}: file hash changed during the upgrade step (${reSha.slice(0, 12)}…) — NOT deleted; adjudicate manually.`);
        console.log(`  STOP ${name}: post-upgrade hash drift`);
        continue;
      }
    } else {
      // The upgrade itself removed it (unexpected — L1 no longer delivers it,
      // and docs/ is never pruned). Treat as already deleted, report honestly.
      result.deletionCommit = 'SKIP (removed by upgrade)';
      results.push(result);
      followUpList.push(`${name}: the file disappeared during the upgrade step — verify no unintended prune removed it (docs/ is never pruned by upgrade-project).`);
      console.log(`  ⚠️  ${name}: file absent after upgrade — nothing to commit`);
      continue;
    }
  } else {
    result.upgrade = 'dry-run';
  }

  if (!apply) {
    result.deletionCommit = 'would: git rm + scoped commit';
    result.pushState = 'would push only with --apply --push';
    results.push(result);
    console.log(`  PLAN ${name}: hash match, target clean → upgrade (dry-run) → git rm + scoped commit`);
    continue;
  }

  // (e) git rm — explicit, path-scoped.
  const rm = git(repo, ['rm', '--', TARGET_RELPATH]);
  if (!rm.ok) {
    result.deletionCommit = 'FAILED (git rm)';
    results.push(result);
    stopList.push(`${name}: git rm failed — ${rm.out}`);
    continue;
  }

  // (f) commit ONLY that path — pathspec-scoped; never `git add -A`/`git add .`,
  // so anything the upgrade left staged or modified stays out of this commit.
  const commit = git(repo, ['commit', '-m', COMMIT_MESSAGE, '--', TARGET_RELPATH]);
  if (!commit.ok) {
    result.deletionCommit = 'FAILED (commit)';
    results.push(result);
    stopList.push(`${name}: git commit failed — ${commit.out}`);
    continue;
  }

  // (g) verify the commit touches exactly one file.
  const show = git(repo, ['show', '--name-status', '--format=', 'HEAD']);
  const touched = show.out.split('\n').filter((l) => l.trim().length > 0);
  const short = git(repo, ['rev-parse', '--short', 'HEAD']).out;
  if (touched.length !== 1 || !touched[0].endsWith(TARGET_RELPATH)) {
    result.deletionCommit = `FAILED (verify: ${touched.length} file(s))`;
    results.push(result);
    stopList.push(`${name}: commit ${short} touches ${touched.length} path(s), expected exactly [D ${TARGET_RELPATH}] — inspect immediately.`);
    continue;
  }
  result.deletionCommit = short;

  // (g+) push policy — operator-controlled, default local-only.
  if (push) {
    const branch = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).out;
    const pushed = git(repo, ['push', 'origin', branch]);
    result.pushState = pushed.ok ? 'pushed' : `PUSH FAILED (${pushed.out.split('\n')[0]})`;
    if (!pushed.ok) stopList.push(`${name}: push failed — ${pushed.out}`);
  } else {
    result.pushState = 'local commit only';
  }

  results.push(result);
  console.log(`  ✅ ${name}: deleted (commit ${short})${result.pushState === 'pushed' ? ', pushed' : ''}`);
}

// ── Report (§5.5.5) ────────────────────────────────────────────────────────────

console.log('\n   ── Per-repo result table ──');
console.log('   repo       | hash-match | upgrade            | deletion commit            | push');
console.log('   -----------+------------+--------------------+----------------------------+---------------------');
for (const r of results) {
  console.log(
    `   ${r.repo.padEnd(10)} | ${r.hashMatch.padEnd(10)} | ${r.upgrade.padEnd(18)} | ${r.deletionCommit.padEnd(26)} | ${r.pushState}`
  );
}

if (followUpList.length > 0) {
  console.log('\n   ── Pending-upgrade follow-ups (R1) ──');
  for (const f of followUpList) console.log(`     - ${f}`);
}

if (stopList.length > 0) {
  console.error('\n   ── STOP list (no action taken on these repos) ──');
  for (const s of stopList) console.error(`     - ${s}`);
  die(`${stopList.length} repo(s) stopped — resolve the list above, then re-run (the pass is idempotent).`);
}

const deleted = results.filter((r) => /^[0-9a-f]{7,}$/.test(r.deletionCommit)).length;
console.log(`\n✅ ${apply ? 'Pass complete' : 'Dry-run complete'}: ${deleted} deletion commit(s), ${results.filter((r) => r.deletionCommit.startsWith('SKIP')).length} skip(s), ${stopList.length} stop(s).`);
if (!apply) console.log('   This was a dry-run — no upgrades, deletions, or commits were made. Re-run with --apply to execute.');
