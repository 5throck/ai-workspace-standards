#!/usr/bin/env bun
/**
 * pre-push.ts — TS-based pre-push hook.
 */

import { $ } from "bun";

async function main() {
  console.log("=== pre-push audit ===");
  try {
    await $`bun scripts/audit.ts`;
  } catch {
    console.error("\n\x1b[31m❌ Audit failed — push blocked. Fix issues above before pushing.\x1b[0m");
    process.exit(1);
  }

  console.log("=== pre-push integration tests ===");
  try {
    console.log("Running integration tests...");
    await $`bun scripts/test-runner.ts integration`;
  } catch {
    console.error("\n\x1b[31m❌ Integration tests failed — push blocked. Fix test failures before pushing.\x1b[0m");
    process.exit(1);
  }

  const branch = await $`git rev-parse --abbrev-ref HEAD`.text();
  if (branch.trim() === "main" || branch.trim() === "master") {
    console.error(`\n\x1b[31m❌ Direct push to '${branch.trim()}' is blocked. Use a PR branch.\x1b[0m`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
