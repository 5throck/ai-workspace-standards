#!/usr/bin/env bun
// @version 1.1.0
// v1.1.0 (2026-10-26, T-20261026-009, finding #32): the PM marker TTL no longer
//           expires inside long-running sessions. (1) MARKER_TTL_MS 24h -> 7 days.
//           (2) The TTL now SLIDES: every accepted gated dispatch refreshes the
//           marker's ts (best-effort, atomic tmp+rename), so an ACTIVE PM session
//           never goes stale, while an abandoned marker still expires 7 days after
//           its last dispatch. Previously a session past 24h degraded silently —
//           Claude re-prompted the user, Gemini hard-denied with a reason claiming
//           pm-role-bootstrap never ran (it had; the marker had merely aged out).
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

import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT =
  process.env.CLAUDE_PROJECT_DIR ?? fileURLToPath(new URL('../..', import.meta.url));

const STATE_DIR =
  process.env.PM_GATE_STATE_DIR ?? join(tmpdir(), 'ai-workspace-pm-gateway');

// T-20261026-009 (finding #32): 24h expired inside real long-running PM sessions.
// 7 days + the sliding refresh in evaluate() cover both active multi-day sessions
// and the abandon case (an idle marker still ages out).
const MARKER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

/** Fresh marker read; returns the parsed payload when fresh, null otherwise.
 * Any read/parse failure counts as absent (fail-open). */
function freshMarker(markerPath: string | null): MarkerPayload | null {
  if (!markerPath) return null;
  if (!existsSync(markerPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(markerPath, 'utf-8')) as MarkerPayload;
    if (typeof parsed.ts !== 'number' || !Number.isFinite(parsed.ts)) return null;
    return Date.now() - parsed.ts <= MARKER_TTL_MS ? parsed : null;
  } catch {
    return null;
  }
}

/** T-20261026-009 (finding #32): slide the marker forward on every accepted gated
 * dispatch, so an ACTIVE PM session never crosses the TTL mid-flight. Best-effort
 * (fail-open) and atomic (tmp + rename): a torn or failed refresh only means the
 * next dispatch re-checks the original age. */
function refreshMarker(markerPath: string | null, payload: MarkerPayload): void {
  if (!markerPath) return;
  try {
    const tmp = `${markerPath}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmp, JSON.stringify({ ...payload, ts: Date.now() }), 'utf-8');
    renameSync(tmp, markerPath);
  } catch {
    // fail-open: refresh is an optimization for the gate, not the contract
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
  const markerPath = markerFilePath(sessionId);
  const marker = freshMarker(markerPath);
  if (marker) {
    refreshMarker(markerPath, marker);
    return null;
  }

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
