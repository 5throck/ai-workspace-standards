#!/usr/bin/env bun
// @version 1.0.1
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

const validators: Array<{
  name: string;
  cmd: string[];
  tolerateExit1?: boolean;
  driftJsonContract?: boolean;
}> = [
  { name: "audit.ts (workspace standards)", cmd: ["bun", "scripts/audit.ts"] },
  { name: "validate-templates.ts (template/variant integrity + L1 parity)", cmd: ["bun", "scripts/validate-templates.ts"] },
  { name: "verify-scripts.ts --verify (SCRIPTS.md registry sync)", cmd: ["bun", "scripts/verify-scripts.ts", "--verify"] },
  { name: "agent-lifecycle-audit (agent health)", cmd: ["bun", "run", "agent-lifecycle-audit"] },
  { name: "skill-lifecycle-audit (skill health)", cmd: ["bun", "run", "skill-lifecycle-audit"] },
  // T-20260922-030: the tolerated exit-1 class is verified via the machine
  // contract (--json: toleratedDrift/unexpectedDrift) — a hard crash also
  // exits 1, and mapping it to "tolerated" would green-light a drift check
  // that never ran. Mirrors the test.yml drift step's contract.
  { name: "propagate-to-templates --check-drift (L1↔L2 drift)", cmd: ["bun", "scripts/propagate-to-templates.ts", "--check-drift", "--json"], tolerateExit1: true, driftJsonContract: true },
];

const quiet = process.argv.includes("--quiet");
const results: Array<{ name: string; ok: boolean; note: string }> = [];

for (const v of validators) {
  const proc = Bun.spawnSync(v.cmd, { stdout: "pipe", stderr: "pipe" });
  const output = new TextDecoder().decode(proc.stdout) + new TextDecoder().decode(proc.stderr);
  // T-20260922-030: for the drift validator, a tolerated exit 1 counts as pass
  // ONLY when the output proves the machine contract (parseable JSON with
  // unexpectedDrift === 0). A hard crash also exits 1 — mapping it to
  // "tolerated" would green-light a drift check that never ran.
  let ok = proc.exitCode === 0;
  let note = `exit ${proc.exitCode}`;
  if (!ok && v.tolerateExit1 && proc.exitCode === 1 && v.driftJsonContract) {
    try {
      // The drift script prints human-readable lines before the machine JSON;
      // parse from the first `{` and read the nested summary — same contract
      // as test.yml's drift step.
      const start = output.indexOf("{");
      const summary = JSON.parse(output.slice(start)).summary;
      if (summary && typeof summary.unexpectedDrift === "number") {
        if (summary.unexpectedDrift === 0) {
          ok = true;
          note = `exit 1 (documented tolerated drift class, JSON contract verified: tolerated ${summary.toleratedDrift}, unexpected 0)`;
        } else {
          note = `exit 1 with unexpectedDrift=${summary.unexpectedDrift} — treated as failure`;
        }
      } else {
        note = `exit 1 without a machine contract summary — treated as failure`;
      }
    } catch {
      note = `exit 1 with unparseable output — treated as failure`;
    }
  }
  const failed = !ok;
  results.push({ name: v.name, ok, note });
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
