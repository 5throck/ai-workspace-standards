// @version 1.1.0
// v1.1.0 (2026-11-09, spec docs/designs/2026-11-09-repo-integrity-mode1-detector-design.md,
//          T-20261109-002): the FIRST corruption mode of the 2026-11-09 incident gets a
//          mechanical, fail-closed detector, and the snapshot gains the per-worktree
//          config scope:
//            - ROGUE_IDENTITY_EMAIL_PATTERNS — blocklist of known fixture identity
//              emails (author AND committer, case-insensitive). Extending the list is a
//              ONE-LINE change: add a literal regex with a comment naming where the
//              identity came from, then re-run the identity census
//              (`git log --all --format='%an <%ae> | %cn <%ce>' | sort -u` — the
//              2026-11-09 census found zero test@example.com identities in the full
//              history). NEVER add a skip environment variable — the §11 "reports,
//              does not edit / no blanket skip" discipline carries over.
//            - filterRogueCommits() — pure filter over one `git log` stream, so the
//              matching rules are unit-testable without any git spawn and refusal
//              messages carry SHA + identity + subject.
//            - scanRogueCommitsInRange() / scanRogueCommits() — one git spawn per scan
//              (`git log <range> --format=...`), under gitCleanEnv() like every read
//              here. Non-zero git exit → { ok:false } → callers abort (fail-closed).
//            - resolveRogueScanBase() — upstream → origin/main → { ok:false }. A gate
//              that cannot establish a comparison base must not silently pass.
//            - snapshotRepoConfig() now also snapshots the WORKTREE config scope:
//              `git config --worktree --list` when `extensions.worktreeConfig` is
//              enabled (verified 2026-11-09: with the extension on but no
//              config.worktree file, `git config --worktree --list` exits 128 with
//              "unable to read config file ... config.worktree" — that is an EMPTY
//              scope, not a failure; with the extension off git consults no worktree
//              config at all, so [] is the truthful snapshot). Worktree delta rows are
//              printed with a `wt: ` prefix (formatRepoConfigDeltaRows) so the operator
//              can see which scope moved.
//          Callers (one derivation, many callers — the scripts/lib/fleet.ts discipline):
//          scripts/dev-sync.ts (step 4.88 spawned-child integrity gate: config Arm 1 +
//          rogue-commit Arm 2) and scripts/hooks/pre-push.ts (config snapshot/compare
//          around the changed-path test run + rogue-identity scan over the exact pushed
//          range, before the gitleaks stage).
// v1.0.0 (2026-11-09, spec docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md
//          §11): repository-config integrity guard. The 2026-11-09 incident had two
//          corruption modes, both from a spawned child inheriting a git hook's
//          environment:
//            1. rogue commits — `git push` exports GIT_DIR into pre-push, the hook's
//               `bun test` child inherited it, and upgrade-project fixtures committed
//               INTO the checkout (fixed by scripts/lib/git-env.ts);
//            2. repository CONFIG corruption — the same inheritance let a fixture-side
//               `git config` write land on the REAL repository, leaving
//               `core.bare = true` in `.git/config` (git then refuses every work-tree
//               operation: "fatal: this operation must be run in a work tree") and
//               wiping `.git/worktrees/`. Worktrees SHARE the main `.git/config`, so
//               one redirected write corrupts every checkout of the repository.
//          This module makes mode 2 mechanical and fail-closed:
//            - snapshotRepoConfig() — stable (sorted) serialization of
//              `git config --local --list` plus the EFFECTIVE core.bare value;
//            - diffRepoConfig() — pure before/after diff (added/removed/changed);
//            - assertWorkTreeHealthy() — one-line refusal + the exact repair command
//              when the tree is not a usable work tree (`core.bare = true` or a
//              non-repository directory), instead of a cryptic git fatal.
//
//          Sanctioned config writers: NONE write this repository's local config during
//          a dev-sync run or a pre-push run (verified 2026-11-09). Every `git config`
//          WRITE in scripts/ targets an explicit `-C <projectDir>` or a chdir'd
//          scaffold (new-project.ts, adopt-project.ts, migrate-project.ts,
//          upgrade-project.ts, create-l3-scaffold.ts) and never the invoking repo, and
//          dev-sync installs no hooks. So the gate is exact — no key is excluded. If a
//          sanctioned writer is ever added (e.g. a bootstrap writing core.hooksPath),
//          declare THAT key by name at the call site; never add a blanket skip env.
//
//          Every git spawn here goes through gitCleanEnv() (scripts/lib/git-env.ts):
//          these reads must inspect the repo at --root, not one a hook's GIT_DIR points
//          at. Ambiguity would defeat the gate itself — a redirected read snapshots a
//          different repository and compares clean.

import { spawnSync } from 'node:child_process';
import { gitCleanEnv } from './git-env.ts';

/**
 * One-line incident reference carried by every refusal message, so an operator who
 * meets the guard for the first time can find the mechanism without git archaeology.
 */
export const REPO_INTEGRITY_INCIDENT_REF =
  '2026-11-09 repository-config corruption incident (design §11 of 2026-11-08-gw-tenant-loop-and-hardening-design)';

/** The exact command that clears the `core.bare = true` half of the incident. */
export const CORE_BARE_REPAIR_COMMAND = 'git config --local core.bare false';

/**
 * Design reference for the corruption-mode-1 detector (rogue commits), cited by the
 * base-resolution refusal and the Arm-2 wiring.
 */
export const ROGUE_COMMIT_DESIGN_REF =
  'docs/designs/2026-11-09-repo-integrity-mode1-detector-design.md (rogue-commit detector, §3.1-§3.3)';

/**
 * Blocklist of KNOWN fixture identity emails. A commit authored or committed by one of
 * these in this repository's own history is by definition a redirected fixture write —
 * the exact hazard the 2026-11-09 incident produced (10 commits authored
 * `Test <test@example.com>`, ~393 files, three L1 core scripts deleted).
 *
 * Matching is on the EMAIL only, case-insensitive and exact (`^...$` anchors) — never a
 * substring match, so `test@example.com.evil.example` or `tests@example.com` cannot
 * collide, and a human legitimately named "Test" with a different email passes.
 *
 * EXTENDING THE LIST (design §3.1): add ONE literal regex with a comment naming where
 * the identity came from (the fixture harness that sets it), then re-run the identity
 * census over the full history to confirm zero legitimate commits carry it:
 *
 *   git log --all --format='%an <%ae> | %cn <%ce>' | sort -u
 *
 * The 2026-11-09 census found only operator identities (techcross@gmail.com and GitHub
 * noreply addresses, one historical techcross@gamil.com typo), dependabot, and Claude
 * bot identities — zero test@example.com. There is deliberately NO skip environment
 * variable for this blocklist; the remedy for a legitimate commit that somehow carries
 * a blocklisted identity is `git config user.email <real>` +
 * `git commit --amend --reset-author`, which is auditable.
 */
export const ROGUE_IDENTITY_EMAIL_PATTERNS: RegExp[] = [
  /^test@example\.com$/i, // the standard fixture identity set by test harnesses (upgrade-project, generator-manifest, …)
];

/** Field separator for the single-spawn `git log` record format (%x1f). */
const FIELD_SEPARATOR = '\x1f';

/** One blocklisted commit, with WHICH identity field matched so the operator can see the shape. */
export interface RogueCommitRecord {
  sha: string;
  field: 'author' | 'committer';
  /** Reconstructed `Name <email>` of the matched field. */
  identity: string;
  subject: string;
}

/**
 * Outcome of a rogue-commit scan. `ok:false` covers the fail-closed conditions (git
 * failure, malformed range) — callers MUST abort on it, never treat it as clean.
 */
export type RogueScanResult =
  | { ok: true; commits: RogueCommitRecord[] } // commits.length === 0 means clean
  | { ok: false; reason: string };

/**
 * Pure filter over one `git log` stream — unit-testable without any git spawn.
 *
 * Input lines are `sha<US>authorName<US>authorEmail<US>committerName<US>committerEmail<US>subject`
 * records (US = \x1f, the %x1f separator of the scan format). Empty and malformed lines
 * are skipped defensively; a subject containing the separator stays one record (the
 * remainder re-joins). A commit whose author AND committer emails both match yields TWO
 * records (one per field) — the refusal lists each, which is informative, not noisy.
 */
export function filterRogueCommits(
  logOutput: string,
  patterns: RegExp[] = ROGUE_IDENTITY_EMAIL_PATTERNS,
): RogueCommitRecord[] {
  const hits: RogueCommitRecord[] = [];
  for (const line of logOutput.split('\n')) {
    if (line.length === 0) continue;
    const fields = line.split(FIELD_SEPARATOR);
    if (fields.length < 6) continue; // not a scan record — ignore rather than misreport
    const [sha, authorName, authorEmail, committerName, committerEmail] = fields;
    const subject = fields.slice(5).join(FIELD_SEPARATOR);
    if (patterns.some((p) => p.test(authorEmail))) {
      hits.push({ sha, field: 'author', identity: `${authorName} <${authorEmail}>`, subject });
    }
    if (patterns.some((p) => p.test(committerEmail))) {
      hits.push({ sha, field: 'committer', identity: `${committerName} <${committerEmail}>`, subject });
    }
  }
  return hits;
}

/** The exact `git log` record format: SHA + both identities + subject, one line each. */
const ROGUE_SCAN_FORMAT = '%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%s';

/**
 * Spawn + filter over an explicit rev range (pre-push scans the EXACT pushed range:
 * `remoteOid..localOid` for existing refs, `localOid --not --remotes` for new branches).
 * One git spawn per scan, under gitCleanEnv() (a redirected read would scan the wrong
 * repository and report clean — the same rule as every read in this module).
 * Non-zero git exit → { ok:false } (fail-closed). An EMPTY revArgs list would scan the
 * entire history — refused as a programming error instead.
 */
export function scanRogueCommitsInRange(revArgs: string[], root: string = process.cwd()): RogueScanResult {
  if (revArgs.length === 0) {
    return { ok: false, reason: 'rogue-commit scan received an empty revision range — refusing to scan unbounded history' };
  }
  const res = runGit(['log', ...revArgs, `--format=${ROGUE_SCAN_FORMAT}`], root);
  if (res.status !== 0) {
    return {
      ok: false,
      reason: `git log ${revArgs.join(' ')} failed (exit ${res.status}): ${res.stderr.trim() || 'no stderr'}`,
    };
  }
  return { ok: true, commits: filterRogueCommits(res.stdout) };
}

/**
 * Spawn + filter over `base..HEAD` (the dev-sync Arm-2 window). See
 * {@link scanRogueCommitsInRange} for the failure semantics.
 */
export function scanRogueCommits(base: string, root: string = process.cwd()): RogueScanResult {
  return scanRogueCommitsInRange([`${base}..HEAD`], root);
}

/**
 * Base-ref resolution for the Arm-2 scan window, in order (design §3.2):
 *
 *   1. `HEAD@{upstream}` — the remote PR-branch tip: the window is exactly "commits
 *      made since the last successful push", covering both a rogue commit produced
 *      during THIS run's test steps and one left over from an earlier gate-less session.
 *   2. `origin/main` — the workspace's protected default branch (pre-push blocks direct
 *      pushes to it, so it is a trustworthy known-good boundary). Used when HEAD has no
 *      upstream (first dev-sync run on a brand-new branch, local-only branches).
 *   3. Neither resolvable → { ok:false } and the caller aborts — fail-closed on
 *      purpose: an integrity gate that cannot establish a comparison base must not
 *      silently pass.
 */
export function resolveRogueScanBase(
  root: string = process.cwd(),
): { ok: true; base: string } | { ok: false; reason: string } {
  const upstream = runGit(['rev-parse', '--abbrev-ref', 'HEAD@{upstream}'], root);
  if (upstream.status === 0 && upstream.stdout.trim() !== '') {
    return { ok: true, base: upstream.stdout.trim() };
  }
  const originMain = runGit(['rev-parse', '--verify', 'origin/main'], root);
  if (originMain.status === 0 && originMain.stdout.trim() !== '') {
    return { ok: true, base: 'origin/main' };
  }
  return {
    ok: false,
    reason:
      `cannot resolve a rogue-commit scan base in ${root}: neither HEAD@{upstream} `
      + `(exit ${upstream.status}: ${upstream.stderr.trim() || 'no stderr'}) nor origin/main `
      + `(exit ${originMain.status}: ${originMain.stderr.trim() || 'no stderr'}) resolves. `
      + `An integrity gate that cannot establish a comparison base must not silently pass. Ref: ${ROGUE_COMMIT_DESIGN_REF} §3.2.`,
  };
}

/**
 * Operator-facing refusal lines for a non-empty rogue-commit scan (one derivation for
 * the dev-sync Arm-2 gate and the pre-push pushed-range scan). `windowLabel` names the
 * scanned range (e.g. `origin/pr/123..HEAD` or `abc123..def456`). No auto-repair: the
 * remedy is manual history surgery, per the §11 "reports, does not edit" discipline.
 */
export function rogueScanRefusalLines(commits: RogueCommitRecord[], windowLabel: string): string[] {
  const lines = [
    `${commits.length} commit(s) authored by a KNOWN TEST-FIXTURE identity exist in ${windowLabel} — the branch must not be pushed or staged:`,
  ];
  for (const c of commits) {
    lines.push(`${c.sha} [${c.field}] ${c.identity} — ${c.subject}`);
  }
  lines.push(
    'These commits were produced by a spawned test that inherited a hook\'s git environment (2026-11-09 incident class).',
    'Repair is MANUAL history surgery — no auto-repair: drop the commits with `git rebase` (or `git reset` while unpushed)',
    'after confirming no legitimate work is discarded, then re-run /sync.',
    'Fix the spawning test to run under scripts/lib/git-env.ts (gitCleanEnvForShell for Bun Shell, gitCleanEnv for spawnSync);',
    'fixture suites must self-assert via tests/helpers/fixture-git.ts.',
    `Spec: ${ROGUE_COMMIT_DESIGN_REF} §3.3.`,
  );
  return lines;
}

/** Stable, comparable view of a repository's local configuration. */
export interface RepoConfigSnapshot {
  /** Repository root the snapshot was taken against. */
  root: string;
  /** Sorted `key=value` lines from `git -C <root> config --local --list`. */
  entries: string[];
  /** Effective `core.bare` (local > global > system), or null when unset. */
  coreBare: string | null;
  /**
   * Sorted `key=value` lines from `git config --worktree --list`, captured only when
   * `extensions.worktreeConfig` is enabled. Empty when the extension is off — git
   * consults no worktree config in that mode, so `[]` and "feature off" are
   * behaviorally identical for diffing (no nullable third state; v1.1.0).
   */
  worktreeEntries: string[];
}

/** Structural difference between two snapshots. Empty arrays mean "no change". */
export interface RepoConfigDelta {
  /** `key=value` lines only present AFTER the run. */
  added: string[];
  /** `key=value` lines only present BEFORE the run. */
  removed: string[];
  /** `key: <before values> → <after values>` for keys whose value set changed. */
  changed: string[];
}

/** Outcome of the work-tree health probe. */
export type WorkTreeHealth = { ok: true } | { ok: false; reason: string };

interface GitResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runGit(args: string[], root: string): GitResult {
  const res = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    // gitCleanEnv(): never let a hook-inherited GIT_DIR/GIT_CONFIG redirect these
    // reads onto another repository (that would silently defeat the gate).
    env: gitCleanEnv(),
  });
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? res.error?.message ?? '',
  };
}

/** Split `git config --list` output into sorted, CR-trimmed, non-empty lines. */
function normalizeConfigList(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.length > 0)
    .sort();
}

/**
 * Snapshot `git -C <root> config --local --list` as sorted `key=value` lines, plus the
 * effective `core.bare` value and — when `extensions.worktreeConfig` is enabled — the
 * per-worktree config scope (`git config --worktree --list`, v1.1.0).
 *
 * Git reads: the local list + the effective bare probe + the worktree-extension probe
 * (+1 when the extension is off), plus the worktree list itself (+1 more when on).
 * Throws when the repository cannot be read at all — a caller inside a checkout treats
 * that as a hard failure, and `assertWorkTreeHealthy()` is the separate, graceful
 * non-repository probe.
 */
export function snapshotRepoConfig(root: string = process.cwd()): RepoConfigSnapshot {
  const list = runGit(['config', '--local', '--list'], root);
  if (list.status !== 0) {
    throw new Error(
      `repo-integrity: cannot read local git config at ${root} (exit ${list.status}): ${list.stderr.trim()}`,
    );
  }
  const entries = normalizeConfigList(list.stdout);

  // Effective value, not just the local one: a global `core.bare` would break the
  // work tree just as effectively. Exit 1 with empty stdout = key unset.
  const bare = runGit(['config', '--bool', '--get', 'core.bare'], root);
  const coreBare = bare.status === 0 && bare.stdout.trim() !== '' ? bare.stdout.trim() : null;

  // Worktree scope (v1.1.0): gated on the extension probe — with the extension OFF,
  // `git config --worktree --list` silently falls back to the LOCAL config (verified
  // 2026-11-09), so an ungated read would duplicate `entries` instead of snapshotting
  // a distinct scope. With the extension ON but no config.worktree file, the read
  // exits 128 with "unable to read config file … config.worktree" — that is git
  // reporting an EMPTY worktree scope, not a failure (verified 2026-11-09).
  let worktreeEntries: string[] = [];
  const wtProbe = runGit(['config', '--type=bool', '--get', 'extensions.worktreeConfig'], root);
  if (wtProbe.status === 0 && wtProbe.stdout.trim() === 'true') {
    const wt = runGit(['config', '--worktree', '--list'], root);
    if (wt.status === 0) {
      worktreeEntries = normalizeConfigList(wt.stdout);
    } else if (/unable to read config file .*config\.worktree/i.test(wt.stderr)) {
      worktreeEntries = [];
    } else {
      throw new Error(
        `repo-integrity: cannot read worktree-scoped git config at ${root} (exit ${wt.status}): ${wt.stderr.trim()}`,
      );
    }
  }

  return { root, entries, coreBare, worktreeEntries };
}

interface ParsedConfig {
  /** key → sorted values (duplicates PRESERVED — a repeated `remote.origin.fetch` line is
   *  a distinct value and must keep its multiplicity, so a run that adds a duplicate is
   *  reported as a change), plus the original lines for message fidelity. */
  values: Map<string, string[]>;
  lines: Map<string, string[]>;
}

function parseEntries(entries: string[]): ParsedConfig {
  const values = new Map<string, string[]>();
  const lines = new Map<string, string[]>();
  for (const entry of entries) {
    const eq = entry.indexOf('=');
    const key = eq === -1 ? entry : entry.slice(0, eq);
    const value = eq === -1 ? '' : entry.slice(eq + 1);
    const bucket = values.get(key) ?? [];
    bucket.push(value);
    values.set(key, bucket);
    const lineBucket = lines.get(key) ?? [];
    lineBucket.push(entry);
    lines.set(key, lineBucket);
  }
  for (const [key, bucket] of values) values.set(key, bucket.sort());
  for (const [key, bucket] of lines) lines.set(key, bucket.sort());
  return { values, lines };
}

/**
 * Pure difference between two `key=value` line lists (normally the `entries` of two
 * snapshots). Order-insensitive and multi-value aware (`remote.origin.fetch` can appear
 * several times). added/removed are KEY-level; a key that already existed and gained or
 * lost a value lands in `changed` (its before/after value sets are printed), because the
 * key itself is not new. Empty arrays on both sides means the run left the config
 * untouched — the contract both callers gate on.
 */
export function diffRepoConfig(before: string[], after: string[]): RepoConfigDelta {
  const b = parseEntries(before);
  const a = parseEntries(after);
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const key of [...a.lines.keys()].sort()) {
    if (!b.lines.has(key)) added.push(...a.lines.get(key)!);
  }
  for (const key of [...b.lines.keys()].sort()) {
    if (!a.lines.has(key)) removed.push(...b.lines.get(key)!);
  }
  for (const key of [...b.values.keys()].sort()) {
    if (!a.values.has(key)) continue;
    const beforeValues = b.values.get(key)!;
    const afterValues = a.values.get(key)!;
    if (beforeValues.join('\u0000') === afterValues.join('\u0000')) continue;
    changed.push(`${key}: ${beforeValues.join(', ')} → ${afterValues.join(', ')}`);
  }

  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}

/** True when a delta carries no change at all. */
export function isEmptyRepoConfigDelta(delta: RepoConfigDelta): boolean {
  return delta.added.length === 0 && delta.removed.length === 0 && delta.changed.length === 0;
}

/**
 * One derivation for the operator-facing delta rows of both integrity-gate callers.
 * `scopePrefix` marks which config scope moved — the worktree section's rows are
 * printed with `'wt: '` so a `config.worktree` delta is distinguishable from a local
 * one at a glance (v1.1.0).
 */
export function formatRepoConfigDeltaRows(delta: RepoConfigDelta, scopePrefix = ''): string[] {
  return [
    ...delta.added.map((line) => `${scopePrefix}+ ${line}`),
    ...delta.removed.map((line) => `${scopePrefix}- ${line}`),
    ...delta.changed.map((line) => `${scopePrefix}~ ${line}`),
  ];
}

/**
 * Fail-closed work-tree probe. Reports a one-line refusal — with the exact repair
 * command and the incident reference — when the directory is not a usable work tree:
 *
 *   - `git rev-parse --is-inside-work-tree` does not print `true` (a non-repository
 *     directory, or a repository switched to bare mode: verified 2026-11-09 that
 *     `core.bare = true` makes this probe print `false` while still exiting 0);
 *   - the effective `core.bare` value is `true`.
 */
export function assertWorkTreeHealthy(root: string = process.cwd()): WorkTreeHealth {
  const probe = runGit(['rev-parse', '--is-inside-work-tree'], root);
  const insideWorkTree = probe.status === 0 && probe.stdout.trim() === 'true';

  const bare = runGit(['config', '--bool', '--get', 'core.bare'], root);
  const coreBare = bare.status === 0 && bare.stdout.trim() !== '' ? bare.stdout.trim() : null;

  if (insideWorkTree && coreBare !== 'true') return { ok: true };

  const detail = coreBare === 'true'
    ? `core.bare is true in ${root}/.git/config`
    : `git rev-parse --is-inside-work-tree did not return true at ${root} (exit ${probe.status}: ${probe.stderr.trim() || 'not inside a git work tree'})`;

  return {
    ok: false,
    reason:
      `unusable git work tree — ${detail}. `
      + `Repair: ${CORE_BARE_REPAIR_COMMAND}  (worktrees share the main .git/config, so one redirected write breaks every checkout). `
      + `Ref: ${REPO_INTEGRITY_INCIDENT_REF}.`,
  };
}
