#!/usr/bin/env bun
/**
 * pre-push.ts — TS-based pre-push hook.
 * @version 1.2.2
 */

import { $ } from "bun";

// Read stdin to determine what refs are being pushed.
// Format per line: <local ref> <local sha1> <remote ref> <remote sha1>
// Tag pushes have local ref like "refs/tags/..." — skip branch protection for those.
async function isTagOnlyPush(): Promise<boolean> {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of Bun.stdin.stream()) {
      chunks.push(Buffer.from(chunk));
    }
    const stdin = Buffer.concat(chunks).toString("utf8").trim();
    if (!stdin) return false;
    const lines = stdin.split("\n").filter(Boolean);
    return lines.length > 0 && lines.every(line => line.split(" ")[0]?.startsWith("refs/tags/"));
  } catch {
    return false;
  }
}

async function main() {
  console.log("=== pre-push audit ===");

  // Secret scan (gitleaks) — skip if not installed
  try {
    await $`which gitleaks`;
    try {
      await $`gitleaks detect --source . --no-git --redact`;
      console.log("  ✅ Secret scan passed");
    } catch {
      console.error("\n\x1b[31m❌ Secret scan failed — push blocked. Run 'gitleaks detect' to see detected secrets.\x1b[0m");
      process.exit(1);
    }
  } catch {
    // gitleaks not installed — run minimal regex fallback
    console.warn("  ⚠️  gitleaks not installed — running regex secret scan fallback");
    const { stdout } = await $`git grep -rn -E "sk-ant-api03-[A-Za-z0-9_-]{93}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|sk-proj-[A-Za-z0-9_-]+" -- "*.ts" "*.json"`.nothrow();
    const matches = stdout.toString().trim();
    if (matches) {
      console.error("\n\x1b[31m❌ Potential secrets found — push blocked. Install gitleaks for full coverage.\x1b[0m");
      console.error(matches.split('\n').slice(0, 5).join('\n'));
      process.exit(1);
    }
    console.log("  ✅ Regex secret scan passed (install gitleaks for full coverage)");
  }

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

  // Tag-only pushes bypass the branch protection check — tags are not commits to main.
  if (await isTagOnlyPush()) return;

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
