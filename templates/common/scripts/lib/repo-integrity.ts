// @version 1.0.0
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
//          Callers (one derivation, many callers — the scripts/lib/fleet.ts discipline):
//          scripts/dev-sync.ts (start-of-run invariant + post-test config integrity
//          gate) and scripts/hooks/pre-push.ts (snapshot/compare around the
//          changed-path test run, where incident 1 originated).
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

/** Stable, comparable view of a repository's local configuration. */
export interface RepoConfigSnapshot {
  /** Repository root the snapshot was taken against. */
  root: string;
  /** Sorted `key=value` lines from `git -C <root> config --local --list`. */
  entries: string[];
  /** Effective `core.bare` (local > global > system), or null when unset. */
  coreBare: string | null;
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

/**
 * Snapshot `git -C <root> config --local --list` as sorted `key=value` lines, plus the
 * effective `core.bare` value.
 *
 * Two git reads (the list + the effective bare probe). Throws when the repository
 * cannot be read at all — a caller inside a checkout treats that as a hard failure, and
 * `assertWorkTreeHealthy()` is the separate, graceful non-repository probe.
 */
export function snapshotRepoConfig(root: string = process.cwd()): RepoConfigSnapshot {
  const list = runGit(['config', '--local', '--list'], root);
  if (list.status !== 0) {
    throw new Error(
      `repo-integrity: cannot read local git config at ${root} (exit ${list.status}): ${list.stderr.trim()}`,
    );
  }
  const entries = list.stdout
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.length > 0)
    .sort();

  // Effective value, not just the local one: a global `core.bare` would break the
  // work tree just as effectively. Exit 1 with empty stdout = key unset.
  const bare = runGit(['config', '--bool', '--get', 'core.bare'], root);
  const coreBare = bare.status === 0 && bare.stdout.trim() !== '' ? bare.stdout.trim() : null;

  return { root, entries, coreBare };
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
