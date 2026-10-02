#!/usr/bin/env bun
// @version 1.0.1
/**
 * pm-role-bootstrap.ts — SessionStart hook for PM role bootstrap.
 * Injects a reminder that the agent must read AGENTS.md and agents/pm.md
 * before the first response of every session.
 *
 * Triggered by SessionStart hook on all four sources: startup, resume, clear, compact.
 * Fails open: any error exits 0 with no stdout, after writing a warning to stderr.
 *
 * @version 1.0.1
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = process.env.CLAUDE_PROJECT_DIR || fileURLToPath(new URL('../..', import.meta.url));

const BOOTSTRAP_TEXT = `PM bootstrap (workspace rule): You are the PM agent for this session.
Before your first response, Read AGENTS.md and agents/pm.md with the Read tool.
This applies to every request, including short questions and non-code questions.
Read them once per session. Read them again after /clear or context compaction.
Q&A-only answers need no execution plan table. Multi-step work still needs one.`;

interface HookInput {
  hook_event_name?: string;
  source?: string;
}

interface HookOutput {
  hookSpecificOutput: {
    hookEventName: string;
    additionalContext: string;
  };
}

function main(): void {
  try {
    // Read stdin
    let stdinJson: string;
    try {
      stdinJson = readFileSync(0, 'utf-8');
    } catch {
      // No stdin or read error — fail-open
      process.exit(0);
      return;
    }

    // Parse stdin
    let data: HookInput;
    try {
      data = JSON.parse(stdinJson) as HookInput;
    } catch {
      // Malformed JSON — fail-open
      process.exit(0);
      return;
    }

    // Check event name
    if (data.hook_event_name !== 'SessionStart') {
      process.exit(0);
      return;
    }

    // Check that AGENTS.md and agents/pm.md exist
    const agentsPath = join(WORKSPACE_ROOT, 'AGENTS.md');
    const pmAgentPath = join(WORKSPACE_ROOT, 'agents', 'pm.md');

    if (!existsSync(agentsPath) || !existsSync(pmAgentPath)) {
      // Files missing — skip injection
      process.exit(0);
      return;
    }

    // Build output
    const output: HookOutput = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: BOOTSTRAP_TEXT,
      },
    };

    process.stdout.write(JSON.stringify(output) + '\n');
    process.exit(0);
  } catch (err) {
    // Any unexpected error — fail-open with warning
    console.error(`[PM-BOOTSTRAP] WARN: ${(err as Error).message}`);
    process.exit(0);
  }
}

main();
