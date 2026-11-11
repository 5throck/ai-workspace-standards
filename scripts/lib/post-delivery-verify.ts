// @version 1.0.0
/**
 * post-delivery-verify.ts — C-A post-delivery behavior verification helpers
 *
 * v1.0.0 (2026-11-11, T-20261110-012 Scope C-A, design
 *          docs/designs/2026-11-10-delivery-gating-hardening-design.md §4 C-A,
 *          DEC-20261110-04 PR-3): an upgrade apply that delivers a script can
 *          break the project's own colocated test of that script (the 2026-11-08
 *          co-deck security-validator v1.3.0 case). upgrade-project.ts runs the
 *          sibling tests BEFORE the first delivery write and AFTER the passes in
 *          the project checkout, and records only the NEW failures.
 *
 * v1 bounds (design §4 C-A): sibling-suffix selection only — `X.test.ts` beside
 * a delivered `X.ts` under the project's scripts/ tree. Transitively importing
 * tests are a follow-up. Dry-run never verifies (no writes to verify).
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Per-test-file outcome of one runner invocation. */
export interface TestFileOutcome {
  /** false when the runner could not start (missing binary, spawn error). */
  ran: boolean;
  exitCode: number | null;
  /** Failing test names; a file-level failure with no named case is `<file>`. */
  failures: string[];
}

export interface PreDeliverySnapshot {
  /** subject rel (`scripts/.../X.ts`) → sha256 of its pre-delivery bytes */
  subjectHashes: Map<string, string>;
  /** sibling test rel → pre-delivery outcome */
  outcomes: Map<string, TestFileOutcome>;
}

export interface BehaviorRegression {
  subject: string;
  testFile: string;
  test: string;
}

const FILE_LEVEL = "<file>";

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Subject rel for a sibling test rel: `scripts/a/X.test.ts` → `scripts/a/X.ts`. */
export function subjectOf(testRel: string): string | null {
  return testRel.endsWith(".test.ts") ? `${testRel.slice(0, -".test.ts".length)}.ts` : null;
}

/** Every `X.test.ts` under `<projectDir>/scripts` whose subject `X.ts` exists. */
export function listSiblingTests(projectDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string): void => {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const abs = join(dir, entry);
      const childRel = `${rel}/${entry}`;
      let isDir = false;
      try {
        isDir = statSync(abs).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        walk(abs, childRel);
      } else if (entry.endsWith(".test.ts")) {
        const subject = subjectOf(childRel);
        if (subject && existsSync(join(projectDir, subject))) out.push(childRel);
      }
    }
  };
  walk(join(projectDir, "scripts"), "scripts");
  return out.sort();
}

/** Parse `bun test` output into failing test names. */
export function parseBunTestFailures(output: string): string[] {
  const names: string[] = [];
  for (const line of output.split("\n")) {
    const m = line.match(/^\(fail\)\s+(.*?)(?:\s+\[[\d.]+m?s\])?\s*$/);
    if (m) names.push(m[1]);
  }
  return names;
}

/** Run one test file with bun in the project checkout. */
export function runTestFile(projectDir: string, testRel: string, runner = process.execPath): TestFileOutcome {
  const res = spawnSync(runner, ["test", testRel], {
    cwd: projectDir,
    encoding: "utf8",
    timeout: 180000,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  if (res.error || res.status === null) {
    return { ran: false, exitCode: res.status, failures: [] };
  }
  const failures = parseBunTestFailures(`${res.stdout ?? ""}\n${res.stderr ?? ""}`);
  if (res.status !== 0 && failures.length === 0) failures.push(FILE_LEVEL);
  return { ran: true, exitCode: res.status, failures };
}

/** Pre-delivery capture: hash every sibling-test subject and run its test. */
export function capturePreDelivery(
  projectDir: string,
  run: (projectDir: string, testRel: string) => TestFileOutcome = runTestFile,
): PreDeliverySnapshot {
  const subjectHashes = new Map<string, string>();
  const outcomes = new Map<string, TestFileOutcome>();
  for (const testRel of listSiblingTests(projectDir)) {
    const subject = subjectOf(testRel);
    if (!subject) continue;
    subjectHashes.set(subject, sha256(readFileSync(join(projectDir, subject))));
    outcomes.set(testRel, run(projectDir, testRel));
  }
  return { subjectHashes, outcomes };
}

/**
 * Trigger set (design §4 C-A): delivered subjects whose bytes changed against
 * the pre-delivery snapshot and that have a sibling test.
 */
export function changedDeliveredSubjects(
  projectDir: string,
  pre: PreDeliverySnapshot,
  deliveredRels: Iterable<string>,
): string[] {
  const out: string[] = [];
  for (const rel of deliveredRels) {
    const before = pre.subjectHashes.get(rel);
    if (before === undefined) continue;
    const abs = join(projectDir, rel);
    if (!existsSync(abs)) continue;
    if (sha256(readFileSync(abs)) !== before) out.push(rel);
  }
  return out.sort();
}

/** New failures only: failing after delivery, not failing before. */
export function diffNewFailures(
  subject: string,
  testFile: string,
  pre: TestFileOutcome | undefined,
  post: TestFileOutcome,
): BehaviorRegression[] {
  if (!post.ran) return [];
  const before = new Set(pre?.ran ? pre.failures : []);
  // A file-level failure before delivery masks named cases (nothing passed).
  if (before.has(FILE_LEVEL)) return [];
  return post.failures.filter((t) => !before.has(t)).map((test) => ({ subject, testFile, test }));
}
