#!/usr/bin/env bun
/**
 * gen-pr-body.ts - Generate a structured PR body from commit message + diff
 * Usage: bun run scripts/gen-pr-body.ts "<commit message>"
 * Output: PR body markdown (stdout)
 * @version 1.2.0
 *
 * Behaviour:
 *   Builds a structured template PR body from the commit message + file list.
 *
 *   NOTE (1.2.0): AI-mode generation via the `claude -p` CLI was removed. The
 *   agent invoking /sync writes the PR body itself (see skills/sync/SKILL.md)
 *   and passes it to dev-sync.ts via --body-file; this script remains the
 *   template fallback and language-validation point for the pipeline.
 */

import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { hasNonEnglish } from './lib/language-guard.ts';

const commitMsg = process.argv.slice(2).join(' ');
if (!commitMsg) {
  process.stderr.write('Usage: bun run scripts/gen-pr-body.ts "<commit message>"\n');
  if (import.meta.main) {
    process.exit(1);
  }
}

// ── Language validation ───────────────────────────────────────────────────────
// PR titles, bodies, and commit messages must be in English — see context.md §3
// (workspace root) or docs/context.md §3 (variant projects, which omit context.md).
// Detection (Korean/Japanese/Chinese) lives in scripts/lib/language-guard.ts, shared
// with dev-sync.ts and pre-commit.ts so the three enforcement points can't drift.
const LANGUAGE_POLICY_REF = existsSync('CONSTITUTION.md') ? 'CONSTITUTION.md §3' : 'docs/context.md §3';

function validateLanguage(text: string, label = 'PR body'): void {
  if (hasNonEnglish(text)) {
    process.stderr.write(
      `\x1b[31m[FAIL]\x1b[0m Non-English characters detected in ${label}.\n` +
      `       ${LANGUAGE_POLICY_REF} mandates all PR titles and bodies must be written in English.\n` +
      `       Translate the content to English before generating the PR.\n`
    );
    process.exit(1);
  }
}

// Validate commit message used as PR title/summary
validateLanguage(commitMsg, 'commit message / PR title');

// ── Collect changed files ──────────────────────────────────────────────────────
async function getFiles(): Promise<string> {
  let result = (await $`git diff --name-only HEAD~1 HEAD`.quiet().nothrow()).stdout.toString().trim();
  if (!result) result = (await $`git diff --cached --name-only`.quiet().nothrow()).stdout.toString().trim();
  if (!result) result = (await $`git show --name-only --format= HEAD`.quiet().nothrow()).stdout.toString().trim();
  return result;
}

const filesRaw = await getFiles();

const fileList = filesRaw
  .split('\n')
  .filter(Boolean)
  .slice(0, 30)
  .map(f => `- ${f}`)
  .join('\n') || '';

// ── Fallback mode: structured template with auto-filled fields ────────────────
const fallback = `## Why
${commitMsg}

## What Changed
${fileList}

## Test Plan
- [ ] \`bun scripts/audit.ts\` passes
- [ ] CHANGELOG.md updated under \`[Unreleased]\`

## Security Checklist
- [ ] No secrets, credentials, or API keys committed
- [ ] No \`.env\` files staged (use \`.env.sample\` for templates)
- [ ] Dependencies unchanged or reviewed for new CVEs

## Notes
None

---
`;

validateLanguage(fallback, 'fallback PR body');
process.stdout.write(fallback);
