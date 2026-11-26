#!/usr/bin/env bun
// @version 1.1.0
// v1.1.0 (2026-11-26, spec docs/designs/2026-11-26-skill-drift-structural-fixes-design.md
//          §4.4 S4): checkoutHead() added — `git -C <dir> rev-parse --short HEAD`
//          under gitCleanEnv(), fail-open null (same contract as checkoutBranch).
//          Read-only identity of a checkout's HEAD; consumed by the fleet report's
//          snapshot `transient[]` records so a skipped PR working copy is visible in
//          the durable artifact WITHOUT its tree ever being scanned (S4 non-goal:
//          rev-parse metadata only, no tree reads).
// v1.0.1 (2026-11-09, rogue-commit incident): both git spawns run under
//          scripts/lib/git-env.ts gitCleanEnv(). `-C <dir>` does not defeat an
//          inherited GIT_DIR, so a hook context made this scan report the
//          invoking repository's files/branch (wrong generated content and wrong
//          fixture decisions — 10 rogue commits landed that way).
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

import { spawnSync } from "node:child_process";
import { gitCleanEnv } from "./git-env.ts";

/**
 * One `git ls-files -z -- <dir>` query rooted at `root`, NUL-split and
 * forward-slash-normalized, as a Set of repo-root-relative POSIX paths.
 * null = non-git context (no repo / git unavailable) — callers treat null
 * as include-all (fail-open; SKILL_GRAPH_ROOT fixtures keep the historical
 * include-all behavior).
 *
 * gitCleanEnv(): `-C root` only changes cwd — an inherited GIT_DIR still wins,
 * so under a hook context this query would report the INVOKING repo's files
 * (2026-11-09 rogue-commit incident class: generated content and fixture
 * decisions silently keyed off the wrong repository).
 */
export function trackedFilesUnder(root: string, dir: string): Set<string> | null {
  const res = spawnSync("git", ["-C", root, "ls-files", "-z", "--", dir], {
    encoding: "buffer",
    env: gitCleanEnv() as NodeJS.ProcessEnv,
  });
  if (res.status !== 0 || !res.stdout) return null;
  const out = new Set<string>();
  for (const entry of res.stdout.toString("utf8").split("\0")) {
    if (entry) out.add(entry.replace(/\\/g, "/"));
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
  return tracked.has(relPath.replace(/\\/g, "/"));
}

/**
 * Current branch of a checkout via `git -C <dir> branch --show-current`, or
 * null when detached / non-git / git errored — null is "no positive
 * evidence", never an exclusion signal.
 */
export function checkoutBranch(dir: string): string | null {
  // gitCleanEnv(): same reason as trackedFilesUnder — never let an inherited
  // GIT_DIR answer "which branch is this checkout on" for another repo.
  const res = spawnSync("git", ["-C", dir, "branch", "--show-current"], {
    encoding: "utf8",
    env: gitCleanEnv() as NodeJS.ProcessEnv,
  });
  if (res.status !== 0) return null;
  const branch = (res.stdout || "").trim();
  return branch || null; // detached HEAD prints empty
}

/** `pr/*` = a transient PR working checkout per the landing convention. */
export function isTransientCheckoutBranch(branch: string): boolean {
  return branch.startsWith("pr/");
}

/**
 * Short HEAD sha of a checkout via `git -C <dir> rev-parse --short HEAD`, or
 * null on any git error / empty output (non-git dir, unborn HEAD) — fail-open,
 * the checkoutBranch() contract. v1.1.0 (S4): read-only metadata for the fleet
 * snapshot's transient[] records; the checkout's working tree is never read.
 */
export function checkoutHead(dir: string): string | null {
  // gitCleanEnv(): same reason as checkoutBranch — never let an inherited
  // GIT_DIR answer "which commit is this checkout at" for another repo.
  const res = spawnSync("git", ["-C", dir, "rev-parse", "--short", "HEAD"], {
    encoding: "utf8",
    env: gitCleanEnv() as NodeJS.ProcessEnv,
  });
  if (res.status !== 0) return null;
  const head = (res.stdout || "").trim();
  return head || null;
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
