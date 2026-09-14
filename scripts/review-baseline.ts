#!/usr/bin/env bun
// @version 1.0.0
/**
 * review-baseline.ts — consolidated read-only runner for the project-review
 * Step 0 baseline battery (T-20260912-030).
 *
 * Runs the six baseline validators in guaranteed read-only mode and prints a
 * PASS/FAIL summary. Each validator is invoked exactly the way the
 * project-review skill's Step 0 documents them; nothing here mutates the tree.
 *
 *   1. bun scripts/audit.ts                               # workspace standards
 *   2. bun scripts/validate-templates.ts                  # template/variant integrity + L1 parity
 *   3. bun scripts/verify-scripts.ts --verify             # SCRIPTS.md registry sync
 *   4. bun run agent-lifecycle-audit                      # agent health
 *   5. bun run skill-lifecycle-audit                      # skill health
 *   6. bun scripts/propagate-to-templates.ts --check-drift # L1↔L2 drift
 *
 * Exit codes: 0 = all green, 1 = one or more validators failed.
 * Known-tolerated noise (not failures): propagate --check-drift exits 1 on
 * the documented gemini-settings drift class; the lifecycle audits emit
 * pre-existing warnings.
 *
 * Usage: bun scripts/review-baseline.ts [--quiet]
 */

const validators: Array<{ name: string; cmd: string[]; tolerateExit1?: boolean }> = [
  { name: "audit.ts (workspace standards)", cmd: ["bun", "scripts/audit.ts"] },
  { name: "validate-templates.ts (template/variant integrity + L1 parity)", cmd: ["bun", "scripts/validate-templates.ts"] },
  { name: "verify-scripts.ts --verify (SCRIPTS.md registry sync)", cmd: ["bun", "scripts/verify-scripts.ts", "--verify"] },
  { name: "agent-lifecycle-audit (agent health)", cmd: ["bun", "run", "agent-lifecycle-audit"] },
  { name: "skill-lifecycle-audit (skill health)", cmd: ["bun", "run", "skill-lifecycle-audit"] },
  // Documented exception: exits 1 on the tolerated gemini-settings drift class.
  { name: "propagate-to-templates --check-drift (L1↔L2 drift)", cmd: ["bun", "scripts/propagate-to-templates.ts", "--check-drift"], tolerateExit1: true },
];

const quiet = process.argv.includes("--quiet");
const results: Array<{ name: string; ok: boolean; note: string }> = [];

for (const v of validators) {
  const proc = Bun.spawnSync(v.cmd, { stdout: "pipe", stderr: "pipe" });
  const output = new TextDecoder().decode(proc.stdout) + new TextDecoder().decode(proc.stderr);
  const failed = proc.exitCode !== 0 && !(v.tolerateExit1 && proc.exitCode === 1);
  const note = failed
    ? `exit ${proc.exitCode}`
    : v.tolerateExit1 && proc.exitCode === 1
      ? "exit 1 (documented tolerated drift class)"
      : `exit 0`;
  results.push({ name: v.name, ok: !failed, note });
  if (!quiet) {
    console.log(`${failed ? "❌" : "✅"} ${v.name} — ${note}`);
    if (failed) {
      const tail = output.trim().split("\n").slice(-8).join("\n");
      console.error(tail);
    }
  }
}

const failures = results.filter((r) => !r.ok);
if (!quiet) {
  console.log(`\n=== Review baseline summary: ${results.length - failures.length}/${results.length} green ===`);
  for (const r of results) console.log(`  ${r.ok ? "✅" : "❌"} ${r.name}`);
}

process.exit(failures.length > 0 ? 1 : 0);
