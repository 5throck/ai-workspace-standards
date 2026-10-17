#!/usr/bin/env bun
// @version 1.0.0
/**
 * pm-dispatch-gate.ts — PreToolUse (Claude, tool `Agent`) / BeforeTool (Gemini,
 * tool `invoke_subagent`) identity gate enforcing the PM Gateway
 * single-point-of-entry rule (AGENTS.md §3.1).
 *
 * A session that HAS booted into the PM role (pm-role-bootstrap marker, fresh
 * within MARKER_TTL_MS) may dispatch rostered specialists directly. Any other
 * session attempting a rostered specialist dispatch is answered with a
 * platform-appropriate decision:
 *   - Claude Code CLI (tool `Agent`, PreToolUse): `{"decision":"ask", ...}` —
 *     the user is shown the reason and confirms or denies.
 *   - Gemini CLI (tool `invoke_subagent`, BeforeTool): `{"decision":"deny",
 *     "reason": ...}` — Gemini BeforeTool has no ask concept; deny returns the
 *     reason to the calling agent so it can route via PM.
 *
 * The specialist roster is read live from `agents/*.md` (minus `pm.md`) so it
 * follows roster evolution at runtime; `disable-work-routes`-style frontmatter
 * abstractions are deliberately NOT consulted (KISS).
 *
 * Identity-critical marker/state handling mirrors pm-role-bootstrap v1.1.0:
 * state dir is `PM_GATE_STATE_DIR` (override for tests) or
 * `<os.tmpdir()>/ai-workspace-pm-gateway`, expected outside the repo on
 * purpose (session state, not source).
 *
 * This gate is FAIL-OPEN by design: unexpected payloads or state-dir read
 * errors exit 0 silently and never block a dispatch. Hard enforcement is the
 * intent, but a broken harness must not brick the workspace.
 *
 * Layer scope: L0 (workspace root). Project-level (L2/L3) wiring is a
 * deliberate follow-up — see docs/designs/2026-10-17-pm-dispatch-gate-design.md.
 *
 * Spec: docs/designs/2026-10-17-pm-dispatch-gate-design.md
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT =
  process.env.CLAUDE_PROJECT_DIR ?? fileURLToPath(new URL('../..', import.meta.url));

const STATE_DIR =
  process.env.PM_GATE_STATE_DIR ?? join(tmpdir(), 'ai-workspace-pm-gateway');

const MARKER_TTL_MS = 24 * 60 * 60 * 1000;

const SPECIALIST_DISPATCH_TOOLS = new Set(['Agent', 'invoke_subagent']);

/** Payloads that dispatch rostered specialists carry the specialist name in
 * one of these tool_input keys; unknown schemas (desktop apps) fail closed to
 * exit 0 (no block) because this gate never invents an identity. */
const SPECIALIST_INPUT_KEYS = ['subagent_type', 'subagent_name', 'name'] as const;

interface MarkerPayload {
  ts?: unknown;
}

interface HookPayload {
  tool_name?: unknown;
  tool_input?: unknown;
  session_id?: unknown;
}

export interface GateDecision {
  decision: 'ask' | 'deny';
  reason: string;
}

/** Live-dispatch roster: agents/*.md minus pm.md, sorted for determinism. */
function loadSpecialistRoster(): string[] {
  const dir = join(WORKSPACE_ROOT, 'agents');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'pm.md')
    .map((name) => name.replace(/\.md$/, ''))
    .sort();
}

/** Sanitized marker path for a session id; null when the payload carries no
 * usable session id (those sessions are never marker-exempt). */
function markerFilePath(sessionId: string | null): string | null {
  if (!sessionId) return null;
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, '_');
  if (!safe || safe === '_'.repeat(safe.length)) return null;
  return join(STATE_DIR, `${safe}.json`);
}

/** Fresh marker check; any read/parse failure counts as absent (fail-open). */
function markerIsFresh(markerPath: string | null): boolean {
  if (!markerPath) return false;
  if (!existsSync(markerPath)) return false;
  try {
    const parsed = JSON.parse(readFileSync(markerPath, 'utf-8')) as MarkerPayload;
    if (typeof parsed.ts !== 'number' || !Number.isFinite(parsed.ts)) return false;
    return Date.now() - parsed.ts <= MARKER_TTL_MS;
  } catch {
    return false;
  }
}

export function evaluate(payload: HookPayload): GateDecision | null {
  if (typeof payload.tool_name !== 'string' || !SPECIALIST_DISPATCH_TOOLS.has(payload.tool_name)) {
    return null;
  }

  const input = (typeof payload.tool_input === 'object' && payload.tool_input !== null
    ? payload.tool_input
    : {}) as Record<string, unknown>;

  let specialist: string | null = null;
  for (const key of SPECIALIST_INPUT_KEYS) {
    const value = input[key];
    if (typeof value === 'string' && value.length > 0) {
      specialist = value;
      break;
    }
  }
  if (!specialist) return null;

  let roster: string[];
  try {
    roster = loadSpecialistRoster();
  } catch {
    // agents/ unreadable — cannot verify identity, do not block
    return null;
  }
  if (!roster.includes(specialist)) return null;

  const sessionId = typeof payload.session_id === 'string' && payload.session_id.length > 0
    ? payload.session_id
    : null;
  if (markerIsFresh(markerFilePath(sessionId))) return null;

  // No marker: dispatch blocked. Decision verb is platform-specific.
  const decision: 'ask' | 'deny' = payload.tool_name === 'invoke_subagent' ? 'deny' : 'ask';
  const reason =
    `[PM-GATE] workspace rule AGENTS.md §3.1: specialist agents are dispatched ` +
    `through PM. This session tried to dispatch "${specialist}" directly but ` +
    `has no PM-role session marker (pm-role-bootstrap did not run, or this is ` +
    `not a PM session). Route the work through PM, or boot this session into ` +
    `the PM role (agents/pm.md session bootstrap) before dispatching again.`;
  return { decision, reason };
}

function main(): void {
  try {
    const payload = JSON.parse(readFileSync(0, 'utf-8')) as HookPayload;
    const decision = evaluate(payload);
    if (decision) {
      process.stdout.write(`${JSON.stringify(decision)}\n`);
    }
  } catch {
    // malformed hook payload — fail open
  }
}

main();
