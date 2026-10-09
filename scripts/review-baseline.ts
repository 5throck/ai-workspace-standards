#!/usr/bin/env bun
// @version 1.2.0
// v1.2.0 (2026-10-09, T-20261009-002): battery #8 — nightly scaffold E2E conclusion
//          surfacing via gh run list; red nightly surfaces as a passed-with-WARN note
//          that prints even under --quiet. Network-dependent, never fails the battery.
// v1.1.0 (earlier): variant-claims battery entry.
/**
 * review-baseline.ts — consolidated read-only runner for the project-review
 * Step 0 baseline battery (T-20260912-030).
 *
 * Runs the seven baseline validators in guaranteed read-only mode and prints a
 * PASS/FAIL summary. Each validator is invoked exactly the way the
 * project-review skill's Step 0 documents them; nothing here mutates the tree.
 *
 *   1. bun scripts/audit.ts                               # workspace standards
 *   2. bun scripts/validate-templates.ts                  # template/variant integrity + L1 parity
 *   3. bun scripts/verify-scripts.ts --verify             # SCRIPTS.md registry sync
 *   4. bun run agent-lifecycle-audit                      # agent health
 *   5. bun run skill-lifecycle-audit                      # skill health
 *   6. bun scripts/propagate-to-templates.ts --check-drift # L1↔L2 drift
 *   7. bun scripts/validate-variant-claims.ts             # variant contract-truth (D6, T-20261005-011..014)
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
  // D6 (2026-10-05 co-deck remediation): contract-truth battery entry —
  // prose claims and semantic bindings the structural validators above do
  // not see (roster/theme/status/process claims, phantom paths, boilerplate
  // drift). Runs against the default template (co-deck); exit 1 = findings.
  { name: "validate-variant-claims.ts (variant contract-truth: roster/theme/status/process claims)", cmd: ["bun", "scripts/validate-variant-claims.ts"] },
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
  if (failed) {
    // Failure diagnostics are NEVER suppressed, not even under --quiet: the
    // 01:30 fleet-review runner runs exactly --quiet (design R10), and an
    // unattended log holding only an exit code is untriageable
    // (T-20260926-013). Quiet silences passing chatter only.
    console.error(`❌ ${v.name} — ${note}`);
    const tail = output.trim().split("\n").slice(-8).join("\n");
    console.error(tail);
  } else if (!quiet) {
    console.log(`✅ ${v.name} — ${note}`);
  }
}

// T-20261009-002 (design 2026-10-09-scaffold-package-merge-and-baseline-surfacing D3):
// battery #8 — surface the nightly scaffold E2E conclusion. The 2026-10-06..08 red
// streak went unnoticed because no local battery looked at CI. Network-dependent:
// gh unavailability must NOT fail the battery; a red nightly is surfaced as a
// passed-with-WARN note that prints even under --quiet (the 01:30 runner runs
// exactly --quiet, design R10).
{
  const name = "nightly E2E conclusion surfacing (nightly-scaffold-e2e.yml)";
  let ok = true;
  let warn = false;
  let note = "skipped (gh unavailable or timed out)";
  const gh = Bun.spawnSync(
    ["gh", "run", "list", "--workflow=nightly-scaffold-e2e.yml", "--limit", "1", "--json", "conclusion,createdAt,url,databaseId"],
    { stdout: "pipe", stderr: "pipe", timeout: 15_000 },
  );
  if (gh.exitCode === 0) {
    try {
      const runs = JSON.parse(new TextDecoder().decode(gh.stdout));
      const r = Array.isArray(runs) ? runs[0] : undefined;
      if (r?.conclusion === "success") {
        note = `nightly green as of ${r.createdAt}`;
      } else if (r?.conclusion === "failure") {
        warn = true;
        note = `WARN: nightly scaffold E2E FAILED — run ${r.databaseId} (${r.createdAt}) ${r.url} — scaffold-contract regression class (T-20261009-002); run bun scripts/test-new-project.ts to reproduce`;
      } else {
        note = `nightly status: ${r?.status ?? "unknown"}, conclusion: ${r?.conclusion ?? "none"}`;
      }
    } catch {
      note = "skipped (unparseable gh output)";
    }
  }
  results.push({ name, ok, note });
  if (warn) console.error(`⚠️  ${name} — ${note}`);
  else if (!quiet) console.log(`✅ ${name} — ${note}`);
}

const failures = results.filter((r) => !r.ok);
if (!quiet || failures.length > 0) {
  console.log(`\n=== Review baseline summary: ${results.length - failures.length}/${results.length} green ===`);
  for (const r of results) console.log(`  ${r.ok ? "✅" : "❌"} ${r.name}`);
}

process.exit(failures.length > 0 ? 1 : 0);
