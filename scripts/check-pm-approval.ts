#!/usr/bin/env bun
/**
 * check-pm-approval.ts — PM Gateway Hook
 * @version 1.0.1
 * @status deprecated
 *
 * PreToolUse hook for Claude Code and Antigravity/Gemini CLI.
 * Blocks Write/Edit/Bash tool calls unless .pm-approved flag file exists.
 *
 * Read-only Bash commands are always allowed (audit, validate, git log, etc.)
 *
 * Usage (configured in settings.json):
 *   "command": "bun scripts/check-pm-approval.ts"
 *
 * Exit codes:
 *   0 = allow
 *   1 = block (also writes JSON reason to stdout)
 *
 * DEPRECATED: Physical PreToolUse hooks do not fire in Claude Code Desktop App
 * or Antigravity sessions. PM Gateway enforcement now uses Double-Lock Strategy:
 * - Markdown boilerplate in CLAUDE.md and GEMINI.md
 * - Agent Constraints in agents/pm.md
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const APPROVE_FLAG = '.pm-approved';

// Read stdin payload (JSON from Claude Code / Gemini CLI)
let payload: { tool_name?: string; tool_input?: { command?: string } } = {};
try {
  const raw = readFileSync(0, 'utf-8').trim(); // fd 0 = stdin, cross-platform (no /dev/stdin on Windows)
  if (raw) payload = JSON.parse(raw);
} catch {
  // stdin unavailable or not JSON — allow by default
  process.exit(0);
}

const toolName = payload.tool_name ?? '';
const toolInput = payload.tool_input ?? {};

// Read-only Bash commands — always allow without PM approval
const READ_ONLY_PATTERN =
  /^(cat|ls|find|echo|pwd|which|type|head|tail|wc)\b|^git\s+(log|status|diff|show|branch|remote|rev-parse|tag)\b|^bun\s+(scripts\/(audit|validate|verify|list|report))|^gh\s+(pr\s+view|issue\s+view|repo\s+view)\b|^(touch|rm)\s+\.pm-approved\b/;

// Shell chaining operators that could smuggle destructive commands past the read-only check
const CHAIN_OPERATORS = /&&|\|\||;|\||\`|\$\(/;

if (toolName === 'Bash' || toolName === 'bash') {
  const cmd = (toolInput.command ?? '').trim();
  if (READ_ONLY_PATTERN.test(cmd) && !CHAIN_OPERATORS.test(cmd)) {
    process.exit(0);
  }
}

// Check PM approval flag
if (existsSync(join(process.cwd(), APPROVE_FLAG))) {
  process.exit(0);
}

// Block — PM approval required
const response = {
  decision: 'block',
  reason:
    'PM approval required before modifying files.\n' +
    '1. Display execution plan table (| # | Task | Agent | Tier | Model |)\n' +
    '2. Create .pm-approved file to grant access\n' +
    '3. Delete .pm-approved when work is complete\n\n' +
    'To approve: touch .pm-approved',
};

process.stdout.write(JSON.stringify(response) + '\n');
process.exit(1);
