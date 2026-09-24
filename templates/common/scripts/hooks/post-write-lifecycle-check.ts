#!/usr/bin/env bun
/**
 * post-write-lifecycle-check.ts — Real-time lifecycle WARN on file changes.
 * Triggered by PostToolUse (Write|Edit) in Claude Code CLI, and AfterTool in
 * Gemini CLI. Non-blocking: emits WARNs, never exits with error.
 *
 * Platform coverage:
 *   Claude Code CLI  — automatic via PostToolUse hook (async)
 *   Claude Desktop App — should fire via bundled CLI (fallback: prompt)
 *   Gemini CLI       — automatic via AfterTool hook (--platform gemini)
 *   Antigravity      — hooks do not fire (prompt enforcement)
 *
 * @version 1.2.0
 * v1.2.0 (spec 2026-09-25-verifier-platform-expansion-design site 9, D9):
 * checks 1-4 generalize to all four platforms, mapping-aware (.codex/prompts
 * mapping leg added; .agents/commands excluded per Finding D).
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

function hasVersionField(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return /^version:\s*\d+\.\d+\.\d+/m.test(content);
  } catch {
    return false;
  }
}

/**
 * Run the 5 lifecycle checks against a list of changed files.
 *
 * D9 (spec 2026-09-25-verifier-platform-expansion-design site 9): checks 1-4
 * generalize to all four platforms, mapping-aware — the skills check covers
 * the .agents/.codex mirrors too, and the commands propagation check adds the
 * .codex/prompts mapping (ADR-0077 D4). .agents/commands is excluded — no
 * producer, no documented consumer (design Finding D; recorded exclusion).
 */
function checkFiles(changed: string[]): number {
  let lifecycleIssues = 0;

  // Check 1: .{claude,gemini,agents,codex}/skills/*/SKILL.md — version field + propagation
  const platformSkills = changed.filter(f => /^\.(claude|gemini|agents|codex)\/skills\/[^/]+\/SKILL\.md$/.test(f));
  for (const f of platformSkills) {
    if (existsSync(f) && !hasVersionField(f)) {
      warn(`${f} — missing 'version: X.Y.Z' in frontmatter. Add version: 1.0.0 for new skills.`);
      lifecycleIssues++;
    } else if (existsSync(f)) {
      const commonPath = f.replace(/^\.(claude|gemini|agents|codex)\//, 'templates/common/.$1/');
      if (!existsSync(commonPath)) {
        warn(`${f} — not propagated to ${commonPath}. Run platform-skill-lifecycle-manager skill.`);
        lifecycleIssues++;
      }
    }
  }

  // Check 3: command surfaces — .claude/commands and .gemini/commands (1:1),
  // .codex/prompts (mapping) — check template propagation
  const commandSurfaces: ReadonlyArray<readonly [RegExp, string]> = [
    [/^\.claude\/commands\/[^/]+\.md$/, 'templates/common/.claude/commands/'],
    [/^\.gemini\/commands\/[^/]+\.md$/, 'templates/common/.gemini/commands/'],
    [/^\.codex\/prompts\/[^/]+\.md$/, 'templates/common/.codex/prompts/'],
  ];
  for (const f of changed) {
    for (const [pattern, commonPrefix] of commandSurfaces) {
      if (!pattern.test(f)) continue;
      const fileName = f.replace(/\\/g, '/').split('/').pop();
      const commonPath = `${commonPrefix}${fileName}`;
      if (existsSync(f) && !existsSync(commonPath)) {
        warn(`${f} — not propagated to ${commonPath}. Run platform-command-lifecycle-manager skill.`);
        lifecycleIssues++;
      }
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

  return lifecycleIssues;
}

async function main() {
  // Determine platform from CLI flag
  const args = process.argv.slice(2);
  const platformIdx = args.indexOf('--platform');
  const isGemini = platformIdx !== -1 && args[platformIdx + 1] === 'gemini';

  let changed: string[];

  if (isGemini) {
    // Gemini AfterTool mode: read specific file from stdin JSON
    let stdinJson: string;
    try {
      stdinJson = readFileSync(0, 'utf-8'); // fd 0 = stdin
    } catch {
      // Cannot read stdin — silently exit (non-blocking)
      return;
    }

    let data: { tool_name?: string; tool_input?: Record<string, unknown> };
    try {
      data = JSON.parse(stdinJson) as typeof data;
    } catch {
      // Malformed JSON — silently exit
      return;
    }

    // Extract file path from Gemini AfterTool tool_input
    const toolInput = data.tool_input ?? {};
    const filePath = (toolInput.path as string | undefined)?.replace(/\\/g, '/');

    if (!filePath) return;

    changed = [filePath];
  } else {
    // Claude PostToolUse mode: get all changed files from git diff
    try {
      const { stdout } = await $`git diff --name-only`.quiet().nothrow();
      changed = stdout.toString().split('\n').filter(Boolean).map(f => f.replace(/\\/g, '/'));
    } catch {
      changed = [];
    }
  }

  if (changed.length === 0) {
    // No changed files — run audit.ts as normal and exit
    if (!isGemini) {
      await $`bun scripts/audit.ts`.nothrow();
    }
    return;
  }

  const lifecycleIssues = checkFiles(changed);

  if (lifecycleIssues === 0) {
    pass('Lifecycle check passed — no issues detected in changed files.');
  } else {
    console.log(`\n${YELLOW}${lifecycleIssues} lifecycle issue(s) detected. Fix before running /sync.${RESET}`);
  }

  // Always run audit.ts as well (Claude mode only — Gemini has no async audit hook)
  if (!isGemini) {
    await $`bun scripts/audit.ts`.nothrow();
  }
}

main().catch(err => {
  console.error('Lifecycle check error:', err);
  if (import.meta.main) {
    process.exit(0); // Non-blocking: never fail PostToolUse/AfterTool
  }
});
