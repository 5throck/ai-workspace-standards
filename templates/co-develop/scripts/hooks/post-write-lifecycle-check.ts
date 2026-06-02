#!/usr/bin/env bun
/**
 * post-write-lifecycle-check.ts — Real-time lifecycle WARN on file changes.
 * Triggered by PostToolUse (Write|Edit) in Claude Code CLI only.
 * Non-blocking: emits WARNs, never exits with error.
 *
 * Platform coverage:
 *   Claude Code CLI  — automatic via PostToolUse hook
 *   Claude Code App  — not triggered (run bun scripts/audit.ts manually)
 *   Gemini CLI       — not triggered (run bun scripts/audit.ts manually)
 *   Antigravity      — not triggered (run bun scripts/audit.ts manually)
 *
 * @version 1.0.0
 */

import { $ } from 'bun';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const RESET  = '\x1b[0m';
const DIM    = '\x1b[2m';

function warn(msg: string) {
  console.log(`${YELLOW}[LIFECYCLE-WARN]${RESET} ${msg}`);
}

function pass(msg: string) {
  console.log(`${GREEN}[LIFECYCLE-OK]${RESET}  ${DIM}${msg}${RESET}`);
}

async function getChangedFiles(): Promise<string[]> {
  try {
    const { stdout } = await $`git diff --name-only`.quiet().nothrow();
    return stdout.toString().split('\n').filter(Boolean).map(f => f.replace(/\\/g, '/'));
  } catch {
    return [];
  }
}

function hasVersionField(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return /^version:\s*\d+\.\d+\.\d+/m.test(content);
  } catch {
    return false;
  }
}

async function main() {
  const changed = await getChangedFiles();
  if (changed.length === 0) {
    // Also run audit.ts as normal
    await $`bun scripts/audit.ts`.nothrow();
    return;
  }

  let lifecycleIssues = 0;

  // Check 1: .claude/skills/*/SKILL.md — must have version: field
  const claudeSkills = changed.filter(f => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(f));
  for (const f of claudeSkills) {
    if (existsSync(f) && !hasVersionField(f)) {
      warn(`${f} — missing 'version: X.Y.Z' in frontmatter. Add version: 1.0.0 for new skills.`);
      lifecycleIssues++;
    } else if (existsSync(f)) {
      // Check propagation to templates/common
      const commonPath = f.replace(/^\.claude\//, 'templates/common/.claude/');
      if (!existsSync(commonPath)) {
        warn(`${f} — not propagated to ${commonPath}. Run platform-skill-lifecycle-manager skill.`);
        lifecycleIssues++;
      }
    }
  }

  // Check 2: .gemini/skills/*/SKILL.md — must have version: field
  const geminiSkills = changed.filter(f => /^\.gemini\/skills\/[^/]+\/SKILL\.md$/.test(f));
  for (const f of geminiSkills) {
    if (existsSync(f) && !hasVersionField(f)) {
      warn(`${f} — missing 'version: X.Y.Z' in frontmatter.`);
      lifecycleIssues++;
    } else if (existsSync(f)) {
      const commonPath = f.replace(/^\.gemini\//, 'templates/common/.gemini/');
      if (!existsSync(commonPath)) {
        warn(`${f} — not propagated to ${commonPath}. Run platform-skill-lifecycle-manager skill.`);
        lifecycleIssues++;
      }
    }
  }

  // Check 3: .claude/commands/*.md — check template propagation
  const claudeCommands = changed.filter(f => /^\.claude\/commands\/[^/]+\.md$/.test(f));
  for (const f of claudeCommands) {
    const commonPath = f.replace(/^\.claude\//, 'templates/common/.claude/');
    if (existsSync(f) && !existsSync(commonPath)) {
      warn(`${f} — not propagated to ${commonPath}. Run platform-command-lifecycle-manager skill.`);
      lifecycleIssues++;
    }
  }

  // Check 4: .gemini/commands/*.md — check template propagation
  const geminiCommands = changed.filter(f => /^\.gemini\/commands\/[^/]+\.md$/.test(f));
  for (const f of geminiCommands) {
    const commonPath = f.replace(/^\.gemini\//, 'templates/common/.gemini/');
    if (existsSync(f) && !existsSync(commonPath)) {
      warn(`${f} — not propagated to ${commonPath}. Run platform-command-lifecycle-manager skill.`);
      lifecycleIssues++;
    }
  }

  // Check 5: agents/*.md — check last_updated freshness
  const agents = changed.filter(f => /^agents\/[^/]+\.md$/.test(f));
  const today = new Date().toISOString().slice(0, 10);
  for (const f of agents) {
    if (!existsSync(f)) continue;
    const content = readFileSync(f, 'utf-8');
    const match = content.match(/last_updated:\s*(\d{4}-\d{2}-\d{2})/);
    if (!match) {
      warn(`${f} — missing 'last_updated:' in frontmatter.`);
      lifecycleIssues++;
    } else if (match[1] !== today) {
      warn(`${f} — last_updated is ${match[1]}, expected ${today}. Update before committing.`);
      lifecycleIssues++;
    }
  }

  if (lifecycleIssues === 0) {
    pass('Lifecycle check passed — no issues detected in changed files.');
  } else {
    console.log(`\n${YELLOW}${lifecycleIssues} lifecycle issue(s) detected. Fix before running /sync.${RESET}`);
  }

  // Always run audit.ts as well
  await $`bun scripts/audit.ts`.nothrow();
}

main().catch(err => {
  console.error('Lifecycle check error:', err);
  process.exit(0); // Non-blocking: never fail PostToolUse
});
