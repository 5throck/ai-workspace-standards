#!/usr/bin/env bun
// gen-pr-body.ts - Generate a structured PR body from commit message + diff
// Usage: bun run scripts/gen-pr-body.ts "<commit message>"
// Output: PR body markdown (stdout)
//
// Behaviour:
//   1. If `claude` CLI is available → ask Claude to write the PR body (AI mode)
//   2. Otherwise → build a structured template from commit message + file list (fallback)

import { $ } from 'bun';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

const commitMsg = process.argv.slice(2).join(' ');
if (!commitMsg) {
  process.stderr.write('Usage: bun run scripts/gen-pr-body.ts "<commit message>"\n');
  process.exit(1);
}

const today = new Date().toISOString().split('T')[0];

// ── Collect changed files ──────────────────────────────────────────────────────
async function getFiles(): Promise<string> {
  let result = (await $`git diff --name-only HEAD~1 HEAD`.quiet().nothrow()).stdout.toString().trim();
  if (!result) result = (await $`git diff --cached --name-only`.quiet().nothrow()).stdout.toString().trim();
  if (!result) result = (await $`git show --name-only --format= HEAD`.quiet().nothrow()).stdout.toString().trim();
  return result;
}

async function getDiffStat(): Promise<string> {
  let result = (await $`git diff --stat HEAD~1 HEAD`.quiet().nothrow()).stdout.toString().trim();
  if (!result) result = (await $`git diff --cached --stat`.quiet().nothrow()).stdout.toString().trim();
  return result;
}

const filesRaw = await getFiles();
const diffStat = await getDiffStat();

const fileList = filesRaw
  .split('\n')
  .filter(Boolean)
  .slice(0, 30)
  .map(f => `- ${f}`)
  .join('\n') || '';

// ── AI mode: generate body via Claude CLI ────────────────────────────────────
const hasClaudeRes = await $`claude --version`.quiet().nothrow();
if (hasClaudeRes.exitCode === 0) {
  const prompt = `Generate a GitHub Pull Request body for the following change.
Output ONLY the PR body in markdown - no explanation, no code fences around the whole output.

Commit message : ${commitMsg}
Date           : ${today}

Changed files  :
${filesRaw}

Diff summary   :
${diffStat}

Use EXACTLY this structure (keep all section headers, fill placeholders):

## Why
[1-3 sentences: what problem does this solve and why now?]

## What Changed
[concise bullet list of actual changes - be specific, not generic]

## Test Plan
- [ ] \`bash scripts/audit.sh\` passes
- [ ] [add relevant manual or automated test steps]

## Security Checklist
- [ ] No secrets, credentials, or API keys committed
- [ ] No \`.env\` files staged (use \`.env.sample\` for templates)
- [ ] Dependencies unchanged or reviewed for new CVEs

## Notes
[Breaking changes, deployment steps, or reviewer guidance. Write 'None' if not applicable.]

---
`;

  const tmpFile = path.join(os.tmpdir(), `gen-pr-body-${Date.now()}.txt`);
  try {
    await Bun.write(tmpFile, prompt);
    const claudeRes = await $`claude -p ${prompt}`.quiet().nothrow();
    const body = claudeRes.stdout.toString().trim();
    if (body) {
      process.stdout.write(body + '\n');
      process.exit(0);
    }
  } catch {
    // fall through to fallback
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// ── Fallback mode: structured template with auto-filled fields ────────────────
const fallback = `## Why
${commitMsg}

## What Changed
${fileList}

## Test Plan
- [ ] \`bash scripts/audit.sh\` passes
- [ ] CHANGELOG.md updated under \`[Unreleased]\`

## Security Checklist
- [ ] No secrets, credentials, or API keys committed
- [ ] No \`.env\` files staged (use \`.env.sample\` for templates)
- [ ] Dependencies unchanged or reviewed for new CVEs

## Notes
None

---
`;

process.stdout.write(fallback);
