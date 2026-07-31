#!/usr/bin/env bun
/**
 * gateguard-fact-force.ts — Pre-edit fact-forcing quality gate.
 * Triggered by PreToolUse (Claude Code) or BeforeTool (Gemini CLI).
 * Blocks first edit per file per session until importers are investigated.
 *
 * Platform coverage:
 *   Claude Code CLI  — automatic via PreToolUse hook (ask mode)
 *   Claude Desktop App — should fire via bundled CLI (fallback: prompt)
 *   Gemini CLI       — automatic via BeforeTool hook (deny mode)
 *   Antigravity      — hooks do not fire (prompt enforcement)
 *
 * @version 1.0.0
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GATEKEEP_TAG = '[GATEGUARD]';

// Paths that are safe to edit without importer investigation
const SAFE_PATH_PREFIXES = ['memory/', 'CHANGELOG.md', '.git/', 'node_modules/'];

// Glob patterns passed to git grep to limit file types
const GIT_GREP_GLOBS = ['*.ts', '*.tsx', '*.js', '*.jsx'];

// Timeout for git grep: 3 seconds
const GREP_TIMEOUT_MS = 3000;

// ---------------------------------------------------------------------------
// Module-level state — tracks first edit per file per process
// ---------------------------------------------------------------------------

const _firstEditSeen = new Map<string, boolean>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize Windows backslashes to forward slashes for consistent matching. */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Extract basename without extension (e.g. "my-utils" from "/src/my-utils.ts"). */
function moduleFromPath(filePath: string): string {
  const b = basename(filePath);
  // Strip all extensions: "my-utils.ts" → "my-utils", "index.test.ts" → "index.test"
  const dotIdx = b.indexOf('.');
  return dotIdx === -1 ? b : b.slice(0, dotIdx);
}

/** Check if the file path is in the safe-list and should not be gated. */
function isSafePath(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return SAFE_PATH_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

/**
 * Synchronous search for importers using git grep via Bun.spawnSync.
 * git grep is fast (only searches tracked files) and avoids the ZCode
 * shell-function grep wrapper that breaks -E regex on this platform.
 * Returns array of matching file paths (unique).
 */
function findImporters(moduleName: string): string[] {
  // Build ERE pattern covering common import/require syntaxes.
  // git grep uses POSIX extended regex by default with -E.
  const extRegex =
    `from ['\"].*${moduleName}['\"]` +
    `|require\\(['\"].*${moduleName}['\"]\\)` +
    `|import ['\"].*${moduleName}['\"]`;

  const args: string[] = ['grep', '-l', '-E', extRegex];
  for (const glob of GIT_GREP_GLOBS) {
    args.push('--', glob);
  }

  const result = Bun.spawnSync(['git', ...args], {
    cwd: process.cwd(),
    timeout: GREP_TIMEOUT_MS,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // git grep exit code 1 = no matches (valid, empty result).
  // exit code 128/129 = not in a git repo or other git error.
  // success false with signal = timeout.
  if (!result.success) {
    return [];
  }
  if (result.exitCode === 1 || result.exitCode === 128 || result.exitCode === 129) {
    return [];
  }

  const stdout = result.stdout as Uint8Array;
  const output = new TextDecoder().decode(stdout);
  if (!output.trim()) return [];

  // git grep -l outputs one filepath per line (no colon-separated content).
  const importers = output
    .split('\n')
    .filter(Boolean)
    .map(p => normalizePath(p));

  return importers;
}

// ---------------------------------------------------------------------------
// Main — fully synchronous
// ---------------------------------------------------------------------------

function main(): void {
  // 1. Determine platform from CLI flag
  const args = process.argv.slice(2);
  const platformIdx = args.indexOf('--platform');
  const platform: 'claude' | 'gemini' =
    platformIdx !== -1 && args[platformIdx + 1] === 'gemini' ? 'gemini' : 'claude';

  // 2. Read all of stdin synchronously
  let stdinJson: string;
  try {
    stdinJson = readFileSync(0, 'utf-8'); // fd 0 = stdin
  } catch {
    // Cannot read stdin — don't block
    process.exit(0);
    return; // TypeScript unreachable guard
  }

  // 3. Parse JSON
  let data: { tool_name?: string; tool_input?: Record<string, unknown> };
  try {
    data = JSON.parse(stdinJson) as typeof data;
  } catch {
    // Malformed JSON — don't block
    process.exit(0);
    return;
  }

  // 4. Extract file path based on platform
  const toolInput = data.tool_input ?? {};
  let filePath: string | undefined;

  if (platform === 'claude') {
    filePath = toolInput.file_path as string | undefined;
  } else {
    filePath = toolInput.path as string | undefined;
  }

  if (!filePath) {
    process.exit(0);
    return;
  }

  const normalizedFile = normalizePath(filePath);

  // 5. Safe paths pass through without gating
  if (isSafePath(normalizedFile)) {
    process.exit(0);
    return;
  }

  // 6. Check if this is the first edit to this file in this process
  if (_firstEditSeen.has(normalizedFile)) {
    // Subsequent edit — pass through
    process.exit(0);
    return;
  }

  // Mark as seen
  _firstEditSeen.set(normalizedFile, true);

  // 7. First edit — search for importers
  const moduleName = moduleFromPath(normalizedFile);
  const importers = findImporters(moduleName);

  if (importers.length === 0) {
    // No importers — pass through, no investigation needed
    process.exit(0);
    return;
  }

  // 8. Importers found — block or ask depending on platform
  const importerList = importers.join(', ');
  const reason = `${GATEKEEP_TAG} First edit to '${normalizedFile}'. Found ${importers.length} importer(s): ${importerList}. Investigate importers before proceeding.`;

  if (platform === 'claude') {
    // Claude: ask mode — output JSON to stdout, exit 0
    const response = { decision: 'ask' as const, reason };
    process.stdout.write(JSON.stringify(response) + '\n');
    process.exit(0);
  } else {
    // Gemini: deny mode — output JSON to stdout, exit 2
    const response = { decision: 'deny' as const, reason };
    process.stdout.write(JSON.stringify(response) + '\n');
    process.exit(2);
  }
}

// Execute synchronously — no async, no import.meta.main guard needed
// (this script is always the entry point when invoked as a hook)
main();
