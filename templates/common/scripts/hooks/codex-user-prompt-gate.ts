#!/usr/bin/env bun
// @version 1.0.0
/**
 * codex-user-prompt-gate.ts — UserPromptSubmit (Codex CLI / Desktop / IDE)
 * identity gate enforcing the PM Gateway single-point-of-entry rule
 * (AGENTS.md §3.1) on the Codex platform.
 *
 * Codex has no subagent-dispatch tool, so the Claude `Agent` / Gemini
 * `invoke_subagent` interception points (scripts/hooks/pm-dispatch-gate.ts)
 * have no Codex analog. The explicit direct-dispatch surface on Codex is the
 * slash-style prompt: a user typing `/architect ...` is invoking a rostered
 * specialist directly, the same way the workspace's own Command Intercept
 * Rule treats `/memlog` as an explicit prompt invocation (CODEX.md §3).
 *
 * A session that HAS booted into the PM role (pm-role-bootstrap marker, fresh
 * within MARKER_TTL_MS — the same marker chain as pm-dispatch-gate) may
 * invoke specialists freely. Any other session attempting a rostered
 * slash-invocation is answered with the documented Codex UserPromptSubmit
 * block shape:
 *   {"decision": "block", "reason": "[PM-GATE] ..."} (exit 0)
 *
 * Identity-critical marker/state handling mirrors pm-dispatch-gate v1.0.0:
 * state dir is `PM_GATE_STATE_DIR` (override for tests) or
 * `<os.tmpdir()>/ai-workspace-pm-gateway`, expected outside the repo on
 * purpose (session state, not source). Helpers are deliberately duplicated —
 * both gates are standalone hook executables; importing a script with
 * `main()` would execute it.
 *
 * This gate is FAIL-OPEN by design: unexpected payloads, unreadable rosters,
 * or state-dir errors exit 0 silently and never block a prompt. Codex's
 * hash-pinned hook trust model (non-managed hooks are skipped until trusted
 * via `/hooks`) makes an absent gate the safe default; CODEX.md §1 documents
 * prompt-enforcement as the standing fallback.
 *
 * Layer scope: L0 + L1 (mirrored verbatim to templates/common/scripts/hooks/).
 * Variant (L2) wiring is out of scope — variants carry no .codex config layer.
 *
 * Spec: docs/designs/2026-10-18-codex-user-prompt-gate-design.md
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

interface MarkerPayload {
  ts?: unknown;
}

interface HookPayload {
  prompt?: unknown;
  session_id?: unknown;
}

export interface GateDecision {
  decision: 'block';
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

/** The explicit-invocation surface: a leading `/name` on the prompt. Prose
 * that merely mentions a specialist ("ask docs-writer to...") is NOT gated. */
export function extractSlashCommand(prompt: string): string | null {
  const match = /^\/([a-z0-9][a-z0-9_-]*)/i.exec(prompt.trim());
  return match ? match[1].toLowerCase() : null;
}

export function evaluate(payload: HookPayload): GateDecision | null {
  if (typeof payload.prompt !== 'string' || payload.prompt.length === 0) return null;

  const command = extractSlashCommand(payload.prompt);
  if (!command) return null;

  let roster: string[];
  try {
    roster = loadSpecialistRoster();
  } catch {
    // agents/ unreadable — cannot verify identity, do not block
    return null;
  }
  if (!roster.includes(command)) return null;

  const sessionId = typeof payload.session_id === 'string' && payload.session_id.length > 0
    ? payload.session_id
    : null;
  if (markerIsFresh(markerFilePath(sessionId))) return null;

  // No marker: prompt blocked. Codex UserPromptSubmit documents exactly this
  // JSON shape (developers.openai.com/codex/hooks).
  const reason =
    `[PM-GATE] workspace rule AGENTS.md §3.1: specialist agents are dispatched ` +
    `through PM. This prompt invoked "/${command}" directly but this session ` +
    `has no PM-role session marker (pm-role-bootstrap did not run, or this is ` +
    `not a PM session). Restate the request as PM work, or boot this session ` +
    `into the PM role (agents/pm.md session bootstrap / CODEX.md) before ` +
    `invoking specialists again.`;
  return { decision: 'block', reason };
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
