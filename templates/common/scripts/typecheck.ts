#!/usr/bin/env bun
// @version 1.0.0
/**
 * typecheck.ts — TypeScript typecheck regression gate over scripts/.
 *
 * Runs `tsc --noEmit` with the repo tsconfig (include: the scripts/ tree),
 * counts the reported type errors, and compares the count against the
 * recorded baseline (scripts/helpers/typecheck-baseline.json):
 *   - errors <= baseline → exit 0 (summary printed)
 *   - errors >  baseline → exit 1 with the regression delta
 *
 * T-20260910-012 (infrastructure only): the repo carries a large body of
 * pre-existing type errors that need triage before this gate can tighten.
 * NOT yet wired into the dev-sync battery — that wiring happens post-triage.
 * CI (test.yml) runs this as a regression-blocking step in the meantime.
 *
 * Usage: bun scripts/typecheck.ts
 * Exit codes: 0 (at/below baseline), 1 (regression above baseline, or tsc
 * infrastructure failure)
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";

const BASELINE_PATH = join(dirname(import.meta.path), "helpers", "typecheck-baseline.json");

interface TypecheckBaseline {
  count: number;
  updated: string;
  note: string;
}

function main() {
  const baseline: TypecheckBaseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));

  console.log("=== TypeScript typecheck (tsc --noEmit over scripts/) ===");
  // Resolve from the repo root so the repo tsconfig governs regardless of cwd.
  const repoRoot = join(dirname(import.meta.path), "..");
  const proc = Bun.spawnSync(["bunx", "tsc", "--noEmit"], { cwd: repoRoot, stdout: "pipe", stderr: "pipe" });
  const output = new TextDecoder().decode(proc.stdout) + new TextDecoder().decode(proc.stderr);
  const errorCount = output.split("\n").filter((line) => /error TS\d+:/.test(line)).length;

  if (proc.exitCode !== 0 && errorCount === 0) {
    // tsc failed without per-line diagnostics (broken tsconfig, missing
    // dependency) — that is an infrastructure failure, not measurable debt.
    console.error(output.trim());
    console.error("❌ tsc exited non-zero without per-line errors (infrastructure failure).");
    process.exit(1);
  }

  console.log(`   Current errors : ${errorCount}`);
  console.log(`   Baseline       : ${baseline.count} (recorded ${baseline.updated})`);

  if (errorCount <= baseline.count) {
    if (errorCount < baseline.count) {
      console.log(`   ℹ️  Baseline can be tightened by ${baseline.count - errorCount}: consider updating scripts/helpers/typecheck-baseline.json.`);
    }
    console.log(`✅ Typecheck at/below baseline (delta ${errorCount - baseline.count}). ${baseline.note}`);
    process.exit(0);
  }

  console.error(`❌ Typecheck regression: ${baseline.count} → ${errorCount} (+${errorCount - baseline.count} above baseline).`);
  console.error("   Fix the new type errors. Only lower the baseline after triage per T-20260910-012 — never raise it to absorb new debt.");
  process.exit(1);
}

main();
