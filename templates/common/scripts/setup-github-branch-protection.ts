#!/usr/bin/env bun
/**
 * setup-github-branch-protection.ts
 *
 * Idempotently applies the GitHub repo/branch safety settings this workspace
 * expects on its default branch: auto-delete merged branches, native auto-merge
 * enabled, and (optionally) required status checks — so `gh pr merge --auto`
 * genuinely waits for CI instead of merging immediately (see
 * docs/governance/branch-strategy.md).
 *
 * Usage:
 *   bun scripts/setup-github-branch-protection.ts [--repo owner/name] [--branch main] [--check "job name"]... [--dry-run]
 *
 * --repo   defaults to the `origin` remote of the current repo.
 * --branch defaults to "main".
 * --check  repeatable — pass one per required check, e.g.:
 *            --check "test (ubuntu-latest, 18.x)" --check "test (macos-latest, 18.x)"
 *          A single comma-joined value is deliberately NOT supported: CI job names
 *          from a build matrix (e.g. "test (ubuntu-latest, 18.x)") already contain
 *          commas, which silently mangles a naive split(',') into garbage context
 *          strings that GitHub's API then rejects (HTTP 422) — verified by hand
 *          while building this script.
 *
 *          At least one --check is REQUIRED to configure branch protection —
 *          there is no safe default: every repo's CI workflow has its own job
 *          names (this repo's `.github/workflows/test.yml` produces
 *          "test (ubuntu-latest, 18.x)" etc., while templates/common's
 *          `.github/workflows/ci.yml` produces "audit", "secret-scan", etc.).
 *          A guessed or hardcoded name that never matches becomes a required
 *          check that can NEVER be satisfied, permanently blocking every merge —
 *          so this script refuses to touch branch protection unless the caller
 *          supplies the real check names (visible on the "Checks" tab of any
 *          open PR in the target repo).
 *
 * Without --check, only the repo-level settings (delete-on-merge, auto-merge)
 * are applied.
 *
 * @version 1.0.1
 */

import { $ } from 'bun';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
};
const getRepeatedArg = (name: string): string[] => {
  const flag = `--${name}`;
  const values: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && args[i + 1] !== undefined) values.push(args[i + 1]);
  }
  return values;
};
const isDryRun = args.includes('--dry-run');

async function inferRepo(): Promise<string> {
  const explicit = getArg('repo');
  if (explicit) return explicit;
  const res = await $`git remote get-url origin`.quiet().nothrow();
  const url = res.stdout.toString().trim();
  const m = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!m) {
    console.error(`${RED}❌ Could not infer owner/repo from 'git remote get-url origin' (${url || 'no origin remote'}). Pass --repo owner/name.${RESET}`);
    if (import.meta.main) process.exit(1);
    return '';
  }
  return m[1];
}

async function main() {
  const repo = await inferRepo();
  if (!repo) return;
  const branch = getArg('branch') || 'main';
  const checks = getRepeatedArg('check');

  console.log(`${CYAN}Repo: ${repo}  Branch: ${branch}${isDryRun ? '  (dry-run)' : ''}${RESET}`);

  if (isDryRun) {
    console.log(`${YELLOW}Would set: delete_branch_on_merge=true, allow_auto_merge=true${RESET}`);
    if (checks.length > 0) {
      console.log(`${YELLOW}Would require status checks on '${branch}': ${checks.join(', ')}${RESET}`);
    } else {
      console.log(`${YELLOW}No --check given — branch protection would NOT be touched (repo settings only).${RESET}`);
    }
    return;
  }

  // 1. Repo-level settings — idempotent PATCH, safe to re-run.
  const patchRes = await $`gh api -X PATCH repos/${repo} -f delete_branch_on_merge=true -F allow_auto_merge=true`.quiet().nothrow();
  if (patchRes.exitCode !== 0) {
    console.error(`${RED}❌ Failed to update repo settings: ${patchRes.stderr.toString().trim()}${RESET}`);
    if (import.meta.main) process.exit(1);
    return;
  }
  console.log(`${GREEN}✓ delete_branch_on_merge=true, allow_auto_merge=true${RESET}`);

  // 2. Branch protection — only touched when explicit check names are supplied.
  if (checks.length === 0) {
    console.log(`${YELLOW}⚠️  No --check provided — skipping branch protection (repo settings above still applied).${RESET}`);
    console.log(`${YELLOW}   Re-run with --check "job name" (repeatable) using this repo's actual CI check names.${RESET}`);
    return;
  }

  const payload = {
    required_status_checks: { strict: false, checks: checks.map(context => ({ context })) },
    enforce_admins: false,
    required_pull_request_reviews: null,
    restrictions: null,
  };
  const tmpPath = join(tmpdir(), `branch-protection-${crypto.randomUUID()}.json`);
  writeFileSync(tmpPath, JSON.stringify(payload));
  try {
    const protectRes = await $`gh api -X PUT repos/${repo}/branches/${branch}/protection --input ${tmpPath}`.quiet().nothrow();
    if (protectRes.exitCode !== 0) {
      console.error(`${RED}❌ Failed to set branch protection: ${protectRes.stderr.toString().trim()}${RESET}`);
      if (import.meta.main) process.exit(1);
      return;
    }
  } finally {
    try { unlinkSync(tmpPath); } catch { /* best-effort cleanup */ }
  }
  console.log(`${GREEN}✓ Branch protection on '${branch}' requires: ${checks.join(', ')}${RESET}`);
}

main().catch(err => {
  console.error(`${RED}❌ ${err}${RESET}`);
  if (import.meta.main) process.exit(1);
});
