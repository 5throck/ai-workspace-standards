#!/usr/bin/env bun
// @version 1.3.0
// v1.3.0 (2026-11-22, U-20261122-006 — design
//           docs/designs/2026-11-22-auth-gate-hook-artifact-arm-design.md): the
//           AUTH-GATE arm is rebuilt on the auth-gate-state.json PASS artifact.
//           The v1.2.0 arm was dead code: it resolved agent/record paths off
//           STATE_DIR (the OS temp dir by default), so existsSync was always
//           false, and it checked only the EXISTENCE of docs/authorization.md —
//           a historical record, not a freshness verdict. Now: (1) paths are
//           rooted at WORKSPACE_ROOT; (2) the arm demands a fresh PASS artifact
//           — resolved AUTH_GATE_STATE env -> <gitDir>/auth-gate-state.json
//           (.git dir, or gitdir: pointer file, no spawn) -> the L3 script's
//           tmpdir sha256 fallback — with verdict PASS + schemaVersion 1 +
//           checked_at within 24h (future = forged = fail) + window-end bound
//           (TZ-aware, Intl en-CA); every invalid outcome is a fail-closed
//           `deny` with an actionable "run bun scripts/verify-authorization-gate.ts"
//           remedy. Hash re-validation stays in the L3 script (the artifact is a
//           cache of the last verdict, never a trust root — residual: a
//           hand-forged fresh-PASS artifact passes this hook; the artifact lives
//           inside <git-dir> and the PM workflow plus --verify-artifact remain
//           the trust anchors). (3) Coverage change: the auth consult now runs
//           for marker-passed PM sessions too — the v1.2.0 marker fast-path
//           returned before the arm, so booted PM sessions were never
//           auth-checked. Marker TTL/sliding/fail-open semantics are untouched.
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
 * One arm is deliberately FAIL-CLOSED (U-20261122-006): a dispatch of an agent
 * whose frontmatter requires `verify-authorization` must present a fresh
 * auth-gate-state.json PASS artifact (produced by the L3 script
 * verify-authorization-gate.ts, consulted as a cache — freshness + verdict +
 * window only, never hash re-validation). Absent/expired/non-PASS/malformed
 * artifacts deny on both platforms: "cannot verify" is never "authorized".
 *
 * Layer scope: L0 (workspace root). Project-level (L2/L3) wiring is a
 * deliberate follow-up — see docs/designs/2026-10-17-pm-dispatch-gate-design.md.
 *
 * Spec: docs/designs/2026-10-17-pm-dispatch-gate-design.md
 */

import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = process.env.CLAUDE_PROJECT_DIR ?? fileURLToPath(new URL("../..", import.meta.url));

const STATE_DIR = process.env.PM_GATE_STATE_DIR ?? join(tmpdir(), "ai-workspace-pm-gateway");

// T-20261026-009 (finding #32): 24h expired inside real long-running PM sessions.
// 7 days + the sliding refresh in evaluate() cover both active multi-day sessions
// and the abandon case (an idle marker still ages out).
const MARKER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// U-20261122-006: a PASS artifact is a cache of the most recent verdict; the L3
// script (verify-authorization-gate.ts VERDICT_TTL_MS) retires it after 24h. The
// hook mirrors that TTL so the consumer and producer agree on freshness.
const AUTH_ARTIFACT_TTL_MS = 24 * 60 * 60 * 1000;

const SPECIALIST_DISPATCH_TOOLS = new Set(["Agent", "invoke_subagent"]);

/** Payloads that dispatch rostered specialists carry the specialist name in
 * one of these tool_input keys; unknown schemas (desktop apps) fail closed to
 * exit 0 (no block) because this gate never invents an identity. */
const SPECIALIST_INPUT_KEYS = ["subagent_type", "subagent_name", "name"] as const;

interface MarkerPayload {
  ts?: unknown;
}

interface HookPayload {
  tool_name?: unknown;
  tool_input?: unknown;
  session_id?: unknown;
}

export interface GateDecision {
  decision: "ask" | "deny";
  reason: string;
}

/** Live-dispatch roster: agents/*.md minus pm.md, sorted for determinism. */
function loadSpecialistRoster(): string[] {
  const dir = join(WORKSPACE_ROOT, "agents");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name !== "pm.md")
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
}

/** Sanitized marker path for a session id; null when the payload carries no
 * usable session id (those sessions are never marker-exempt). */
function markerFilePath(sessionId: string | null): string | null {
  if (!sessionId) return null;
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, "_");
  if (!safe || safe === "_".repeat(safe.length)) return null;
  return join(STATE_DIR, `${safe}.json`);
}

/** Fresh marker read; returns the parsed payload when fresh, null otherwise.
 * Any read/parse failure counts as absent (fail-open). */
function freshMarker(markerPath: string | null): MarkerPayload | null {
  if (!markerPath) return null;
  if (!existsSync(markerPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(markerPath, "utf-8")) as MarkerPayload;
    if (typeof parsed.ts !== "number" || !Number.isFinite(parsed.ts)) return null;
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
    writeFileSync(tmp, JSON.stringify({ ...payload, ts: Date.now() }), "utf-8");
    renameSync(tmp, markerPath);
  } catch {
    // fail-open: refresh is an optimization for the gate, not the contract
  }
}

// ---------------------------------------------------------------------------
// AUTH-GATE arm (U-20261122-006): freshness over the L3 gate's PASS artifact.
// Spawn-free by design (PreToolUse hot path): fs reads + JSON.parse + Date math
// + Intl format + one createHash in the fallback arm only. Hash re-validation
// stays in verify-authorization-gate.ts — the artifact is a cache, not a trust
// root; this hook checks freshness + verdict + window only.
// ---------------------------------------------------------------------------

/** Artifact path resolution mirroring verify-authorization-gate.ts
 * defaultArtifactPath(), without spawning git:
 * 1. AUTH_GATE_STATE env when set and non-empty (the script's test escape hatch);
 * 2. <gitDir>/auth-gate-state.json — <root>/.git as a directory, or as a
 *    worktree/submodule pointer file (`gitdir: <path>`, relative = to the file's
 *    directory);
 * 3. the script's tmpdir arm: <tmpdir()>/ai-workspace-auth-gate/<sha256(root)>.json
 *    — both sides hash the same absolute repo root, so the keys agree. */
function resolveAuthArtifactPath(): string {
  const env = process.env.AUTH_GATE_STATE;
  if (env !== undefined && env.trim().length > 0) return env.trim();
  const dotGit = join(WORKSPACE_ROOT, ".git");
  let gitDir: string | null = null;
  try {
    const st = statSync(dotGit);
    if (st.isDirectory()) {
      gitDir = dotGit;
    } else if (st.isFile()) {
      const firstLine = (readFileSync(dotGit, "utf-8").split(/\r?\n/, 1)[0] ?? "").trim();
      const m = /^gitdir:\s*(.+)$/.exec(firstLine);
      if (m) {
        const target = m[1].trim();
        gitDir = isAbsolute(target) ? target : join(WORKSPACE_ROOT, target);
      }
    }
  } catch {
    gitDir = null;
  }
  if (gitDir !== null) return join(gitDir, "auth-gate-state.json");
  const key = createHash("sha256").update(resolve(WORKSPACE_ROOT)).digest("hex");
  return join(tmpdir(), "ai-workspace-auth-gate", `${key}.json`);
}

/** Today as YYYY-MM-DD in the given IANA tz (the script's todayInTz shape);
 * null when the tz is unknown — callers fall back to UTC. */
function todayInTz(tz: string, now: Date): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  } catch {
    return null;
  }
}

/** Validity predicate for the gate artifact (design D1, all must hold):
 * parses as JSON, schemaVersion 1, verdict PASS, checked_at a real past
 * timestamp within 24h, and — when window.end is a date-shaped string — today
 * (in window.tz, UTC fallback) is not past it. Absent/malformed window fields
 * degrade to "skip this sub-check" (the TTL still applies); the hook never
 * guesses. Returns ok, or a `why` fragment for the deny reason:
 * absent | malformed | verdict <v> | expired <age>h | window ended <end>. */
function checkAuthArtifact(artifactPath: string): { ok: true } | { ok: false; why: string } {
  if (!existsSync(artifactPath)) return { ok: false, why: "absent" };
  let artifact: Record<string, unknown>;
  try {
    artifact = JSON.parse(readFileSync(artifactPath, "utf-8")) as Record<string, unknown>;
  } catch {
    return { ok: false, why: "malformed" };
  }
  if (artifact.schemaVersion !== 1) return { ok: false, why: "malformed" };
  if (artifact.verdict !== "PASS") return { ok: false, why: `verdict ${String(artifact.verdict)}` };
  const checkedAt = typeof artifact.checked_at === "string" ? Date.parse(artifact.checked_at) : Number.NaN;
  if (Number.isNaN(checkedAt)) return { ok: false, why: "malformed" };
  const age = Date.now() - checkedAt;
  if (age < 0) return { ok: false, why: "malformed" }; // future timestamp = forged clock
  if (age > AUTH_ARTIFACT_TTL_MS) return { ok: false, why: `expired ${Math.floor(age / 3_600_000)}h` };
  const win = (typeof artifact.window === "object" && artifact.window !== null ? artifact.window : {}) as Record<
    string,
    unknown
  >;
  const windowEnd = typeof win.end === "string" ? win.end : null;
  if (windowEnd !== null && /^\d{4}-\d{2}-\d{2}$/.test(windowEnd)) {
    const tz = typeof win.tz === "string" && win.tz.length > 0 ? win.tz : "UTC";
    const now = new Date();
    const today = todayInTz(tz, now) ?? todayInTz("UTC", now);
    if (today !== null && today > windowEnd) return { ok: false, why: `window ended ${windowEnd}` };
  }
  return { ok: true };
}

export function evaluate(payload: HookPayload): GateDecision | null {
  if (typeof payload.tool_name !== "string" || !SPECIALIST_DISPATCH_TOOLS.has(payload.tool_name)) {
    return null;
  }

  const input = (
    typeof payload.tool_input === "object" && payload.tool_input !== null ? payload.tool_input : {}
  ) as Record<string, unknown>;

  let specialist: string | null = null;
  for (const key of SPECIALIST_INPUT_KEYS) {
    const value = input[key];
    if (typeof value === "string" && value.length > 0) {
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

  const sessionId = typeof payload.session_id === "string" && payload.session_id.length > 0 ? payload.session_id : null;
  const markerPath = markerFilePath(sessionId);
  const marker = freshMarker(markerPath);
  if (marker) {
    refreshMarker(markerPath, marker);
  }

  // Authorization gate (U-20261122-006): if the dispatched agent's frontmatter
  // requires verify-authorization, demand a fresh auth-gate-state.json PASS
  // artifact. Fail-closed: absent/expired/non-PASS/malformed = deny with an
  // actionable remedy; hash re-validation stays in the L3 script. The consult
  // runs for marker-passed sessions TOO (design D3): the v1.2.0 marker
  // fast-path returned before this arm, so booted PM sessions — the actual
  // enforcement target — were never auth-checked.
  const agentFile = join(WORKSPACE_ROOT, "agents", `${specialist}.md`);
  if (existsSync(agentFile)) {
    try {
      const fm = readFileSync(agentFile, "utf-8");
      if (/required_skills:.*verify-authorization/.test(fm)) {
        const check = checkAuthArtifact(resolveAuthArtifactPath());
        if (!check.ok) {
          return {
            decision: "deny" as const,
            reason: `[AUTH-GATE] "${specialist}" requires verify-authorization but no fresh gate artifact exists (${check.why}). Run bun scripts/verify-authorization-gate.ts, then retry.`,
          };
        }
      }
    } catch {
      // agent file unreadable — fail-open (the session still faces the marker check)
    }
  }

  if (marker) return null;

  // No marker: dispatch blocked. Decision verb is platform-specific.
  const decision: "ask" | "deny" = payload.tool_name === "invoke_subagent" ? "deny" : "ask";
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
    const payload = JSON.parse(readFileSync(0, "utf-8")) as HookPayload;
    const decision = evaluate(payload);
    if (decision) {
      process.stdout.write(`${JSON.stringify(decision)}\n`);
    }
  } catch {
    // malformed hook payload — fail open
  }
}

main();
