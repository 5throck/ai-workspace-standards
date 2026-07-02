#!/usr/bin/env bun
/**
 * gen-pr-body.ts - Generate a structured PR body from commit message + diff
 * Usage: bun run scripts/gen-pr-body.ts "<commit message>"
 * Output: PR body markdown (stdout)
 * @version 1.1.3
 *
 * Behaviour:
 *   1. If `claude` CLI is available → ask Claude to write the PR body (AI mode)
 *   2. Otherwise → build a structured template from commit message + file list (fallback)
 */

import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { withRetry, DEFAULT_CONFIG } from './retry-handler.ts';

const commitMsg = process.argv.slice(2).join(' ');
if (!commitMsg) {
  process.stderr.write('Usage: bun run scripts/gen-pr-body.ts "<commit message>"\n');
  process.exit(1);
}

// ── Language validation ───────────────────────────────────────────────────────
// PR titles, bodies, and commit messages must be in English — see CONSTITUTION.md §3
// (workspace root) or docs/context.md §3 (variant projects, which omit CONSTITUTION.md).
// Code blocks (``` ... ```) are stripped before checking — data samples may contain non-English values.
const KOREAN_RANGE = /[가-힯ᄀ-ᇿ㄰-㆏]/;
const LANGUAGE_POLICY_REF = existsSync('CONSTITUTION.md') ? 'CONSTITUTION.md §3' : 'docs/context.md §3';

function stripCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
}

function validateLanguage(text: string, label = 'PR body'): void {
  if (KOREAN_RANGE.test(stripCodeBlocks(text))) {
    process.stderr.write(
      `\x1b[31m[FAIL]\x1b[0m Non-English characters (Korean) detected in ${label}.\n` +
      `       ${LANGUAGE_POLICY_REF} mandates all PR titles and bodies must be written in English.\n` +
      `       Translate the content to English before generating the PR.\n`
    );
    process.exit(1);
  }
}

// Validate commit message used as PR title/summary
validateLanguage(commitMsg, 'commit message / PR title');

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

// ── Prompt injection sanitizer ────────────────────────────────────────────────
// Strips content that could hijack the Claude prompt when git output is embedded.
function sanitizeForPrompt(text: string): string {
  return text
    .split('\n')
    .filter(line => {
      const trimmed = line.trimStart();
      // Drop lines that look like injected prompt roles
      if (/^(Human|Assistant|System)\s*:/i.test(trimmed)) return false;
      // Drop instruction-injection patterns (e.g., "ignore previous instructions")
      if (/ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|context|prompts?)/i.test(trimmed)) return false;
      // Drop XML-style role tags that Claude XML-tag parsers may interpret
      if (/^<\s*(system|human|assistant|instruction)\s*[\/>]/i.test(trimmed)) return false;
      return true;
    })
    .map(line =>
      line
        // Escape backtick sequences (break out of code-fence attacks)
        .replace(/`/g, '⁠`')
        // Escape closing XML-style tags that could confuse tag boundaries
        .replace(/<\//g, '&lt;/')
    )
    .join('\n');
}

// ── AI mode: generate body via Claude CLI ────────────────────────────────────
const hasClaudeRes = await $`claude --version`.quiet().nothrow();
if (hasClaudeRes.exitCode === 0) {
  const safeFiles = sanitizeForPrompt(filesRaw);
  const safeDiffStat = sanitizeForPrompt(diffStat);
  const safeCommitMsg = sanitizeForPrompt(commitMsg);

  const prompt = `Generate a GitHub Pull Request body for the following change.
Output ONLY the PR body in markdown - no explanation, no code fences around the whole output.

Commit message : ${safeCommitMsg}
Date           : ${today}

<file-list>
${safeFiles}
</file-list>

<diff-summary>
${safeDiffStat}
</diff-summary>

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

  try {
    const claudeRetry = await withRetry(
      () => $`claude -p ${prompt}`.quiet().nothrow(),
      { ...DEFAULT_CONFIG, maxRetries: 2, initialDelay: 1000, isSuccess: (r: any) => r.exitCode === 0 },
      'claude pr-body'
    );
    const claudeRes = claudeRetry.result;
    const body = claudeRes?.stdout.toString().trim() ?? '';
    if (body) {
      validateLanguage(body, 'AI-generated PR body');
      process.stdout.write(body + '\n');
      process.exit(0);
    }
  } catch {
    // fall through to fallback
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

validateLanguage(fallback, 'fallback PR body');
process.stdout.write(fallback);
