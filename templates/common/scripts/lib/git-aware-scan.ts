#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-11-03, T-20261103-004): git-aware discovery helpers for scripts
//          whose output is COMMITTED — trackedFilesUnder (one cached
//          `git ls-files -z` query, NUL-split, forward-slash-normalized),
//          isTrackedRel (fail-open on null/non-git), checkoutBranch
//          (`git -C <dir> branch --show-current`), isTransientCheckoutBranch
//          (`pr/*` = transient working copy per the landing convention),
//          filterTransientCheckouts (pure split of candidate checkouts into
//          members vs PR copies; only positive evidence excludes). Closes two
//          leak classes: untracked files inside tracked dirs
//          (generate-skill-graph.ts decisions/ADR scan) and transient PR
//          checkouts inside the fleet projection
//          (skill-graph-fleet-report.ts defaultProjects).

import { spawnSync } from 'node:child_process';

/**
 * One `git ls-files -z -- <dir>` query rooted at `root`, NUL-split and
 * forward-slash-normalized, as a Set of repo-root-relative POSIX paths.
 * null = non-git context (no repo / git unavailable) — callers treat null
 * as include-all (fail-open; SKILL_GRAPH_ROOT fixtures keep the historical
 * include-all behavior).
 */
export function trackedFilesUnder(root: string, dir: string): Set<string> | null {
  const res = spawnSync('git', ['-C', root, 'ls-files', '-z', '--', dir], { encoding: 'buffer' });
  if (res.status !== 0 || !res.stdout) return null;
  const out = new Set<string>();
  for (const entry of res.stdout.toString('utf8').split('\0')) {
    if (entry) out.add(entry.replace(/\\/g, '/'));
  }
  return out;
}

/**
 * Fail-open membership test against a trackedFilesUnder() result: a null set
 * (non-git context) tracks everything, so the caller's historical include-all
 * behavior survives outside a repo.
 */
export function isTrackedRel(tracked: Set<string> | null, relPath: string): boolean {
  if (tracked === null) return true;
  return tracked.has(relPath.replace(/\\/g, '/'));
}

/**
 * Current branch of a checkout via `git -C <dir> branch --show-current`, or
 * null when detached / non-git / git errored — null is "no positive
 * evidence", never an exclusion signal.
 */
export function checkoutBranch(dir: string): string | null {
  const res = spawnSync('git', ['-C', dir, 'branch', '--show-current'], { encoding: 'utf8' });
  if (res.status !== 0) return null;
  const branch = (res.stdout || '').trim();
  return branch || null; // detached HEAD prints empty
}

/** `pr/*` = a transient PR working checkout per the landing convention. */
export function isTransientCheckoutBranch(branch: string): boolean {
  return branch.startsWith('pr/');
}

/**
 * Pure split of candidate project checkouts into fleet members vs transient
 * PR working copies. Only positive evidence (a live `pr/*` branch) excludes —
 * main-branch, detached-HEAD and non-git dirs all stay (fail-open).
 */
export function filterTransientCheckouts(
  projects: string[],
  branchOf: (dir: string) => string | null,
): { projects: string[]; skipped: Array<{ name: string; branch: string }> } {
  const members: string[] = [];
  const skipped: Array<{ name: string; branch: string }> = [];
  for (const dir of projects) {
    const branch = branchOf(dir);
    if (branch !== null && isTransientCheckoutBranch(branch)) {
      skipped.push({ name: dir, branch });
    } else {
      members.push(dir);
    }
  }
  return { projects: members, skipped };
}
