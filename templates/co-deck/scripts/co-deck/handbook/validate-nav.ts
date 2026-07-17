#!/usr/bin/env bun
// scripts/co-deck/handbook/validate-nav.ts
// Navigation integrity validator — runs all 4 checks and exits with code 1 on failure.
// Adapted from Handbooks/multi-agent-harness-handbook/scripts/validate-nav.ts

import { checkBrokenLinks } from "./check-links.ts";
import { checkSymmetry } from "./check-symmetry.ts";
import { checkLabels } from "./check-labels.ts";
import { checkSearchIndex } from "./check-search.ts";

const CHECKS: { name: string; run: () => { errors: object[] } }[] = [
  { name: "① Broken links", run: () => ({ errors: checkBrokenLinks() }) },
  { name: "② prev/next symmetry", run: () => ({ errors: checkSymmetry() }) },
  { name: "③ Label ↔ target match", run: () => ({ errors: checkLabels() }) },
  { name: "④ site-search DOCS sync", run: () => ({ errors: checkSearchIndex() }) },
];

let totalErrors = 0;

for (const check of CHECKS) {
  console.log(`\n--- ${check.name} ---`);
  const { errors } = check.run();

  if (errors.length === 0) {
    console.log("✅ PASS — no issues found");
  } else {
    console.log(`❌ FAIL — ${errors.length} issue(s):`);
    for (const err of errors) {
      const e = err as Record<string, string>;
      console.log(`  • ${e.file || e.path || ""} ${e.href || ""}: ${e.detail || e.type || JSON.stringify(err)}`);
    }
    totalErrors += errors.length;
  }
}

console.log(`\n${totalErrors === 0 ? "✅ All checks passed!" : `❌ ${totalErrors} issue(s) found`}`);
process.exit(totalErrors > 0 ? 1 : 0);
