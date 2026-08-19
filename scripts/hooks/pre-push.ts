#!/usr/bin/env bun
/**
 * pre-push.ts — TS-based pre-push hook.
 * @version 1.2.9
 */

import { $ } from "bun";

const ZERO_OID = "0000000000000000000000000000000000000000";

interface PushRefUpdate {
  localRef: string;
  localOid: string;
  remoteRef: string;
  remoteOid: string;
}

// Read stdin ONCE to determine what refs are actually being pushed.
// Format per line: <local ref> SP <local oid> SP <remote ref> SP <remote oid> LF
// A deletion (e.g. `git push origin --delete <branch>`) has localOid all-zero.
async function readPushRefUpdates(): Promise<PushRefUpdate[]> {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of Bun.stdin.stream()) {
      chunks.push(Buffer.from(chunk));
    }
    const stdin = Buffer.concat(chunks).toString("utf8").trim();
    if (!stdin) return [];
    return stdin.split("\n").filter(Boolean).map(line => {
      const [localRef, localOid, remoteRef, remoteOid] = line.split(" ");
      return { localRef, localOid, remoteRef, remoteOid };
    });
  } catch {
    return [];
  }
}

async function main() {
  console.log("=== pre-push audit ===");

  // Parsed once, up front — reused by both the tag-only check and branch
  // protection below, since stdin can only be consumed once.
  const refUpdates = await readPushRefUpdates();

  // Secret scan (gitleaks) — skip if not installed
  // Scoped to only the commits being pushed, not the entire working tree.
  try {
    await $`which gitleaks`;
    try {
      const pushedUpdates = refUpdates.filter(r => r.localOid !== ZERO_OID);
      if (pushedUpdates.length > 0) {
        // Use gitleaks in git-aware mode with --log-opts to restrict scanning
        // to only the commit ranges being pushed. Collect unique commit SHAs
        // across all pushed ref updates via git rev-list.
        const revListArgs: string[] = [];
        for (const ref of pushedUpdates) {
          if (ref.remoteOid !== ZERO_OID) {
            // Existing remote ref — diff the range
            revListArgs.push(`${ref.remoteOid}..${ref.localOid}`);
          } else {
            // New branch with no remote counterpart — diff against
            // all known remote refs to avoid scanning full history.
            const remoteRefs = (await $`git for-each-ref --format='%(objectname)' refs/remotes/`.text()).trim();
            if (remoteRefs) {
              // Each remote SHA must be its own `^sha` exclusion token — joining
              // them into a single string (e.g. "sha1 sha2..localOid") produces
              // an invalid git-rev-list argument once more than one remote ref
              // exists (always true: `origin/HEAD` sits alongside `origin/main`).
              const uniqueRemoteShas = [...new Set(remoteRefs.split('\n').filter(Boolean))];
              for (const sha of uniqueRemoteShas) revListArgs.push(`^${sha}`);
              revListArgs.push(ref.localOid);
            } else {
              // No remote refs at all (fresh clone with no upstream) — fall back
              // to scanning untracked working tree changes only
              revListArgs.push(`HEAD`);
            }
          }
        }
        // Deduplicate and run gitleaks against the commit list
        const commitShas = (await $`git rev-list ${revListArgs}`.text()).trim();
        if (commitShas) {
          const uniqueShas = [...new Set(commitShas.split('\n'))].join(' ');
          await $`gitleaks detect --redact --log-opts -- ${uniqueShas}`;
        }
      }
      // Tag-only or deletion pushes: nothing to scan, pass through
      console.log("  ✅ Secret scan passed");
    } catch {
      console.error("\n\x1b[31m❌ Secret scan failed — push blocked. Run 'gitleaks detect' to see detected secrets.\x1b[0m");
      process.exit(1);
    }
  } catch {
    // gitleaks not installed — run minimal regex fallback
    console.warn("  ⚠️  gitleaks not installed — running regex secret scan fallback");
    const { stdout } = await $`git grep -rn -E "sk-ant-api03-[A-Za-z0-9_-]{93}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|sk-proj-[A-Za-z0-9_-]+" -- "*.ts" "*.js" "*.mjs" "*.py" "*.sh" "*.json" "*.md" "*.env" "*.env.*" "*.yml" "*.yaml" "*.toml" "*.cfg" "*.ini" "*.html"`.nothrow();
    const matches = stdout.toString().trim();
    if (matches) {
      console.error("\n\x1b[31m❌ Potential secrets found — push blocked. Install gitleaks for full coverage.\x1b[0m");
      console.error(matches.split('\n').slice(0, 5).join('\n'));
      process.exit(1);
    }
    console.log("  ✅ Regex secret scan passed (install gitleaks for full coverage)");
  }

  // When running via /sync (SYNC_ACTIVE=1), dev-sync.ts already ran full audit before commit — skip here to avoid duplicate execution.
  const auditAlreadyRan = process.env.SYNC_ACTIVE === "1";
  if (!auditAlreadyRan) {
    try {
      await $`bun scripts/audit.ts`;
    } catch {
      console.error("\n\x1b[31m❌ Audit failed — push blocked. Fix issues above before pushing.\x1b[0m");
      process.exit(1);
    }
  } else {
    console.log("  [audit skipped — already ran in dev-sync pipeline]");
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
  const isTagOnlyPush = refUpdates.length > 0 && refUpdates.every(r => r.localRef?.startsWith("refs/tags/"));
  if (isTagOnlyPush) return;

  // Branch protection is keyed off the *remote* ref actually being updated, not the
  // currently checked-out local branch. The old check used `git rev-parse --abbrev-ref
  // HEAD`, which falsely blocked any push (e.g. deleting an unrelated remote branch,
  // or `git push origin HEAD:some-other-branch`) whenever `main` happened to be checked
  // out locally, while it would have missed `git push origin HEAD:main` run from a
  // different local branch. Deletions (localOid all-zero) push no commits and are exempt.
  if (refUpdates.length > 0) {
    const blockedUpdate = refUpdates.find(r =>
      r.localOid !== ZERO_OID &&
      (r.remoteRef === "refs/heads/main" || r.remoteRef === "refs/heads/master")
    );
    if (blockedUpdate) {
      const branchName = blockedUpdate.remoteRef.replace(/^refs\/heads\//, '');
      console.error(`\n\x1b[31m❌ Direct push to '${branchName}' is blocked. Use a PR branch.\x1b[0m`);
      process.exit(1);
    }
    return;
  }

  // Fallback for the rare case stdin carried no ref updates (e.g. hook invoked
  // manually outside of a real `git push`) — preserves the previous, cruder check.
  const branch = await $`git rev-parse --abbrev-ref HEAD`.text();
  if (branch.trim() === "main" || branch.trim() === "master") {
    console.error(`\n\x1b[31m❌ Direct push to '${branch.trim()}' is blocked. Use a PR branch.\x1b[0m`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  if (import.meta.main) {
    process.exit(1);
  }
});
