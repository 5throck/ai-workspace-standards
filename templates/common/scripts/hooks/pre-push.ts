#!/usr/bin/env bun
/**
 * pre-push.ts — TS-based pre-push hook.
 * @version 1.8.1
 * v1.8.1 (2026-11-09, QA follow-up fix — design §11 fail-closed semantics): the pre-run
 *          snapshot no longer fails OPEN. An unreadable config before the changed-path
 *          test run now aborts non-zero with the same actionable shape dev-sync uses
 *          ("FATAL — repository config could not be read …" plus the repair line and
 *          spec reference) instead of warning and skipping the whole check. The
 *          comparison also carries the EFFECTIVE `core.bare` field: a bare flip whose
 *          `git config --local --list` key set is otherwise unchanged (the incident
 *          shape — `core.bare` can flip through a global/system value, so the local
 *          listing does not move) is now refused, matching dev-sync step 4.88.
 * v1.8.0 (2026-11-09, spec docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md
 *          §11): repository-config integrity check around the changed-path test run —
 *          the origin of the 2026-11-09 incident. This hook is the one place where a
 *          test spawn has historically inherited GIT_DIR from `git push`, so it also
 *          gets the SECOND corruption mode's guard: snapshot
 *          `git config --local --list` before the spawn and compare after; any delta is
 *          FATAL (a fixture-side `git config` write landed on the real repository and
 *          left `core.bare = true`, breaking every work-tree operation until manually
 *          repaired). Cost is four `git config` reads (two snapshots, each one list +
 *          one effective core.bare probe) and no writes.
 * v1.7.3 (2026-11-09, P0 correctness fix): the changed-path `bun test` spawn now runs
 *           under `.env(gitCleanEnvForShell())`, not the deleted `gitEnvUnset()`. Bun
 *           Shell's `.env(obj)` REPLACES the child environment, so an
 *           `{ GIT_DIR: undefined }` map gave the child no PATH and every binary
 *           lookup failed (see scripts/lib/git-env.ts v1.2.0 for the verified proof).
 * v1.7.2 (2026-11-09, rogue-commit incident): the changed-path `bun test` spawn ran
 *           under `.env(gitEnvUnset())` — RETRACTED in v1.7.3 (that payload is the
 *           child's ENTIRE env: GIT_DIR masked, PATH destroyed). This hook inherits GIT_DIR from `git
 *           push`; the test children inherited it too and the upgrade-project fixtures
 *           committed 10 rogue commits into this repo (see scripts/lib/git-env.ts).
 * v1.7.1
 * v1.7.0 (2026-10-29, U-20261028-018 + U-20261028-004 rider): the gitleaks
 *           invocation passes --config .gitleaks.toml (existsSync-guarded,
 *           pre-commit.ts guard shape) so push-time scans run under the same
 *           reviewed policy as commit-time scans. Custom secret patterns and
 *           allowlists belong in .gitleaks.toml (merge-aware and
 *           upgrade-preserving) — never as local patches inside hook files.
 * v1.6.0 (2026-10-26, U-20261026-011): lands the pr/* remote-branch deletion guard
 *           that 1.5.0 described but never shipped. Pure ref-deletion pushes that
 *           delete refs/heads/pr/* now require ALLOW_REMOTE_BRANCH_DELETE=1; other
 *           branch deletions stay unrestricted.
 */

import { $ } from "bun";
import { existsSync } from "node:fs";
import { gitCleanEnvForShell } from "../lib/git-env.ts";
import { diffRepoConfig, isEmptyRepoConfigDelta, snapshotRepoConfig, type RepoConfigSnapshot } from "../lib/repo-integrity.ts";

// All-zero OID: git's "null" object id, sent as the local OID of a ref
// deletion on both SHA-1 (40 zeros) and SHA-256 (64 zeros) repositories.
const ZERO_OID_RE = /^(?:0{40}|0{64})$/;

export interface PushRefUpdate {
  localRef: string;
  localOid: string;
  remoteRef: string;
  remoteOid: string;
}

// A deletion line (e.g. `git push origin --delete <branch>`) carries an
// all-zero local OID instead of a commit SHA.
export function isZeroOid(oid: string | undefined): boolean {
  return typeof oid === "string" && ZERO_OID_RE.test(oid);
}

// A pure ref-deletion push is one where EVERY stdin line deletes a remote
// ref (all-zero local OID). Such a push transfers no commits, so there is
// nothing content-bearing to secret-scan or audit (T-20260916-014).
// Mixed pushes (commits + deletions) are not pure deletions and keep the
// full gate. An empty stdin line set is NOT a pure deletion: the hook's
// no-ref-updates fallback (branch protection) still applies.
export function isPureDeletionPush(refUpdates: PushRefUpdate[]): boolean {
  return refUpdates.length > 0 && refUpdates.every(r => isZeroOid(r.localOid));
}

// Refuses a pure deletion push that removes refs/heads/pr/* remote branches
// unless the operator opts in with ALLOW_REMOTE_BRANCH_DELETE=1. Returns the
// failure reason, or null to allow.
export function branchDeletionGuardError(
  deletedRemoteRefs: string[],
  allowRemoteBranchDelete: boolean,
): string | null {
  const prBranches = deletedRemoteRefs.filter(r => /^refs\/heads\/pr\//.test(r));
  if (prBranches.length === 0) return null;
  if (allowRemoteBranchDelete) return null;
  const names = prBranches.map(r => r.replace("refs/heads/", "")).join(", ");
  return (
    `refusing to delete pr/* remote branch(es): ${names}. ` +
    `To confirm an intentional cleanup, re-run with ALLOW_REMOTE_BRANCH_DELETE=1.`
  );
}

// Read stdin ONCE to determine what refs are actually being pushed.
// Format per line: <local ref> SP <local oid> SP <remote ref> SP <remote oid> LF
// A deletion (e.g. `git push origin --delete <branch>`) has localOid all-zero.
async function readPushRefUpdates(): Promise<PushRefUpdate[]> {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of Bun.stdin.stream()) {
      chunks.push(Buffer.from(chunk));
    }
    const stdin = Buffer.concat(chunks).toString("utf8").trim();
    if (!stdin) return [];
    return stdin.split("\n").filter(Boolean).map(line => {
      const [localRef, localOid, remoteRef, remoteOid] = line.split(" ");
      return { localRef, localOid, remoteRef, remoteOid };
    });
  } catch {
    return [];
  }
}

// Collect the file paths changed by the commits being pushed, so only the
// touched test files are re-run (T-20260910-025). Scoping mirrors the
// gitleaks scan: existing remote refs diff as a range, new branches diff
// each commit not reachable from any remote ref.
async function collectPushedChangedFiles(refUpdates: PushRefUpdate[]): Promise<string[]> {
  const files = new Set<string>();
  for (const ref of refUpdates) {
    if (isZeroOid(ref.localOid)) continue; // deletion refs push no commits
    if (!/^[0-9a-f]{40,64}$/.test(ref.localOid)) continue; // validate before shell interpolation
    if (!isZeroOid(ref.remoteOid) && /^[0-9a-f]{40,64}$/.test(ref.remoteOid)) {
      // Existing remote ref — net diff of the pushed range
      const range = `${ref.remoteOid}..${ref.localOid}`;
      const out = await $`git diff --name-only ${range}`.nothrow().text();
      for (const line of out.split('\n')) {
        const f = line.trim();
        if (f) files.add(f);
      }
    } else {
      // New branch with no remote counterpart — list each pushed commit
      // and diff it individually (same scope the gitleaks scan uses here).
      const shas = (await $`git rev-list ${ref.localOid} --not --remotes`.nothrow().text())
        .split('\n').map((s: string) => s.trim()).filter(Boolean);
      for (const sha of shas) {
        if (!/^[0-9a-f]{40,64}$/.test(sha)) continue;
        const out = await $`git diff-tree --no-commit-id --name-only -r ${sha}`.nothrow().text();
        for (const line of out.split('\n')) {
          const f = line.trim();
          if (f) files.add(f);
        }
      }
    }
  }
  return [...files];
}

// Prepare the computed rev-list arguments for the gitleaks shell template.
// Every token must be a git object name by construction — a 40-hex SHA, a
// `^sha` exclusion, a `sha..sha` range, or HEAD — so allowlist-validate each
// one and return them joined for the single `--log-opts` value. Throws on any
// foreign token; the caller's catch block then blocks the push.
//
// Bun Shell note: interpolations reach the command verbatim as a single argv
// element (no word-splitting, no re-parsing), so — unlike POSIX shells —
// escaping here means validating the value, not adding quote characters
// (literal quotes would become part of the flag value and corrupt it). This
// wrapper also satisfies the audit's bun-shell-compound-interpolation
// allowlist (shellEscape*/shellQuote*/escapeShellArg*).
function shellEscapeRevListArgs(args: string[]): string {
  for (const arg of args) {
    if (!/^(?:[0-9a-f]{40,64}(?:\.\.[0-9a-f]{40,64})?|\^[0-9a-f]{40,64}|HEAD)$/.test(arg)) {
      throw new Error(`unexpected rev-list argument: ${arg}`);
    }
  }
  return args.join(" ");
}

// ── Repository-config integrity guard (design §11) ───────────────────────────
// Wraps the changed-path test run: the children below are the exact spawn that once
// wrote into this repository's .git/config. Both phases are FAIL CLOSED — an
// unreadable snapshot aborts the push (design §11: "unreadable at run start aborts
// non-zero"), and the comparison carries the EFFECTIVE core.bare field so a bare flip
// is refused even when the local key list is unchanged.

/** Which side of the test run a snapshot read belongs to. */
export type RepoConfigPhase = 'before' | 'after';

/**
 * Actionable refusal line for an unreadable snapshot, shaped like dev-sync's start-of-run
 * and step-4.88 messages (FATAL, phase, underlying error).
 */
export function repoConfigSnapshotFailureMessage(phase: RepoConfigPhase, err: unknown): string {
  const when = phase === 'before' ? 'could not be read before' : 'could not be re-read after';
  return `pre-push: FATAL — repository config ${when} the changed-path test run: ${String(err)}`;
}

/**
 * Read one repository-config snapshot, or abort. `abort` MUST terminate the process
 * (the hook passes a printer+`process.exit(1)`); it is injected so the unit suite can
 * pin the fail-closed contract without exiting the test runner. Review note v1.8.1: the
 * previous inline `catch` warned and skipped the whole check — a guard that fails open
 * is not a guard.
 */
export function snapshotRepoConfigOrAbort(
  phase: RepoConfigPhase,
  read: () => RepoConfigSnapshot,
  abort: (message: string) => never,
): RepoConfigSnapshot {
  try {
    return read();
  } catch (err) {
    abort(repoConfigSnapshotFailureMessage(phase, err));
  }
}

/** Outcome of the before/after comparison. `lines` are the operator-facing detail rows. */
export interface RepoConfigGuardVerdict {
  refused: boolean;
  lines: string[];
}

/**
 * Pure verdict for the snapshot pair. Refuses on ANY local-config key delta (added /
 * removed / changed) AND on any change to the effective `core.bare` — the latter because
 * `core.bare` resolves local > global > system: a global flip leaves
 * `git config --local --list` byte-identical yet still makes every work-tree operation
 * fail (the incident's own failure mode). Reported even when the key diff is empty.
 */
export function repoConfigGuardVerdict(
  before: RepoConfigSnapshot,
  after: RepoConfigSnapshot,
): RepoConfigGuardVerdict {
  const delta = diffRepoConfig(before.entries, after.entries);
  const bareChanged = before.coreBare !== after.coreBare;
  if (isEmptyRepoConfigDelta(delta) && !bareChanged) return { refused: false, lines: [] };

  const lines = [
    ...delta.added.map((line) => `+ ${line}`),
    ...delta.removed.map((line) => `- ${line}`),
    ...delta.changed.map((line) => `~ ${line}`),
  ];
  if (bareChanged) {
    lines.push(`~ core.bare (effective): ${before.coreBare ?? '(unset)'} → ${after.coreBare ?? '(unset)'}`);
  }
  return { refused: true, lines };
}

async function main() {
  console.log("=== pre-push audit ===");

  // Parsed once, up front — reused by both the tag-only check and branch
  // protection below, since stdin can only be consumed once.
  const refUpdates = await readPushRefUpdates();

  // Pure ref-deletion push (T-20260916-014): every stdin line deletes a
  // remote ref (all-zero local OID). No commits are transferred, so there is
  // nothing content-bearing to secret-scan or audit — exit early instead of
  // running the gate battery and blocking branch-cleanup pushes.
  if (isPureDeletionPush(refUpdates)) {
    const guardError = branchDeletionGuardError(
      refUpdates.map(r => r.remoteRef),
      process.env.ALLOW_REMOTE_BRANCH_DELETE === "1",
    );
    if (guardError) {
      console.error(`❌ pre-push: ${guardError}`);
      process.exit(1);
    }
    console.log("ℹ️  pre-push: ref-deletion push — no commits to audit, skipping");
    return;
  }

  // Secret scan (gitleaks) — skip if not installed
  // Scoped to only the commits being pushed, not the entire working tree.
  try {
    await $`which gitleaks`;
    try {
      const pushedUpdates = refUpdates.filter(r => !isZeroOid(r.localOid));
      if (pushedUpdates.length > 0) {
        // Use gitleaks in git-aware mode with --log-opts to restrict scanning
        // to only the commit ranges being pushed. Collect unique commit SHAs
        // across all pushed ref updates via git rev-list.
        const revListArgs: string[] = [];
        for (const ref of pushedUpdates) {
          if (!isZeroOid(ref.remoteOid)) {
            // Existing remote ref — diff the range
            revListArgs.push(`${ref.remoteOid}..${ref.localOid}`);
          } else {
            // New branch with no remote counterpart — diff against
            // all known remote refs to avoid scanning full history.
            const remoteRefs = (await $`git for-each-ref --format='%(objectname)' refs/remotes/`.text()).trim();
            if (remoteRefs) {
              // Each remote SHA must be its own `^sha` exclusion token — joining
              // them into a single string (e.g. "sha1 sha2..localOid") produces
              // an invalid git-rev-list argument once more than one remote ref
              // exists (always true: `origin/HEAD` sits alongside `origin/main`).
              const uniqueRemoteShas = [...new Set(remoteRefs.split('\n').filter(Boolean))];
              for (const sha of uniqueRemoteShas) revListArgs.push(`^${sha}`);
              revListArgs.push(ref.localOid);
            } else {
              // No remote refs at all (fresh clone with no upstream) — fall back
              // to scanning untracked working tree changes only
              revListArgs.push(`HEAD`);
            }
          }
        }
        // Deduplicate and run gitleaks against the commit list
        const commitShas = (await $`git rev-list ${revListArgs}`.text()).trim();
        if (commitShas) {
          // gitleaks forwards --log-opts verbatim to `git log`, so pass the exact
          // rev-list arguments (ranges + `^sha` exclusions) as ONE flag value.
          // The previous form (`--log-opts -- ${uniqueShas}`) made the literal `--`
          // the flag value, so the computed SHAs never reached gitleaks.
          // U-20261028-018: pass the repo config explicitly (pre-commit.ts guard
          // shape) so push-time scans run under the same reviewed policy as
          // commit-time — implicit discovery can miss the dot-named file and
          // silently deviate from the .gitleaks.toml allowlist.
          const gitleaksArgs = ['detect', '--redact'];
          if (existsSync('.gitleaks.toml')) gitleaksArgs.push('--config', '.gitleaks.toml');
          gitleaksArgs.push('--log-opts', shellEscapeRevListArgs(revListArgs));
          await $`gitleaks ${gitleaksArgs}`;
        }
      }
      // Tag-only or deletion pushes: nothing to scan, pass through
      console.log("  ✅ Secret scan passed");
    } catch {
      console.error("\n\x1b[31m❌ Secret scan failed — push blocked. Run 'gitleaks detect' to see detected secrets.\x1b[0m");
      process.exit(1);
    }
  } catch {
    // gitleaks not installed — run minimal regex fallback
    console.warn("  ⚠️  gitleaks not installed — running regex secret scan fallback");
    const { stdout } = await $`git grep -rn -E "sk-ant-api03-[A-Za-z0-9_-]{93}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|sk-proj-[A-Za-z0-9_-]+" -- "*.ts" "*.js" "*.mjs" "*.py" "*.sh" "*.json" "*.md" "*.env" "*.env.*" "*.yml" "*.yaml" "*.toml" "*.cfg" "*.ini" "*.html"`.nothrow();
    const matches = stdout.toString().trim();
    if (matches) {
      console.error("\n\x1b[31m❌ Potential secrets found — push blocked. Install gitleaks for full coverage.\x1b[0m");
      console.error(matches.split('\n').slice(0, 5).join('\n'));
      process.exit(1);
    }
    console.log("  ✅ Regex secret scan passed (install gitleaks for full coverage)");
  }

  // Lifecycle audit only (T-20260910-025): --lifecycle-only is the fastest
  // sanctioned audit mode (the same gate the pre-commit hook runs). When
  // running via /sync (SYNC_ACTIVE=1), dev-sync.ts already ran the full audit
  // before commit — skip here to avoid duplicate execution. The full
  // workspace audit runs in CI (test.yml "Workspace audit").
  const auditAlreadyRan = process.env.SYNC_ACTIVE === "1";
  if (!auditAlreadyRan) {
    try {
      await $`bun scripts/audit.ts --lifecycle-only`;
    } catch {
      console.error("\n\x1b[31m❌ Audit failed — push blocked. Fix issues above before pushing.\x1b[0m");
      process.exit(1);
    }
  } else {
    console.log("  [audit skipped — already ran in dev-sync pipeline]");
  }

  // Changed-path tests (T-20260910-025): the full integration suite moved to
  // CI (test.yml "Run integration tests" runs `bun run test` on every
  // push/PR). Locally, only re-run the test files touched by the pushed
  // commits; when the push touches no test files, skip tests entirely.
  console.log("=== pre-push changed-path tests ===");
  const changedTestFiles = (await collectPushedChangedFiles(refUpdates))
    .map(f => f.replace(/\\/g, '/'))
    // Deleted test files appear in the pushed-range diff but cannot be
    // re-run — bun test would fail with "filters did not match any test
    // files" and block every deletion push (observed 2026-11-04, PR #1848).
    .filter(f => f.startsWith('tests/') && f.endsWith('.test.ts') && existsSync(f));
  if (changedTestFiles.length > 0) {
    // Repository-config baseline (design §11, 2026-11-09 incident): the test children
    // below are the exact spawn that once wrote into this repository's .git/config —
    // worktrees share the main config, so a single redirected `git config` write
    // (core.bare = true) breaks every work-tree operation in every checkout. Snapshot
    // before, compare after; an unreadable snapshot OR any delta blocks the push.
    // Read-only and cheap.
    const configBefore = snapshotRepoConfigOrAbort(
      'before',
      () => snapshotRepoConfig(),
      (message) => {
        console.error(`\n\x1b[31m❌ ${message} — push blocked.\x1b[0m`);
        console.error("   A guard that cannot read the repository config cannot prove the test run left it intact.");
        console.error("   Repair a bare checkout with: git config --local core.bare false");
        console.error("   Spec: design §11 (2026-11-08-gw-tenant-loop-and-hardening-design).");
        process.exit(1);
      },
    );
    try {
      console.log(`Running ${changedTestFiles.length} changed test file(s)...`);
      // gitCleanEnvForShell(): this hook runs with GIT_DIR exported by git. The test
      // children (upgrade-project engine fixtures run `git init`/`add`/`commit`)
      // would inherit it and commit INTO this repo — the 2026-11-09 rogue-commit
      // incident (10 rogue `Test <test@example.com>` commits, ~393 files, three
      // L1 core scripts deleted). Never spawn a test runner here without it. The
      // payload must be a FULL env: Bun Shell's `.env()` replaces the child env.
      await $`bun test ${changedTestFiles}`.env(gitCleanEnvForShell());
    } catch {
      console.error("\n\x1b[31m❌ Changed-path tests failed — push blocked. Fix test failures before pushing.\x1b[0m");
      process.exit(1);
    }
    const configAfter = snapshotRepoConfigOrAbort(
      'after',
      () => snapshotRepoConfig(),
      (message) => {
        console.error(`\n\x1b[31m❌ ${message} — push blocked.\x1b[0m`);
        console.error("   The run may have corrupted the repository config; inspect .git/config before re-pushing.");
        console.error(`   Repair if core.bare was set: git config --local core.bare false`);
        console.error("   Spec: design §11 (2026-11-08-gw-tenant-loop-and-hardening-design).");
        process.exit(1);
      },
    );
    const verdict = repoConfigGuardVerdict(configBefore, configAfter);
    if (verdict.refused) {
      console.error("\n\x1b[31m❌ pre-push: a test mutated the REPOSITORY git config — push blocked.\x1b[0m");
      console.error("   Worktrees share the main .git/config, so this change is repo-wide (2026-11-09 incident).");
      for (const line of verdict.lines) console.error(`   ${line}`);
      console.error(`   Repair if core.bare was set: git config --local core.bare false`);
      console.error("   Fix the spawning test: scripts/lib/git-env.ts (gitCleanEnvForShell). Spec: design §11.");
      process.exit(1);
    }
    console.log("  ✅ Repository config unchanged by the test run");
  } else {
    console.log("  [no test files changed — tests skipped; full integration suite runs in CI]");
  }

  // Tag-only pushes bypass the branch protection check — tags are not commits to main.
  const isTagOnlyPush = refUpdates.length > 0 && refUpdates.every(r => r.localRef?.startsWith("refs/tags/"));
  if (isTagOnlyPush) return;

  // Branch protection is keyed off the *remote* ref actually being updated, not the
  // currently checked-out local branch. The old check used `git rev-parse --abbrev-ref
  // HEAD`, which falsely blocked any push (e.g. deleting an unrelated remote branch,
  // or `git push origin HEAD:some-other-branch`) whenever `main` happened to be checked
  // out locally, while it would have missed `git push origin HEAD:main` run from a
  // different local branch. Deletions (localOid all-zero) push no commits and are exempt.
  if (refUpdates.length > 0) {
    const blockedUpdate = refUpdates.find(r =>
      !isZeroOid(r.localOid) &&
      (r.remoteRef === "refs/heads/main" || r.remoteRef === "refs/heads/master")
    );
    if (blockedUpdate) {
      const branchName = blockedUpdate.remoteRef.replace(/^refs\/heads\//, '');
      console.error(`\n\x1b[31m❌ Direct push to '${branchName}' is blocked. Use a PR branch.\x1b[0m`);
      process.exit(1);
    }
    return;
  }

  // Fallback for the rare case stdin carried no ref updates (e.g. hook invoked
  // manually outside of a real `git push`) — preserves the previous, cruder check.
  const branch = await $`git rev-parse --abbrev-ref HEAD`.text();
  if (branch.trim() === "main" || branch.trim() === "master") {
    console.error(`\n\x1b[31m❌ Direct push to '${branch.trim()}' is blocked. Use a PR branch.\x1b[0m`);
    process.exit(1);
  }
}

// Guarded so unit tests can import the exported helpers without executing
// the hook (git invokes this file directly, where import.meta.main is true).
if (import.meta.main) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
