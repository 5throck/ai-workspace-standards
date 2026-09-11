#!/usr/bin/env bun
// @version 1.1.0
/**
 * typecheck.ts — TypeScript typecheck gate over scripts/ (T-20260910-012).
 *
 * Runs `tsc --noEmit` with the repo tsconfig (include: the scripts/ tree),
 * counts the reported type errors, and compares the count against the
 * recorded baseline (scripts/helpers/typecheck-baseline.json):
 *   - errors <= baseline → exit 0 (summary printed)
 *   - errors >  baseline → exit 1 with the regression delta
 *
 * T-20260910-012 history: introduced as a regression-only gate over a
 * recorded 2169-error baseline; the Phase 2 triage (2026-09-11) fixed the
 * type roots (@types/bun, tsconfig) and all 2169 errors — the baseline is
 * now 0, so ANY type error fails. Wired into the dev-sync battery
 * (root context) and CI (test.yml).
 *
 * Usage: bun scripts/typecheck.ts
 * Exit codes: 0 (at/below baseline), 1 (regression above baseline, or tsc
 * infrastructure failure). In a context without a baseline file (e.g. L1
 * mirrors), the gate skips cleanly — the baseline is a root-context asset.
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
  let baseline: TypecheckBaseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("=== TypeScript typecheck: no baseline file in this context — skipping (root-context gate) ===");
      process.exit(0);
    }
    throw err;
  }

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
