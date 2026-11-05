#!/usr/bin/env bun
/**
 * delete-guard.ts — PreToolUse Bash (Claude) / BeforeTool run_shell_command
 * (Gemini) recursive-delete guard.
 *
 * Design: docs/designs/2026-11-04-project-loss-hardening-design.md §5.1
 * Ticket:  T-20261104-004 item (1). Rulings: docs/decisions/DEC-20261104-02.md
 * (Gemini = deny; v1 verb scope = rm/trash recursive deletes only — git clean
 * and find -delete are deferred to v2).
 *
 * Detects recursive deletes (`rm` with -r/-R/--recursive in any permutation,
 * `trash`, `trash-put`) whose operand resolves inside the workspace root and
 * FAILS CLOSED on them (Claude: decision "ask", exit 0; Gemini: decision
 * "deny", exit 2), EXCEPT:
 *   - regenerable-artifact allowlist targets (path-segment match:
 *     node_modules, .next, dist, build, coverage, tmp, temp, .cache, .turbo,
 *     .parcel-cache, .nuxt, .output, .vite, __pycache__, .pytest_cache,
 *     target, .eslintcache) and anything under os.tmpdir() — BUT the
 *     allowlist bypass is itself suppressed when a `.git` entry exists at or
 *     beneath the target (bounded depth-2 scan): the incident's fatal class.
 *     os.tmpdir() targets are exempt from the .git re-check (temp dirs are
 *     the sanctioned place for test fixtures).
 *   - a valid dry-run marker (dry-run-list-first escape protocol): a
 *     read-only listing (ls / tree / stat / `du -s` / `find <path>
 *     -maxdepth`) of a workspace-interior path records `{ resolvedPath, at }`
 *     in the session marker file (DELETE_GUARD_STATE_DIR override, else
 *     <os.tmpdir()>/ai-workspace-delete-guard/<sanitized session_id>.json —
 *     pm-role-bootstrap marker precedent). A recursive delete of the SAME
 *     resolved path within 30 minutes passes the marker check. The marker
 *     never bypasses the human confirmation on Claude (still `ask` — it only
 *     softens the message); on Gemini a valid marker downgrades to allow
 *     (Gemini's terminal.executionPolicy "Manual" supplies the confirmation).
 *   - the reviewed escape hatch: ALLOW_RECURSIVE_DELETE=1 bypasses the gate
 *     for the invocation (pre-push.ts ALLOW_REMOTE_BRANCH_DELETE precedent).
 *
 * Fail posture: hook-infrastructure errors (unreadable stdin, JSON parse
 * failure, missing/untyped payload fields) → fail-open (exit 0, silent) per
 * the workspace hook convention (gateguard-fact-force.ts). Successfully
 * parsed gated commands → fail-closed.
 *
 * ---------------------------------------------------------------------------
 * Non-firing deny-rule finding (open observation, resolved 2026-11-05)
 * ---------------------------------------------------------------------------
 * .claude/settings.json carried "Bash(rm -rf *)" in permissions.deny at
 * incident time (present since commit aaf2b3648, 2026-06-02), yet the
 * 2026-11-04 `rm -rf Projects` was not prevented. Verified against the
 * documented Claude Code permission semantics
 * (https://code.claude.com/docs/en/permissions, checked 2026-11-05): Bash
 * rules match as globs over the whole command text with `*` matching any
 * suffix, and deny rules apply when ANY subcommand matches, including
 * commands nested in subshells — the incident's bare `rm -rf Projects` WOULD
 * have matched. So pattern-matching semantics does not explain the
 * non-firing for that exact command form. Two residual rule gaps are still
 * real per the same docs: prefix rules are explicitly not a security
 * boundary (`/bin/rm -rf ...` and `bash -c 'rm -rf ...'` wrapper forms are
 * NOT matched), and the rule's scope covered only `rm -rf` — not `-r`,
 * `-R`, `--recursive`, `-fr` permutations, and not trash commands. Given a
 * bare command the documented matcher denies, the most probable root cause
 * is that the matcher was never invoked: the incident session ran on a
 * harness that does not consume .claude/settings.json (the workspace hosts
 * six platforms; only Claude Code reads that file; the incident record,
 * memory/2026-11-04.md:175, does not record the session platform). The
 * secondary contributing gap (rule scope + wrapper forms) applies even on
 * Claude Code.
 *
 * Wiring adjustment so this control does not inherit that failure mode: the
 * delete guard is wired as a PreToolUse/BeforeTool HOOK — not a permission
 * rule — so on both wired platforms it fires on the tool call itself and
 * parses compound command segments and the full rm/trash recursive-verb
 * family independently of permission-rule evaluation. Platforms without
 * hook support (Antigravity, Codex, Hermes, ZCode) remain prompt-layer
 * covered per the design's §5.1 enforcement-coverage table.
 *
 * Parsing is a documented heuristic (separator split + token scan), not a
 * shell parser; obfuscated deletes (scripts calling fs.rmSync, find -delete,
 * git clean) are out of scope by design (design N3; v2 candidates).
 *
 * @version 1.2.0
 *
 * v1.2.0 (2026-11-06, T-20261106-005 item 1): transparent-prefix bypass
 *          closed — sudo/env/nice/xargs/nohup are skipped (stacked forms and
 *          env assignments they carry included) before verb detection, so
 *          `sudo rm -rf Projects` no longer walks past the guard. Negative
 *          tests pin that benign prefixed reads (sudo ls, env grep) stay
 *          unflagged.
 *
 * v1.1.1 (2026-11-05, windows-latest CI + U-20261104-002 follow-through): the
 * containment helpers are separator- and case-agnostic. A POSIX-literal root
 * ('/ws') vs a path.sepped target (join() backslashes on win32) never matched
 * under bare startsWith(root + sep) — the security-validator.ts U-20261104-002
 * precedent's Windows twin — and win32 paths are case-insensitive, so a
 * case-mismatched spelling of an in-workspace target must not read as
 * "outside" (resolve-fallback targets bypass realpath case-normalization).
 * Both paths are now resolve()-normalized and, on win32, case-folded before
 * comparison; allowlist segments stay case-sensitive by design.
 *
 * v1.1.0 (2026-11-05, L1 promotion — forced by the propagation SSOT): the
 * gemini-settings propagation domain (scripts/propagation-map.json; dev-sync
 * runs propagate-to-templates --apply unconditionally) mirrors root
 * .gemini/settings.json BeforeTool entries into templates/common/.gemini
 * on EVERY sync ("shared ... hook config must stay identical across all
 * tiers"), so the v1.0.0 wiring landed in the L1 template in commit
 * a57dc970a while this file stayed L0-only — scaffolded projects would
 * fire `bun scripts/hooks/delete-guard.ts` against a missing file on every
 * shell command. The design (§6) had deferred BOTH the L1 mirror and the
 * delivered wiring to Phase 2 and did not account for the propagation
 * contract; with the wiring already committed, the minimal coherent state
 * is the delivered hook (gateguard 1.3.0 L1-promotion precedent:
 * byte-identical modulo the sanctioned comment scrub — this file's
 * 'context.md' marker string is functional code and survives the
 * scrub unchanged). Design deviation flagged for PM review; reverting the
 * L1 wiring instead would recreate the broken-artifact state on the next
 * sync.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { homedir, tmpdir } from 'node:os';

const TAG = '[DELETE-GUARD]';
const MARKER_TTL_MS = 30 * 60 * 1000; // dry-run marker validity window
const STATE_DIR =
  process.env.DELETE_GUARD_STATE_DIR || join(tmpdir(), 'ai-workspace-delete-guard');

/** Workspace-root markers (upward-walk fallback when CLAUDE_PROJECT_DIR is
 * unset) — mirrors scripts/helpers/security-validator.ts detectWorkspaceRoot
 * (U-20261104-002). Reimplemented locally so the hook stays self-contained
 * for the Phase-2 L1 delivery (hooks ship as single files). */
const WORKSPACE_ROOT_MARKERS = ['CONSTITUTION.md', join('templates', 'common')];

/** Regenerable-artifact allowlist — path-segment match, case-sensitive
 * (design §5.1). */
const ALLOWLIST_SEGMENTS: ReadonlySet<string> = new Set([
  'node_modules', '.next', 'dist', 'build', 'coverage', 'tmp', 'temp',
  '.cache', '.turbo', '.parcel-cache', '.nuxt', '.output', '.vite',
  '__pycache__', '.pytest_cache', 'target', '.eslintcache',
]);

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests; main() runs under import.meta.main,
// pre-push.ts precedent)
// ---------------------------------------------------------------------------

/** Split a command on shell separators (`&&`, `||`, `;`, `|`, newlines) —
 * the design's documented heuristic (§5.1 step 2), not a shell parser. */
export function splitSegments(command: string): string[] {
  return command
    .replace(/\r\n?/g, '\n')
    .split(/&&|\|\||;|\||\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** True when a single-dash token enables the recursive flag for `rm`:
 * exact `-r`/`-R`, or a combined short-flag bundle containing r/R
 * (`-fr`, `-rf`, `-Rf`, ...). Double-dash tokens are handled separately. */
export function shortFlagsEnableRecursive(token: string): boolean {
  if (!/^-[^-]+$/.test(token)) return false;
  return token.slice(1).includes('r') || token.slice(1).includes('R');
}

export interface SegmentAnalysis {
  /** Recursive-delete verb detected on this segment (rm/trash family). */
  isRecursiveDelete: boolean;
  /** Operand paths of the recursive delete (non-flag tokens after the verb). */
  deleteOperands: string[];
  /** Read-only listing segment (dry-run-list-first protocol write path). */
  isListing: boolean;
  /** Operand paths of the listing. */
  listingOperands: string[];
}

/** A token that is (or carries) a shell redirection: `>`, `>>`, `2>`,
 * `2>&1`, `&>>`, `>file`, `2>/dev/null`, `<input`. Pathological filenames
 * containing < or > are misread as redirections — accepted heuristic cost. */
export function isRedirectToken(token: string): boolean {
  return /[<>]/.test(token);
}

/** Analyze one command segment: recursive-delete verb + operands, or a
 * read-only listing of the marker protocol (ls/tree/stat any flags; `du`
 * only with -s; `find` only with -maxdepth, path = first token after the
 * verb). Leading KEY=VALUE env assignments are skipped so `FOO=1 rm -rf x`
 * is still detected as an rm invocation; redirection tokens (and the bare
 * `>`/`>>` operator's target token) are excluded from operands. */
export function analyzeSegment(segment: string): SegmentAnalysis {
  const result: SegmentAnalysis = {
    isRecursiveDelete: false,
    deleteOperands: [],
    isListing: false,
    listingOperands: [],
  };
  const allTokens = segment.split(/\s+/).filter((t) => t.length > 0);
  // Skip leading env assignments (VAR=value ...).
  let start = 0;
  while (start < allTokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(allTokens[start])) {
    start++;
  }
  // Transparent prefixes (T-20261106-005 item 1): sudo/env/nice/xargs/nohup
  // execute the following command unchanged — skip them (and any env
  // assignments they carry) so the delete verb is detected through the
  // wrapper. Loop until no progress: covers stacked forms (sudo env rm).
  const TRANSPARENT_PREFIXES = new Set(['sudo', 'env', 'nice', 'xargs', 'nohup']);
  let progressed = true;
  while (progressed) {
    progressed = false;
    while (start < allTokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(allTokens[start])) {
      start++;
      progressed = true;
    }
    if (start < allTokens.length && TRANSPARENT_PREFIXES.has(allTokens[start])) {
      start++;
      progressed = true;
    }
  }
  const tokens = allTokens.slice(start);
  if (tokens.length === 0) return result;
  const verb = tokens[0];

  // Operand scan shared by delete verbs and listings: skips flags (until
  // `--`), redirection tokens, and the target token following a bare
  // `>` / `>>` / `<` operator.
  const collectOperands = (from: number): string[] => {
    const operands: string[] = [];
    let optionsEnded = false;
    let skipNext = false;
    for (let i = from; i < tokens.length; i++) {
      const t = tokens[i];
      if (skipNext) {
        skipNext = false;
        continue;
      }
      if (!optionsEnded && t === '--') {
        optionsEnded = true;
        continue;
      }
      if (isRedirectToken(t)) {
        // Bare operator (`>`, `>>`, `2>`) consumes the next token as target;
        // attached forms (`>file`, `2>&1`) carry it in the token itself.
        skipNext = /^[0-9]*[<>]{1,2}$/.test(t) || t === '<' || t === '&>' || t === '&>>';
        continue;
      }
      if (!optionsEnded && t.startsWith('-')) continue;
      operands.push(t);
    }
    return operands;
  };

  if (verb === 'rm' || verb === 'trash' || verb === 'trash-put') {
    const recursive =
      verb !== 'rm' || // trash commands are inherently recursive
      tokens.slice(1).some(
        (t) => t === '--recursive' || shortFlagsEnableRecursive(t),
      );
    if (recursive) {
      result.isRecursiveDelete = true;
      result.deleteOperands = collectOperands(1);
    }
    return result;
  }

  if (verb === 'ls' || verb === 'tree' || verb === 'stat') {
    result.isListing = true;
    result.listingOperands = collectOperands(1);
  } else if (verb === 'du' && tokens.includes('-s')) {
    result.isListing = true;
    result.listingOperands = collectOperands(1);
  } else if (verb === 'find' && tokens.includes('-maxdepth') && tokens.length > 1) {
    result.isListing = true;
    result.listingOperands = [tokens[1]];
  }
  return result;
}

/** Expand a leading `~` to the user's home directory (design §5.1 step 4).
 * Accepts both `~/` and the platform separator (`~\\` on win32). */
export function expandTilde(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/') || p.startsWith('~' + sep)) return join(homedir(), p.slice(2));
  return p;
}

/** Symlink-canonicalize a path when it resolves on disk; fall back to the
 * lexical resolution when it does not (security-validator.ts canonicalize,
 * macOS /private/var spelling). */
export function canonicalize(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

/** Normalize a path for containment comparison (U-20261104-002 hardening,
 * windows-sep class): lexical resolve() makes the comparison separator-agnostic
 * (a POSIX-literal root and a path.sepped target converge), and on win32 the
 * comparison is case-folded because the filesystem is case-insensitive — a
 * case-mismatched spelling of an in-workspace target must not read as
 * "outside the workspace" (non-existent targets take the resolve() fallback
 * and get no realpath case-normalization). */
export function normalizeForCompare(p: string): string {
  const resolved = resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/** Inside check against the (canonicalized) workspace root: the root itself
 * or anything beneath it. Separator- and case-agnostic (see
 * normalizeForCompare); the root + sep prefix still rejects sibling
 * directories whose names share the root's prefix (`/ws` vs `/ws-evil`). */
export function isInsideWorkspace(root: string, target: string): boolean {
  const r = normalizeForCompare(root);
  const t = normalizeForCompare(target);
  return t === r || t.startsWith(r + sep);
}

// ---------------------------------------------------------------------------
// Workspace root detection (fail-closed boundary, security-validator shape)
// ---------------------------------------------------------------------------

function detectWorkspaceRoot(): string {
  const envRoot = process.env.CLAUDE_PROJECT_DIR;
  if (envRoot) return canonicalize(resolve(envRoot));
  let dir = resolve(process.cwd());
  for (;;) {
    if (WORKSPACE_ROOT_MARKERS.some((m) => existsSync(join(dir, m)))) {
      return canonicalize(dir);
    }
    const parent = resolve(dir, '..');
    if (parent === dir) return canonicalize(resolve(process.cwd())); // fail closed to cwd
    dir = parent;
  }
}

// ---------------------------------------------------------------------------
// Allowlist + the .git-beneath suppression (the incident's fatal class)
// ---------------------------------------------------------------------------

/** Path-segment allowlist match, relative to the workspace root,
 * case-sensitive (deliberate: `Dist` must not pass as `dist`). The root
 * itself has no segments → never allowlisted. Segments are computed from
 * resolve()-normalized operands so the slice is separator-agnostic on win32
 * (normalizeForCompare's case-fold applies to containment only). */
export function isAllowlisted(root: string, target: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);
  if (!isInsideWorkspace(root, target) || resolvedTarget === resolvedRoot) return false;
  const relative = resolvedTarget.slice(resolvedRoot.length + sep.length);
  return relative.split(sep).some((segment) => ALLOWLIST_SEGMENTS.has(segment));
}

/** Bounded depth-2 scan for a `.git` entry (dir or file — worktree/submodule
 * pointers are files) at or beneath `target`. Depth 1 = entries of target,
 * depth 2 = entries of target's direct subdirectories. Early-exits on the
 * first hit; unreadable directories are skipped (fail-open per directory —
 * a scan that cannot read cannot prove a .git exists). */
export function hasGitBeneath(target: string): boolean {
  return scanForGit(target, 2);
}

function scanForGit(dir: string, levels: number): boolean {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.name === '.git') return true;
  }
  if (levels > 1) {
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '.git') continue; // already matched above
      if (scanForGit(join(dir, entry.name), levels - 1)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Dry-run marker protocol (stateless hook — pm-role-bootstrap marker shape)
// ---------------------------------------------------------------------------

interface MarkerEntry {
  resolvedPath: string;
  at: number;
}

interface MarkerFile {
  entries: MarkerEntry[];
}

function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^A-Za-z0-9_-]/g, '_');
}

function markerPathFor(sessionId: string): string | null {
  const safe = sanitizeSessionId(sessionId);
  return safe ? join(STATE_DIR, `${safe}.json`) : null;
}

function readMarker(sessionId: string): MarkerFile {
  const path = markerPathFor(sessionId);
  if (!path || !existsSync(path)) return { entries: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<MarkerFile>;
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const now = Date.now();
    return {
      entries: entries.filter(
        (e) =>
          e &&
          typeof e.resolvedPath === 'string' &&
          typeof e.at === 'number' &&
          now - e.at <= MARKER_TTL_MS,
      ),
    };
  } catch {
    return { entries: [] }; // unreadable/corrupt marker = no marker (fail-closed gate)
  }
}

/** Best-effort marker write (pm-role-bootstrap convention): a write failure
 * only warns to stderr, never blocks the listing command. */
function recordListingMarkers(resolvedPaths: string[], sessionId: string): void {
  if (resolvedPaths.length === 0) return;
  try {
    const marker = readMarker(sessionId);
    const now = Date.now();
    const byPath = new Map<string, number>();
    for (const e of marker.entries) byPath.set(e.resolvedPath, e.at);
    for (const p of resolvedPaths) byPath.set(p, now); // latest listing wins
    const entries = [...byPath.entries()].map(([resolvedPath, at]) => ({ resolvedPath, at }));
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(join(STATE_DIR, `${sanitizeSessionId(sessionId)}.json`), JSON.stringify({ entries }), 'utf-8');
  } catch (err) {
    console.error(`${TAG} WARN: marker write failed (fail-open): ${(err as Error).message}`);
  }
}

/** A fresh (≤30 min) marker exists for this exact resolved path. */
function hasFreshMarker(resolvedPath: string, sessionId: string): boolean {
  const now = Date.now();
  return readMarker(sessionId).entries.some(
    (e) => e.resolvedPath === resolvedPath && now - e.at <= MARKER_TTL_MS,
  );
}

// ---------------------------------------------------------------------------
// Verdict emission (platform hook contracts — gateguard-fact-force shape)
// ---------------------------------------------------------------------------

function emitAsk(reason: string): never {
  process.stdout.write(JSON.stringify({ decision: 'ask', reason }) + '\n');
  process.exit(0);
}

function emitDeny(reason: string): never {
  process.stdout.write(JSON.stringify({ decision: 'deny', reason }) + '\n');
  process.exit(2);
}

function allowSilently(): never {
  process.exit(0);
}

function gateReason(paths: string[], opts: { suppressNote: boolean; markerAck: boolean }): string {
  const targetList = paths.map((p) => `'${p}'`).join(', ');
  const suppression = opts.suppressNote
    ? ` The regenerable-artifact allowlist bypass is suppressed: a .git entry exists at or beneath the target — never delete a path that can contain .git children.`
    : '';
  if (opts.markerAck) {
    return (
      `${TAG} Recursive delete of ${targetList} (inside workspace root). A dry-run listing of this exact ` +
      `target was recorded within the last 30 minutes — confirm the delete.${suppression}`
    );
  }
  return (
    `${TAG} Recursive delete of ${targetList} (inside workspace root) is gated. ` +
    `Protocol: dry-run list the exact resolved target first (e.g. \`ls -la ${paths[0]}\` or ` +
    `\`find ${paths[0]} -maxdepth 1\`), then retry the delete within 30 minutes — the recorded ` +
    `listing downgrades this to a confirmation. ` +
    `Reviewed scripted cases only: re-run with ALLOW_RECURSIVE_DELETE=1. ` +
    `Never delete a path that can contain .git children (Projects/** first).${suppression}`
  );
}

// ---------------------------------------------------------------------------
// Main — fully synchronous
// ---------------------------------------------------------------------------

function main(): void {
  // 1. Platform/mode flags (gateguard convention: gemini forces deny;
  //    claude defaults to ask, --mode deny overrides).
  const args = process.argv.slice(2);
  const platformIdx = args.indexOf('--platform');
  const platform: 'claude' | 'gemini' =
    platformIdx !== -1 && args[platformIdx + 1] === 'gemini' ? 'gemini' : 'claude';
  const modeIdx = args.indexOf('--mode');
  const mode: 'ask' | 'deny' = modeIdx !== -1 && args[modeIdx + 1] === 'deny' ? 'deny' : 'ask';

  // 2. Read stdin (fd 0) — fail-open.
  let stdinJson: string;
  try {
    stdinJson = readFileSync(0, 'utf-8');
  } catch {
    process.exit(0);
    return;
  }

  // 3. Parse JSON — fail-open.
  let data: { session_id?: unknown; tool_input?: Record<string, unknown> };
  try {
    data = JSON.parse(stdinJson) as typeof data;
  } catch {
    process.exit(0);
    return;
  }

  // 4. Extract the command — both wired surfaces carry tool_input.command
  //    (Claude PreToolUse/Bash; Gemini BeforeTool/run_shell_command).
  //    Missing or non-string → fail-open.
  const toolInput = data.tool_input ?? {};
  const command = toolInput.command;
  if (typeof command !== 'string' || command.trim().length === 0) {
    process.exit(0);
    return;
  }

  const sessionId = typeof data.session_id === 'string' ? data.session_id : '';
  const root = detectWorkspaceRoot();
  const canonicalTmp = canonicalize(tmpdir());
  const segments = splitSegments(command);

  // 5. Marker-protocol write path: read-only listings of workspace-interior
  //    paths record { resolvedPath, at } for the session.
  for (const segment of segments) {
    const a = analyzeSegment(segment);
    if (!a.isListing || !sessionId) continue;
    const resolved = a.listingOperands
      .map(expandTilde)
      .map((p) => canonicalize(resolve(root, p)))
      .filter((p) => isInsideWorkspace(root, p));
    recordListingMarkers(resolved, sessionId);
  }

  // 6. Gating: collect workspace-interior targets of recursive deletes that
  //    are NOT exempt (tmpdir, or allowlist without a .git beneath).
  const gatedTargets: string[] = [];
  const suppressedTargets: string[] = [];
  for (const segment of segments) {
    const a = analyzeSegment(segment);
    if (!a.isRecursiveDelete) continue;
    for (const operand of a.deleteOperands) {
      const target = canonicalize(resolve(root, expandTilde(operand)));
      if (!isInsideWorkspace(root, target)) continue; // outside workspace — no opinion
      if (isInsideWorkspace(canonicalTmp, target)) continue; // tmpdir sanctioned for fixtures
      if (isAllowlisted(root, target)) {
        if (!hasGitBeneath(target)) continue; // regenerable artifact — allowed
        suppressedTargets.push(target); // .git beneath an allowlisted path — gated
        continue;
      }
      gatedTargets.push(target);
    }
  }

  if (gatedTargets.length === 0 && suppressedTargets.length === 0) {
    allowSilently();
    return;
  }

  // 7. Reviewed escape hatch (pre-push.ts ALLOW_REMOTE_BRANCH_DELETE=1
  //    precedent): bypass for this invocation.
  if (process.env.ALLOW_RECURSIVE_DELETE === '1') {
    console.error(`${TAG} ALLOW_RECURSIVE_DELETE=1 — gate bypassed for this invocation (reviewed escape).`);
    allowSilently();
    return;
  }

  // 8. Marker check: every gated target must have a fresh marker for the
  //    exact resolved path for the protocol to count as satisfied.
  const paths = [...gatedTargets, ...suppressedTargets];
  const markerSatisfied = sessionId !== '' && paths.every((p) => hasFreshMarker(p, sessionId));

  const reason = gateReason(paths, {
    suppressNote: suppressedTargets.length > 0,
    markerAck: markerSatisfied,
  });

  // 9. Verdict mapping (DEC-20261104-02 ruling 3): Claude = ask (exit 0,
  //    human confirms; marker never bypasses the ask; --mode deny
  //    hard-blocks), Gemini = deny (exit 2; a valid marker downgrades to
  //    allow — Manual terminal approval supplies the confirmation there).
  if (platform === 'gemini') {
    if (markerSatisfied) {
      allowSilently();
      return;
    }
    emitDeny(reason);
    return;
  }
  if (mode === 'deny') {
    emitDeny(reason);
    return;
  }
  emitAsk(reason);
}

// pre-push.ts precedent: main() guarded so unit tests can import the
// exported pure helpers without executing the hook body.
if (import.meta.main) {
  main();
}
