#!/usr/bin/env bun
// @version 1.1.0
/**
 * pm-role-bootstrap.ts — SessionStart hook for PM role bootstrap.
 * Injects a reminder that the agent must read AGENTS.md and agents/pm.md
 * before the first response of every session.
 *
 * Triggered by SessionStart hook on all four sources: startup, resume, clear, compact.
 * On every confirmed bootstrap it also records the PM-role session marker consumed
 * by hooks/pm-dispatch-gate.ts (identity gate, AGENTS.md §3.1): state dir
 * PM_GATE_STATE_DIR (override) or <os.tmpdir()>/ai-workspace-pm-gateway, sanitized
 * <session_id>.json holding { ts, source }, treated stale after 24h. Best-effort:
 * a marker write failure only warns (fail-open), never blocks bootstrap.
 * Fails open: any error exits 0 with no stdout, after writing a warning to stderr.
 *
 * @version 1.1.0
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = process.env.CLAUDE_PROJECT_DIR || fileURLToPath(new URL('../..', import.meta.url));

// v1.1.0: marker state dir for the PreToolUse pm-dispatch-gate identity chain.
// The default lives in the OS temp dir on purpose — session state, not source.
const STATE_DIR = process.env.PM_GATE_STATE_DIR || join(tmpdir(), 'ai-workspace-pm-gateway');

const BOOTSTRAP_TEXT = `PM bootstrap (workspace rule): You are the PM agent for this session.
Before your first response, Read AGENTS.md and agents/pm.md with the Read tool.
This applies to every request, including short questions and non-code questions.
Read them once per session. Read them again after /clear or context compaction.
Q&A-only answers need no execution plan table. Multi-step work still needs one.`;

interface HookInput {
  hook_event_name?: string;
  source?: string;
  session_id?: string;
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

    // v1.1.0: record the PM-role session marker for pm-dispatch-gate.
    // Sanitized <session_id>.json carrying { ts, source }; the dispatch gate
    // treats a marker older than 24h as absent (re-bootstrap rewrites it).
    const sessionId = typeof data.session_id === 'string' && data.session_id.length > 0 ? data.session_id : '';
    if (sessionId) {
      const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, '_');
      if (safe) {
        mkdirSync(STATE_DIR, { recursive: true });
        writeFileSync(
          join(STATE_DIR, `${safe}.json`),
          JSON.stringify({ ts: Date.now(), source: 'pm-role-bootstrap' }),
          'utf-8',
        );
      }
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
